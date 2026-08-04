-- ==============================================================================
-- Invitations, RSVP, Entry Scans, Pledges, Broadcasts
-- ==============================================================================

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY,
    guest_id UUID NOT NULL UNIQUE REFERENCES guests(id) ON DELETE CASCADE,
    short_link TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'viewed', 'scanned', 'expired')),
    scan_count INTEGER NOT NULL DEFAULT 0,
    invitation_sent_at TIMESTAMPTZ,
    last_scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_short_link ON invitations (short_link);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations (status);

-- RSVP Responses
CREATE TABLE IF NOT EXISTS rsvp_responses (
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    response TEXT NOT NULL DEFAULT 'pending'
        CHECK (response IN ('pending', 'confirmed', 'declined')),
    responded_at TIMESTAMPTZ,
    PRIMARY KEY (guest_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_rsvp_event_response ON rsvp_responses (event_id, response);

-- Entry Scans
CREATE TABLE IF NOT EXISTS entry_scans (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    invitation_id UUID REFERENCES invitations(id) ON DELETE SET NULL,
    scanned_by_user_id UUID,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scan_source TEXT NOT NULL DEFAULT 'qr',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_entry_scans_event_scanned_at ON entry_scans (event_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_scans_guest_id ON entry_scans (guest_id);

-- Pledge Tracker (Michango)
CREATE TABLE IF NOT EXISTS pledge_tracker (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    pledged_amount BIGINT NOT NULL CHECK (pledged_amount > 0),
    amount_paid BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    payment_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')),
    payment_deadline DATE,
    reminder_count INTEGER NOT NULL DEFAULT 0,
    last_reminder_sent_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_pledge_tracker_event_status ON pledge_tracker (event_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_pledge_tracker_deadline ON pledge_tracker (payment_deadline);

-- Broadcast Campaigns
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    campaign_name TEXT,
    message TEXT NOT NULL,
    message_channel TEXT NOT NULL CHECK (message_channel IN ('whatsapp', 'sms', 'both')),
    target_audience TEXT NOT NULL CHECK (target_audience IN ('all', 'vip', 'confirmed', 'declined', 'not_rsvp')),
    guest_category TEXT,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'sent', 'partial', 'failed')),
    total_recipients INTEGER,
    successfully_sent INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_event_created_at ON broadcast_campaigns (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON broadcast_campaigns (status);

-- Broadcast Deliveries
CREATE TABLE IF NOT EXISTS broadcast_deliveries (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    provider_message_id TEXT,
    error_message TEXT,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_campaign_id ON broadcast_deliveries (campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_status ON broadcast_deliveries (status);
