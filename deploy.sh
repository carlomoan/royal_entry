#!/usr/bin/env bash
# ==============================================================================
# deploy.sh — Pull the latest RoyalEntry changes from GitHub and rebuild +
# restart the backend and frontend on this (production) server.
#
# Usage:
#   ./deploy.sh                # full update (pull → build backend → build frontend → restart)
#   ./deploy.sh --backend-only # only update + restart the Rust API
#   ./deploy.sh --frontend-only# only update + restart the Next.js app
#   ./deploy.sh --rebuild      # skip pull (only if already on the latest commit)
#
# Notes:
#   * The deploy user must own the repo and be able to write to backend/ and
#     frontend-next/ (they own the build outputs). Run via sudo only if needed.
#   * Secrets live in backend/.env (or ./env at repo root) and are gitignored —
#     this script never touches them, and refuses to start the backend without
#     a .env file present.
#   * DB migrations run automatically when the backend starts.
#   * Rollback:  git reset --hard <previous_commit>  && ./deploy.sh --rebuild
# ==============================================================================
set -euo pipefail

# ── Locations & config ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"                 # repo root (script lives in <root>/scripts or <root>)
if [ ! -d "$ROOT/backend" ] || [ ! -d "$ROOT/frontend-next" ]; then
  ROOT="$SCRIPT_DIR"                                  # script itself is at repo root
fi
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend-next"
LOG_DIR="${DEPLOY_LOG_DIR:-$ROOT/logs}"
BACKEND_BIN="$BACKEND_DIR/target/release/royalentry"
BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"

DO_BACKEND="true"
DO_FRONTEND="true"
DO_PULL="true"
for arg in "$@"; do
  case "$arg" in
    --backend-only) DO_FRONTEND="false" ;;
    --frontend-only) DO_BACKEND="false" ;;
    --rebuild) DO_PULL="false" ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '    \033[1;32mOK\033[0m %s\n' "$*"; }
warn() { printf '    \033[1;33mWARN\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR\033[0m %s\n' "$*" >&2; exit 1; }

# ── Pre-flight ────────────────────────────────────────────────────────────────
cd "$ROOT"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository"
command -v cargo >/dev/null || die "cargo not found — install the Rust toolchain"
command -v npm  >/dev/null || die "npm not found — install Node.js"
mkdir -p "$LOG_DIR"

OLD_COMMIT="$(git rev-parse --short HEAD)"

# ── Pull from GitHub ─────────────────────────────────────────────────────────
if [ "$DO_PULL" = "true" ]; then
  log "Fetching $REMOTE/$BRANCH from GitHub"
  git fetch "$REMOTE" "$BRANCH" || die "git fetch failed — check network access to GitHub"

  LOCAL="$(git rev-parse HEAD)"
  REMOTE_SHA="$(git rev-parse "$REMOTE/$BRANCH")"
  if [ "$LOCAL" = "$REMOTE_SHA" ]; then
    ok "Already on the latest commit ($(git rev-parse --short HEAD))"
    [ "$DO_BACKEND" = "true" ] && [ "$DO_FRONTEND" = "true" ] \
      && warn "Nothing to do — rerun with --rebuild to force a rebuild, or press on." 
    if [ "$DO_BACKEND" != "true" ] || [ "$DO_FRONTEND" != "true" ]; then
      : # a partial update was requested; continue with the build anyway
    else
      exit 0
    fi
  fi

  log "Pulling $REMOTE/$BRANCH (fast-forward only)"
  if ! git pull --ff-only "$REMOTE" "$BRANCH"; then
    # Git never clobbers local work; give actionable guidance.
    git status --short
    die "Pull failed — local files conflict with incoming changes. Commit or stash them, then re-run."
  fi
  ok "Updated $(git rev-parse --short HEAD) (was $OLD_COMMIT)"
else
  warn "--rebuild: skipping git pull"
fi

NEW_COMMIT="$(git rev-parse --short HEAD)"

# ── Backend ──────────────────────────────────────────────────────────────────
restart_backend() {
  # Prefer systemd if a unit exists, else manage the process directly.
  for unit in royalentry royalentry-api royalentry-backend; do
    if systemctl list-unit-files --no-legend 2>/dev/null | grep -qE "^${unit}(\\.service)?[[:space:]]"; then
      log "Restarting systemd unit: $unit"
      systemctl restart "$unit" && return 0
      warn "systemctl restart $unit failed — falling back to process restart"
    fi
  done

  pkill -f "target/release/royalentry" 2>/dev/null || true
  sleep 1
  cd "$BACKEND_DIR"
  nohup "$BACKEND_BIN" >>"$LOG_DIR/backend.log" 2>&1 &
  cd "$ROOT"
  ok "Backend started (pid $!; log: $LOG_DIR/backend.log)"
}

