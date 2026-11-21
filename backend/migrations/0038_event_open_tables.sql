-- ==============================================================================
-- Migration: 0038_event_open_tables.sql
-- Organizer-declared open/shared tables used by the gate seating suggestion
-- after a booking's own reserved tables are full.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS event_open_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 5 CHECK (capacity > 0),
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_event_open_tables_event ON event_open_tables (event_id);
