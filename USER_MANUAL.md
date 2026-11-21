# RoyalEntry — User Manual

RoyalEntry is a multi-tenant event guest-management platform. This manual covers
every user role, what each role can do, and step-by-step walkthroughs of the
main workflows.

- **Live site:** https://royalentry.foctek.co.tz
- **Sessions:** you are signed out automatically after **2 minutes of inactivity**
  (configurable via `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES`). After an idle logout you
  must sign in again to confirm your identity.

---

## 1. Roles at a glance

| Role | Scope | What they can do |
|---|---|---|
| **Super Admin** | Platform | Everything — manage all organizations, plans, users, templates, audit, impersonate any org |
| **Platform Admin** | Platform | Same as Super Admin (accounts, plans, users, templates, RBAC, audit, reports) |
| **System Admin** | Platform | Platform-level operations (settings, users, audit) |
| **Account Admin** | Own organization | Everything inside the org: events, guests, invitations, cards, michango, broadcast, payments, reports, team, settings |
| **Event Manager** | Own organization | Create/manage events, guests, invitations, cards, broadcast |
| **Event Accountant** | Own organization | View events; manage michango (pledges/payments) and payments |
| **Secretary** | Own organization | View events; manage guests and invitations; read broadcasts |
| **Scanner Attendant** | Own organization | The Scanner hub only — QR/SMS check-in at the door |
| **Viewer** | Own organization | Read-only: events and reports |

> Platform roles see the **Platform** menu (Accounts, Plans, Users, Card Templates,
> Message Templates, Audit, RBAC, Webhooks). Account roles see the **tenant** menus
> (Events, Guests, Cards, Michango, Broadcast, Scanner, Reports, Settings).

---

## 2. Signing in

1. Open https://royalentry.foctek.co.tz and click **Sign in**.
2. Enter your **username/email** and **password**.
3. You land on the **Dashboard** (or the Scanner hub for Scanner Attendants).

If you see *"Your session expired due to inactivity"*, simply sign in again —
this is the automatic idle-logout protecting your account.

If you're asked to **change your password** right after signing in, that's the
forced password change for accounts created with a default password — set a new
one before you can continue.

---

## 3. Platform roles (Super Admin, Platform Admin, System Admin)

### 3.1 Accounts (organizations)
1. Open **Platform → Accounts**.
2. **New organization** — name, admin email, contact/billing email, and either
   create a new admin account, assign an existing user, or skip.
   - **Auto-approve** skips the pending-review step.
3. **Pending Review** list — **Approve**, **Reject**, or open **Review & Assign Plan**.
4. Each account row: **View/Edit** (full profile), **Quick view**, **Impersonate**
   (sign in as that org), **Suspend/Reactivate**, **Delete**.
5. The internal "RoyalEntry Platform" organization is hidden from the list.

### 3.2 Plans & subscriptions
1. **Platform → Packages** — create/edit/activate plans (price, billing interval,
   max users/events/guests).
2. On an account profile, **assign a plan** and manage the subscription status.

### 3.3 Platform users & RBAC
1. **Platform → Users** — create platform users, assign roles.
2. **Platform → RBAC** — manage roles and their permissions, assign roles to users.

### 3.4 Settings hub (vertical tabs)
**Platform → Settings** opens a page with **vertical tabs** on the left. Each tab
is a section:

- **Tax & TRA** — VAT rate, tax-inclusive toggle, and TRA API credentials applied
  to invoice generation.
- **Global Variables** — system-wide configuration variables.
- **Card Templates** — create visual-preset templates, upload preview images,
  edit, delete.
- **Email Templates** — edit the system email templates (invitation, reminder,
  pledge reminder, payment, verification/OTP) with live preview.
- **Roles & Permissions** — manage roles and their permissions.
- **Webhooks** — register endpoints that receive event callbacks (HMAC-signed),
  view deliveries, retry failed ones.
- **Audit Logs** — searchable audit trail of platform/tenant actions.
- **WhatsApp / SMS / Telegram Config** — channel credentials (write-only).
- **AI Integration** — AI feature descriptions.

### 3.5 Card Studio
**Card Studio** (`/cards`) — upload a designed card, position the **QR code**
(square, drag + resize from the corner handles), position the **guest name** box,
and **Share with all organizations** so every tenant can assign it to their
events. Shared templates appear with a gold **Shared** badge.

