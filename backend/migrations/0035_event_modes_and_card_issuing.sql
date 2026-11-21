-- ==============================================================================
-- Migration: 0035_event_modes_and_card_issuing.sql
-- Shared foundation for family and corporate/concert events:
--   * event mode + card-issue policy + arrival/parking/OTP settings
--   * guest pass fields (party size, seat, issued-at)
--   * family approvals for partly-paid guests
-- ==============================================================================

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS event_mode TEXT NOT NULL DEFAULT 'family',
    ADD COLUMN IF NOT EXISTS checkin_policy TEXT NOT NULL DEFAULT 'family_approval',
    ADD COLUMN IF NOT EXISTS min_percent INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS card_issue_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS parking_instructions TEXT,
    ADD COLUMN IF NOT EXISTS otp_mode TEXT NOT NULL DEFAULT 'feature_phone_only',
    ADD COLUMN IF NOT EXISTS otp_channels TEXT[] NOT NULL DEFAULT ARRAY['sms','whatsapp','email'],
    ADD COLUMN IF NOT EXISTS pledge_deadline_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS min_pledge_per_person BIGINT,
    ADD COLUMN IF NOT EXISTS min_pledge_plus_one BIGINT,
    ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

ALTER TABLE guests
    ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS seat_number TEXT,
    ADD COLUMN IF NOT EXISTS card_issued_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS card_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    approved_by UUID NOT NULL REFERENCES users(id),
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    balance_at_approval BIGINT NOT NULL DEFAULT 0,
    note TEXT,
    withdrawn_at TIMESTAMPTZ,
    UNIQUE (event_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_card_approvals_event ON card_approvals (event_id, withdrawn_at);