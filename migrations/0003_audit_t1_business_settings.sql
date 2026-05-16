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

-- Backfill the singleton business_settings row (id=1) with the Clean Machine
-- service area + persona so existing behavior is preserved after de-hardcoding
-- `BUSINESS_LOCATION`. Note: business_settings is currently a singleton (no
-- tenant_id column); per-tenant scoping is achieved via tenantDb at the
-- application layer.
UPDATE business_settings
SET
  service_area_center_lat = COALESCE(service_area_center_lat, 36.0900000),
  service_area_center_lng = COALESCE(service_area_center_lng, -95.9750000),
  chat_persona_name       = COALESCE(chat_persona_name, 'Clean Machine Assistant')
WHERE id = 1;

-- Drop legacy global UNIQUE constraints on customers (phone, email).
-- The schema's tenant-scoped uniqueness (customers_tenant_phone_unique)
-- is the correct multi-tenant invariant; the global ones contradicted it
-- and prevented two tenants from having a customer with the same number.
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_unique;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_unique;
