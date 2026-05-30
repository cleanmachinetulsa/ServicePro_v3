-- CM-2: Add delivered_at to port_recovery_sms_sends for Twilio delivery-status tracking.
-- The Twilio status callback updates this column when a campaign SMS is confirmed delivered.
-- Additive only — no DROP, no ALTER COLUMN, no destructive statements.

ALTER TABLE port_recovery_sms_sends
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
