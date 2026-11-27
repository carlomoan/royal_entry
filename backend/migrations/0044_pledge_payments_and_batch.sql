-- ==============================================================================
-- Migration: 0044_pledge_payments_and_batch.sql
-- Individual pledge payment records (so bulk entries are traceable) and a
-- batch id for broadcasts sent through provider multi endpoints.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS pledge_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    pledge_id UUID NOT NULL REFERENCES pledge_tracker(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    amount_tsh BIGINT NOT NULL CHECK (amount_tsh > 0),
    payment_method TEXT NOT NULL DEFAULT 'manual',
    payment_reference TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    batch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pledge_payments_event ON pledge_payments (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pledge_payments_pledge ON pledge_payments (pledge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pledge_payments_batch ON pledge_payments (batch_id);

ALTER TABLE broadcast_campaigns ADD COLUMN IF NOT EXISTS batch_id UUID;
