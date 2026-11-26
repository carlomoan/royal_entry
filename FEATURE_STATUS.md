# RoyalEntry — Feature Status Matrix

> **Status**: ✅ = Fully Implemented | ⚠️ = Partially Implemented | ❌ = Not Implemented
> **Last Updated**: 2026-11-21

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
| **Event Modes & Settings** | `events.event_mode` = `family`/`corporate`; card policy (`family_approval`/`full_payment`/`min_percent`), Gate OTP mode + ordered channels, pledge minimums/deadline, payment + parking instructions | `EventSettingsEditor.tsx` in the event Overview tab | ✅ |
| **Per-class Parking Variants** | `GET/POST/DELETE /events/{eid}/parking-variants` | Parking instructions + variants editor in event settings | ✅ |
| **Arrival Messages** | Venue QR `/w/{event}`, auto-shown on the guest's own card after check-in, SMS to feature phones | Editor in event Overview tab | ✅ |
| **Gate Dashboard** | `GET /events/{eid}/gate-dashboard` (expected/arrived counts, table occupancy, searchable guest list) | `/events/{id}/gate-dashboard` page + link on event detail | ✅ |
| **Recurring Events** | — | — | ❌ |
| **Waitlist Management** | — | — | ❌ |
| **Seat/Table Assignment** | Table reservations + seating suggestions; `seat_number` field exists | No full seat-map UI yet | ⚠️ |
| **Badge Printing** | — | — | ❌ |

## 2A. Corporate Events (Packages & Bookings)

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Packages** | Name, price (TZS), seats/table, card template, active flag | `CorporateTab.tsx` — "Packages & Bookings" tab (corporate events only) | ✅ |
| **Bookings** | Company, contact, packages + quantities, notes | Booking form + list | ✅ |
| **Booking Payment Confirmation** | Bank reference/proof/amount; installments allowed, balance shown | Confirm-payment modal | ✅ |
| **Automatic Pass Creation** | One guest per seat ("Company — Package seat N"), check-in links sent to contact by email/SMS | Pass list per booking | ✅ |
| **Table Reservations & Open Tables** | `POST /events/{eid}/bookings/{id}/tables`, `/events/{eid}/tables/open` | Assign table / open shared tables | ✅ |
| **Seating Suggestion** | `GET /events/{eid}/seating/suggest?booking_id=...` — own tables → open tables → next free table | Suggest button (usher confirms; extra seat invoiceable) | ✅ |
| **Booking Invoices** | `POST/GET /events/{eid}/bookings/{id}/invoice`, idempotent, organizer TIN + VAT from tax settings | Generate/view invoice | ✅ |
| **Corporate Report** | `GET /events/{eid}/corporate-report` by package/company/table — revenue, paid, balance, passes, attendance | Report table in tab | ✅ |

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
| **Family Card Issuing & Approval** | `POST /events/{eid}/guests/{id}/issue-card`, `approve-card`, `withdraw-approval`; policy from event settings | Issue / Approve / Withdraw actions in Michango tab | ✅ |

## 4. QR Scanner

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Check-in Guest** | `POST /events/{eid}/scan` | Scanner page with camera | ✅ |
| **SMS OTP Check-in** | `send_otp` / `verify_otp` (email for smartphone, SMS for feature phone) | SMS-link mode | ✅ |
| **OTP Gate Enforcement** | `otp_mode` = all / feature_phone_only / off; ordered `otp_channels` (sms/whatsapp/email); QR scan returns 428 `OTP_REQUIRED` | Scanner switches to SMS OTP mode on 428 | ✅ |
| **Party-size Entry Counting** | Card scannable up to `party_size` times; invitation marked scanned only when all entries used | Entries-used count shown | ✅ |
| **Manual Override** | `POST /events/{eid}/scan/override` with required reason, logged with operator id | Amber override panel | ✅ |
| **Scan Stats** | `GET /events/{eid}/scan-stats` | Arrival rate, timeline chart | ✅ |
| **Duplicate Scan Detection** | Returns `DuplicateScan` error | Toast notification | ✅ |
| **Offline Scanning** | Offline scans send `scan_source: qr_offline`, flagged for review | Local guest cache + offline check-in queue + sync | ✅ |
| **Kiosk Mode** | — | — | ❌ |

