-- ==============================================================================
-- Migration: 0025_add_card_template_visibility.sql
-- SaaS-level template sharing: `is_global` marks platform templates that any
-- organization can select for their events. Org-created templates stay private
-- to their org unless marked global by a platform admin.
-- ==============================================================================

ALTER TABLE card_templates
    ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_card_templates_is_global ON card_templates(is_global);