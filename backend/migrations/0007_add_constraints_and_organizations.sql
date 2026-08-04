-- ==============================================================================
-- 0007_add_constraints_and_organizations.sql
-- Add missing organizations table, CHECK constraints, and foreign keys
-- ==============================================================================

-- ── Create organizations table (CRITICAL - missing from previous migrations) ──
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,
    display_name TEXT NOT NULL,
    account_slug TEXT UNIQUE,
    billing_email TEXT,
    contact_phone TEXT,
    account_status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (account_status IN ('pending_review', 'active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(account_status);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(account_slug);

-- ── Seed default platform organization ───────────────────────────────────────
INSERT INTO organizations (id, display_name, account_slug, account_status, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'RoyalEntry Platform',
    'royalentry-platform',
    'active',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- ── Add CHECK constraint to users.role (new RBAC system) ─────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
    role IN (
        -- Platform roles
        'superadmin', 'platform_admin', 'system_admin',
        -- Account roles
        'account_admin', 'event_manager', 'event_accountant',
        'secretary', 'scanner_attendant', 'viewer'
    )
);

-- ── Add foreign key constraints ──────────────────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_organization;
ALTER TABLE users ADD CONSTRAINT fk_users_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE events DROP CONSTRAINT IF EXISTS fk_events_organization;
ALTER TABLE events ADD CONSTRAINT fk_events_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_organization;
ALTER TABLE payments ADD CONSTRAINT fk_payments_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_organization;
ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE organization_settings DROP CONSTRAINT IF EXISTS fk_org_settings_organization;
ALTER TABLE organization_settings ADD CONSTRAINT fk_org_settings_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE organization_subscriptions DROP CONSTRAINT IF EXISTS fk_org_subscriptions_organization;
ALTER TABLE organization_subscriptions ADD CONSTRAINT fk_org_subscriptions_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE billing_invoices DROP CONSTRAINT IF EXISTS fk_billing_invoices_organization;
ALTER TABLE billing_invoices ADD CONSTRAINT fk_billing_invoices_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ── Add CHECK constraints to existing tables ─────────────────────────────────

-- Events
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_approval_status_check;
ALTER TABLE events ADD CONSTRAINT events_approval_status_check CHECK (
    approval_status IN ('pending', 'approved', 'rejected')
);

-- Guests
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_guest_category_check;
ALTER TABLE guests ADD CONSTRAINT guests_guest_category_check CHECK (
    guest_category IS NULL OR guest_category IN ('VIP', 'Regular', 'Staff', 'Family', 'Friend')
);

ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_contact_method_check;
ALTER TABLE guests ADD CONSTRAINT guests_contact_method_check CHECK (
    contact_method IN ('whatsapp', 'sms', 'email', 'telegram')
);

-- Payments
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (
    status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')
);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check CHECK (
    payment_method IN ('mpesa', 'card', 'bank_transfer', 'manual')
);

-- Invitations
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_status_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_status_check CHECK (
    status IN ('pending', 'sent', 'viewed', 'scanned', 'expired')
);

-- RSVP Responses
ALTER TABLE rsvp_responses DROP CONSTRAINT IF EXISTS rsvp_responses_response_check;
ALTER TABLE rsvp_responses ADD CONSTRAINT rsvp_responses_response_check CHECK (
    response IN ('pending', 'confirmed', 'declined')
);

-- Pledge Tracker
ALTER TABLE pledge_tracker DROP CONSTRAINT IF EXISTS pledge_tracker_payment_status_check;
ALTER TABLE pledge_tracker ADD CONSTRAINT pledge_tracker_payment_status_check CHECK (
    payment_status IN ('pending', 'partial', 'paid', 'overdue')
);

ALTER TABLE pledge_tracker DROP CONSTRAINT IF EXISTS pledge_tracker_amounts_check;
ALTER TABLE pledge_tracker ADD CONSTRAINT pledge_tracker_amounts_check CHECK (
    pledged_amount > 0 AND amount_paid >= 0
);

-- Broadcast Campaigns
ALTER TABLE broadcast_campaigns DROP CONSTRAINT IF EXISTS broadcast_campaigns_channel_check;
ALTER TABLE broadcast_campaigns ADD CONSTRAINT broadcast_campaigns_channel_check CHECK (
    message_channel IN ('whatsapp', 'sms', 'both')
);

ALTER TABLE broadcast_campaigns DROP CONSTRAINT IF EXISTS broadcast_campaigns_target_check;
ALTER TABLE broadcast_campaigns ADD CONSTRAINT broadcast_campaigns_target_check CHECK (
    target_audience IN ('all', 'vip', 'confirmed', 'declined', 'not_rsvp')
);

ALTER TABLE broadcast_campaigns DROP CONSTRAINT IF EXISTS broadcast_campaigns_status_check;
ALTER TABLE broadcast_campaigns ADD CONSTRAINT broadcast_campaigns_status_check CHECK (
    status IN ('processing', 'sent', 'partial', 'failed')
);

-- Broadcast Deliveries
ALTER TABLE broadcast_deliveries DROP CONSTRAINT IF EXISTS broadcast_deliveries_status_check;
ALTER TABLE broadcast_deliveries ADD CONSTRAINT broadcast_deliveries_status_check CHECK (
    status IN ('sent', 'failed')
);

-- Reminder Deliveries
ALTER TABLE reminder_deliveries DROP CONSTRAINT IF EXISTS reminder_deliveries_status_check;
ALTER TABLE reminder_deliveries ADD CONSTRAINT reminder_deliveries_status_check CHECK (
    status IN ('sent', 'failed')
);

-- Service Plans
ALTER TABLE service_plans DROP CONSTRAINT IF EXISTS service_plans_billing_interval_check;
ALTER TABLE service_plans ADD CONSTRAINT service_plans_billing_interval_check CHECK (
    billing_interval IN ('monthly', 'yearly', 'weekly')
);

ALTER TABLE service_plans DROP CONSTRAINT IF EXISTS service_plans_price_check;
ALTER TABLE service_plans ADD CONSTRAINT service_plans_price_check CHECK (
    price_tsh >= 0
);

-- Organization Subscriptions
ALTER TABLE organization_subscriptions DROP CONSTRAINT IF EXISTS org_subscriptions_status_check;
ALTER TABLE organization_subscriptions ADD CONSTRAINT org_subscriptions_status_check CHECK (
    status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')
);

-- Billing Invoices
ALTER TABLE billing_invoices DROP CONSTRAINT IF EXISTS billing_invoices_status_check;
ALTER TABLE billing_invoices ADD CONSTRAINT billing_invoices_status_check CHECK (
    status IN ('open', 'paid', 'void', 'overdue')
);

ALTER TABLE billing_invoices DROP CONSTRAINT IF EXISTS billing_invoices_amount_check;
ALTER TABLE billing_invoices ADD CONSTRAINT billing_invoices_amount_check CHECK (
    amount_tsh > 0
);

-- ── Add missing indexes for performance ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_guests_guest_category ON guests(guest_category);
CREATE INDEX IF NOT EXISTS idx_pledge_tracker_deadline ON pledge_tracker(payment_deadline);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON broadcast_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON billing_invoices(status);

-- ── Seed default superadmin user ─────────────────────────────────────────────
-- Password: "RoyalEntry@2026" (CHANGE THIS IMMEDIATELY!)
-- ── Seed default superadmin user ─────────────────────────────────────────────
INSERT INTO users (id, organization_id, email, full_name, password_hash, role, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'superadmin@royalentry.co',
    'Super Admin',
    '$argon2id$v=19$m=19456,t=2,p=1$placeholder_replace_with_real_hash',
    'superadmin',
    TRUE,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING; -- ✅ FIXED: Checks the primary key instead
