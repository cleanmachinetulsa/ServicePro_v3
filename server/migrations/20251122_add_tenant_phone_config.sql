-- Phase 2.2: Add tenant_phone_config table for multi-tenant telephony
-- This table stores phone configuration per tenant including SIP and IVR settings

CREATE TABLE IF NOT EXISTS tenant_phone_config (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number VARCHAR(50) NOT NULL UNIQUE,
  messaging_service_sid VARCHAR(255),
  sip_domain VARCHAR(255),
  sip_username VARCHAR(255),
  sip_password_encrypted VARCHAR(255),
  ivr_mode VARCHAR(50) DEFAULT 'simple',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient lookups
CREATE UNIQUE INDEX IF NOT EXISTS tenant_phone_config_phone_number_idx ON tenant_phone_config(phone_number);
CREATE INDEX IF NOT EXISTS tenant_phone_config_tenant_id_idx ON tenant_phone_config(tenant_id);

-- Add comment for documentation
COMMENT ON TABLE tenant_phone_config IS 'Multi-tenant phone configuration for voice and SMS routing';
COMMENT ON COLUMN tenant_phone_config.phone_number IS 'E.164 format Twilio phone number (e.g., +19188565304)';
COMMENT ON COLUMN tenant_phone_config.ivr_mode IS 'IVR routing mode: simple (SIP forward), ivr (menu), ai-voice (AI agent)';
