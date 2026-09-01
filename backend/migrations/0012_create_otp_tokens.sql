-- ==============================================================================
-- Migration: 0012_create_otp_tokens.sql
-- OTP tokens for SMS-link guest verification at event scanning
-- ==============================================================================

CREATE TABLE IF NOT EXISTS otp_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    invitation_short_link TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    engaged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_tokens_link ON otp_tokens (invitation_short_link, event_id);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_guest ON otp_tokens (guest_id);