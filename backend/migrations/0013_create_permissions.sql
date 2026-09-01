-- ==============================================================================
-- Migration: 0013_create_permissions.sql
-- Permission catalog for RBAC — documents all objects and actions in the system.
-- Mirrors backend rbac.rs ROLE_PERMISSIONS and frontend roles.ts.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (resource, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions (resource);

INSERT INTO permissions (resource, action) VALUES
    ('events', 'read'),
    ('events', 'write'),
    ('events', 'delete'),
    ('events', 'activate'),
    ('events', 'approve'),
    ('events', 'reject'),
    ('events', 'complete'),
    ('guests', 'read'),
    ('guests', 'write'),
    ('guests', 'delete'),
    ('guests', 'import'),
    ('invitations', 'read'),
    ('invitations', 'write'),
    ('invitations', 'generate'),
    ('invitations', 'send'),
    ('scanner', 'read'),
    ('scanner', 'write'),
    ('scanner', 'otp'),
    ('michango', 'read'),
    ('michango', 'write'),
    ('michango', 'payment'),
    ('broadcast', 'read'),
    ('broadcast', 'write'),
    ('payments', 'read'),
    ('payments', 'write'),
    ('reports', 'read'),
    ('reports', 'export'),
    ('audit', 'read'),
    ('audit', 'export'),
    ('team', 'read'),
    ('team', 'write'),
    ('settings', 'read'),
    ('settings', 'write'),
    ('platform', 'read'),
    ('platform', 'write'),
    ('platform', 'manage_users'),
    ('platform', 'manage_plans'),
    ('platform', 'manage_templates'),
    ('platform', 'manage_global_variables'),
    ('webhooks', 'read'),
    ('webhooks', 'write'),
    ('cards', 'read'),
    ('cards', 'write'),
    ('cards', 'design'),
    ('otp', 'send'),
    ('otp', 'verify')
ON CONFLICT (resource, action) DO NOTHING;

-- Role permission mapping (which roles can access which resources)
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role TEXT NOT NULL,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role);

-- Helper function to assign all permissions of a resource to a role
CREATE OR REPLACE FUNCTION grant_resource(role_name TEXT, res TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO role_permissions (role, permission_id)
    SELECT role_name, id FROM permissions WHERE resource = res
    ON CONFLICT (role, permission_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;