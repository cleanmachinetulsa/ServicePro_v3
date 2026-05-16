-- Audit T1 (Task #15): web chat tenant config + de-hardcoding
-- Adds tenant-customizable chat widget, service-area origin, AI budget,
-- and per-tenant web-chat rate limit columns. Idempotent via IF NOT EXISTS.

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS service_area_center_lat numeric(10, 7),
  ADD COLUMN IF NOT EXISTS service_area_center_lng numeric(10, 7),
  ADD COLUMN IF NOT EXISTS chat_greeting text,
  ADD COLUMN IF NOT EXISTS chat_persona_name varchar(100),
  ADD COLUMN IF NOT EXISTS chat_avatar_url text,
  ADD COLUMN IF NOT EXISTS web_chat_rate_limit_per_window integer,
  ADD COLUMN IF NOT EXISTS ai_daily_token_budget integer,
  ADD COLUMN IF NOT EXISTS ai_budget_exhausted_reply text;

-- Backfill the Clean Machine root tenant with its known service area + persona
-- so existing behavior is preserved after de-hardcoding `BUSINESS_LOCATION`.
UPDATE business_settings bs
SET
  service_area_center_lat = COALESCE(bs.service_area_center_lat, 36.0900000),
  service_area_center_lng = COALESCE(bs.service_area_center_lng, -95.9750000),
  chat_persona_name       = COALESCE(bs.chat_persona_name, 'Clean Machine Assistant')
FROM tenants t
WHERE bs.tenant_id = t.id
  AND (t.name ILIKE '%clean machine%' OR t.subdomain ILIKE '%clean%');

-- Drop legacy global UNIQUE constraints on customers (phone, email).
-- The schema's tenant-scoped uniqueness (customers_tenant_phone_unique)
-- is the correct multi-tenant invariant; the global ones contradicted it
-- and prevented two tenants from having a customer with the same number.
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_unique;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_unique;
