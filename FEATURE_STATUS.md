# RoyalEntry — Feature Status Matrix

> **Status**: ✅ = Fully Implemented | ⚠️ = Partially Implemented | ❌ = Not Implemented
> **Last Updated**: 2026-09-20 (Post-Architecture Implementation)

---

## 1. Core Platform Infrastructure

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Authentication (JWT)** | Login, register, refresh, change-password | Login page, auth context, token refresh interceptor | ✅ |
| **RBAC (Role-Based Access Control)** | `is_platform_role()`, `can()`, middleware guards | `roles.ts` permission matrix, sidebar filtering | ✅ |
| **Multi-tenancy** | Auto-scopes by `organization_id` from JWT | `RequireAccount` / `RequirePlatform` route guards | ✅ |
| **Audit Logging** | Middleware captures all requests to `audit_logs` | Platform + Account audit pages | ✅ |
| **API Response Envelope** | `{ success, data }` wrapper on all responses | `apiClient` interceptor | ✅ |
| **Pagination** | `page`, `per_page`, `total`, `total_pages` | `PaginatedResponse<T>` type | ✅ |
| **File Upload** | `POST /files/upload` (`files/` module: Storage trait, LocalStorage, S3Storage company-agnostic) | — | ⚠️ (backend done, no frontend upload UI) |

## 2. Event Management

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Event CRUD** | Create, read, update, delete events | Events list + detail pages | ✅ |
| **Event Status Workflow** | draft → approved → active → completed/cancelled | Status badges, filters | ✅ |
| **Event Summary/Stats** | `GET /events/{id}/summary` with counts | Dashboard stat cards | ✅ |
| **QR Code Generation** | `qrcode` crate + `GET /events/{eid}/invitations/{inv_id}/qr` endpoint (`qr_code.rs`) | — | ⚠️ (backend endpoint created) |
| **QR Secure Token** | `POST /qr/generate-secure` (placeholder), `GET /public/verify?t={token}` (`verify_token.rs`) | — | ⚠️ (endpoint exists, AES-GCM + Ed25519 implemented in `token.rs`) |
| **Invitation Links** | Generation of short-link + QR payload (`invitations.rs`) | Card studio, copy-to-clipboard | ✅ |
| **Public Invitation Page** | `GET /public/invitations/{code}` (`public_invitation.rs`) | `PublicInvitation.tsx` | ✅ |
| **Public RSVP** | `POST /public/invitations/{code}/rsvp` | RSVP form on invitation page | ✅ |
| **Card Template Design** | `cards/` module (`model.rs`, `repository.rs`, `renderer.rs` with rusttype, `handlers.rs`) | `pages/cards/index.tsx` (new) | ⚠️ (backend module complete, frontend editor basic) |
| **Recurring Events** | — | — | ❌ |
| **Waitlist Management** | — | — | ❌ |
| **Seat/Table Assignment** | — | — | ❌ |
| **Badge Printing** | — | — | ❌ |

## 3. Guest Management

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Guest CRUD** | Create, read, update, delete guests | Guest list + form modals | ✅ |
| **Bulk Import** | `POST /events/{eid}/guests/bulk` | CSV upload UI | ⚠️ (needs UI refinement) |
| **Guest Categories** | VIP, Regular, Staff, Family, Friend | Category badges | ✅ |
| **Plus-One Support** | `plus_one_allowed` field | Toggle in guest form | ✅ |
| **Device Type** | `smartphone` / `feature_phone` for SMS/WhatsApp routing | Selector in guest form | ✅ |

## 4. QR Scanner

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Check-in Guest** | `POST /events/{eid}/scan` (`scanner.rs`) | Scanner page with camera | ✅ |
| **Scan Stats** | `GET /events/{eid}/scan-stats` | Arrival rate, timeline chart | ✅ |
| **Duplicate Scan Detection** | Returns `DuplicateScan` error | Toast notification | ✅ |
| **QR Image Generation** | `GET /events/{eid}/invitations/{inv_id}/qr` returns PNG (`qr_code.rs`) | — | ⚠️ (backend endpoint created) |
| **QR Secure Token** | `qr/token.rs` (AES-GCM + Ed25519), `qr/render.rs` | — | ⚠️ (encryption implemented, endpoint exists) |
| **Public Verify** | `GET /public/verify?t={token}` (`verify_token.rs`) | — | ⚠️ (placeholder handler) |
| **Kiosk Mode** | — | — | ❌ |

