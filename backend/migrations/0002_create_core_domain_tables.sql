-- ==============================================================================
-- Organizations, Events, Guests, Payments
-- ==============================================================================

-- Organizations (tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    account_slug TEXT UNIQUE,
    billing_email TEXT,
    contact_phone TEXT,
    account_status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (account_status IN ('pending_review', 'active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(account_status);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(account_slug);

-- Seed default organization for platform superadmin
INSERT INTO organizations (id, display_name, account_slug, account_status, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'RoyalEntry Platform',
    'royalentry-platform',
    'active',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TEXT,
    venue_name TEXT,
    venue_address TEXT,
    venue_latitude DOUBLE PRECISION,
    venue_longitude DOUBLE PRECISION,
    dress_code TEXT,
    event_logo_url TEXT,
    card_template_id UUID,
    card_theme TEXT,
    entry_start_time TEXT,
    entry_end_time TEXT,
    rsvp_deadline DATE,
    guest_count_expected INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    approval_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    send_save_the_date BOOLEAN NOT NULL DEFAULT FALSE,
    save_the_date_sent_at TIMESTAMPTZ,
    invitation_sent_at TIMESTAMPTZ,
    thank_you_message_template TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_events_org_date ON events (organization_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_active ON events (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_approval ON events (approval_status);

-- Guests
CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    table_number TEXT,
    guest_category TEXT CHECK (guest_category IN ('VIP', 'Regular', 'Staff', 'Family', 'Friend')),
    plus_one_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    contact_method TEXT NOT NULL DEFAULT 'whatsapp'
        CHECK (contact_method IN ('whatsapp', 'sms', 'email', 'telegram')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests (event_id);
CREATE INDEX IF NOT EXISTS idx_guests_event_phone ON guests (event_id, phone);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    payment_type TEXT NOT NULL,
    package_name TEXT,
    amount_tsh BIGINT NOT NULL,
    payment_method TEXT NOT NULL,
    payment_reference TEXT,
    transaction_id TEXT,
    checkout_request_id TEXT,
    mpesa_receipt_number TEXT,
    payer_phone TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
    payment_gateway TEXT NOT NULL,
    gateway_response TEXT,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_org_created_at ON payments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_request_id ON payments (checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
