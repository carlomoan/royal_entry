# RoyalEntry — Feature Status Matrix

> **Status**: ✅ = Fully Implemented | ⚠️ = Partially Implemented | ❌ = Not Implemented

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
| **File Upload** | — | — | ❌ |

## 2. Event Management

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Event CRUD** | Create, read, update, delete events | Events list + detail pages | ✅ |
| **Event Status Workflow** | draft → approved → active → completed/cancelled | Status badges, filters | ✅ |
| **Event Summary/Stats** | `GET /events/{id}/summary` with counts | Dashboard stat cards | ✅ |
| **Qr Code Generation** | `qrcode` crate on invitation generation | Qr display in card studio | ✅ |
| **Invitation Links** | Generation of short-link + QR payload | Card studio, copy-to-clipboard | ✅ |
| **Public Invitation Page** | `GET /public/invitations/{code}` | `PublicInvitation.tsx` | ✅ |
| **Public RSVP** | `POST /public/invitations/{code}/rsvp` | RSVP form on invitation page | ✅ |
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

## 4. QR Scanner

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Check-in Guest** | `POST /events/{eid}/scan` | Scanner page with camera | ✅ |
| **Scan Stats** | `GET /events/{eid}/scan-stats` | Arrival rate, timeline chart | ✅ |
| **Duplicate Scan Detection** | Returns `DuplicateScan` error | Toast notification | ✅ |
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
| **Send Broadcast** | `POST /events/{eid}/broadcast` | Broadcast form (SMS/WhatsApp) | ✅ |
| **List Broadcasts** | `GET /events/{eid}/broadcasts` | Campaign history table | ✅ |
| **Delivery Tracking** | `GET /broadcasts/{id}/deliveries` | Delivery status per guest | ✅ |
| **SMS Integration** | Africa's Talking SDK | — | ⚠️ (sandbox mode) |
| **WhatsApp Integration** | WhatsApp Business API | — | ⚠️ (sandbox mode) |
| **Email Templates** | Handlebars rendering in `TemplateService` | Template editor UI | ⚠️ (backend done, frontend placeholder) |

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
| **Template CRUD** | Create, update, delete templates | Template editor UI | ❌ |
| **Preview** | `render_template()` with sample variables | Preview in admin | ❌ |
| **Merge Variables** | `{{user_name}}`, `{{event_title}}`, etc. | — | ✅ (backend only) |

## 11. Email & Communication

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **SMTP Email** | Config in `.env` (SMTP_HOST, SMTP_PORT) | — | ✅ (backend only, untested) |
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
| **Password Hashing** | Argon2 (argon2 crate) | — | ✅ |
| **Role-Based Access** | Middleware guards per route group | Route guards, sidebar filtering | ✅ |
| **CORS** | Permissive (development) | Vite proxy | ✅ |
| **SQL Injection Protection** | Parameterized queries via sqlx | — | ✅ |
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

## 15. Infrastructure / DevOps

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Database Migrations** | sqlx-based, auto-run on startup | — | ✅ |
| **Background Jobs (Scheduler)** | `tokio-cron-scheduler` with 6 billing jobs | — | ✅ (backend only) |
| **Health Check** | `GET /health` returns "OK" | — | ✅ |
| **Logging** | `tracing` with json/pretty formats | — | ✅ |
| **Dockerfile** | — | — | ❌ |
| **CI/CD** | — | — | ❌ |

---

## 16. Feature Summary by Status

| Status | Count | Details |
|--------|-------|---------|
| ✅ **Fully Implemented** | **~60** | Core auth, RBAC, events, guests, scanner, michango, broadcast, payments (M-Pesa), platform management (accounts, plans, users, webhooks), impersonation, usage metrics |
| ⚠️ **Partially Implemented** | **~15** | Bulk guest import (no CSV UI), SMS/WhatsApp (sandbox), email templates (no editor UI), subscription/invoice management (backend only), dunning + grace periods (backend only), usage metrics (backend only), plan limits enforcement (no callers) |
| ❌ **Not Implemented** | **~25** | File upload, recurring events, waitlist, seating, badge printing, kiosk mode, invoice PDF, Stripe, SSO/SAML, custom domains, white-labeling, feature flags, API keys, OpenAPI, Docker, CI/CD, in-app notifications, SendGrid/Mailgun, delivery logs UI, template editor UI |

---

## 17. Recommended Next Steps (Priority)

1. **Frontend for Subscription/Invoice Management** — Add UI for viewing and managing customer subscriptions, creating invoices, marking paid
2. **Plan Limits Enforcement** — Wire up `enforce_plan_limits()` in event/guest handlers to prevent exceeding plan limits
3. **Email Template Editor UI** — Build the Handlebars template editor with preview in platform settings
4. **Delivery Logs UI** — Show webhook delivery history with status, retry count, response body
5. **Docker Compose** — Add `Dockerfile` and `docker-compose.yml` for production deployment
6. **Usage Metrics Dashboard** — Frontend charts showing usage vs plan limits per organization