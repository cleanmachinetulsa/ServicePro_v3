-- Comms Hub Stage 1: Voice as Message Persistence
-- Adds a discriminator column so inbound calls can be persisted into the
-- same `messages` table SMS uses, without disturbing existing SMS rows.
-- Valid values: 'sms' | 'call_inbound' | 'call_missed' | 'voicemail'
-- Additive + backward compatible: every existing row defaults to 'sms'.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'sms';

-- Helpful index for looking up the call-arrival row by Twilio CallSid
-- (stored in metadata jsonb) when the voicemail/recording webhook fires.
CREATE INDEX IF NOT EXISTS messages_metadata_call_sid_idx
  ON messages ((metadata->>'callSid'))
  WHERE metadata ? 'callSid';

-- Idempotency guard: Twilio retries /twilio/voice/incoming on 5xx, and the
-- caller has no other natural key, so we dedupe at the DB level. Only enforced
-- for the initial 'call_inbound' marker — voicemail/missed-call upgrades to
-- the same row are allowed (and are the intended workflow).
CREATE UNIQUE INDEX IF NOT EXISTS messages_call_inbound_callsid_unique_idx
  ON messages (tenant_id, (metadata->>'callSid'))
  WHERE message_type = 'call_inbound' AND metadata ? 'callSid';
