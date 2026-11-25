-- ==============================================================================
-- Migration: 0043_document_templates_and_public_invoices.sql
-- Editable document templates (invoice, receipt, report, card) and public
-- tokens so links sent to guests/companies open without a login.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('invoice', 'receipt', 'report', 'checkin_card', 'invitation')),
    name TEXT NOT NULL,
    subject TEXT,
    body_html TEXT NOT NULL,
    variables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_templates_kind ON document_templates (kind, is_active);

-- System defaults (org_id NULL = visible to every account).
INSERT INTO document_templates (org_id, kind, name, subject, body_html, variables_json, is_system)
VALUES
    (NULL, 'invoice', 'Standard Invoice', 'Invoice {{invoice_number}}',
     '<div style="font-family:Arial;max-width:700px;margin:auto"><h1 style="color:#0a1628">ROYALENTRY</h1><h2>Invoice {{invoice_number}}</h2><p>{{organization_name}}</p><p>Date: {{issued_at}}</p><p>Amount: {{amount_tsh}}</p><p>VAT: {{tax_amount_tsh}}</p><p>Total: {{total_tsh}}</p><p>TIN: {{tin}}</p></div>',
     '["invoice_number","organization_name","issued_at","amount_tsh","tax_amount_tsh","total_tsh","tin"]'::jsonb, TRUE),
    (NULL, 'receipt', 'Standard Receipt', 'Receipt {{receipt_number}}',
     '<div style="font-family:Arial;max-width:700px;margin:auto"><h1 style="color:#0a1628">ROYALENTRY</h1><h2>Payment Receipt</h2><p>{{guest_name}}</p><p>Amount: {{amount_tsh}}</p><p>Method: {{payment_method}}</p><p>Reference: {{reference}}</p></div>',
     '["receipt_number","guest_name","amount_tsh","payment_method","reference"]'::jsonb, TRUE),
    (NULL, 'report', 'Event Report', '{{event_title}} report',
     '<div style="font-family:Arial"><h1>{{event_title}}</h1><p>Guests: {{total_guests}}</p><p>Arrived: {{guests_arrived}}</p><p>Collected: {{michango_collected_tsh}}</p></div>',
     '["event_title","total_guests","guests_arrived","michango_collected_tsh"]'::jsonb, TRUE)
ON CONFLICT DO NOTHING;

ALTER TABLE booking_invoices ADD COLUMN IF NOT EXISTS public_token TEXT;
UPDATE booking_invoices SET public_token = replace(gen_random_uuid()::text, '-', '')
    WHERE public_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_invoices_public_token ON booking_invoices (public_token);
