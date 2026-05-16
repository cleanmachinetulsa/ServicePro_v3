-- Audit T1 (Task #17): Cross-channel customer threads.
-- Adds the `customer_threads` table (one row per (tenant_id, customer_id))
-- and a nullable `thread_id` FK on `conversations` so that SMS, web chat,
-- Facebook/Instagram and email conversations for the same identified customer
-- share one source of truth for escalation, automation pause, and live
-- booking offers.
--
-- Idempotent: every statement uses IF NOT EXISTS so the migration can be
-- re-run safely. Anonymous web-chat conversations keep `thread_id = NULL`
-- and continue to read state from their own conversation row.

CREATE TABLE IF NOT EXISTS customer_threads (
  id                          serial PRIMARY KEY,
  tenant_id                   varchar(50)  NOT NULL DEFAULT 'root',
  customer_id                 integer      NOT NULL REFERENCES customers(id),
  status                      varchar(20)  NOT NULL DEFAULT 'active',
  control_mode                varchar(20)  NOT NULL DEFAULT 'auto',
  automation_paused_until     timestamptz,
  needs_human_attention       boolean      NOT NULL DEFAULT false,
  needs_human_reason          text,
  last_message_at             timestamptz  DEFAULT now(),
  booking_offer_armed_at      timestamptz,
  booking_offer_expires_at    timestamptz,
  booking_offer_payload_hash  text,
  created_at                  timestamptz  DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_threads_tenant_customer_unique
  ON customer_threads (tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_threads_tenant_id_idx
  ON customer_threads (tenant_id);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS thread_id integer REFERENCES customer_threads(id);

CREATE INDEX IF NOT EXISTS conversations_thread_id_idx
  ON conversations (thread_id);
