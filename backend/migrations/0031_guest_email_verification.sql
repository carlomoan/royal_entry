-- ==============================================================================
-- Migration: 0031_guest_email_verification.sql
-- Track whether a guest's email has been confirmed before sending invitations.
-- ==============================================================================

ALTER TABLE guests
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE guests
    ADD COLUMN IF NOT EXISTS email_verification_token TEXT;