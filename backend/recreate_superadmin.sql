-- Recreate the initial superadmin user with all permissions
-- Run this after PostgreSQL is started

INSERT INTO users (id, organization_id, email, phone, full_name, password_hash, role, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'superadmin@royalentry.co.tz',
    '+255700000000',
    'Super Admin',
    '$argon2id$v=19$m=19456,t=2,p=1$placeholder_replace_with_real_hash',
    'superadmin',
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Ensure all permissions are assigned to superadmin role
INSERT INTO role_permissions (id, role_id, role, permission)
SELECT gen_random_uuid(), r.id, r.code, p
FROM roles r
CROSS JOIN unnest(ARRAY[
    'events:read', 'events:write', 'events:delete', 'events:activate', 'events:approve', 'events:reject', 'events:complete',
    'guests:read', 'guests:write', 'guests:delete', 'guests:import', 'guests:csv',
    'invitations:read', 'invitations:write', 'invitations:generate', 'invitations:send',
    'scanner:read', 'scanner:write', 'scanner:otp',
    'michango:read', 'michango:write', 'michango:payment', 'michango:remind',
    'broadcast:read', 'broadcast:write', 'broadcast:sms', 'broadcast:whatsapp', 'broadcast:email', 'broadcast:telegram',
    'payments:read', 'payments:write', 'payments:receipt', 'payments:invoice',
    'reports:read', 'reports:export',
    'audit:read', 'audit:export',
    'team:read', 'team:write',
    'settings:read', 'settings:write',
    'platform:read', 'platform:write', 'platform:manage_users', 'platform:manage_plans', 'platform:manage_templates', 'platform:manage_global_variables',
    'webhooks:read', 'webhooks:write',
    'cards:read', 'cards:write', 'cards:design', 'cards:checkin',
    'otp:send', 'otp:verify',
    'roles:read', 'roles:write', 'roles:assign',
    'invoices:read', 'invoices:write'
]) AS p
WHERE r.code = 'superadmin'
ON CONFLICT (role_id, permission) DO NOTHING;