### 3.6 Approving events
When a tenant submits an event for approval you get a **notification** (bell icon
top-right). Open the event → **Approve** or **Reject** (with a reason). The tenant
is notified of the outcome.

---

## 4. Account roles — shared walkthroughs

### 4.1 Events lifecycle
1. **Events → New Event** — title, date, venue, main characters, expected guests,
   **Invitation Card Design** (choose your own or a shared platform template).
2. Event statuses: `draft → pending_review → approved → active → completed/cancelled`.
3. On the event page:
   - **Generate links** — creates a unique invitation link + QR for every guest.
   - **Send Invitations** — delivers the invitation (SMS/WhatsApp/Email) to guests.
   - **Report (PDF)** — downloadable event report.
   - **Submit for approval** — sends the event to the platform for approval.
   - **Save the Date** — sends save-the-date messages (requires all pledges paid).
   - **Invitation Card Design** panel — change the card template for the event.
4. **Scanner** — open the door scanner for this event.
5. **Gate dashboard** — see who is expected/arrived and table occupancy (§4.12).

> Choose the event **Mode** (`family` or `corporate`) in the **Overview** tab's
> **Event Settings** editor (§4.9). Corporate events get an extra
> **Packages & Bookings** tab (§4.11).

### 4.2 Guests
1. **Guests** tab → **Add Guest** or **Import CSV** (download the template first).
2. Guest fields: name, phone, email, WhatsApp phone, device type
   (smartphone/feature phone), table, category (VVIP/VIP/Gold/…), plus-one,
   contact method, pledge-exempt flag.
3. Bulk actions: select guests → send invitations / reminders / mark arrived.

### 4.3 Invitations & guest cards
1. **Generate links** for the event, then **Send Invitations**.
2. Each guest gets a check-in link + QR. Open **View Card** from a guest or the
   Michango tab to see the rendered card with the QR stamped in the designed spot.
3. **Card layout** — on the guest card page, drag/resize the **gold** box (QR) and
   the **blue** box (guest name), then **Save layout** (applies to every guest
   card using that template).
4. **Email verification** — the guest card shows whether the guest's email is
   **Verified**; use **Send verification** to email them a confirm link.
5. **Telegram** — use **Link Telegram** to send a guest the opt-in link so they
   can receive messages on Telegram.

### 4.4 Michango (pledges & contributions)
1. **Michango** tab — set a default pledge amount, **Add Pledge** per guest
   (amount auto-suggested by guest category).
2. **Record Payment** — partial or full; statuses: pending → partial → paid
   (overdue when past the deadline).
3. Stat cards show **Total Pledged / Collected / Outstanding / Pledgers** and a
   collection progress bar.
4. **Reminders** — send payment reminders to pending/partial/overdue guests.
5. Fully-paid guests get a **Guest card** button (check-in card).
6. **Family events** — under the event's card-issuing policy you can **Issue card**,
   **Approve** a partly-paid guest's card, or **Withdraw approval** (§4.10).
7. **Automatic reminders** go out before the pledge deadline and when overdue —
   you do not need to send them manually (§4.10).

### 4.5 Broadcast
1. **Broadcast** tab → **New Broadcast** — pick channel (SMS/WhatsApp/Email),
   message template, recipients, and schedule.
2. Campaign history shows delivery status per guest.

### 4.6 Scanner (check-in)
1. **Scanner** — scan the guest's QR (camera) or enter the SMS code.
2. The guest is marked **arrived**; duplicates and invalid codes are rejected.
3. **Offline scanning** — the scanner caches the event's guests + invitations, so
   you can keep checking guests in with no connection. Offline check-ins are
   recorded locally and **sync automatically when you're back online** (a banner
   shows the pending count). OTP verification needs a connection.
4. Scanner Attendants land directly on the Scanner hub.
5. **OTP gate** — if the event requires OTP, a QR scan asks for the SMS code first (§4.13).
6. **Party size** — one card can be scanned up to the guest's `party_size` times (§4.13).
7. **Manual override** — use the amber panel with a required reason if a guest cannot check in (§4.13).

### 4.7 Reports
**Reports** — summary + exportable reports (events, guests, payments, michango,
broadcasts) as CSV.

### 4.8 Settings (account)
**Settings** — organization profile, account settings, and **team management**
(create users, assign account roles).