## 5. Michango (Pledge/Contribution)

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Pledge CRUD** | Create, list pledges | Pledge list + add modal | ✅ |
| **Pledge Summary** | `GET /events/{eid}/michango/summary` | Summary stat cards (fixed) | ✅ |
| **Record Payment** | `POST /michango/{id}/payment` | Payment modal | ✅ |
| **Reminders** | Send + list reminder deliveries | Reminder button + history | ✅ |
| **Automatic Reminders** | 14/7/3/1 days before deadline, deadline morning, overdue; 09:00–18:00 EAT; idempotent via `reminder_stages`; hourly cron | — | ✅ |
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
| **SMS Integration** | Beem/UniTxt/Africa's Talking; `ENABLE_SMS_SANDBOX=true` logs previews to `sandbox_messages` | Messages tab shows recipient, token and QR link | ✅ (sandbox works; live needs credentials) |
| **WhatsApp Integration** | WhatsApp Cloud API; `ENABLE_WHATSAPP_SANDBOX=true` logs previews | Messages tab shows recipient, token and QR link | ✅ (sandbox works; live needs credentials) |
| **Public QR endpoint** | `GET /public/invitations/{code}/qr` — no auth, points to `/g/{token}` | Used on invitation and check-in card pages | ✅ |
| **Email Integration** | SMTP (Outlook) via `Channels` | — | ✅ (needs app password) |
| **Telegram Integration** | Bot API + webhook | — | ✅ (needs token + setWebhook) |

## 7. Payments & Billing

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Payment CRUD** | List, filter payments | Payments table | ✅ |
| **M-Pesa STK Push** | Initiate + callback (idempotent); skipped cleanly when credentials are absent | Initiate payment button returns a clear "not enabled" message | ✅ (optional — enable when API credentials are available) |
| **Other payment gateways** | Pluggable via `services/` — UniTxt/NextSMS-style channel pattern; Stripe and other mobile money gateways planned | — | ⚠️ (future) |
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
| ✅ **Fully Implemented** | **~90** | Core auth + security, events (incl. account-admin activation, modes/settings, per-class parking, arrival messages, gate dashboard), family flow (card issuing/approval, automatic reminders), corporate flow (packages, bookings, passes, tables, seating suggestions, invoices, report), guests (incl. email verification, Telegram linking), scanner (OTP gate, party-size counting, manual override, offline), michango, broadcast, payments/billing, platform management, webhooks, email templates, in-app notifications, offline sync, settings hub |
| ⚠️ **Partially Implemented** | **~9** | Broadcast dispatcher/worker (backend pipeline), retry scheduling (backend only), plan limits enforcement (no callers), live channel delivery (needs real credentials: Beem/WhatsApp/Telegram/SMTP app password), TRA e-invoice (best-effort, needs TRA spec), seat/table assignment (reservations + suggestions, no full seat-map UI) |
| ❌ **Not Implemented** | **~11** | Recurring events, waitlist, badge printing, kiosk mode, Stripe, SSO/SAML, custom domains, white-labeling, API keys, OpenAPI, SendGrid/Mailgun |

---

## 17. Recent Updates (2026-11-21)

### Event modes & settings
- ✅ `events.event_mode` = `family` | `corporate`; `EventSettingsEditor.tsx` in the event Overview tab configures card-issuing policy (`family_approval` / `full_payment` / `min_percent` + `min_percent` + `card_issue_at`), Gate OTP (`otp_mode` = all / feature_phone_only / off, ordered `otp_channels` sms/whatsapp/email), family pledge minimums + timestamped pledge deadline + payment instructions, general parking instructions, and per-class parking variants (`GET/POST/DELETE /events/{eid}/parking-variants`).

