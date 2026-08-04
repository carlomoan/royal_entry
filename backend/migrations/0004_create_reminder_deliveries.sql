-- ==============================================================================
-- Reminder Deliveries (Michango reminders)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS reminder_deliveries (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    pledge_id UUID NOT NULL REFERENCES pledge_tracker(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    provider_message_id TEXT,
    error_message TEXT,
    message TEXT NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_event_id ON reminder_deliveries (event_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_pledge_id ON reminder_deliveries (pledge_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_status ON reminder_deliveries (status);
