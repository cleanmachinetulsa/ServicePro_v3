-- migrations/0010_call_outbound_message_type.sql
-- Comms Hub Stage 4: Outbound Call Tracking
--
-- No schema change required — messages.message_type is TEXT, not an enum.
-- This file documents that 'call_outbound' is a valid value as of Stage 4.
--
-- Valid message_type values after this stage:
--   'sms' | 'call_inbound' | 'call_missed' | 'voicemail' | 'call_outbound'
--
-- Idempotency guard for outbound calls: Twilio retries terminal status
-- callbacks on 5xx, and click-to-call status + number-level outbound-status
-- can both fire for the same CallSid. Add a unique partial index analogous
-- to migration 0008's call_inbound guard so duplicate writes hit a 23505
-- and are swallowed at the app layer (see persistOutboundCall).
CREATE UNIQUE INDEX IF NOT EXISTS messages_call_outbound_callsid_unique_idx
  ON messages (tenant_id, (metadata->>'callSid'))
  WHERE message_type = 'call_outbound' AND metadata ? 'callSid';
