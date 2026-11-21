-- ==============================================================================
-- Migration: 0036_arrival_messages_and_reminders.sql
-- Arrival messages (per event/class, scheduled) and reminder stage tracking.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS arrival_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_category TEXT, -- NULL = all guests
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT, -- image | audio | video
    contribution_block TEXT,
    release_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arrival_messages_event ON arrival_messages (event_id, guest_category, release_at);

ALTER TABLE pledge_tracker
    ADD COLUMN IF NOT EXISTS reminder_stages TEXT[] NOT NULL DEFAULT '{}';