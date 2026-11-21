-- ==============================================================================
-- Migration: 0039_booking_invoices_and_parking_variants.sql
-- Booking invoices (organizer TIN + VAT) and per-class parking instructions.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS booking_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    amount_tsh BIGINT NOT NULL CHECK (amount_tsh > 0),
    tax_rate_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
    tax_amount_tsh BIGINT NOT NULL DEFAULT 0,
    tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    tin TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_invoices_booking ON booking_invoices (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_invoices_event ON booking_invoices (event_id);

CREATE TABLE IF NOT EXISTS event_parking_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    instructions TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, class_name)
);

CREATE INDEX IF NOT EXISTS idx_event_parking_variants_event ON event_parking_variants (event_id);