### Family flow
- ✅ Per-guest card issuing (`POST /events/{eid}/guests/{id}/issue-card`), approval for partly-paid guests (`approve-card`, `withdraw-approval`), QR-free public invitation page `/i/{token}` with pledge info/payment/parking and a "Parking by class" block, check-in card `/g/{token}` gated by the issuing policy.
- ✅ Automatic reminders (14/7/3/1 days before deadline, deadline morning, overdue; 09:00–18:00 EAT; idempotent via `reminder_stages`; hourly cron).

### Corporate flow
- ✅ New "Packages & Bookings" tab (`CorporateTab.tsx`) for corporate events: packages, bookings, payment confirmation (bank reference/proof/amount, installments, balance), automatic pass creation (one guest per seat, check-in links to contact), table reservations + open/shared tables, seating suggestion (own → open → next free), booking invoices (idempotent, organizer TIN + VAT), corporate report by package/company/table.

### Gate & scanner
- ✅ Gate dashboard page + `GET /events/{eid}/gate-dashboard` (expected/arrived counts, table occupancy, searchable guest list with company/package/party size/entries).
- ✅ OTP gate enforcement from `otp_mode` — QR scan returns HTTP 428 `OTP_REQUIRED`, UI switches to SMS OTP mode; party-size entry counting; manual override `POST /events/{eid}/scan/override` with required reason (logged with operator id, amber UI panel); offline scans send `scan_source: qr_offline` and are flagged for review; arrival messages still sent after check-in.

### NextSMS v2 API correction (2026-11-26)
- ✅ Reviewed official NextSMS Messaging API v2 docs. Corrected base URL to `https://messaging-service.co.tz`, WhatsApp `to` to an array of numbers, and template values to named `personalisation` objects (e.g. `{"message":"…"}`) instead of the invalid `variables` / `{{1}}` approach.
- ✅ Added `NEXTSMS_WHATSAPP_PLACEHOLDERS` config (env + Settings UI) mapping our composed values to the template's named placeholders in order. Test script supports the free `/test/` endpoint.
- ✅ Verified captured payloads against a local mock for both the CLI script and the app's channel-test endpoint.

### Channel test tool (2026-11-26)
- ✅ `POST /settings/channels/test` sends a real message through the configured provider and returns the raw receipt (provider, success, provider_id, error). Added "Send test message" cards to WhatsApp Config and SMS Config, plus an amber warning that the NextSMS template must contain `{{1}}` and be approved.
- ✅ Verified against a local NextSMS mock: WhatsApp payload carries `variables:['VARIABLE-TEST-123']` and returns a success receipt.

### NextSMS WhatsApp variables (2026-11-26)
- ✅ NextSMS WhatsApp now sends `variables` (not `text`) — the composed message is passed as body variable `{{1}}`, so the recipient sees the message instead of only the approved static template.
- ✅ `whatsapp_template` extracts variables from Meta-style components (`parameters[].text`) and legacy flat `{text}` shapes via `collect_body_variables`.
- ✅ Removed the dead CallMeBot `WhatsappService`; updated Channels page labels to NextSMS/UniTxt, NextSMS/Meta Cloud, Resend/SMTP.
- ✅ Verified against a local NextSMS mock: payload contains `variables:[…composed message…]`, no `text` key.

### Card actions & designer (2026-11-25)
- ✅ `issue-card` now returns the real check-in link, human entry code and public QR URL; the Michango tab shows them in a modal with Send/View actions. `View Card` deep-links to the check-in tab. Guest card page has a QR fallback when no template is assigned.
- ✅ Check-in emails embed the QR image inline (`email_card`) and the preview records the same HTML. WhatsApp preview page has a draggable/resizable/colour-changeable card layout designer persisted in localStorage.
- ✅ Added a diagnostic React error boundary in `_app.tsx` so render failures show the actual error message instead of the generic "Something Went Wrong" page.

### Billing, roles & DB hardening (2026-11-25)
- ✅ Billing link added to the platform sidebar; platform admins see a banner pointing to platform-wide payments since subscriptions are tenant-scoped. Account roles keep their existing Billing/Payments links.
- ✅ Invoice paths verified end-to-end (create, mark paid, PDF, booking invoice) with no DB errors. Hardened `pass_security_level` validation, sandbox channel values, `tax_rate_percent` casts and payment-method normalisation. A 27-endpoint smoke test returned zero 5xx and zero database-error log lines.

