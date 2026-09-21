# RoyalEntry — Implementation Todo List

> Based on proposed architecture (files/, cards/, qr/, templates/, channels/, broadcast/, logs/)
> Cross-referenced with FEATURE_STATUS.md (updated 2026-09-03)
> Priority: P0 = Blocker, P1 = High, P2 = Medium, P3 = Low

---

## Legend
- ✅ = Already implemented (from FEATURE_STATUS.md)
- ⚠️ = Partially implemented / needs extension
- ❌ = Not implemented / new module
- 🔴 = Blocker for proposed architecture
- 🟡 = Required for full feature
- 🟢 = Enhancement / nice-to-have

---

## 1. NEW MODULE: `src/files/` — File Upload + Storage

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 1.1 | Create `files/mod.rs` with `Storage` trait | ✅ | 🔴 P0 | Trait: upload(), download(), delete(), signed_url() |
| 1.2 | Implement `LocalStorage` (disk-based) | ✅ | 🟡 P1 | For dev / single-node |
| 1.3 | Implement `S3Storage` (AWS S3 / MinIO) — company-agnostic (`STORAGE_ENDPOINT_URL`) | ✅ | 🟡 P1 | Production storage (Contabo, OVH, Namecheap, Wasabi, DO Spaces, MinIO) |
| 1.4 | Create `files/handlers.rs` — upload endpoint | ✅ | 🟡 P1 | `POST /files/upload` → returns `file_id` |
| 1.5 | Create `files/repository.rs` — DB table `files` | ✅ | 🟡 P1 | Columns: id, org_id, path, size, mime_type, created_at |
| 1.6 | Add `files` import to routes + middleware | ✅ | 🟡 P1 | Gate by `files:read` / `files:write` |
| 1.7 | Migration: `CREATE TABLE files (...)` (`0021`) | ✅ | 🔴 P0 | Required before any upload works |

**Dependencies:** None (new root module)
**Blocked by:** None
**Blocks:** 2.1 (cards need file upload for backgrounds), 9.1 (broadcast needs file storage for rendered cards)

---

## 2. NEW MODULE: `src/cards/` — Card Template Design + Rendering

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 2.1 | Create `cards/model.rs` — `CardTemplate`, `CardPlaceholder` | ✅ | 🔴 P0 | Placeholder: {x, y, w, h, rotation, type: qr\|text} |
| 2.2 | Create `cards/repository.rs` — DB table `card_templates` | ✅ | 🔴 P0 | Columns: id, org_id, name, background_file_id, placeholders_json, published, created_at |
| 2.3 | Create `cards/renderer.rs` — composite QR + text onto background (`rusttype`) | ✅ | 🟡 P1 | Uses `image` + `rusttype` crates; takes PNG background + placeholder data → PNG output |
| 2.4 | Create `cards/handlers.rs` — admin CRUD | ✅ | 🟡 P1 | `POST /cards/templates`, `GET /cards/templates`, `PUT /cards/templates/{id}`, `DELETE ...` |
| 2.5 | Add `cards` import to routes + middleware | ✅ | 🟡 P1 | Gate by `cards:read` / `cards:write` |
| 2.6 | Migration: `CREATE TABLE card_templates (...)` (`0015` exists) | ✅ | 🔴 P0 | Required before any card creation |
| 2.7 | Migration: `CREATE TABLE card_placeholders (...)` (optional — can be JSON) | ❌ | 🟢 P3 | If using normalized schema instead of JSON |

**Dependencies:** 1.1 (file upload for background images)
**Blocked by:** 1.7 (files table)
**Blocks:** 9.3 (broadcast needs card rendering), 3.2 (QR token needs card composite)

---

## 3. EXTEND: `src/qr/` — Secure Token + Rendering

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 3.1 | Create `qr/token.rs` — `VerifyPayload` + AES-GCM + Ed25519 | ✅ | 🔴 P0 | Payload: recipient_id, event_id, card_template_id, issued_at, nonce, exp |
| 3.2 | Create `qr/render.rs` — wrap existing `qrcode` usage | ✅ | 🟡 P1 | Reuse `qrcode` crate; output PNG bytes |
| 3.3 | Add `.env` keys: `QR_ENCRYPTION_KEY` (AES-256), `QR_SIGNING_KEY` (Ed25519 private) | ✅ | 🔴 P0 | Must be set before token generation works |
| 3.4 | Create endpoint: `GET /public/verify?t={token}` | ✅ | 🟡 P1 | Decrypt + verify → lookup recipient + event → check-in |
| 3.5 | Create endpoint: `POST /qr/generate-secure` (internal) | ⚠️ | 🟡 P1 | Returns token + QR PNG (used by broadcast dispatcher) |
| 3.6 | Migration: Add `qr_tokens` table (optional — can be stateless) | ❌ | 🟢 P3 | If tracking issued tokens; else stateless JWT-style |

