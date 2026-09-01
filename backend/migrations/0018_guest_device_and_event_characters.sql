-- ==============================================================================
-- Migration: 0018_guest_device_and_event_characters.sql
-- Adds fields required by the full event flow:
--   * guests.device_type  -> smartphone | feature_phone (determines check-in
--     method: QR code for smartphones, SMS link + OTP for feature phones)
--   * guests.whatsapp_phone -> separate WhatsApp contact (optional)
--   * events.main_characters -> main characters / speakers for invitation cards
--   * relax guest_category CHECK to include class levels (VVIP, VIP, Normal,
--     Premium) and special lists (Service Provider, Special Guest)
-- ==============================================================================

ALTER TABLE guests ADD COLUMN IF NOT EXISTS device_type TEXT NOT NULL DEFAULT 'smartphone'
    CHECK (device_type IN ('smartphone', 'feature_phone'));

ALTER TABLE guests ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- Relax the guest_category constraint to support class levels + special guests
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_guest_category_check;
ALTER TABLE guests ADD CONSTRAINT guests_guest_category_check CHECK (
    guest_category IN (
        'VVIP', 'VIP', 'Normal', 'Premium', 'Staff', 'Family', 'Friend',
        'Service Provider', 'Special Guest', 'Regular'
    )
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS main_characters TEXT;
