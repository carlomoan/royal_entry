-- Manual fix for card_templates table schema
-- Run this directly in PostgreSQL to fix the existing table

-- Drop the existing table with wrong schema
DROP TABLE IF EXISTS card_templates CASCADE;

-- Recreate with correct schema
CREATE TABLE card_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    theme_config JSONB NOT NULL DEFAULT '{}', 
    background_file_id VARCHAR(255), 
    preview_image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_card_templates_org_id ON card_templates(org_id);
CREATE INDEX idx_card_templates_is_active ON card_templates(is_active);
