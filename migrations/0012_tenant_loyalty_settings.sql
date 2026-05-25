-- Stage L1-1: Create per-tenant loyalty settings table
-- Replaces global business_settings guardrail columns (GAM-1 in debt ledger)
-- Additive only. No existing table is modified.

CREATE TABLE IF NOT EXISTS tenant_loyalty_settings (
  id                  serial PRIMARY KEY,
  tenant_id           varchar(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  points_per_dollar   integer NOT NULL DEFAULT 1,
  min_cart_total_cents integer NOT NULL DEFAULT 0,
  requires_core_service boolean NOT NULL DEFAULT false,
  guardrail_message   text,
  tier_thresholds     jsonb NOT NULL DEFAULT '{"bronze":0,"silver":1000,"gold":2000,"platinum":5000}'::jsonb,
  created_at          timestamp NOT NULL DEFAULT NOW(),
  updated_at          timestamp NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

-- Seed root tenant (Clean Machine) with its actual current values from business_settings.
-- min_cart_total_cents = 7500 matches loyalty_min_cart_total = 75 (dollars * 100).
-- guardrail_message matches loyalty_guardrail_message current default in business_settings.
-- requires_core_service = false matches loyalty_require_core_service current default.
-- ON CONFLICT DO NOTHING makes this safe to re-run.
INSERT INTO tenant_loyalty_settings (
  tenant_id,
  points_per_dollar,
  min_cart_total_cents,
  requires_core_service,
  guardrail_message
) VALUES (
  'root',
  1,
  7500,
  false,
  'To redeem your loyalty points, please book a qualifying service worth at least $75.'
)
ON CONFLICT (tenant_id) DO NOTHING;