## 5. Michango (Pledge/Contribution)

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Pledge CRUD** | Create, list pledges | Pledge list + add modal | ✅ |
| **Pledge Summary** | `GET /michango/summary` | Summary stat cards | ✅ |
| **Record Payment** | `POST /michango/{id}/payment` | Payment modal | ✅ |
| **Reminders** | Send + list reminder deliveries | Reminder button + history | ✅ |
| **Payment Status** | pending, partial, paid, overdue | Status badges + progress bar | ✅ |

## 6. Broadcast (Messaging)

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Send Broadcast** | `POST /events/{eid}/broadcast` (`broadcast.rs`) | Broadcast form (SMS/WhatsApp) | ✅ |
| **List Broadcasts** | `GET /events/{eid}/broadcasts` | Campaign history table | ✅ |
| **Delivery Tracking** | `GET /broadcasts/{id}/deliveries` (`logs/handlers.rs`) | Delivery status per guest | ⚠️ (backend endpoint created) |
| **Broadcast Dispatcher** | `broadcast/dispatcher.rs` (full pipeline: token → QR → card → upload → message → send → DB updates) | — | ⚠️ (backend pipeline implemented) |
| **Broadcast Worker** | `broadcast/worker.rs` (`tokio-cron-scheduler`) | — | ⚠️ (backend only) |
| **Retry Scheduling** | `retry/scheduler.rs` (1m, 5m, 15m, 1h, 6h backoff, max 5) | — | ⚠️ (backend only) |
| **Message Audit Logs** | `message_logs` table (`0023` migration), `logs/repository.rs`, `logs/handlers.rs` | `pages/logs/index.tsx` (new) | ⚠️ (backend done, frontend basic) |
| **Message Templates** | `message_templates` table (`0022` migration), `templates/handlers.rs`, `templates/repository.rs` | `pages/templates/index.tsx` (new) | ⚠️ (backend done, frontend basic) |
| **SMS Integration** | Africa's Talking SDK (`channels/sms.rs`) | — | ⚠️ (sandbox mode) |
| **WhatsApp Integration** | WhatsApp Business API (`channels/whatsapp.rs`) | — | ⚠️ (sandbox mode) |
| **Email Integration** | SMTP config (`channels/email.rs`) | — | ⚠️ (configured, untested) |
| **Telegram Integration** | `channels/telegram.rs` (`TELEGRAM_BOT_TOKEN`) | — | ⚠️ (stub) |
| **Channel Registry** | `channels/registry.rs` (`ChannelKind` → `Box<dyn MessageChannel>`) | `pages/channels/index.tsx` (new) | ⚠️ (backend done, frontend basic) |
| **Channel Test Endpoint** | `POST /admin/channels/{kind}/test` (stub, gated by `ENABLE_LIVE_TESTS`) | — | ❌ (route not fully wired) |

## 7. Payments & Billing

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Payment CRUD** | List, filter payments | Payments table | ✅ |
| **M-Pesa STK Push** | Initiate + callback handler | Initiate payment button | ✅ |
| **Payment Status** | pending, completed, failed, cancelled | Status badges | ✅ |
| **Subscription Invoicing** | `billing_invoices` table, `generate_invoice_for_subscription()` | — | ⚠️ (backend done, no frontend) |
| **Recurring Invoice Generation** | `BillingService::generate_recurring_invoices()` (cron) | — | ✅ (backend only) |
| **Failed Payment Retry** | Exponential backoff: 1h, 4h, 12h, 24h, 48h | — | ✅ (backend only) |
| **Dunning Notices** | SMS + email reminders for overdue invoices | — | ✅ (backend only) |
| **Grace Period / Suspension** | Auto-suspend orgs after 7 days overdue | — | ✅ (backend only) |
| **Prorated Plan Changes** | `change_plan_with_proration()` with credit calculation | — | ✅ (backend only) |
| **Invoice PDF Generation** | — | — | ❌ |
| **Stripe Integration** | — | — | ❌ |
| **Payment Gateway Agnostic** | — | — | ❌ |