if [ "$DO_BACKEND" = "true" ]; then
  log "Building backend (release)"
  cd "$BACKEND_DIR"
  cargo build --release -p royalentry-cloud
  [ -x "$BACKEND_BIN" ] || die "Backend binary missing after build: $BACKEND_BIN"
  cd "$ROOT"

  # Secrets must exist before we (re)start the API.
  if [ -f "$BACKEND_DIR/.env" ]; then ENV_FILE="$BACKEND_DIR/.env"
  elif [ -f "$ROOT/.env" ]; then ENV_FILE="$ROOT/.env"
  else die "No .env found (backend/.env or ./.env) — refusing to start the backend"; fi
  ok "Using env: $ENV_FILE"

  restart_backend

  # Health check (migrations apply on startup, so wait a moment).
  BPORT="$(grep -E '^SERVER_PORT=' "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2 | tr -d '[:space:]' || true)"
  BPORT="${BPORT:-3000}"
  ok "Waiting for backend health on 127.0.0.1:$BPORT/health"
  UP="false"
  for _ in $(seq 1 20); do
    if curl -fsS -m 2 "http://127.0.0.1:$BPORT/health" >/dev/null 2>&1; then UP="true"; break; fi
    sleep 1
  done
  if [ "$UP" != "true" ]; then
    warn "Backend did not become healthy — last log lines:"
    tail -n 20 "$LOG_DIR/backend.log" 2>/dev/null || tail -n 20 /dev/null
    die "Backend failed to start (migrations are the usual suspect — check the log)."
  fi
  ok "Backend healthy"
fi

# ── Frontend ─────────────────────────────────────────────────────────────────
restart_frontend() {
  for unit in royalentry-frontend royalentry-web royalentry-next; do
    if systemctl list-unit-files --no-legend 2>/dev/null | grep -qE "^${unit}(\\.service)?[[:space:]]"; then
      log "Restarting systemd unit: $unit"
      systemctl restart "$unit" && return 0
      warn "systemctl restart $unit failed — falling back to process restart"
    fi
  done

  pkill -f "next-server" 2>/dev/null || true
  pkill -f "next start"  2>/dev/null || true
  sleep 1
  cd "$FRONTEND_DIR"
  nohup npm run start >>"$LOG_DIR/frontend.log" 2>&1 &
  cd "$ROOT"
  ok "Frontend started (pid $!; log: $LOG_DIR/frontend.log)"
}

if [ "$DO_FRONTEND" = "true" ]; then
  log "Installing + building frontend"
  cd "$FRONTEND_DIR"
  [ -f package-lock.json ] && npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  npm run build
  cd "$ROOT"

  restart_frontend

  FPORT="$(grep -E 'start.*-p ' "$FRONTEND_DIR/package.json" 2>/dev/null | grep -oE '\-p [0-9]+' | grep -oE '[0-9]+' | head -n1 || true)"
  FPORT="${FPORT:-3001}"
  ok "Waiting for frontend on http://127.0.0.1:$FPORT"
  UP="false"
  for _ in $(seq 1 15); do
    if curl -fsS -m 2 -o /dev/null "http://127.0.0.1:$FPORT/login" 2>/dev/null; then UP="true"; break; fi
    sleep 1
  done
  if [ "$UP" != "true" ]; then
    warn "Frontend did not respond — last log lines:"
    tail -n 20 "$LOG_DIR/frontend.log" 2>/dev/null || true
    die "Frontend failed to start — check the log."
  fi
  ok "Frontend healthy"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
cat <<EOF

Deployment finished:
  repo      : $ROOT
  commit    : $OLD_COMMIT -> $NEW_COMMIT
  backend   : $([ "$DO_BACKEND" = "true" ] && echo restarted || echo skipped)
  frontend  : $([ "$DO_FRONTEND" = "true" ] && echo restarted || echo skipped)
  logs      : $LOG_DIR

Rollback: git reset --hard $OLD_COMMIT && ./deploy.sh --rebuild
EOF