**Dependencies:** 2.1 (card templates for payload), 1.3 (S3 for storage — optional)
**Blocked by:** 2.6 (cards table — for payload reference), 3.3 (env keys)
**Blocks:** 9.4 (broadcast dispatcher needs secure QR), 9.9 (public verify endpoint)

---

## 4. EXTEND: `src/templates/` — Message Template Engine

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 4.1 | Create `templates/message_template.rs` — `MessageTemplate` model | ✅ | 🟡 P1 | Channel-aware: SMS, WhatsApp, Email, Telegram |
| 4.2 | Create `templates/repository.rs` — DB table `message_templates` | ✅ | 🟡 P1 | Columns: id, org_id, name, channel_kind, subject, body, attachments_json, created_at |
| 4.3 | Create `templates/handlers.rs` — CRUD + preview | ✅ | 🟡 P1 | `POST /message-templates`, `GET ...`, `PUT ...`, `POST .../{id}/preview` |
| 4.4 | Extend `TemplateService` (existing) to load from DB | ⚠️ | 🟡 P1 | Currently uses seeded templates; add DB lookup |
| 4.5 | Add `message_templates` import to routes + middleware | ✅ | 🟡 P1 | Gate by `templates:read` / `templates:write` |
| 4.6 | Migration: `CREATE TABLE message_templates (...)` (`0022`) | ✅ | 🟡 P1 | Required for template CRUD |

**Dependencies:** None (extends existing `templates/`)
**Blocked by:** None
**Blocks:** 9.5 (broadcast needs message templates), 5.1 (channel registry needs templates)

---

## 5. NEW MODULE: `src/channels/` — Unified Messaging Layer

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 5.1 | Create `channels/traits.rs` — `MessageChannel` trait | ✅ | 🔴 P0 | Method: `send(to, body, attachments) -> DeliveryReceipt` |
| 5.2 | Create `channels/sms.rs` — wrap existing Africa's Talking | ✅ | 🟡 P1 | Reuse `SmsService`; implement trait |
| 5.3 | Create `channels/whatsapp.rs` — wrap existing WA Business API | ✅ | 🟡 P1 | Reuse `WhatsappService`; implement trait |
| 5.4 | Create `channels/email.rs` — wrap existing SMTP / lettre | ✅ | 🟡 P1 | Reuse SMTP config; implement trait |
| 5.5 | Create `channels/telegram.rs` — NEW `teloxide` | ✅ | 🟢 P3 | `TELEGRAM_BOT_TOKEN` env; `teloxide` crate |
| 5.6 | Create `channels/registry.rs` — `ChannelKind` → `Box<dyn MessageChannel>` | ✅ | 🟡 P1 | Lookup by enum: SMS, WhatsApp, Email, Telegram |
| 5.7 | Create `channels/mod.rs` — module exports | ✅ | 🟡 P1 | Export trait + registry + all implementations |
| 5.8 | Migration: `CREATE TABLE channels (...)` (optional — config in env) | ❌ | 🟢 P3 | If storing per-org channel config; else env-only |
| 5.9 | Endpoint: `POST /admin/channels/{kind}/test` | ⚠️ | 🟡 P1 | Gated by `ENABLE_LIVE_TESTS=true`; sends ping message |

**Dependencies:** 4.1 (message templates — optional), 1.1 (file storage — for attachments)
**Blocked by:** None (new root module)
**Blocks:** 6.1 (broadcast dispatcher needs unified channel), 9.7 (delivery receipt needs trait)

---

