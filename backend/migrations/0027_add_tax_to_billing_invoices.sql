-- ==============================================================================
-- Migration: 0027_add_tax_to_billing_invoices.sql
-- TRA VAT fields on invoices. `tax_inclusive` marks whether the invoice total
-- already includes VAT (Tanzania standard); `tax_amount_tsh` is the VAT portion.
-- ==============================================================================

ALTER TABLE billing_invoices
    ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(6,2) NOT NULL DEFAULT 0;

ALTER TABLE billing_invoices
    ADD COLUMN IF NOT EXISTS tax_amount_tsh BIGINT NOT NULL DEFAULT 0;

ALTER TABLE billing_invoices
    ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN NOT NULL DEFAULT TRUE;