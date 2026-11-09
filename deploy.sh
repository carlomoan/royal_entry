#!/usr/bin/env bash
# ==============================================================================
# deploy.sh — update RoyalEntry on the production server.
#
# Run as root:   ./deploy.sh [--backend-only | --frontend-only | --rebuild]
#
#   (no flag)        pull from GitHub, then rebuild + restart what is needed
#   --backend-only   only the Rust API
#   --frontend-only  only the Next.js app
#   --rebuild        skip the pull and rebuild the current commit
#
# Root is used only for systemctl and the database backup. Git and every build
# run as $DEPLOY_USER, so no root-owned files appear in the repo (that is what
# broke `next build` with EACCES) and git's "dubious ownership" check passes.
#
# Settings below can be overridden from the environment, e.g.
#   FRONTEND_PORT=3002 ./deploy.sh
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_USER="${DEPLOY_USER:-foctek}"
REMOTE="${DEPLOY_REMOTE:-origin}"
BRANCH="${DEPLOY_BRANCH:-main}"
BACKEND_UNIT="${BACKEND_UNIT:-royalentry-backend}"
FRONTEND_UNIT="${FRONTEND_UNIT:-royalentry-frontend}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3002}"
DB_NAME="${DB_NAME:-royalentry_db}"
BACKUP_DIR="${BACKUP_DIR:-/root/royalentry-backups}"
BIN="$ROOT/backend/target/release/royalentry"

DO_BACKEND=true
DO_FRONTEND=true
DO_PULL=true
for arg in "$@"; do
  case "$arg" in
    --backend-only)  DO_FRONTEND=false ;;
    --frontend-only) DO_BACKEND=false ;;
    --rebuild)       DO_PULL=false ;;
    -h|--help)       sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '    \033[1;32mOK\033[0m %s\n' "$*"; }
warn() { printf '    \033[1;33mWARN\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR\033[0m %s\n' "$*" >&2; exit 1; }

git_u() { sudo -u "$DEPLOY_USER" -H git -C "$ROOT" "$@"; }
run_u() { sudo -u "$DEPLOY_USER" -i bash -c "$1"; }   # login shell: finds cargo / node

