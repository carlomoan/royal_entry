-- ==============================================================================
-- Migration: 0009_create_email_templates.sql
-- Email templates with Handlebars support
-- ==============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT,
    variables TEXT[] NOT NULL DEFAULT '{}',
    category TEXT NOT NULL DEFAULT 'general',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates (organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates (category);
CREATE INDEX IF NOT EXISTS idx_email_templates_system ON email_templates (is_system) WHERE is_system = TRUE;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_email_templates_updated_at ON email_templates;
CREATE TRIGGER trigger_update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_email_templates_updated_at();