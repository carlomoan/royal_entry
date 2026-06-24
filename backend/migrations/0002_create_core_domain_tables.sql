CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
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
    approval_status TEXT NOT NULL DEFAULT 'pending',
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

CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    table_number TEXT,
    guest_category TEXT,
    plus_one_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    contact_method TEXT NOT NULL DEFAULT 'whatsapp',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests (event_id);
CREATE INDEX IF NOT EXISTS idx_guests_event_phone ON guests (event_id, phone);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    event_id UUID,
    payment_type TEXT NOT NULL,
    package_name TEXT,
    amount_tsh BIGINT NOT NULL,
    payment_method TEXT NOT NULL,
    payment_reference TEXT,
    transaction_id TEXT,
    checkout_request_id TEXT,
    mpesa_receipt_number TEXT,
    payer_phone TEXT,
    status TEXT NOT NULL,
    payment_gateway TEXT NOT NULL,
    gateway_response TEXT,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_org_created_at ON payments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_request_id ON payments (checkout_request_id);