wait_for() {  # wait_for <url> <seconds>
  local i
  for i in $(seq 1 "$2"); do
    if curl -fsS -m 2 -o /dev/null "$1" 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

# ── Pre-flight ────────────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || die "Run as root (./deploy.sh). Git and builds run as $DEPLOY_USER automatically."
id "$DEPLOY_USER" >/dev/null 2>&1 || die "User $DEPLOY_USER does not exist"
[ -d "$ROOT/backend" ] && [ -d "$ROOT/frontend-next" ] || die "Run this from the repo root ($ROOT has no backend/ or frontend-next/)"
git_u rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$ROOT is not a git repository"

if find "$ROOT" ! -user "$DEPLOY_USER" -print -quit | grep -q .; then
  warn "Files not owned by $DEPLOY_USER found; fixing ownership"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ROOT"
fi

OLD="$(git_u rev-parse --short HEAD)"

# ── Pull ──────────────────────────────────────────────────────────────────────
if [ "$DO_PULL" = true ]; then
  CUR="$(git_u branch --show-current)"
  [ "$CUR" = "$BRANCH" ] || die "Server is on branch '$CUR', expected '$BRANCH'. Switch with: sudo -u $DEPLOY_USER git -C $ROOT checkout $BRANCH"
  if [ -n "$(git_u status --porcelain --untracked-files=no)" ]; then
    git_u status --short --untracked-files=no
    die "Uncommitted changes on the server. Commit or stash them first (never edit production directly)."
  fi
  log "Fetching $REMOTE/$BRANCH"
  git_u fetch "$REMOTE" "$BRANCH" || die "git fetch failed (network or deploy key problem)"
  if [ "$(git_u rev-parse HEAD)" = "$(git_u rev-parse "$REMOTE/$BRANCH")" ]; then
    ok "Already up to date at $OLD. Use --rebuild to rebuild this commit."
    exit 0
  fi
  log "Pulling (fast-forward only)"
  git_u pull --ff-only "$REMOTE" "$BRANCH" || die "Pull failed: server and GitHub have diverged. Nothing was changed."
fi
NEW="$(git_u rev-parse --short HEAD)"
ok "Commit: $OLD -> $NEW"

# ── Migration safety check ────────────────────────────────────────────────────
# An already-applied migration that was edited makes the backend refuse to start
# (sqlx VersionMismatch). Catch that before anything is restarted.
check_migrations() {
  local f v h db bad=0
  for f in "$ROOT"/backend/migrations/*.sql; do
    v=$((10#$(basename "$f" | cut -d_ -f1)))
    h="$(sha384sum "$f" | cut -d' ' -f1)"
    db="$(cd /tmp && sudo -u postgres psql "$DB_NAME" -Atc "select encode(checksum,'hex') from _sqlx_migrations where version=$v" 2>/dev/null || true)"
    if [ -n "$db" ] && [ "$db" != "$h" ]; then
      warn "Applied migration was modified: $(basename "$f")"
      bad=1
    fi
  done
  [ "$bad" = 0 ] || die "Put schema changes in a NEW numbered migration; never edit an applied one."
  ok "Migration checksums match"
}

# ── Backend ───────────────────────────────────────────────────────────────────
if [ "$DO_BACKEND" = true ]; then
  log "Checking migrations"
  check_migrations

  log "Backing up database and current binary to $BACKUP_DIR"
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  STAMP="$(date +%F_%H%M)"
  (cd /tmp && sudo -u postgres pg_dump "$DB_NAME") > "$BACKUP_DIR/db_$STAMP.sql"
  chmod 600 "$BACKUP_DIR/db_$STAMP.sql"
  if [ -f "$BIN" ]; then cp "$BIN" "$BACKUP_DIR/royalentry.bin_$STAMP"; fi
  ok "Backup: $BACKUP_DIR/db_$STAMP.sql"

  log "Building backend (release) as $DEPLOY_USER"
  run_u "cd '$ROOT/backend' && cargo build --release"
  [ -x "$BIN" ] || die "Backend binary missing after build: $BIN"

  log "Restarting $BACKEND_UNIT"
  systemctl reset-failed "$BACKEND_UNIT" 2>/dev/null || true
  systemctl restart "$BACKEND_UNIT"
  if wait_for "http://127.0.0.1:$BACKEND_PORT/health" 30; then
    ok "Backend healthy on :$BACKEND_PORT"
  else
    journalctl -u "$BACKEND_UNIT" -n 25 --no-pager || true
    die "Backend did not become healthy. Roll back: copy $BACKUP_DIR/royalentry.bin_$STAMP over $BIN and restart $BACKEND_UNIT (restore the DB dump too if new migrations were applied)."
  fi
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
if [ "$DO_FRONTEND" = true ]; then
  NEEDS_INSTALL=false
  [ -d "$ROOT/frontend-next/node_modules" ] || NEEDS_INSTALL=true
  git_u diff --quiet "$OLD" "$NEW" -- frontend-next/package.json frontend-next/package-lock.json || NEEDS_INSTALL=true
  if [ "$NEEDS_INSTALL" = true ]; then
    log "Installing frontend dependencies"
    run_u "cd '$ROOT/frontend-next' && npm ci --no-audit --no-fund"
  fi

  # NEXT_PUBLIC_* values are baked in at build time, so a rebuild is required
  # whenever frontend-next/.env.local changes.
  log "Building frontend as $DEPLOY_USER"
  run_u "cd '$ROOT/frontend-next' && npm run build"

  log "Restarting $FRONTEND_UNIT"
  systemctl reset-failed "$FRONTEND_UNIT" 2>/dev/null || true
  systemctl restart "$FRONTEND_UNIT"
  if wait_for "http://127.0.0.1:$FRONTEND_PORT/login" 30; then
    ok "Frontend healthy on :$FRONTEND_PORT"
  else
    journalctl -u "$FRONTEND_UNIT" -n 25 --no-pager || true
    die "Frontend did not respond on :$FRONTEND_PORT. Check the log above."
  fi
fi

cat <<EOF

Deployment finished:
  commit    : $OLD -> $NEW
  backend   : $([ "$DO_BACKEND" = true ] && echo restarted || echo skipped)
  frontend  : $([ "$DO_FRONTEND" = true ] && echo restarted || echo skipped)

Rollback: sudo -u $DEPLOY_USER git -C $ROOT reset --hard $OLD && ./deploy.sh --rebuild
EOF
