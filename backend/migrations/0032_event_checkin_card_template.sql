-- ==============================================================================
-- Migration: 0032_event_checkin_card_template.sql
-- A second card template per event: the invitation card and the check-in
-- card/ticket can use different designs.
-- ==============================================================================

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS checkin_card_template_id UUID;