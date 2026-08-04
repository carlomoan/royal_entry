-- ==============================================================================
-- Users table with new 13-step workflow RBAC roles
-- ==============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (
        role IN (
            -- Platform roles
            'superadmin', 'platform_admin', 'system_admin',
            -- Account roles
            'account_admin', 'event_manager', 'event_accountant',
            'secretary', 'scanner_attendant', 'viewer'
        )
    ),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users (email, is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Seed default superadmin (password: "RoyalEntry@2026" - CHANGE THIS!)
INSERT INTO users (id, organization_id, email, full_name, password_hash, role, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'superadmin@royalentry.co.tz',
    'Super Admin',
    '$argon2id$v=19$m=19456,t=2,p=1$placeholder_replace_with_real_hash',
    'superadmin',
    TRUE,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;