## 6. REFACTOR: `src/broadcast/` — Broadcast Dispatcher + Worker

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 6.1 | Create `broadcast/dispatcher.rs` — orchestrates per-recipient pipeline | ✅ | 🔴 P0 | Batch size: 50; picks queued `broadcast_deliveries` |
| 6.2 | Create `broadcast/worker.rs` — tokio task / cron for scheduled sends | ✅ | 🟡 P1 | Reuse `tokio-cron-scheduler` (existing dependency) |
| 6.3 | Extend `broadcast/handlers.rs` — `POST /events/{eid}/broadcast` | ⚠️ | 🟡 P1 | Add validation: card published, recipients in event, channel credits |
| 6.4 | Migration: `CREATE TABLE broadcasts (...)` (check if exists) | ⚠️ | 🟡 P1 | Verify existing schema; add `scheduled_at`, `aggregate_status` if missing |
| 6.5 | Migration: `CREATE TABLE broadcast_deliveries (...)` (check if exists) | ⚠️ | 🟡 P1 | Verify existing schema; add `retry_count`, `gateway_msg_id`, `response` |
| 6.6 | Implement retry logic: 1m, 5m, 15m, 1h, 6h (max 5) | ✅ | 🟡 P1 | Reuse `webhook_deliveries` retry pattern (`retry/scheduler.rs`) |
| 6.7 | Update `broadcast` aggregate status (sent_count, failed_count) | ⚠️ | 🟡 P1 | After dispatcher completes batch |

**Dependencies:** 2.1 (cards), 3.1 (QR token), 4.1 (message templates), 5.1 (channel trait), 1.1 (file storage)
**Blocked by:** 2.6, 3.3, 4.6, 5.1, 1.7
**Blocks:** 7.1 (message logs need broadcast data), 9.1 (full broadcast flow)

---

## 7. NEW MODULE: `src/logs/` — Message Audit Logs

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 7.1 | Create `logs/repository.rs` — DB table `message_logs` | ✅ | 🟡 P1 | Columns: id, broadcast_id, delivery_id, recipient_id, event_id, channel, status, gateway_msg_id, response, created_at |
| 7.2 | Create `logs/handlers.rs` — query APIs | ✅ | 🟡 P1 | `GET /broadcasts/{id}/deliveries`, `GET /events/{eid}/message-logs`, `GET /message-logs?recipient_id=...` |
| 7.3 | Create `logs/mod.rs` — module exports | ✅ | 🟡 P1 | |
| 7.4 | Migration: `CREATE TABLE message_logs (...)` (`0023`) | ✅ | 🟡 P1 | Append-only (immutable audit trail) |
| 7.5 | Integration: dispatcher writes `message_logs` row per delivery | ✅ | 🟡 P1 | After `channel.send()` call (step 9i in architecture) |
| 7.6 | Integration: dispatcher updates `broadcast_deliveries` (mutable) | ✅ | 🟡 P1 | Status, retry_count, gateway_msg_id, response |

**Dependencies:** 6.1 (dispatcher — writes logs), 5.1 (channel trait — provides delivery receipt)
**Blocked by:** 6.1 (dispatcher must exist first)
**Blocks:** None (audit layer — can be added after)

---

## 8. FULL BROADCAST FLOW (Integration)

