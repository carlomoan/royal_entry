-- ==============================================================================
-- Migration: 0029_fix_org_subscriptions_notes.sql
-- Migration 0019 intended to add `notes` to organization_subscriptions, but its
-- CREATE TABLE IF NOT EXISTS was a no-op because 0005 already created the table
-- without it. The OrganizationSubscription model expects the column, so every
-- `SELECT *` on the table failed at runtime ("no column found for name: notes"),
-- breaking the midnight invoice cron and plan changes.
-- ==============================================================================

ALTER TABLE organization_subscriptions
    ADD COLUMN IF NOT EXISTS notes TEXT;