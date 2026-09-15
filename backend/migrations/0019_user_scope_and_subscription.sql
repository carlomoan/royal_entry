-- ==============================================================================
-- 0019_user_scope_and_subscription.sql
-- Adds the `user_scope` column to users (global | account), makes
-- `organization_id` nullable for global users, and adds the
-- `organization_subscriptions` table to gate account access.
-- ==============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_scope TEXT NOT NULL DEFAULT 'account'
    CHECK (user_scope IN ('global', 'account'));

-- Make organization_id nullable for global users
ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;

-- Backfill: platform roles are always global
UPDATE users
SET user_scope = 'global', organization_id = NULL
WHERE role IN ('superadmin', 'platform_admin', 'system_admin');

-- Backfill: anyone whose organization_id is the platform org is global
UPDATE users
SET user_scope = 'global', organization_id = NULL
WHERE organization_id = '00000000-0000-0000-0000-000000000000';

CREATE INDEX IF NOT EXISTS idx_users_scope ON users (user_scope);

-- ==============================================================================
-- Organization subscriptions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES service_plans(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'trialing', 'past_due', 'cancelled', 'expired')),
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_subs_org ON organization_subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_status ON organization_subscriptions (status);

-- Seed starter subscriptions for any existing organization that doesn't have one.
INSERT INTO organization_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
SELECT o.id,
       (SELECT id FROM service_plans WHERE code = 'starter' LIMIT 1),
       'active',
       NOW(),
       NOW() + INTERVAL '30 days'
FROM organizations o
LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
WHERE o.id <> '00000000-0000-0000-0000-000000000000'
  AND s.id IS NULL;

-- Add account_enabled column to organizations for quick gating
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS account_enabled BOOLEAN NOT NULL DEFAULT TRUE;
