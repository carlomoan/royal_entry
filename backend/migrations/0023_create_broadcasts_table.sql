-- ==============================================================================
-- Migration: 0023_create_broadcasts_table.sql
-- Broadcast campaigns and per-recipient delivery tracking
-- Matches backend handlers/broadcast.rs schema exactly
-- ==============================================================================

-- Drop existing tables if they were created with the wrong names to avoid conflicts
DROP TABLE IF EXISTS broadcast_deliveries;
DROP TABLE IF EXISTS broadcasts;
DROP TABLE IF EXISTS broadcast_campaigns;

-- 1. Campaigns Table (Matches backend `broadcast_campaigns`)
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_name TEXT,
    message TEXT NOT NULL,
    message_channel TEXT NOT NULL DEFAULT 'whatsapp',
    target_audience TEXT NOT NULL DEFAULT 'all',
    guest_category TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'partial', 'failed')),
    total_recipients INTEGER NOT NULL DEFAULT 0,
    successfully_sent INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_event ON broadcast_campaigns (event_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_org ON broadcast_campaigns (org_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON broadcast_campaigns (status);

-- 2. Deliveries Table (Matches backend `broadcast_deliveries`)
CREATE TABLE IF NOT EXISTS broadcast_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email', 'telegram')),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    provider_message_id TEXT,
    error_message TEXT,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_campaign ON broadcast_deliveries (campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_guest ON broadcast_deliveries (guest_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_status ON broadcast_deliveries (status);