### WhatsApp check-in preview & PDF (2026-11-24)
- ✅ Editable WhatsApp `checkin_card` template (channel_kind='whatsapp') with variables `{{guest_name}}`, `{{entry_code}}`, `{{check_in_link}}`, `{{qr_url}}`, `{{pdf_url}}`, `{{event_title}}`. Check-in delivery renders this template before sending.
- ✅ Check-in card PDF: `GET /events/{eid}/guests/{gid}/card/pdf` (auth) and public `GET /public/invitations/{code}/card/pdf` for WhatsApp/email recipients. Falls back to a plain QR image when no card template is assigned. New `/events/{id}/whatsapp-preview` page shows the template editor, live rendered message and an embedded PDF preview.

### Live gate controls (2026-11-24)
- ✅ `POST /events/{eid}/gate/otp-mode` toggles OTP enforcement (`all` / `feature_phone_only` / `off`) instantly on an active event, with an audit entry. The scanner page has an OTP select next to the Gate field; no deactivation needed. Successful check-ins return an explicit `welcome_message` (name, company, class, table/seat, entry count) shown in the result panel and toast.

### Broadcast placeholders & gate tokens (2026-11-24)
- ✅ Broadcast composer has variable chips (`[fullname]`, `[checkintoken]`, `[checkinlink]`, `[qrurl]`, `[phone]`, `[table]`, `[category]`, `[event]`, `[date]`, `[venue]`) with a live sample preview. Backend substitutes them per recipient for every channel; unknown placeholders are left visible.
- ✅ Gate accepts the human-friendly entry code (e.g. `QADA-HIME-4093`) typed with spaces/lowercase as well as the long `inv-…` link. Duplicate scans report the original time and gate. Fixed OTP verification for typed tokens: code resolution now tries the raw short link before the uppercase human-code form, so the internal short-link lookup no longer returns "Invitation not found".

### Guest pledges & check-in delivery (2026-11-24)
- ✅ Add Pledge modal now accepts multiple selected guests with one amount/due date/notes via `POST /events/{eid}/michango/bulk` (existing pledges skipped).
- ✅ Explicit check-in delivery: `POST /events/{eid}/guests/{id}/send-checkin` and bulk `POST /events/{eid}/guests/send-checkin`. Issues the card when eligible and sends the QR/token via WhatsApp → Email → SMS (feature phones SMS only). Invitations remain QR-free with no entry rights.

### Event edit workflow (2026-11-24)
- ✅ Active events can be deactivated (`POST /events/{id}/deactivate`) into `approved`/`draft`, edited (parking, family pledges, pass security, OTP, templates, etc.), then reactivated (`POST /events/{id}/activate`). Guests, passes and scans are preserved. The event detail page has Deactivate/Activate buttons and an amber info banner; edits while live are rejected with a clear message.

### Messaging templates & history (2026-11-24)
- ✅ SMS Templates page (`/sms-templates`) with CRUD, variable chips, GSM-7/Unicode segment counter and preview. Templates named `invitation` and `checkin_card` override the built-in SMS text. Message-template routes now use broadcast permissions and include update/delete.
- ✅ Check-in credentials try **WhatsApp → Email → SMS** for smartphones; feature phones get SMS only. Each attempt is recorded in the message preview log.
- ✅ Broadcast page shows unified message history across all channels via `GET /events/{eid}/message-history` with channel filter and stats.
- ✅ Invoice reads cast `tax_rate_percent::DOUBLE PRECISION` so they work whether or not migration 0032 ran; subscription payment methods are normalised to the DB CHECK values.

