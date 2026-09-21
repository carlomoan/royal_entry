-- ==============================================================================
-- Migration: 0022_create_message_templates.sql
-- Channel-aware message templates for broadcast
-- ==============================================================================

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel_kind TEXT NOT NULL CHECK (channel_kind IN ('sms', 'whatsapp', 'email', 'telegram')),
    subject TEXT,
    body TEXT NOT NULL,
    attachments_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_org ON message_templates (org_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON message_templates (channel_kind);
