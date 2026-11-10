# RoyalEntry — Feature Status Matrix

> **Status**: ✅ = Fully Implemented | ⚠️ = Partially Implemented | ❌ = Not Implemented
> **Last Updated**: 2026-11-10

---

## 1. Core Platform Infrastructure

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Authentication (JWT)** | Login, register, refresh, change-password; 2h access tokens | Login page, auth context, token refresh interceptor | ✅ |
| **Forced Password Change** | `must_change_password` flag on default admin | `/profile/change-password` page + AppShell guard | ✅ |
| **Account Lockout** | 5 failed logins → 15-min lock (`failed_login_attempts`, `locked_until`) | Error message on login | ✅ |
| **Rate Limiting** | In-memory limiter on auth + scanner OTP (60/min/IP) | 429 handling | ✅ |
| **RBAC** | `is_platform_role()`, `can()`, middleware guards | `roles.ts` permission matrix, sidebar filtering | ✅ |
| **Multi-tenancy** | Auto-scopes by `organization_id` from JWT | Route guards separate account vs platform | ✅ |
| **Audit Logging** | Middleware captures requests to `audit_logs` | Platform + Account audit pages | ✅ |
| **API Response Envelope** | `{ success, data }` wrapper | `apiClient` interceptor | ✅ |
| **Pagination** | `page`, `per_page`, `total`, `total_pages` | `PaginatedResponse<T>` type | ✅ |
| **File Upload** | `POST /files/upload` (`files/` module) | Card Studio upload | ✅ |
| **Health Check** | `/health` runs `SELECT 1` (200/503) | — | ✅ |
| **Secret Masking** | `GET /settings/system` masks channel/TRA keys | Write-only config forms | ✅ |

## 2. Event Management

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Event CRUD** | Create, read, update, delete events | Events list + detail pages | ✅ |
| **Event Status Workflow** | draft → pending_review → approved → active → completed/cancelled | Status badges, filters | ✅ |
| **Account-Admin Activation** | `activate_event` allows draft/pending/approved → active | Dashboard "Activate" button + full event list | ✅ |
| **Event Summary/Stats** | `GET /events/{id}/summary` (fixed subquery) | Dashboard stat cards | ✅ |
| **Invitation Links** | Short-link + QR payload generation | Generate links button | ✅ |
| **Card Template Assignment** | `card_template_id` on events, validated renderable | Event form + "Invitation Card Design" panel | ✅ |
| **Public Invitation Page** | `GET /public/invitations/{code}` | `PublicInvitation.tsx` | ✅ |
| **Public RSVP** | `POST /public/invitations/{code}/rsvp` | RSVP form | ✅ |
| **Card Template Design** | `cards/` renderer (rusttype: QR square + guest-name stamp) | Card Studio (QR + name boxes, corner handles, shared SaaS) | ✅ |
| **Recurring Events** | — | — | ❌ |
| **Waitlist Management** | — | — | ❌ |
| **Seat/Table Assignment** | — | — | ❌ |
| **Badge Printing** | — | — | ❌ |

## 3. Guest Management

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Guest CRUD** | Create, read, update, delete guests | Guest list + form modals | ✅ |
| **Bulk Import** | `POST /events/{eid}/guests/bulk` + CSV import | CSV upload UI | ✅ |
| **Guest Categories** | VVIP, VIP, Gold, Silver, Premium, Regular, etc. | Category badges | ✅ |
| **Plus-One Support** | `plus_one_allowed` field | Toggle in guest form | ✅ |
| **Device Type** | `smartphone` / `feature_phone` for SMS/WhatsApp routing | Selector in guest form | ✅ |
| **Email Verification** | `email_verified` + token; send + public verify endpoints | Verified badge + "Send verification" | ✅ |
| **Telegram Linking** | `telegram_chat_id` + webhook (`/start <token>`) | "Link Telegram" on guest card | ✅ |