### Unified channel configuration (2026-11-24)
- ✅ `services/channels.rs` rewritten as one `ChannelConfig` loaded from `.env` and overlaid from `system_settings` (Settings UI). SMS = **NextSMS / Unitxt only** (Beem removed, optional failover); email = Resend or SMTP; Telegram Bot API; WhatsApp Cloud API. All send paths use the same `Channels` instance.
- ✅ Settings UI: SMS Config (NextSMS/Unitxt + failover + sandbox), Email Config (new tab), WhatsApp Config (Meta Cloud **or NextSMS**), Telegram Config. Secrets are write-only and masked; sandbox flags are forced off in production.
- ✅ NextSMS API shapes verified against a local mock: SMS `POST /api/sms/v2/text/single` sends `to` as a single international-format string (`2557…`); WhatsApp `POST /api/whatsapp/v2/text/single` sends `to` as an array with `account`, `template`, `text` and `reference`. Phone normalisation keeps the `255` country code. Rejected sender IDs are reported with a hint to register `NEXTSMS_SENDER_ID`.

### Pass security — Controlled (2026-11-23)
- ✅ `events.pass_security_level` = standard / controlled / maximum; **controlled is the default for corporate events**. Invitations now carry only the QR-free `/i/{token}` link — no entry token, QR image or check-in link. Entry credentials are sent only when a pass is issued.
- ✅ Named passes: contact verifies email by link, then registers each attendee's name/phone/email at `/b/{token}`; credentials go directly to the attendee. Free-mail contact addresses are flagged. Revoke and reassign invalidate the old QR and are written to `pass_audit`.
- ✅ Gate: controlled corporate passes always require OTP; revoked passes are rejected; duplicate scans report the original time and gate; after the name cutoff the usher captures the name and the entry is logged for review.
- ✅ Booking workflow states (Requested → Invoiced → Paid → Passes issued → Names registered → Checked in) with manual/auto Issue passes. Message inspection is platform-admin only, demo-events only, and masks tokens/OTP codes; sandbox flags are forced off in production.
- ✅ Migrations now run up to **0041** (pass security, audit, gate labels); verified on a fresh database copy (41/41).

### Messaging sandbox & event tabs (2026-11-23)
- ✅ `ENABLE_SMS_SANDBOX` / `ENABLE_WHATSAPP_SANDBOX` now record every outbound message in `sandbox_messages` (recipient, body, QR link, entry token, OTP code) so all three channels can be tested without live credentials. Email previews are recorded too, alongside real Resend delivery.
- ✅ Invitations carry both the entry token and the QR/check-in link on every channel; public QR endpoint `GET /public/invitations/{code}/qr` needs no auth and points to `/g/{token}`.
- ✅ Event detail tabs reordered for operational flow: Overview → Guests → Packages & Bookings → Michango → Messages → Broadcast → Staff → Gate dashboard → Scanner. New Messages tab shows sandbox previews with channel filter.

### Arrival messages & migrations
- ✅ Venue QR `/w/{event}` page, editor in event Overview, auto-shown on the guest's own card after check-in, SMS to feature phones.
- ✅ Migrations now run up to **0040**: 0040 sandbox message previews. Previously: 0032 tax rate float, 0033 checkin card template, 0034 invitation/pledge template, 0035 event modes & card issuing, 0036 arrival messages & reminders, 0037 corporate packages/bookings, 0038 event open tables, 0039 booking invoices & parking variants. **sqlx migration versions must be unique** — a duplicate version causes `VersionMismatch(N)` on startup. The same error also means a checksum mismatch; commit `23fd632` swapped 0032/0033 to match production, so an older local DB needs its `_sqlx_migrations` ledger repaired (never rename the files back).

---

## 18. Earlier Updates (2026-11-10)

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

## 19. Next Immediate Actions (Priority)

1. **Live channel credentials** — set Beem/WhatsApp/Telegram/SMTP app password in the backend `.env` to enable real delivery.
2. **TRA e-invoice payload** — align `TraService` body with TRA's current e-invoice API spec.
3. **S3Storage SDK** — replace the placeholder with real S3 signatures for production file storage.
4. **Broadcast dispatcher wiring** — connect the scheduled/queued broadcast worker to the unified `Channels`.
5. **Plan limits enforcement** — call `PlanLimits` from event/guest/broadcast creation.
6. **Seat map UI** — full visual seat map (only `seat_number` + table reservations/suggestions exist today).
7. **Corporate invoice PDF** — PDF export for booking invoices (invoices are generated/viewable in-app).
