-- ==============================================================================
-- 0006_create_settings_and_audit.sql
-- Audit logs, system settings and organization (account) settings tables
-- ==============================================================================

-- ── Audit logs ────────────────────────────────────────────────────────────────
-- Written by the audit middleware for every authenticated request.
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID,
    organization_id UUID,
    user_email TEXT,
    role TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    action TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    request_query TEXT,
    target_resource_type TEXT,
    target_resource_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at
    ON audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_occurred
    ON audit_logs (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_occurred
    ON audit_logs (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs (action);

-- ── System-wide settings (platform scope) ────────────────────────────────────
-- Key/value store for global configuration managed by platform administrators.
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_by_user_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key
    ON system_settings (setting_key);

-- ── Organization (account) settings ──────────────────────────────────────────
-- Key/value store for per-organization configuration managed by account admins.
CREATE TABLE IF NOT EXISTS organization_settings (
    organization_id UUID NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    updated_by_user_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_organization_settings_org_key
    ON organization_settings (organization_id, setting_key);