## 4. QR Scanner

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Check-in Guest** | `POST /events/{eid}/scan` | Scanner page with camera | ✅ |
| **SMS OTP Check-in** | `send_otp` / `verify_otp` (email for smartphone, SMS for feature phone) | SMS-link mode | ✅ |
| **Scan Stats** | `GET /events/{eid}/scan-stats` | Arrival rate, timeline chart | ✅ |
| **Duplicate Scan Detection** | Returns `DuplicateScan` error | Toast notification | ✅ |
| **Offline Scanning** | — | Local guest cache + offline check-in queue + sync | ✅ |
| **Kiosk Mode** | — | — | ❌ |

## 5. Michango (Pledge/Contribution)

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Pledge CRUD** | Create, list pledges | Pledge list + add modal | ✅ |
| **Pledge Summary** | `GET /events/{eid}/michango/summary` | Summary stat cards (fixed) | ✅ |
| **Record Payment** | `POST /michango/{id}/payment` | Payment modal | ✅ |
| **Reminders** | Send + list reminder deliveries | Reminder button + history | ✅ |
| **Payment Status** | pending, partial, paid, overdue | Status badges + progress bar | ✅ |

## 6. Broadcast (Messaging)

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Send Broadcast** | `POST /events/{eid}/broadcast` | Broadcast form (SMS/WhatsApp/Email/Telegram) | ✅ |
| **Broadcast Selectors** | — | Message-template + card-template selects, schedule picker, channel multi-select | ✅ |
| **List Broadcasts** | `GET /events/{eid}/broadcasts` | Campaign history + delivery details | ✅ |
| **Unified Channels** | `services/channels.rs` — Beem SMS, SMTP/Resend email, Telegram, WhatsApp Cloud | Channel config in Settings | ✅ |
| **Message Audit Logs** | `message_logs` table + handlers | Delivery logs page | ✅ |
| **Message Templates** | `message_templates` table + CRUD | Templates page | ✅ |
| **SMS Integration** | Beem (`BEEM_*`) | — | ✅ (needs live credentials) |
| **WhatsApp Integration** | WhatsApp Cloud API (`WHATSAPP_*`) | — | ✅ (needs live credentials) |
| **Email Integration** | SMTP (Outlook) via `Channels` | — | ✅ (needs app password) |
| **Telegram Integration** | Bot API + webhook | — | ✅ (needs token + setWebhook) |

## 7. Payments & Billing

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Payment CRUD** | List, filter payments | Payments table | ✅ |
| **M-Pesa STK Push** | Initiate + callback (idempotent) | Initiate payment button | ✅ |
| **Payment Status** | pending, completed, failed, cancelled | Status badges | ✅ |
| **Subscription Invoicing** | `billing_invoices` + `generate_invoice_for_subscription()` | Billing page (subscription, invoices, pay) | ✅ |
| **Recurring Invoice Generation** | `BillingService::generate_recurring_invoices()` (cron) | — | ✅ |
| **Invoice Tax (TRA VAT)** | `tax_rate_percent`, `tax_amount_tsh`, `tax_inclusive` on invoices | VAT column + Net/VAT/Total breakdown | ✅ |
| **TRA e-Invoice Submission** | `TraService` submits invoices to TRA API | Tax & TRA settings | ✅ (best-effort, needs TRA spec) |
| **Invoice PDF** | `GET /billing/invoices/{id}/pdf` | "PDF" button on billing page | ✅ |
| **Receipt/Invoice UI** | — | Printable navy/gold document (receipt + invoice) | ✅ |
| **Failed Payment Retry** | Exponential backoff | — | ✅ (backend only) |
| **Dunning Notices** | SMS + email reminders for overdue invoices | — | ✅ (backend only) |
| **Stripe Integration** | — | — | ❌ |

