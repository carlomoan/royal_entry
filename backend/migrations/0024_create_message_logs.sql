-- ==============================================================================
-- Migration: 0024_create_message_logs.sql
-- Immutable audit trail for message deliveries
-- ==============================================================================
DROP TABLE IF EXISTS message_logs;

CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES broadcast_deliveries(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    gateway_msg_id TEXT,
    response TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_broadcast ON broadcast_deliveries (broadcast_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_recipient ON message_logs (recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_event ON message_logs (event_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_channel ON message_logs (channel);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs (status);