Based on architecture steps 1-12:

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 8.1 | Step 1-6: Broadcast form (frontend) — select card, message template, recipients, channels, schedule | ⚠️ | 🟡 P1 | Reuse existing `Broadcast` form; add card/template selectors (`pages/templates/index.tsx`, `pages/cards/index.tsx`, `pages/channels/index.tsx` created) |
| 8.2 | Step 7a: Validate card published + owned by org | ⚠️ | 🟡 P1 | Query `card_templates` (published=true, org_id=...) — `cards/repository.rs` done |
| 8.3 | Step 7b: Validate recipients belong to event | ⚠️ | 🟡 P1 | Reuse existing `list_event_guests` |
| 8.4 | Step 7c: Validate org has channel credits / plan allows | ❌ | 🟢 P3 | Check `plan_limits` or `usage` table |
| 8.5 | Step 7d: Insert `broadcasts` row (status=queued) | ⚠️ | 🟡 P1 | Reuse existing `POST /events/{eid}/broadcast` |
| 8.6 | Step 7e: Insert `broadcast_deliveries` per recipient × channel | ⚠️ | 🟡 P1 | New loop: for each guest, for each selected channel |
| 8.7 | Step 7f: Spawn dispatcher worker (or schedule via cron) | ⚠️ | 🟡 P1 | Call dispatcher; pass `broadcast_id` (`broadcast/dispatcher.rs` + `worker.rs` done) |
| 8.8 | Step 8: Dispatcher picks queued deliveries (batch=50) | ✅ | 🟡 P1 | Query: `SELECT * FROM broadcast_deliveries WHERE status='queued' LIMIT 50` (`dispatcher.rs`) |
| 8.9 | Step 9a: Generate secure QR token (per recipient) | ✅ | 🔴 P0 | Call `qr/token.rs` (`VerifyPayload` + AES-GCM + Ed25519) |
| 8.10 | Step 9b: Render QR PNG | ✅ | 🟡 P1 | Call `qr/render.rs` (`qrcode` crate) |
| 8.11 | Step 9c: Composite QR + guest text onto card → PNG/PDF | ✅ | 🟡 P1 | Call `cards/renderer.rs` (`rusttype` + `image`) |
| 8.12 | Step 9d: Upload rendered card → file storage → file_id + signed URL | ✅ | 🟡 P1 | Call `files/handlers.rs` upload; get `file_id` (`files/storage.rs`) |
| 8.13 | Step 9e: Render message body via Handlebars (inject card URL + QR link) | ⚠️ | 🟡 P1 | Call `TemplateService::render()` with context |
| 8.14 | Step 9f: Build `OutboundMessage` { to, body, attachments } | ❌ | 🟡 P1 | New struct; attachments = [{file_id, url}] |
| 8.15 | Step 9g: Call `channel.send()` → `DeliveryReceipt` | ✅ | 🟡 P1 | Call `channels/registry.rs` lookup + send |
| 8.16 | Step 9h: Update `broadcast_deliveries`: status, gateway_msg_id, response, retry_count | ✅ | 🟡 P1 | Update DB row (`dispatcher.rs`) |
| 8.17 | Step 9i: Append `message_logs` row (immutable audit) | ✅ | 🟡 P1 | Insert into `message_logs` (`dispatcher.rs`) |
| 8.18 | Step 10: Retry with backoff (reuse webhook_deliveries pattern) | ✅ | 🟡 P1 | If `DeliveryReceipt.success == false`, schedule retry (`retry/scheduler.rs`) |
| 8.19 | Step 11: Update broadcast aggregate status | ⚠️ | 🟡 P1 | Count sent/failed; update `broadcasts` row |
| 8.20 | Step 12: Frontend polls `GET /broadcasts/{id}/deliveries` | ⚠️ | 🟡 P1 | New endpoint; returns delivery status per recipient (`logs/handlers.rs`) |

**Dependencies:** All modules (1, 2, 3, 4, 5, 6, 7)
**Blocked by:** 1.7, 2.6, 3.3, 4.6, 5.1, 6.1, 7.4
**Blocks:** Full broadcast feature (architecture complete)

---

## 9. QR TOKEN SECURITY (Verification Flow)

Based on architecture steps 1-3:

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 9.1 | Step 1: Designer creates card template (see 2.1-2.7) | ❌ | 🔴 P0 | |
| 9.2 | Step 2a: Build `VerifyPayload` | ✅ | 🔴 P0 | Struct definition (`qr/token.rs`) |
| 9.3 | Step 2b-2e: Serialize → JSON → AES-GCM encrypt → Ed25519 sign → base64url | ✅ | 🔴 P0 | Use `aes-gcm` + `ed25519-dalek` crates (`qr/token.rs`) |
| 9.4 | Step 2f: Link = `https://app.royalentry.com/verify?t={token}` | ❌ | 🟡 P1 | Public endpoint URL |
| 9.5 | Step 2g: QR PNG = `qrcode::render(link)` | ⚠️ | 🟡 P1 | Reuse existing `qrcode` usage |
| 9.6 | Step 2h: Composite onto card background at placeholder position | ❌ | 🟡 P1 | Reuse `cards/renderer.rs` |
| 9.7 | Step 3a: `GET /public/verify?t=...` endpoint | ❌ | 🟡 P1 | Decrypt + verify signature |
| 9.8 | Step 3b: Decrypt + verify signature | ✅ | 🔴 P0 | Return error if invalid/expired/tampered (`qr/token.rs`) |
| 9.9 | Step 3c: Look up recipient + event → mark check-in | ⚠️ | 🟡 P1 | Reuse existing `scanner::check_in_guest` logic |
| 9.10 | Step 3d: Reject if expired, already scanned, wrong event, tampered | ❌ | 🟡 P1 | Validation rules |

**Dependencies:** 2.1 (cards), 3.1 (token), 1.1 (file storage — optional)
**Blocked by:** 2.6, 3.3
**Blocks:** 8.9 (broadcast needs secure QR), 9.7 (public verify endpoint)

---

## 10. MESSAGE TEMPLATES (Admin UI)