## 8. Platform (SaaS) Management

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Platform Summary** | `GET /platform/summary` | Platform overview dashboard | ✅ |
| **Customer Listing** | `GET /platform/customers` (internal org hidden) | Accounts table | ✅ |
| **Customer Detail** | `GET /platform/customers/{id}` | Account profile page | ✅ |
| **Approve/Reject/Suspend Org** | Endpoints | Approve/Reject/Suspend actions | ✅ |
| **Create Organization** | `POST /platform/organizations` with admin + plan | New-organization modal | ✅ |
| **Service Plan CRUD** | `/platform/plans` | Packages page | ✅ |
| **Platform User Management** | `/platform/users` | Users page | ✅ |
| **Organization Impersonation** | Short-lived JWT | "Login as org" button | ✅ |
| **Usage Metrics API** | `GET /orgs/{id}/usage` | Usage & Limits page | ✅ |
| **Plan Limits Enforcement** | `PlanLimits` in `usage.rs` | — | ⚠️ (no enforcement calls) |

## 9. Webhooks

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Endpoint CRUD** | `/platform/webhooks` | Webhooks page (Settings hub) | ✅ |
| **Delivery Queue** | `webhook_deliveries` table with retry | — | ✅ (backend only) |
| **HMAC Signatures** | `X-RoyalEntry-Signature` verification | — | ✅ |
| **Test Delivery** | `POST /webhooks/{id}/test` | Test button | ✅ |
| **Retry Policy** | Exponential backoff (max 5) | — | ✅ |

## 10. Email Template Engine

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Handlebars Rendering** | `TemplateService` | Live preview | ✅ |
| **System Templates** | 5 seeded: invitation, reminder, pledge reminder, payment, verification/OTP | Email Templates editor (Settings hub) | ✅ |
| **Template CRUD** | `/platform/templates` (real DB CRUD) | Editor with variable insertion + preview | ✅ |
| **Merge Variables** | `{{guest_name}}`, `{{event_title}}`, etc. | Variable chips | ✅ |

## 11. Email & Communication

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **SMTP Email** | Outlook SMTP via `Channels` | — | ✅ (needs app password) |
| **In-App Notifications** | `notifications` table + emitters (event, payment, invitation) | Bell + dropdown + live popup toasts | ✅ |
| **SendGrid / Mailgun** | — | — | ❌ |

## 12. API & Developer Features

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Public REST API** | None (all routes need JWT) | — | ❌ |
| **API Key Auth** | — | — | ❌ |
| **Rate Limiting** | In-memory limiter (auth/OTP) | 429 handling | ✅ |
| **OpenAPI / Swagger** | — | — | ❌ |

## 13. Security

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **JWT Authentication** | HS256, 2h access + 30d refresh | Token refresh interceptor | ✅ |
| **Password Hashing** | Argon2 | — | ✅ |
| **Account Lockout** | 5 failed → 15-min lock | Error message | ✅ |
| **Forced Password Change** | `must_change_password` | Change-password page + guard | ✅ |
| **Rate Limiting** | Auth + OTP endpoints | 429 handling | ✅ |
| **Secret Masking** | Write-only settings | Masked config forms | ✅ |
| **CORS** | Env-driven allowlist | — | ✅ |
| **SQL Injection Protection** | Parameterized queries via `sqlx` | — | ✅ |
| **XSS Protection** | — | React escapes by default | ✅ |
| **M-Pesa Callback Idempotency** | Only completes non-completed payments | — | ✅ |
| **Telegram Webhook Secret** | `X-Telegram-Bot-Api-Secret-Token` check | — | ✅ |
| **Encryption at Rest** | — | — | ❌ |
| **SSO / OIDC** | — | — | ❌ |

## 14. Multi-tenancy & Isolation

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Tenant Scoping** | `organization_id` from JWT auto-applied | Route guards | ✅ |
| **Data Isolation** | All queries include `organization_id = $1` | API calls scoped per org | ✅ |
| **Custom Domains** | — | — | ❌ |
| **White-labeling** | — | — | ❌ |

