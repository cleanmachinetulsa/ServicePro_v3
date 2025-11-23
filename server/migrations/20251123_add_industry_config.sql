-- Phase 8C: Add industry configuration to tenant_config table
-- This stores detailed industry settings including feature flags and onboarding selections

-- Add industry_config column to store detailed industry configuration
ALTER TABLE tenant_config 
ADD COLUMN IF NOT EXISTS industry_config JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN tenant_config.industry_config IS 'Industry-specific configuration including feature flags, sub-packs, and onboarding selections (Phase 8C)';