### 4.9 Event settings: mode, card policy, OTP and parking
Open an event → **Overview** tab → **Event Settings** editor.

1. **Mode** — choose `family` (default) or `corporate`. Corporate events get the
   extra **Packages & Bookings** tab (§4.11); family events use the pledge/card
   flow (§4.10).
2. **Card-issuing policy** — `family_approval` (organizer approves partly-paid
   guests), `full_payment` (card only after the pledge is fully paid), or
   `min_percent` plus a **Minimum %** and optional **Card issue at** date/time.
3. **Gate OTP** — `otp_mode` = `all`, `feature_phone_only`, or `off`, and an
   ordered `otp_channels` list (`sms`, `whatsapp`, `email`). This controls what
   the scanner requires at the door (§4.13).
4. **Family pledge settings** — minimum pledge per person / plus-one, a
   timestamped **Pledge deadline**, and **Payment instructions** shown on the
   guest invitation.
5. **Parking** — general **Parking instructions**, plus **per-class parking
   variants** (class name + instructions). Add or delete variants; guests see
   them as "Parking by class" on their invitation page.
6. **Arrival messages** — use the **Arrival Messages** editor in the Overview tab
   to set the message guests see on their own card after check-in. A venue QR
   page (`/w/{event}`) and SMS to feature phones deliver the same message.

Save with **Save settings**.

### 4.10 Family flow: approving cards and the guest invitation
1. Open the event → **Michango** tab. Each guest shows a pledge status and card
   actions.
2. **Issue card** (`POST /events/{eid}/guests/{id}/issue-card`) — issue a check-in
   card to a guest who meets the event's card policy.
3. For a **partly-paid** guest under `family_approval`, use **Approve**
   (`approve-card`) to allow their card; use **Withdraw approval**
   (`withdraw-approval`) to revoke it. The check-in link `/g/{token}` only works
   once the card is active.
4. Guests open their QR-free invitation page `/i/{token}`. It shows the pledge
   amount and status, payment instructions, general parking instructions and a
   **Parking by class** block with the variant matching their guest class.
5. **Automatic reminders** are sent 14, 7, 3 and 1 days before the pledge
   deadline, on the deadline morning, and when overdue — between 09:00 and
   18:00 EAT. They are idempotent (tracked per stage) and run hourly, so you do
   not need to send them manually.

### 4.11 Corporate events: packages, bookings, passes and invoices
Available on events whose mode is `corporate` — open the event →
**Packages & Bookings** tab.

1. **Packages** — create a package with a name, price (TZS), seats per table,
   card template and an active flag.
2. **Bookings** — add a booking with company name, contact, chosen packages and
   quantities, and notes.
3. **Confirm payment** — record the bank reference/proof and amount. Installments
   are allowed; the remaining balance is shown on the booking.
4. **Passes** — once confirmed, one guest pass is created per seat, named
   "Company — Package seat N". Check-in links are sent to the contact by email
   or SMS.
5. **Tables** — assign tables to a booking (`POST /events/{eid}/bookings/{id}/tables`)
   or open shared tables (`/events/{eid}/tables/open`) that several bookings can
   use.
6. **Seating suggestion** — click **Suggest** for a booking
   (`GET /events/{eid}/seating/suggest?booking_id=...`). Priority is the booking's
   own tables → open tables → the next free table. The usher confirms the
   suggestion; an extra seat can be invoiced.
7. **Invoice** — **Generate invoice** (`POST /events/{eid}/bookings/{id}/invoice`)
   creates an idempotent booking invoice using the organizer's TIN and VAT rate
   from account tax settings; view it with `GET .../invoice`.
8. **Corporate report** — `GET /events/{eid}/corporate-report` summarises revenue,
   paid, balance, passes and attendance by package, company and table.

### 4.12 Gate dashboard
Open an event → **Gate dashboard** (button next to **Scanner**), or visit
`/events/{id}/gate-dashboard`. It refreshes automatically and shows:

- expected vs arrived counts and table occupancy;
- a searchable guest list with company, package, party size and entries used.

Use it at the door to see who is still expected and how full each table is.

