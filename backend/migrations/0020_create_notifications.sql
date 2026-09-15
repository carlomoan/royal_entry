CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY,
    organization_id UUID,                                   -- org-wide notification
    user_id         UUID,                                   -- personal notification
    type            TEXT NOT NULL,                          -- e.g. guest.vip_arrived
    title           TEXT NOT NULL,
    body            TEXT,
    link            TEXT,                                   -- optional deep link
    metadata        JSONB,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org  ON notifications (organization_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC);
