-- ==============================================================================
-- Migration: 0010_create_usage_metrics.sql
-- Usage tracking for plan limits enforcement
-- ==============================================================================

CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    value BIGINT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_org_date ON usage_metrics (organization_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_lookup ON usage_metrics (organization_id, metric_name);

-- Add plan limit columns to service_plans if not exists
ALTER TABLE service_plans 
ADD COLUMN IF NOT EXISTS max_storage_mb INTEGER,
ADD COLUMN IF NOT EXISTS max_api_calls_per_month INTEGER;

-- Update existing plans with default limits for new columns only
UPDATE service_plans SET 
    max_storage_mb = CASE 
        WHEN code = 'starter' THEN 100
        WHEN code = 'growth' THEN 1000
        WHEN code = 'enterprise' THEN NULL
        ELSE 100
    END,
    max_api_calls_per_month = CASE 
        WHEN code = 'starter' THEN 10000
        WHEN code = 'growth' THEN 100000
        WHEN code = 'enterprise' THEN NULL
        ELSE 10000
    END
WHERE max_storage_mb IS NULL;