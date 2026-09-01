-- ==============================================================================
-- Migration: 0015_create_card_templates.sql
-- Global card templates for invitation design (SaaS-level, selectable by orgs)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS card_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    theme_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    preview_image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_templates_active ON card_templates (is_active) WHERE is_active = TRUE;