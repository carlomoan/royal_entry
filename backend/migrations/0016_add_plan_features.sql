-- ==============================================================================
-- Migration: 0016_add_plan_features.sql
-- Package feature assignment + guest limit enforcement
-- ==============================================================================

-- Add feature flags + guest limit to service_plans
ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS max_guests INTEGER;
ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Seed features for existing plans
UPDATE service_plans SET features = '{
  "events": true,
  "guests": true,
  "invitations": true,
  "scanner": true,
  "michango": true,
  "broadcast": true,
  "payments": true,
  "reports": true,
  "audit": true,
  "team": true,
  "settings": true,
  "cards": true,
  "webhooks": false,
  "api": false
}'::jsonb WHERE features = '{}'::jsonb;

-- Set sensible guest limits per plan
UPDATE service_plans SET max_guests = 55 WHERE code = 'starter' AND max_guests IS NULL;
UPDATE service_plans SET max_guests = 500 WHERE code = 'growth' AND max_guests IS NULL;
UPDATE service_plans SET max_guests = NULL WHERE code = 'enterprise' AND max_guests IS NULL;

-- Event assignment: which users are assigned to which events
CREATE TABLE IF NOT EXISTS event_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_assignments_user ON event_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_event_assignments_event ON event_assignments (event_id);