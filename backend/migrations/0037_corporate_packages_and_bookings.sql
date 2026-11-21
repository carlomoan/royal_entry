-- ==============================================================================
-- Migration: 0037_corporate_packages_and_bookings.sql
-- Corporate/concert mode: fixed packages sold to companies, bookings with
-- payment proof, and passes (guests) created when a booking is confirmed.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS event_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price_tsh BIGINT NOT NULL CHECK (price_tsh > 0),
    seats_per_table INTEGER NOT NULL DEFAULT 5 CHECK (seats_per_table > 0),
    card_template_id UUID REFERENCES card_templates(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_packages_event ON event_packages (event_id, is_active);

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_email TEXT,
    payment_reference TEXT,
    proof_file_id TEXT,
    amount_paid BIGINT NOT NULL DEFAULT 0,
    confirmed_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings (event_id, confirmed_at);

CREATE TABLE IF NOT EXISTS booking_packages (
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES event_packages(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    PRIMARY KEY (booking_id, package_id)
);

CREATE TABLE IF NOT EXISTS booking_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    package_id UUID REFERENCES event_packages(id) ON DELETE SET NULL,
    table_number TEXT NOT NULL,
    UNIQUE (booking_id, table_number)
);

ALTER TABLE guests
    ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES event_packages(id) ON DELETE SET NULL;