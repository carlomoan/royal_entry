CREATE TABLE IF NOT EXISTS reminder_deliveries (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    pledge_id UUID NOT NULL,
    guest_id UUID NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_message_id TEXT,
    error_message TEXT,
    message TEXT NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_event_id ON reminder_deliveries (event_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_pledge_id ON reminder_deliveries (pledge_id, delivered_at DESC);
