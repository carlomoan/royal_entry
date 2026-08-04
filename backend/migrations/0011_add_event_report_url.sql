-- ==============================================================================
-- Migration: 0011_add_event_report_url.sql
-- Add report_url column to events table for storing generated PDF URL
-- ==============================================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS report_url TEXT;