-- Comms Hub Stage 3: backfill pre-Stage-1 voicemail rows to correct message_type
-- Safe: only touches rows where message_type='sms' AND metadata marks them as voicemail
-- All other rows (real SMS, call_inbound, call_missed) are unaffected

UPDATE messages
SET message_type = 'voicemail'
WHERE message_type = 'sms'
  AND metadata->>'type' = 'voicemail';
