-- ==============================================================================
-- Migration: 0026_add_voided_at_to_billing_invoices.sql
-- Track when an invoice was voided (soft-void) for audit purposes.
-- ==============================================================================

ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;