-- ==============================================================================
-- Migration: 0017_starter_single_event.sql
-- Starter package allows only 1 event (was 3). Guest limit stays 55.
-- ==============================================================================

UPDATE service_plans SET max_events = 1 WHERE code = 'starter';