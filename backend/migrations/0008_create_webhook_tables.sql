-- ==============================================================================
-- Migration: 0008_create_webhook_tables.sql
-- Webhook endpoints and deliveries
-- ==============================================================================

-- Webhook Endpoints
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints (organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints (is_active) WHERE is_active = TRUE;

-- Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    attempt INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivering', 'success', 'failed', 'abandoned')),
    error TEXT,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries (endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries (status, next_retry_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries (created_at DESC);

-- Trigger to update updated_at on webhook_endpoints
CREATE OR REPLACE FUNCTION update_webhook_endpoints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER trigger_update_webhook_endpoints_updated_at
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_webhook_endpoints_updated_at();