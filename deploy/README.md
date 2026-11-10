# RoyalEntry — Production Server Configuration

Reference documentation for the production server at `royalentry.foctek.co.tz`.
Keep copies of the real files here whenever they change so the deployment is
reproducible.

- Repo on server: `/home/foctek/royalentry`
- Deploy script: `./deploy.sh` (pull from GitHub → build → restart)
- Backend port: **3000** · Frontend port: **3001** (Apache proxies 80/443 → 3001,
  which rewrites `/api/*` to 3000)

---

## 1. systemd units

### `/etc/systemd/system/royalentry-api.service`

```ini
[Unit]
Description=RoyalEntry API (Rust/Axum)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=foctek
Group=foctek
WorkingDirectory=/home/foctek/royalentry/backend
ExecStart=/home/foctek/royalentry/backend/target/release/royalentry
Restart=always
RestartSec=3
Environment=RUST_LOG=royalentry=info,sqlx=warn,tower_http=info

[Install]
WantedBy=multi-user.target
```

Enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now royalentry-api
sudo systemctl status royalentry-api
```

### `/etc/systemd/system/royalentry-web.service`

```ini
[Unit]
Description=RoyalEntry Web (Next.js)
After=network.target royalentry-api.service

[Service]
Type=simple
User=foctek
Group=foctek
WorkingDirectory=/home/foctek/royalentry/frontend-next
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

> If Node is installed via nvm, use the absolute path, e.g.
> `ExecStart=/home/foctek/.nvm/versions/node/v20.x.x/bin/npm run start`.

---

## 2. Apache vhost

### `/etc/apache2/sites-available/royalentry.conf`

```apache
<VirtualHost *:80>
    ServerName royalentry.foctek.co.tz
    Redirect permanent / https://royalentry.foctek.co.tz/
</VirtualHost>

<VirtualHost *:443>
    ServerName royalentry.foctek.co.tz

    SSLEngine on
    SSLCertificateFile      /etc/letsencrypt/live/royalentry.foctek.co.tz/fullchain.pem
    SSLCertificateKeyFile   /etc/letsencrypt/live/royalentry.foctek.co.tz/privkey.pem

    # Next.js app (which rewrites /api/* to the Rust backend on :3000)
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/

    # Optional: larger uploads for card designs
    LimitRequestBody 20971520

    # Security headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    # Content-Security-Policy (adjust as needed):
    # Header always set Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
</VirtualHost>
```

Enable:

```bash
sudo a2enmod proxy proxy_http ssl headers
sudo a2ensite royalentry
sudo systemctl reload apache2
```

> If you prefer Apache to proxy `/api/*` straight to the backend instead of
> through Next.js, add:
> ```apache
> ProxyPass /api/ http://127.0.0.1:3000/api/
> ProxyPassReverse /api/ http://127.0.0.1:3000/api/
> ```

---

## 3. Database backups

- Backup location on server: **`/root/royalentry-backups/`**
- Manual backup:

```bash
pg_dump -U postgres -d royalentry_db -Fc -f /root/royalentry-backups/royalentry_$(date +%F_%H%M).dump
```

- Restore:

```bash
pg_restore -U postgres -d royalentry_db --clean --if-exists /root/royalentry-backups/royalentry_<file>.dump
```

- Suggested cron (daily 03:00, keep 14 days, encrypted with a passphrase):

```cron
0 3 * * * pg_dump -U postgres -d royalentry_db -Fc | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASS -out /root/royalentry-backups/royalentry_$(date +\%F_\%H\%M).dump.enc && find /root/royalentry-backups -name '*.dump.enc' -mtime +14 -delete
```

- Decrypt to restore:

```bash
BACKUP_PASS=... openssl enc -d -aes-256-cbc -pbkdf2 -in royalentry_<file>.dump.enc -out royalentry.dump
pg_restore -U postgres -d royalentry_db --clean --if-exists royalentry.dump
```

> Test a restore at least once. Backups contain personal data — keep the folder
> readable only by root (`chmod 700 /root/royalentry-backups`) and store the
> `BACKUP_PASS` passphrase somewhere safe (e.g. a password manager).

---

## 4. Environment checklist

### `backend/.env` (gitignored, `chmod 600`)

| Variable | Production value |
|---|---|
| `DATABASE_URL` | `postgresql://…@localhost:5432/royalentry_db` |
| `ENVIRONMENT` | `production` |
| `SERVER_PORT` | `3000` |
| `APP_URL` | `https://royalentry.foctek.co.tz` |
| `FRONTEND_URL` | `https://royalentry.foctek.co.tz` (used for guest QR/invite links) |
| `CORS_ALLOWED_ORIGINS` | `https://royalentry.foctek.co.tz` (+ mobile/device origins) |
| `JWT_SECRET` | long random string |
| `BEEM_API_KEY` / `BEEM_SECRET_KEY` / `BEEM_SENDER_NAME` | Beem SMS |
| `RESEND_API_KEY` / `EMAIL_FROM` | Resend email |
| `TELEGRAM_BOT_TOKEN` | Telegram bot |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_API_VERSION` | WhatsApp Cloud API |

### `frontend-next/.env.local` (gitignored)

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_API_URL` | unset (same-origin `/api` rewrite is used) — set only if the API is on another host |
| `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES` | `2` |

---

## 5. Deployment

```bash
cd /home/foctek/royalentry
./deploy.sh            # pull from GitHub → build backend + frontend → restart
./deploy.sh --backend-only
./deploy.sh --frontend-only
./deploy.sh --rebuild  # rebuild current commit
```

Rollback: `git reset --hard <previous_commit> && ./deploy.sh --rebuild`

Logs: `logs/backend.log`, `logs/frontend.log` (or `journalctl -u royalentry-api`).

---

## 6. Offline / Tauri sync

The frontend is offline-first:

- **Mutations made while offline** (check-ins, pledges, payments, etc.) are queued
  in `localStorage` (`src/lib/offline.ts`) and **replayed automatically when the
  connection returns** (`syncOfflineQueue` on the `online` event).
- A banner (`OfflineBanner`) shows the offline state, the queued-change count,
  and the number of cached items, with a **Sync now** button.
- **Read cache** (`src/lib/cache.ts`): successful GET responses are cached in
  localStorage (5-min TTL, bounded to 100 entries). When offline, GETs fall back
  to the cache so pages still render. `useCachedQuery` (`src/lib/useCachedQuery.ts`)
  returns the cached copy instantly then refreshes when reachable.
- **Offline scanning** (`src/lib/scannerOffline.ts`): the scanner caches the
  event's guests + invitations (24h). Offline, a QR scan resolves the guest from
  the local list, records an offline arrival, and queues the check-in to sync
  when online. OTP verification still requires a connection.
- This works in the browser and the **Tauri desktop app** (localStorage is
  available there).

**SQLite upgrade path (Tauri):** swap the localStorage queue for the Tauri SQL
plugin (`@tauri-apps/plugin-sql`) using the same `QueuedRequest` shape
(`{ id, method, url, data, queuedAt }`), and keep the same flush logic — the rest
of the app is unchanged. For heavier local caching, mirror the key read endpoints
(events, guests, templates) into a local SQLite table and reconcile on sync.

## 7. Security reminders

- `git check-ignore -v backend/.env frontend-next/.env.local` should list both
  (they are ignored — never commit them).
- No secrets may appear in `NEXT_PUBLIC_*` variables (browser bundle).
- Verify webhook signatures (WhatsApp `X-Hub-Signature-256`, payment callbacks)
  before trusting them.
- Keep the system updated and the firewall closed to everything except 80/443/SSH.