Based on architecture steps 1-6:

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 10.1 | Step 1: Admin opens Message Templates page | ✅ | 🟡 P1 | New frontend page (`pages/templates/index.tsx`) |
| 10.2 | Step 2: Creates template (name, channel_kind, subject, body, attachments) | ✅ | 🟡 P1 | Form with Handlebars editor (`pages/templates/index.tsx`) |
| 10.3 | Step 3: `POST /message-templates` | ✅ | 🟡 P1 | See 4.3 (`templates/handlers.rs`) |
| 10.4 | Step 4: Preview — `POST /message-templates/{id}/preview` | ✅ | 🟡 P1 | Render with sample context (`pages/templates/index.tsx`) |
| 10.5 | Step 5: Templates selectable in Broadcast form | ⚠️ | 🟡 P1 | Dropdown in existing broadcast form (`events/[id].tsx` — selectors needed) |
| 10.6 | Step 6: During dispatch, render per recipient with context | ⚠️ | 🟡 P1 | Pass `guest`, `event`, `card_url`, `qr_link` to Handlebars |

**Dependencies:** 4.1 (message template model), 5.1 (channel registry — for channel_kind validation)
**Blocked by:** 4.6 (message_templates table)
**Blocks:** 8.13 (broadcast needs rendered message)

---

## 11. MESSAGE LOGS (Audit + UI)

Based on architecture steps 1-3:

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 11.1 | Step 1: Every `channel.send()` writes `message_logs` row | ✅ | 🟡 P1 | See 7.5 (`dispatcher.rs`) |
| 11.2 | Step 2: Query APIs (`GET /broadcasts/{id}/deliveries`, etc.) | ✅ | 🟡 P1 | See 7.2 (`logs/handlers.rs`) |
| 11.3 | Step 3: Frontend — Delivery Logs page (new) | ✅ | 🟡 P1 | Currently ❌ in FEATURE_STATUS; new page (`pages/logs/index.tsx`) |

**Dependencies:** 7.1 (message_logs table), 6.1 (dispatcher writes logs)
**Blocked by:** 7.4 (table), 6.1 (dispatcher)
**Blocks:** None (audit layer)

---

## 12. CHANNEL REGISTRY + TEST

Based on architecture steps 1-4:

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 12.1 | Step 1: Registry maps `ChannelKind` → `Box<dyn MessageChannel>` | ✅ | 🔴 P0 | See 5.6 (`channels/registry.rs`) |
| 12.2 | Step 2: Each impl reads config from `.env` / `channels` table | ✅ | 🟡 P1 | SMS: `AT_API_KEY`, `AT_USERNAME`; WA: `WA_PHONE_ID`, `WA_TOKEN`; Email: `SMTP_HOST`, etc.; TG: `TELEGRAM_BOT_TOKEN` |
| 12.3 | Step 3: `POST /admin/channels/{kind}/test` endpoint | ❌ | 🟡 P1 | Gated by `ENABLE_LIVE_TESTS=true` |
| 12.4 | Step 3a: Load channel from registry | ❌ | 🟡 P1 | |
| 12.5 | Step 3b: Send ping: "RoyalEntry test message — {timestamp}" | ❌ | 🟡 P1 | |
| 12.6 | Step 3c: Return gateway raw response + success/failure | ❌ | 🟡 P1 | |
| 12.7 | Step 4: Frontend — Settings → Channels page with "Send Test" button | ❌ | 🟡 P1 | New settings page |

**Dependencies:** 5.1 (channel trait), 5.2-5.5 (channel implementations)
**Blocked by:** 5.1
**Blocks:** 8.15 (broadcast needs registry lookup), 12.3 (test endpoint)

---

## 13. ENVIRONMENT / CONFIG

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 13.1 | Add `.env` variables for new modules | ❌ | 🔴 P0 | See 3.3 (QR keys), 12.2 (channel configs) |
| 13.2 | Update `.env.example` with all new variables | ❌ | 🟡 P1 | Document all required keys |
| 13.3 | Update `config.rs` / `AppConfig` to load new env vars | ❌ | 🟡 P1 | If using structured config |

---

## 14. FRONTEND INTEGRATION (Cross-Reference)

Based on FEATURE_STATUS.md gaps:

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 14.1 | QR Code Frontend Integration — "Download QR" button, modal, embed in email | ⚠️ | 🟡 P1 | See FEATURE_STATUS #1 |
| 14.2 | Email Template Editor UI | ❌ | 🟡 P1 | See FEATURE_STATUS #4 |
| 14.3 | Delivery Logs UI (new page) | ❌ | 🟡 P1 | See FEATURE_STATUS #5 |
| 14.4 | Message Templates page (new) | ❌ | 🟡 P1 | See 10.1 |
| 14.5 | Channels Settings page (new) | ❌ | 🟡 P1 | See 12.7 |
| 14.6 | Card Template Editor (new) | ❌ | 🟡 P1 | See 2.4 |
| 14.7 | Broadcast form updates — card/template selectors, schedule picker | ⚠️ | 🟡 P1 | See 8.1 |

