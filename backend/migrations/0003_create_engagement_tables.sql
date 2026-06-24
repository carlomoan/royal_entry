CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY,
    guest_id UUID NOT NULL UNIQUE,
    short_link TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    scan_count INTEGER NOT NULL DEFAULT 0,
    invitation_sent_at TIMESTAMPTZ,
    last_scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rsvp_responses (
    guest_id UUID NOT NULL,
    event_id UUID NOT NULL,
    response TEXT NOT NULL DEFAULT 'pending',
    responded_at TIMESTAMPTZ,
    PRIMARY KEY (guest_id, event_id)
);

CREATE TABLE IF NOT EXISTS entry_scans (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    guest_id UUID NOT NULL,
    invitation_id UUID,
    scanned_by_user_id UUID,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scan_source TEXT NOT NULL DEFAULT 'qr',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_entry_scans_event_scanned_at ON entry_scans (event_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_scans_guest_id ON entry_scans (guest_id);

CREATE TABLE IF NOT EXISTS pledge_tracker (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    guest_id UUID NOT NULL,
    pledged_amount BIGINT NOT NULL,
    amount_paid BIGINT NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    payment_deadline DATE,
    reminder_count INTEGER NOT NULL DEFAULT 0,
    last_reminder_sent_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_pledge_tracker_event_status ON pledge_tracker (event_id, payment_status);

CREATE TABLE IF NOT EXISTS broadcast_campaigns (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    campaign_name TEXT,
    message TEXT NOT NULL,
    message_channel TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    guest_category TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    total_recipients INTEGER,
    successfully_sent INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_event_created_at ON broadcast_campaigns (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS broadcast_deliveries (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL,
    guest_id UUID NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_message_id TEXT,
    error_message TEXT,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_campaign_id ON broadcast_deliveries (campaign_id);
