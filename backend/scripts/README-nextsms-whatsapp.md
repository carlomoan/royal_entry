# NextSMS WhatsApp v2 — correct integration

Corrected after reviewing the official v2 docs: base URL `messaging-service.co.tz`, numeric `to`, and named `personalisation` objects (not `variables` / `{{1}}`).

Official docs: https://nextsms.co.tz/api-docs · Postman: https://documenter.getpostman.com/view/1679195/2sAYkDP1XN

## Key facts from the official v2 API

- **Base URL:** `https://messaging-service.co.tz` (not `nextsms.co.tz`).
- **WhatsApp send:** `POST /api/whatsapp/v2/text/single`.
- `to` is an **array of numbers**, e.g. `[255712345678]` — not strings.
- Template values go in **`personalisation`**: an array of objects keyed by the
  placeholder names **without braces**. For a template body
  `Hello {name}, your code is {code}`, send
  `"personalisation":[{"name":"Asha","code":"1234"}]`.
- There is no `variables` field and no `{{1}}` syntax — that was wrong.
- A 200 response can still contain rejected recipients: check
  `messages[].status.groupName` (`PENDING` = accepted, `REJECTED` = not sent).
- `REJECTED_MISSING_OUTLET` (id 111) means there is no active WhatsApp account
  and template on the NextSMS account. `FAILED`/`SPAM_RATE_LIMIT` are Meta-side
  delivery rejections (template not approved, recipient not opted in, or too
  many marketing messages).
- Free validation endpoint: `POST /api/whatsapp/v2/test/text/single` — same
  body, nothing sent or charged.

## 1. Create an approved template in the NextSMS dashboard

Example single-placeholder template:

- **Name:** `RoyalEntry-Test`
- **Body:** `RoyalEntry test: {message}`

Submit it and wait until it is **active and approved**. An unapproved template
is accepted by the API but delivery fails later.

For invitations use named placeholders:

```
Hello {name}, you are invited to {event} on {date}. Card: {link}
```

## 2. Configure the app

In `backend/.env`:

```
NEXTSMS_BASE_URL=https://messaging-service.co.tz
NEXTSMS_WHATSAPP_ACCOUNT=Foctek-RoyalEntry
NEXTSMS_WHATSAPP_TEMPLATE=RoyalEntry-Test
NEXTSMS_WHATSAPP_PLACEHOLDERS=message
```

For a multi-placeholder template set the names in body order, e.g.:

```
NEXTSMS_WHATSAPP_PLACEHOLDERS=name,event,date,link
```

The app maps its composed values to those names in order. Restart the backend
after changing `.env`, or set the same keys in `system_settings` via the
Settings UI (no restart needed).

## 3. Test directly

```bash
cd /home/foctek/royalentry/backend
chmod +x scripts/test-nextsms-whatsapp.sh

# Free validation (nothing sent, no charge):
./scripts/test-nextsms-whatsapp.sh 255718474695 VARIABLE-TEST-123 RoyalEntry-Test message --test

# Real send:
./scripts/test-nextsms-whatsapp.sh 255718474695 VARIABLE-TEST-123 RoyalEntry-Test message
```

Expected request body:

```json
{
  "to": [255718474695],
  "account": "Foctek-RoyalEntry",
  "template": "RoyalEntry-Test",
  "personalisation": [{ "message": "VARIABLE-TEST-123" }],
  "reference": "re-cli-…"
}
```

If the phone receives `RoyalEntry test: VARIABLE-TEST-123`, the configuration is
correct. If the response says `REJECTED_MISSING_OUTLET`, connect/activate the
WhatsApp account in the NextSMS dashboard. If it says `FAILED` after dispatch,
the template is not approved or the number is not opted in.

## 4. Test through the app UI

Settings → WhatsApp Config → **Send test message** sends through the same code
path and shows the provider receipt (provider, success, provider ID, error).