---

## 15. DATABASE MIGRATIONS (Summary)

| Migration | Table | Status | Priority |
|-----------|-------|--------|----------|
| `files` | `files` | ❌ | P0 |
| `card_templates` | `card_templates` | ❌ | P0 |
| `message_templates` | `message_templates` | ❌ | P1 |
| `message_logs` | `message_logs` | ❌ | P1 |
| `channels` (optional) | `channels` | ❌ | P3 |
| `qr_tokens` (optional) | `qr_tokens` | ❌ | P3 |

---

## 16. DEPENDENCY GRAPH (Visual)

```
1. files/ (P0)
   └── 2. cards/ (P0) ── depends on 1.7
       └── 3. qr/ (P0) ── depends on 2.6, 3.3
           └── 9. QR Security (P0) ── depends on 2.6, 3.3

4. templates/ (P1) ── independent (extends existing)

5. channels/ (P0) ── independent (new root)
   └── 6. broadcast/ (P0) ── depends on 2, 3, 4, 5, 1
       └── 7. logs/ (P1) ── depends on 6, 5
           └── 8. Full Broadcast Flow (P0) ── depends on ALL

10. Message Templates UI (P1) ── depends on 4
11. Message Logs UI (P1) ── depends on 7
12. Channel Registry + Test (P0) ── depends on 5
```

---

## 17. RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Foundation (P0 Blockers)
1. 1.1-1.7 — `files/` module + migration
2. 2.1-2.6 — `cards/` module + migration
3. 3.1-3.3 — `qr/` token + env keys
4. 5.1 — `channels/` trait + registry
5. 4.1-4.6 — `templates/` message templates + migration

### Phase 2: Integration (P0-P1)
6. 6.1-6.7 — `broadcast/` dispatcher + worker
7. 8.1-8.7 — Broadcast form + validation
8. 9.1-9.6 — QR token security + composite
9. 3.4-3.5 — Public verify endpoint

### Phase 3: Pipeline (P1)
10. 8.8-8.20 — Full dispatcher pipeline (batch, render, upload, send, retry, audit)
11. 7.1-7.6 — `logs/` module + integration
12. 9.7-9.10 — Public verify endpoint + check-in

### Phase 4: UI + Polish (P1-P3)
13. 10.1-10.6 — Message templates UI
14. 11.1-11.3 — Delivery logs UI
15. 12.1-12.7 — Channel registry + test endpoint
16. 14.1-14.7 — All frontend integrations
17. 13.1-13.3 — Env/config updates

---

## 18. CURRENT SYSTEM STATUS (Cross-Reference)

From `FEATURE_STATUS.md` (updated 2026-09-03):

| Module | Status | Gap vs Proposed Architecture |
|--------|--------|------------------------------|
| `files/` | ❌ Not implemented | Full module missing |
| `cards/` | ❌ Not implemented | Full module missing |
| `qr/` (existing) | ⚠️ Endpoint created (`GET .../qr`) | Needs token encryption (`token.rs`), secure link (`verify` endpoint) |
| `templates/` (existing) | ⚠️ Handlebars backend done | Needs message template DB (`message_template.rs`), CRUD handlers |
| `channels/` | ❌ Not implemented | Full module missing; SMS/WA exist as separate services |
| `broadcast/` (existing) | ⚠️ Basic POST/GET works | Needs dispatcher (`dispatcher.rs`), worker (`worker.rs`), batch pipeline |
| `logs/` | ❌ Not implemented | Full module missing; webhook delivery logs exist but no message audit |

---

## 19. NEXT ACTION (Immediate)

**Priority P0 — Start Phase 1:**

1. Create `backend/crates/cloud/src/files/` directory with `mod.rs`, `storage.rs`, `handlers.rs`
2. Create `backend/crates/cloud/src/cards/` directory with `mod.rs`, `model.rs`, `repository.rs`, `renderer.rs`, `handlers.rs`
3. Create `backend/crates/cloud/src/qr/token.rs` and `qr/render.rs`
4. Add `.env` variables: `QR_ENCRYPTION_KEY`, `QR_SIGNING_KEY`
5. Create migration files for `files`, `card_templates`, `message_templates`

These 5 actions unblock the entire architecture pipeline.
