# RoyalEntry

Multi-tenant SaaS event guest management platform (Rust/Axum backend + Next.js/React/TS frontend).

## Architecture (SaaS structure)

- **Platform scope** (`superadmin`, `platform_admin`, `system_admin`): cross-tenant
  SaaS operations — customers, subscriptions, invoices, tax/TRA, system settings,
  all-tenant reports/audit. Endpoints under `/api/v1/platform/*`,
  `/api/v1/settings/system`, and reports/audit.
- **Account scope** (`account_admin`, `event_manager`, `event_accountant`,
  `secretary`, `scanner_attendant`, `viewer`): tenant-scoped. The backend
  auto-scopes to the caller's `organization_id` from the JWT; account users cannot
  pass `organization_id` (it is overridden).

RBAC source of truth: `backend/crates/cloud/src/utils/rbac.rs`. The frontend
mirrors it in `frontend-next/src/lib/roles.ts` — keep these in sync when changing
roles.

## Build & verify

Backend (Rust):
```bash
cd backend
cargo check          # type/compile check
cargo run            # apply migrations + serve on :3000 (loads ../.env)
```

Frontend (Next.js + Tailwind):
```bash
cd frontend-next
npm run build        # next build  (use this to verify)
npm run dev          # dev server on :3001 (proxies /api/* to backend :3000)
```

Deploy: `./deploy.sh` at the repo root (pull from GitHub → build → restart).

## Database

PostgreSQL. Migrations live in `backend/migrations/` and run automatically on
startup via sqlx. Notable: `0006` (settings/audit), `0025` (card template
visibility), `0026` (invoice voided_at), `0027` (invoice tax), `0028`
(telegram_chat_id + email templates), `0029` (org_subscriptions notes fix),
`0030` (account security), `0031` (guest email verification).

## Key conventions

- Tailwind brand colors are `navy.*` and `gold.*` (see
  `frontend-next/tailwind.config.js`). `navy.950` MUST be defined — the sidebar
  gradient depends on it.
- API responses use `{ success, data, ... }` envelope; paginated endpoints add
  `{ pagination: { page, per_page, total, total_pages } }`.
- Frontend API client: `frontend-next/src/lib/api.ts` (axios, baseURL `/api/v1`).
  Pages in `frontend-next/src/pages/`; shared components in `frontend-next/src/components/`.
- Settings hub: `frontend-next/src/pages/platform/settings/index.tsx` — vertical
  tabs, each section a component in `frontend-next/src/components/settings/sections/`.
- Offline-first: `frontend-next/src/lib/offline.ts` (mutation queue) +
  `frontend-next/src/lib/cache.ts` (GET read cache) + `scannerOffline.ts`
  (offline scanning). Works in browser and the Tauri desktop app.
- Secrets are write-only: `GET /settings/system` masks `sms_api_key`,
  `whatsapp_access_token`, `tax_tra_api_key`, `tax_tra_secret_key`,
  `telegram_bot_token` as `********`. Never expose them via `NEXT_PUBLIC_*`.
- Security: rate-limited auth/OTP, account lockout after 5 failed logins, forced
  password change for the default admin, 2h access tokens, M-Pesa callback
  idempotency, DB-backed `/health`.