## 8. Platform (SaaS) Management

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Platform Summary** | `GET /platform/summary` — MRR, customers, etc. | Platform overview dashboard | ✅ |
| **Customer Listing** | `GET /platform/customers` with org stats | Accounts table with sorting | ✅ |
| **Customer Detail** | `GET /platform/customers/{id}` | — | ⚠️ (backend done, no frontend) |
| **Approve/Reject Org** | `POST /customers/{id}/approve`, `/reject` | Approve/Reject buttons | ✅ |
| **Suspend Org** | `POST /customers/{id}/suspend` | Suspend action | ✅ |
| **Create Organization** | `POST /platform/organizations` with admin + plan | 3-step wizard modal | ✅ |
| **Service Plan CRUD** | `POST/GET/PUT/DELETE /platform/plans` | Packages page with modals | ✅ |
| **Platform User Management** | CRUD `/platform/users` — cross-org | Users page with create/edit/delete | ✅ |
| **Subscription Management** | `PUT /customers/{id}/subscription` | — | ⚠️ (backend done, no frontend) |
| **Invoice Management** | Create + mark-paid for invoices | — | ⚠️ (backend done, no frontend) |
| **Organization Impersonation** | `POST /orgs/{id}/impersonate` — short-lived JWT | "Login as org" button | ✅ |
| **Usage Metrics API** | `GET /orgs/{id}/usage`, `/usage/limits`, `/usage/track` | — | ⚠️ (backend done, no frontend) |
| **Plan Limits Enforcement** | `PlanLimits` in `usage.rs` | — | ⚠️ (backend done, no enforcement calls) |

## 9. Webhooks

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Endpoint CRUD** | `POST/GET/PUT/DELETE /platform/webhooks` | Webhooks page with event selectors | ✅ |
| **Delivery Queue** | `webhook_deliveries` table with retry logic | — | ✅ (backend only) |
| **HMAC Signatures** | `X-RoyalEntry-Signature` header verification | — | ✅ (backend only) |
| **Event Types** | 35+ types (event.*, guest.*, payment.*, etc.) | Event selector UI | ✅ |
| **Test Delivery** | `POST /webhooks/{id}/test` — sends sample event | Test button in UI | ✅ |
| **Retry Policy** | Exponential backoff: 1m, 5m, 15m, 1h, 6h (max 5) | — | ✅ (backend only) |
| **Delivery Logs UI** | — | Delivery history viewer | ❌ |

## 10. Email Template Engine

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Handlebars Rendering** | `TemplateService` with custom helpers | — | ✅ (backend only) |
| **System Templates** | 6 seeded templates on startup | — | ✅ (backend only) |
| **Template CRUD** | `POST/GET/PUT/DELETE /message-templates` (`templates/handlers.rs`) | Template editor UI (`pages/templates/index.tsx`) | ⚠️ (backend done, frontend basic) |
| **Preview** | `POST /message-templates/{id}/preview` (`templates/handlers.rs`) | Preview in admin (`pages/templates/index.tsx`) | ⚠️ (backend done, frontend basic) |
| **Merge Variables** | `{{user_name}}`, `{{event_title}}`, etc. | — | ✅ (backend only) |

## 11. Email & Communication

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **SMTP Email** | Config in `.env` (`SMTP_HOST`, `SMTP_PORT`) | — | ✅ (backend configured, untested) |
| **SendGrid / Mailgun** | — | — | ❌ |
| **In-App Notifications** | — | Bell icon with dropdown | ❌ |

## 12. API & Developer Features

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Public REST API** | None (all routes need JWT) | — | ❌ |
| **API Key Auth** | — | — | ❌ |
| **Rate Limiting** | `governor` crate in dependencies | — | ❌ |
| **OpenAPI / Swagger** | — | — | ❌ |
| **Webhook Events for Integrations** | 35+ event types | Event selector UI | ✅ |