## 15. Cross-Platform & Offline

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Offline Mutation Queue** | — | `offline.ts` — queue + replay on reconnect | ✅ |
| **Offline Read Cache** | — | `cache.ts` — GET cache + fallback | ✅ |
| **Offline Scanning** | — | `scannerOffline.ts` — local guest cache + queued check-ins | ✅ |
| **Tauri Compatibility** | — | localStorage works in Tauri; SQLite upgrade path documented | ✅ |
| **Broadcast Dispatcher** | `broadcast/dispatcher.rs` pipeline | — | ⚠️ (backend pipeline) |
| **Broadcast Worker** | `broadcast/worker.rs` (cron) | — | ⚠️ (backend only) |
| **Retry Scheduling** | `retry/scheduler.rs` | — | ⚠️ (backend only) |

---

## 16. Feature Summary by Status

| Status | Count | Details |
|--------|-------|---------|
| ✅ **Fully Implemented** | **~75** | Core auth + security (lockout, rate limit, forced password change, secret masking, 2h tokens), events (incl. account-admin activation), guests (incl. email verification, Telegram linking), scanner (incl. offline), michango, broadcast (selectors + unified channels), payments/billing (tax, TRA, invoice PDF, receipt/invoice UI), platform management, webhooks, email templates (5 system + CRUD), in-app notifications, offline sync (queue + read cache + offline scanning), settings hub (vertical tabs) |
| ⚠️ **Partially Implemented** | **~8** | Broadcast dispatcher/worker (backend pipeline), retry scheduling (backend only), plan limits enforcement (no callers), live channel delivery (needs real credentials: Beem/WhatsApp/Telegram/SMTP app password), TRA e-invoice (best-effort, needs TRA spec) |
| ❌ **Not Implemented** | **~12** | Recurring events, waitlist, seating, badge printing, kiosk mode, Stripe, SSO/SAML, custom domains, white-labeling, API keys, OpenAPI, SendGrid/Mailgun |

---

## 17. Recent Updates (2026-11-10)

### Card design & events
- ✅ Card Studio: square QR (corner handles), movable/resizable **guest name** box, shared SaaS templates, renderer stamps guest name.
- ✅ Account Admin activates events to live from the dashboard (full event list).
- ✅ Event summary subquery fixed; generate-links 415 fixed (optional body + `{}`).

### Messaging & templates
- ✅ Unified `Channels` (Beem SMS, SMTP/Resend email, Telegram, WhatsApp Cloud) wired into `MessagingService`.
- ✅ 5 system email templates seeded (invitation, reminder, pledge reminder, payment, verification/OTP); `/platform/templates` CRUD implemented (was stub).
- ✅ OTP email at scan time; guest email verification; Telegram webhook + chat_id linking.
- ✅ Broadcast form: message-template + card-template selectors.

### Billing & tax
- ✅ Invoice tax (VAT rate, tax-inclusive) + TRA e-invoice service; invoice PDF; printable receipt/invoice UI.

### Settings & UI
- ✅ Settings hub with **vertical tabs** (Tax & TRA, Global Variables, Card Templates, Email Templates, Roles & Permissions, Webhooks, Audit, WhatsApp/SMS/Telegram Config, AI).
- ✅ Reports page redesigned (full values, breakdown, export cards); StatCard truncation fixed.

### Security
- ✅ Rate limiting (auth/OTP), account lockout, forced password change, 2h tokens, secret masking (write-only), M-Pesa idempotency, DB-backed `/health`, Telegram webhook secret.

### Offline
- ✅ Offline mutation queue + GET read cache + offline scanner (local guest cache, queued check-ins, auto-sync).

---

## 18. Next Immediate Actions (Priority)

1. **Live channel credentials** — set Beem/WhatsApp/Telegram/SMTP app password in the backend `.env` to enable real delivery.
2. **TRA e-invoice payload** — align `TraService` body with TRA's current e-invoice API spec.
3. **S3Storage SDK** — replace the placeholder with real S3 signatures for production file storage.
4. **Broadcast dispatcher wiring** — connect the scheduled/queued broadcast worker to the unified `Channels`.
5. **Plan limits enforcement** — call `PlanLimits` from event/guest/broadcast creation.