### 4.13 Scanner: OTP-required scans, party size and manual override
1. **OTP gate** — when the event's `otp_mode` requires it, scanning a QR returns
   HTTP 428 `OTP_REQUIRED` and the scanner switches to **SMS OTP** mode. Enter the
   code sent to the guest (channels are tried in the order set in event settings)
   to complete check-in. Feature phones can be restricted via
   `feature_phone_only`; `off` disables the gate.
2. **Party size** — a card can be scanned up to the guest's `party_size` times
   (e.g. a couple on one card enters separately). The invitation is marked
   scanned only after the last entry.
3. **Manual override** — if a guest cannot present a valid code, use the amber
   **Manual override** panel (`POST /events/{eid}/scan/override`). A **reason is
   required** and is logged together with your operator id.
4. **Offline scans** — queued offline check-ins are sent with
   `scan_source: qr_offline` and flagged for review when they sync. Arrival
   messages are still sent after check-in.

---

## 5. Role-specific walkthroughs

### Account Admin
Everything in §4, including event settings (§4.9), the family flow (§4.10),
corporate packages/bookings (§4.11), the gate dashboard (§4.12) and scanner
overrides (§4.13). Manage the team in **Settings → Users**, view **Audit** for
the org, and configure account settings.

### Event Manager
§4.1–§4.6, plus event settings (§4.9), corporate packages/bookings (§4.11) and
the gate dashboard (§4.12). Cannot manage team, payments, or org settings.

### Event Accountant
1. **Events** — view events (read-only).
2. **Michango** — add pledges, record payments, send reminders.
3. **Payments** — view payment records.
4. **Corporate events** — view booking invoices and the corporate report (§4.11).

### Secretary
1. **Events** — view events.
2. **Guests** — full guest management (add/import/edit).
3. **Invitations** — generate and send invitation links; guests see pledge and
   parking details on their `/i/{token}` page (§4.10).
4. **Broadcast** — read campaign history (cannot send).

### Scanner Attendant
- The app opens the **Scanner** hub directly.
- Scan QR codes or type SMS codes to check guests in.
- Handle OTP-required scans, party-size entries and manual overrides (§4.13).
- No other menus are visible.

### Viewer
- **Events** — view events and their details.
- **Reports** — view reports (read-only).

---

## 6. Notifications

- The **bell icon** (top-right) shows unread notifications; a red badge shows the count.
- New notifications also appear as **pop-up alerts** bottom-right — click to open
  the linked page.
- You receive notifications for: event submitted (platform), event approved/
  rejected (org), pledge payment received (org), invitations sent (org).
- **Mark all read** clears the badge.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| "Session expired" on return | Normal — idle logout after 2 min. Sign in again. |
| Card won't render / download disabled | The template has no background or is inactive — open the Card Studio, add the design, save. |
| Can't see shared templates | They must be **Active** and **Shared** by a platform admin. |
| Save-the-date blocked | All guests must have fully paid pledges first. |
| Invitations "delivery failed" | Channel credentials missing on the server (Beem/Resend/WhatsApp/Telegram) — contact the platform admin. |
| Platform menus missing | Your role is an account role; platform access requires a platform role. |
| QR scan says "OTP required" | Normal when the event's `otp_mode` is `all` or `feature_phone_only` — switch to SMS OTP mode and enter the code sent to the guest. |
| "Already scanned" but the party hasn't all entered | A card can be used `party_size` times; if all entries are used, use **Manual override** with a reason. |

---

## 8. Security notes for administrators

- Backend secrets (`BEEM_*`, `RESEND_*`, `WHATSAPP_*`, `TELEGRAM_*`, `JWT_*`,
  `DATABASE_URL`) live **only** in `backend/.env` (gitignored, `chmod 600`).
  Never put them in `NEXT_PUBLIC_*` variables.
- **Secrets are write-only** — stored channel/TRA keys are returned masked as
  `********` and never shown back to the browser.
- **Accounts lock after 5 failed logins** for 15 minutes; access tokens expire
  after 2 hours (auto-refreshed).
- Guest QR/invitation links are built from `FRONTEND_URL` — keep it set to
  `https://royalentry.foctek.co.tz`.
- Database backups are taken on the server (see `deploy/README.md`).

## 9. Offline mode

- The app works **offline** (browser or the Tauri desktop app): reads come from a
  local cache, and changes you make (check-ins, pledges, payments) are queued and
  **sync automatically when you're back online**.
- A banner shows when you're offline and how many changes are waiting to sync.