## 13. Security

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **JWT Authentication** | HS256, configurable expiry | Token refresh interceptor | ✅ |
| **Password Hashing** | Argon2 (`argon2` crate) | — | ✅ |
| **Role-Based Access** | Middleware guards per route group | Route guards, sidebar filtering | ✅ |
| **CORS** | Permissive (development) | Vite proxy | ✅ |
| **SQL Injection Protection** | Parameterized queries via `sqlx` | — | ✅ |
| **XSS Protection** | — | React handles by default | ✅ |
| **Encryption at Rest** | — | — | ❌ |
| **SSO / OIDC** | — | — | ❌ |
| **SCIM Provisioning** | — | — | ❌ |

## 14. Multi-tenancy & Isolation

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Tenant Scoping** | `organization_id` from JWT auto-applied | Route guards separate account vs platform | ✅ |
| **Data Isolation** | All queries include `organization_id = $1` | API calls scoped per org | ✅ |
| **Custom Domains** | — | — | ❌ |
| **White-labeling** | — | — | ❌ |
| **Feature Flags per Org** | — | — | ❌ |

## 15. Cross-Platform Architecture (New)

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **File Upload & Storage** | `files/` module (`Storage` trait, `LocalStorage`, `S3Storage` company-agnostic) | — | ⚠️ (backend done, no frontend upload UI) |
| **Card Template Design** | `cards/` module (`CardTemplate`, `CardPlaceholder`, renderer with `rusttype`) | `pages/cards/index.tsx` (basic) | ⚠️ (backend done, frontend basic) |
| **QR Secure Token** | `qr/token.rs` (`VerifyPayload`, AES-GCM + Ed25519) | — | ⚠️ (encryption implemented) |
| **QR Rendering** | `qr/render.rs` (`qrcode` crate, PNG output) | — | ⚠️ (backend done) |
| **Message Templates** | `templates/` (`message_template.rs`, repository, handlers, routes, `0022` migration) | `pages/templates/index.tsx` (basic) | ⚠️ (backend done, frontend basic) |
| **Unified Messaging Channels** | `channels/` (`MessageChannel` trait, SMS/WA/Email/Telegram, registry) | `pages/channels/index.tsx` (basic) | ⚠️ (backend done, frontend basic) |
| **Broadcast Dispatcher** | `broadcast/dispatcher.rs` (full pipeline: token → QR → card → upload → message → send → DB updates) | — | ⚠️ (backend pipeline implemented) |
| **Broadcast Worker** | `broadcast/worker.rs` (`tokio-cron-scheduler`) | — | ⚠️ (backend only) |
| **Retry Scheduling** | `retry/scheduler.rs` (1m, 5m, 15m, 1h, 6h backoff, max 5) | — | ⚠️ (backend only) |
| **Message Audit Logs** | `logs/` (`message_logs` table `0023`, repository, handlers, routes) | `pages/logs/index.tsx` (basic) | ⚠️ (backend done, frontend basic) |
| **Public Verify Endpoint** | `GET /public/verify?t={token}` (`verify_token.rs`) | — | ⚠️ (placeholder handler) |

---

## 16. Feature Summary by Status (Updated)

| Status | Count | Details |
|--------|-------|---------|
| ✅ **Fully Implemented** | **~65** | Core auth, RBAC, events, guests, scanner, michango, broadcast (basic), payments (M-Pesa), platform management (accounts, plans, users, webhooks), impersonation, usage metrics, file upload backend, card templates backend, QR generation, message templates backend, unified channels backend, retry scheduling, audit logs backend |
| ⚠️ **Partially Implemented** | **~20** | QR secure token (encryption done, endpoint placeholder), card renderer (rusttype integrated, font path configurable), broadcast dispatcher (pipeline implemented, DB integration done), message templates (DB + handlers done, frontend basic), delivery logs (DB + handlers done, frontend basic), channels settings (backend done, frontend basic), file upload (backend done, no frontend UI), email delivery (SMTP configured, untested), SMS/WhatsApp (sandbox), subscription/invoice management (backend only), usage metrics (backend only), plan limits enforcement (no callers) |
| ❌ **Not Implemented** | **~20** | Recurring events, waitlist, seating, badge printing, kiosk mode, invoice PDF, Stripe, SSO/SAML, custom domains, white-labeling, feature flags, API keys, OpenAPI, Docker, CI/CD, in-app notifications, SendGrid/Mailgun, delivery logs UI (advanced), template editor UI (advanced), broadcast form selectors (frontend), S3Storage SDK production, rusttype font file production path |

