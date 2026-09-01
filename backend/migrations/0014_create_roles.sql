-- ==============================================================================
-- Migration: 0014_create_roles.sql
-- Dynamic roles & role-permission assignment for RBAC
-- Rebuilds role_permissions with a UUID id (the 0013 schema used a serial int
-- id that is incompatible with dynamic per-role permission strings).
-- ==============================================================================

-- Roles table — created/kept regardless of prior partial state
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    scope TEXT NOT NULL DEFAULT 'account' CHECK (scope IN ('platform', 'account')),
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_scope ON roles (scope);

-- Seed the built-in roles
INSERT INTO roles (id, code, name, scope, is_system) VALUES
    ('00000000-0000-0000-0000-000000000101', 'superadmin', 'Super Admin', 'platform', TRUE),
    ('00000000-0000-0000-0000-000000000102', 'platform_admin', 'Platform Admin', 'platform', TRUE),
    ('00000000-0000-0000-0000-000000000103', 'system_admin', 'System Admin', 'platform', TRUE),
    ('00000000-0000-0000-0000-000000000104', 'account_admin', 'Account Admin', 'account', TRUE),
    ('00000000-0000-0000-0000-000000000105', 'event_manager', 'Event Manager', 'account', TRUE),
    ('00000000-0000-0000-0000-000000000106', 'event_accountant', 'Event Accountant', 'account', TRUE),
    ('00000000-0000-0000-0000-000000000107', 'secretary', 'Secretary', 'account', TRUE),
    ('00000000-0000-0000-0000-000000000108', 'scanner_attendant', 'Scanner Attendant', 'account', TRUE),
    ('00000000-0000-0000-0000-000000000109', 'viewer', 'Viewer', 'account', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Rebuild role_permissions with a UUID id to match the application's dynamic RBAC.
-- (The 0013 table used a serial int id incompatible with per-role permission strings.)
DROP TABLE IF EXISTS role_permissions;

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role);

-- Seed default permissions for built-in account roles
INSERT INTO role_permissions (id, role_id, role, permission)
SELECT gen_random_uuid(), r.id, r.code, p
FROM roles r
CROSS JOIN unnest(ARRAY['events:*','guests:*','invitations:*','scanner:*','michango:*','broadcast:*','payments:*','reports:*','audit:*','team:*','settings:*','cards:*','invoices:*']) AS p
WHERE r.code = 'account_admin';

INSERT INTO role_permissions (id, role_id, role, permission)
SELECT gen_random_uuid(), r.id, r.code, p
FROM roles r
CROSS JOIN unnest(ARRAY['events:read','events:write','guests:*','invitations:*','scanner:*','broadcast:*','cards:*']) AS p
WHERE r.code = 'event_manager';

INSERT INTO role_permissions (id, role_id, role, permission)
SELECT gen_random_uuid(), r.id, r.code, p
FROM roles r
CROSS JOIN unnest(ARRAY['events:read','michango:*','payments:*','invoices:read']) AS p
WHERE r.code = 'event_accountant';

-- User-role assignment override (assign custom roles / per-user permissions)
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission TEXT,
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments (user_id);

-- Partial unique: one row per (user, permission) where role_id is NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_assignments_user_perm
    ON user_role_assignments (user_id, permission)
    WHERE role_id IS NULL AND permission IS NOT NULL;

-- Partial unique: one row per (user, role)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_assignments_user_role
    ON user_role_assignments (user_id, role_id)
    WHERE role_id IS NOT NULL AND permission IS NULL;