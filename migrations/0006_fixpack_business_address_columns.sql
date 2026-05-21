-- Fixpack Task 1: Add tenant address columns for geocoding bias
-- Applied directly in fixpack (bypassed drizzle-kit due to journal conflict)
-- This file documents what was applied and ensures fresh environments work

ALTER TABLE "business_settings"
  ADD COLUMN IF NOT EXISTS "business_city" text,
  ADD COLUMN IF NOT EXISTS "business_state" text,
  ADD COLUMN IF NOT EXISTS "business_zip_prefix" text;

-- Seed Clean Machine's row (idempotent)
UPDATE "business_settings"
SET
  business_city = COALESCE(business_city, 'Tulsa'),
  business_state = COALESCE(business_state, 'OK'),
  business_zip_prefix = COALESCE(business_zip_prefix, '74')
WHERE tenant_id = 'root';
