-- ==============================================================================
-- Migration: 0040_sandbox_messages.sql
-- Records outbound messages when a channel runs in sandbox mode (no live
-- provider credentials). Lets clients inspect exactly what would be delivered,
-- including the QR link and entry token, before going live.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS sandbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email', 'telegram')),
    recipient TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    qr_url TEXT,
    token TEXT,
    provider_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_messages_event ON sandbox_messages (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sandbox_messages_channel ON sandbox_messages (channel, created_at DESC);
