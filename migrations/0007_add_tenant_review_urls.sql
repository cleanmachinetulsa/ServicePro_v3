-- Stage 1C-a: Move review URLs from hardcoded strings into per-tenant config.
-- Adds google_review_url and facebook_review_url to tenant_config (NOT business_settings,
-- which is a global single-row table and would not provide per-tenant isolation).
-- Seeds the root tenant (Clean Machine) with its existing Google review URL so
-- behavior is preserved after the application code switches to branding.googleReviewUrl.

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS google_review_url TEXT,
  ADD COLUMN IF NOT EXISTS facebook_review_url TEXT;

UPDATE tenant_config
SET google_review_url = 'https://g.page/r/CQo53O2yXrN8EBM/review'
WHERE tenant_id = 'root'
  AND (google_review_url IS NULL OR google_review_url = '');

UPDATE tenant_config
SET facebook_review_url = 'https://www.facebook.com/CLEANMACHINETULSA'
WHERE tenant_id = 'root'
  AND (facebook_review_url IS NULL OR facebook_review_url = '');
