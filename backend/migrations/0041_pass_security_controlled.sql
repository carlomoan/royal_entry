-- ==============================================================================
-- Migration: 0041_pass_security_controlled.sql
-- Pass lifecycle security: per-event security level, named passes, revocation,
-- workflow states, contact verification, gate identity and audit trail.
-- ==============================================================================

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS pass_security_level TEXT NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS name_cutoff_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auto_issue_passes BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_pass_security_level_check;
ALTER TABLE events ADD CONSTRAINT events_pass_security_level_check
    CHECK (pass_security_level IN ('standard', 'controlled', 'maximum'));

-- Controlled is the default for corporate events going forward.
UPDATE events SET pass_security_level = 'controlled' WHERE event_mode = 'corporate';

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'requested',
    ADD COLUMN IF NOT EXISTS registration_token TEXT,
    ADD COLUMN IF NOT EXISTS contact_email_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS contact_verification_token TEXT,
    ADD COLUMN IF NOT EXISTS contact_email_is_free BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE bookings SET registration_token = replace(gen_random_uuid()::text, '-', '')
    WHERE registration_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_registration_token ON bookings (registration_token);

ALTER TABLE guests
    ADD COLUMN IF NOT EXISTS pass_state TEXT NOT NULL DEFAULT 'unnamed',
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS named_at TIMESTAMPTZ;

ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_pass_state_check;
ALTER TABLE guests ADD CONSTRAINT guests_pass_state_check
    CHECK (pass_state IN ('unnamed', 'named', 'issued', 'revoked', 'checked_in'));

ALTER TABLE entry_scans ADD COLUMN IF NOT EXISTS gate TEXT;

CREATE TABLE IF NOT EXISTS pass_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pass_audit_event ON pass_audit (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pass_audit_guest ON pass_audit (guest_id, created_at DESC);

-- Device/location openings are recorded for share detection (Maximum level).
CREATE TABLE IF NOT EXISTS pass_openings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    ip_hash TEXT,
    user_agent TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pass_openings_guest ON pass_openings (guest_id, opened_at DESC);
