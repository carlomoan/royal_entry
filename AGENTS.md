# RoyalEntry

Multi-tenant SaaS event guest management platform (Rust/Axum backend + React/TS frontend).

## Architecture (SaaS structure)

- **Platform scope** (`system_admin`, `superadmin`, `admin`): cross-tenant SaaS
  operations — customers, subscriptions, invoices, system settings, all-tenant
  reports/audit. Endpoints under `/api/v1/platform/*`, `/api/v1/settings/system`,
  and reports/audit accept an optional `organization_id` filter for platform admins.
- **Account scope** (`account_admin`, `organizer`, `mc`, `door_staff`, `viewer`):
  tenant-scoped. The backend auto-scopes to the caller's `organization_id` from
  the JWT; account users cannot pass `organization_id` (it is overridden).

RBAC source of truth: `backend/src/utils/rbac.rs`. The frontend mirrors it in
`frontend/src/utils/roles.ts` — keep these in sync when changing roles.

## Build & verify

Backend (Rust):
```bash
cd backend
cargo check          # type/compile check
cargo run            # apply migrations + serve on :3000 (loads ../.env)
```

Frontend (React + Vite + Tailwind):
```bash
cd frontend
npm run build        # tsc -b && vite build  (use this to verify)
npm run dev          # dev server
```

## Database

PostgreSQL. Migrations live in `backend/migrations/` and run automatically on
startup via sqlx. `0006_create_settings_and_audit.sql` creates `audit_logs`,
`system_settings`, and `organization_settings`.

## Key conventions

- Tailwind brand colors are `navy.*` and `gold.*` (see `tailwind.config.ts`).
  `navy.950` MUST be defined — the sidebar gradient depends on it.
- API responses use `{ success, data, ... }` envelope; paginated endpoints add
  `{ pagination: { page, per_page, total, total_pages } }`.
- Frontend API clients live in `frontend/src/api/`; pages in `frontend/src/pages/`.
