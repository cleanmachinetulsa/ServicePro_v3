-- R1.6 State Hygiene + Confirmation Integrity Migration
-- Adds booking offer arming and automation pause columns to conversations table

-- Booking offer arming columns (for TTL-based slot confirmation)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS booking_offer_armed_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS booking_offer_expires_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS booking_offer_payload_hash TEXT;

-- Automation pause control (prevents AI from running when escalated)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS automation_paused_until TIMESTAMPTZ;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS conversations_booking_offer_expires_idx ON conversations (booking_offer_expires_at) WHERE booking_offer_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_automation_paused_idx ON conversations (automation_paused_until) WHERE automation_paused_until IS NOT NULL;
