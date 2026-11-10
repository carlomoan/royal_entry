-- ==============================================================================
-- Migration: 0030_account_security.sql
-- Account security: forced password change for the default admin, and
-- brute-force lockout (failed attempts + lock window).
-- ==============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;