CREATE TABLE IF NOT EXISTS service_plans (
    id UUID PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price_tsh BIGINT NOT NULL,
    billing_interval TEXT NOT NULL DEFAULT 'monthly',
    max_users INTEGER,
    max_events INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL UNIQUE,
    plan_id UUID NOT NULL REFERENCES service_plans(id),
    status TEXT NOT NULL DEFAULT 'trialing',
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    trial_ends_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_status
    ON organization_subscriptions (status, current_period_end DESC);

CREATE TABLE IF NOT EXISTS billing_invoices (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES service_plans(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    amount_tsh BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_status
    ON billing_invoices (organization_id, status, issued_at DESC);

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS subscription_id UUID,
    ADD COLUMN IF NOT EXISTS invoice_id UUID;

INSERT INTO service_plans (id, code, name, description, price_tsh, billing_interval, max_users, max_events, is_active)
VALUES
    ('5ce02da8-f538-4d22-bb2d-12b41690ef21', 'starter', 'Starter', 'Ideal for small family events and basic guest entry.', 150000, 'monthly', 3, 3, TRUE),
    ('5b1347b1-d9ee-4b59-a794-e9d8bfefed56', 'growth', 'Growth', 'For active organizers running multiple premium events.', 350000, 'monthly', 10, 12, TRUE),
    ('0c4d1ab0-af85-4274-aa52-6482c6c18f89', 'enterprise', 'Enterprise', 'Unlimited scale with premium support and advanced operations.', 900000, 'monthly', NULL, NULL, TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_tsh = EXCLUDED.price_tsh,
    billing_interval = EXCLUDED.billing_interval,
    max_users = EXCLUDED.max_users,
    max_events = EXCLUDED.max_events,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO organization_subscriptions (
    id,
    organization_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    trial_ends_at,
    created_at,
    updated_at
)
SELECT
    (
        substr(md5(orgs.organization_id::text || '-starter-subscription'), 1, 8) || '-' ||
        substr(md5(orgs.organization_id::text || '-starter-subscription'), 9, 4) || '-' ||
        substr(md5(orgs.organization_id::text || '-starter-subscription'), 13, 4) || '-' ||
        substr(md5(orgs.organization_id::text || '-starter-subscription'), 17, 4) || '-' ||
        substr(md5(orgs.organization_id::text || '-starter-subscription'), 21, 12)
    )::uuid,
    orgs.organization_id,
    '5ce02da8-f538-4d22-bb2d-12b41690ef21'::UUID,
    'active',
    NOW(),
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '14 days',
    NOW(),
    NOW()
FROM (
    SELECT DISTINCT organization_id
    FROM users
    WHERE organization_id IS NOT NULL
) AS orgs
WHERE NOT EXISTS (
    SELECT 1
    FROM organization_subscriptions os
    WHERE os.organization_id = orgs.organization_id
);