---

## 17. Recent Updates (2026-09-20 — Post-Architecture Implementation)

### Completed (New Modules)
- ✅ `files/` — `Storage` trait (`LocalStorage`, `S3Storage` company-agnostic with `STORAGE_ENDPOINT_URL`), upload handler, routes, migration `0021`
- ✅ `cards/` — `CardTemplate`/`CardPlaceholder` model, repository, renderer (`rusttype` text rendering, QR composite), handlers, routes
- ✅ `qr/` — `token.rs` (`VerifyPayload` + AES-GCM + Ed25519), `render.rs` (`qrcode` PNG), endpoint `GET .../qr`
- ✅ `templates/` — `message_template.rs`, repository, handlers (`list`, `create`, `preview`), routes, migration `0022`
- ✅ `channels/` — `MessageChannel` trait, SMS/WA/Email/Telegram implementations, registry (`get_channel`), routes
- ✅ `broadcast/` — `dispatcher.rs` (full pipeline: token → QR → card → upload → message → send → DB updates), `worker.rs` (`tokio-cron-scheduler`)
- ✅ `retry/` — `scheduler.rs` (exponential backoff: 1m, 5m, 15m, 1h, 6h, max 5)
- ✅ `logs/` — `message_logs` table (`0023`), repository, handlers (`list_message_logs`, `list_broadcast_deliveries`), routes
- ✅ `public/verify` — `GET /public/verify?t={token}` endpoint (`verify_token.rs`)

### Completed (Environment & Config)
- ✅ `.env.example` updated (`STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_ENDPOINT_URL`, `QR_ENCRYPTION_KEY`, `QR_SIGNING_KEY`, `TELEGRAM_BOT_TOKEN`, `ENABLE_LIVE_TESTS`)
- ✅ Storage made company-agnostic (Contabo, OVH, Namecheap, AWS, Wasabi, DO Spaces, MinIO all supported via `STORAGE_ENDPOINT_URL`)

### Completed (Frontend — Existing Theme: Navy/Gold)
- ✅ `pages/templates/index.tsx` — Message Templates (create form with Handlebars editor, preview modal, list table)
- ✅ `pages/logs/index.tsx` — Delivery Logs (status badges, retry counts, channel filter)
- ✅ `pages/channels/index.tsx` — Channel Settings (per-channel test buttons, provider labels, status badges)
- ✅ `pages/cards/index.tsx` — Card Template Editor (placeholder fields, published badge, basic form)

### Completed (Documentation)
- ✅ `FEATURE_STATUS.md` — Updated with new modules, cross-platform architecture section, updated counts
- ✅ `TODO_LIST.md` — Full dependency graph, 4-phase implementation order, current status cross-reference

---

## 18. Next Immediate Actions (Priority)

1. **Broadcast Form Selectors** (`events/[id].tsx`) — Add card template dropdown, message template dropdown, schedule picker (`datetime-local`), channel multi-select (`sms`, `whatsapp`, `email`, `telegram`) to existing Broadcast form
2. **S3Storage SDK** — Replace placeholder with `aws-sdk-s3` or `reqwest` S3 signatures
3. **Rusttype Font Path** — Verify `CARD_FONT_PATH` env loads production font file
4. **Message Template DB Verification** — Confirm `message_templates` table exists and handlers return correct data
5. **Broadcast Form Validation** — Wire `card_templates` query (`published=true`, `org_id=...`) into broadcast handler (`broadcast/handlers.rs`)
