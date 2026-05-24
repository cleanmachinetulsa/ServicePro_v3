-- FIX-3B: Create sms_suppression_list table
-- Per-tenant opt-out, bounce, and manual suppression tracking for SMS campaigns

CREATE TABLE IF NOT EXISTS sms_suppression_list (
  id              SERIAL PRIMARY KEY,
  tenant_id       VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number    VARCHAR(20)  NOT NULL,
  reason          VARCHAR(50)  NOT NULL DEFAULT 'opt_out',
  suppressed_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  suppressed_by   INTEGER      REFERENCES users(id),
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sms_suppression_tenant_phone_idx
  ON sms_suppression_list (tenant_id, phone_number);

CREATE INDEX IF NOT EXISTS sms_suppression_tenant_idx
  ON sms_suppression_list (tenant_id);
