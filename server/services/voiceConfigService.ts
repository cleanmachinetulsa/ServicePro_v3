/**
 * Voice Configuration Service
 * 
 * Centralized helper for Twilio Voice configuration and status checks.
 * Works with tenant_phone_config table and falls back to env vars.
 */

import { db } from "../db";
import { tenantPhoneConfig, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface VoiceConfig {
  tenantId: string;
  phoneNumber: string | null;
  voiceEnabled: boolean;
  voiceWebhookUrl: string | null;
  forwardingNumber: string | null;
  sipEnabled: boolean;
  sipDomain: string | null;
  ringDuration: number;
  ivrMode: string;
}

export interface VoiceConfigStatus {
  isConfigured: boolean;
  errors: string[];
  warnings: string[];
  config: VoiceConfig | null;
}

/**
 * Get the tenant voice configuration from database or fallback to env vars
 */
export async function getTenantVoiceConfig(tenantId: string): Promise<VoiceConfig | null> {
  try {
    const [phoneConfig] = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.tenantId, tenantId))
      .limit(1);

    if (phoneConfig) {
      const baseUrl = getBaseUrl();
      return {
        tenantId,
        phoneNumber: phoneConfig.phoneNumber,
        voiceEnabled: phoneConfig.voiceEnabled ?? true,
        voiceWebhookUrl: phoneConfig.voiceWebhookUrl || `${baseUrl}/api/twilio/voice/inbound`,
        forwardingNumber: phoneConfig.forwardingNumber || process.env.BUSINESS_OWNER_PERSONAL_PHONE || null,
        sipEnabled: !!phoneConfig.sipDomain,
        sipDomain: phoneConfig.sipDomain || null,
        ringDuration: phoneConfig.ringDuration ?? 20,
        ivrMode: phoneConfig.ivrMode || 'simple',
      };
    }

    // Fallback to environment variables for root tenant
    if (tenantId === 'root') {
      const baseUrl = getBaseUrl();
      return {
        tenantId: 'root',
        phoneNumber: process.env.MAIN_PHONE_NUMBER || null,
        voiceEnabled: true,
        voiceWebhookUrl: `${baseUrl}/api/twilio/voice/inbound`,
        forwardingNumber: process.env.BUSINESS_OWNER_PERSONAL_PHONE || null,
        sipEnabled: false,
        sipDomain: null,
        ringDuration: 20,
        ivrMode: 'simple',
      };
    }

    return null;
  } catch (error) {
    console.error(`[VOICE CONFIG] Error fetching config for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Check if voice is fully configured for a tenant
 */
export async function isVoiceConfiguredForTenant(tenantId: string): Promise<VoiceConfigStatus> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Twilio credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid) {
    errors.push('TWILIO_ACCOUNT_SID is not configured');
  }
  if (!authToken) {
    errors.push('TWILIO_AUTH_TOKEN is not configured');
  }

  // Get tenant voice config
  const config = await getTenantVoiceConfig(tenantId);

  if (!config) {
    errors.push(`No voice configuration found for tenant: ${tenantId}`);
    return { isConfigured: false, errors, warnings, config: null };
  }

  // Check phone number
  if (!config.phoneNumber) {
    errors.push('No Twilio phone number configured');
  } else {
    // Validate E.164 format
    if (!config.phoneNumber.match(/^\+1\d{10}$/)) {
      warnings.push(`Phone number ${config.phoneNumber} may not be in valid E.164 format`);
    }
  }

  // Check forwarding number for click-to-call
  if (!config.forwardingNumber) {
    warnings.push('No forwarding number configured - click-to-call will not work');
  }

  // Check voice webhook URL
  if (!config.voiceWebhookUrl) {
    warnings.push('No voice webhook URL configured - using default');
  }

  // Check if voice is explicitly disabled
  if (!config.voiceEnabled) {
    errors.push('Voice is disabled for this tenant');
  }

  const isConfigured = errors.length === 0;

  return { isConfigured, errors, warnings, config };
}

/**
 * Get the base URL for webhooks
 */
function getBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL;
  }
  return 'https://cleanmachine.app';
}

/**
 * Resolve tenant ID from slug
 */
export async function resolveTenantIdFromSlug(slug: string): Promise<string | null> {
  try {
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    
    return tenant?.id || null;
  } catch (error) {
    console.error(`[VOICE CONFIG] Error resolving tenant slug ${slug}:`, error);
    return null;
  }
}

/**
 * Get diagnostic information for voice configuration
 */
export async function getVoiceDiagnostics(tenantId: string, tenantSlug?: string): Promise<{
  tenantId: string;
  tenantSlug: string | null;
  env: {
    TWILIO_ACCOUNT_SID_PRESENT: boolean;
    TWILIO_AUTH_TOKEN_PRESENT: boolean;
    MAIN_PHONE_NUMBER: string | null;
    BUSINESS_OWNER_PERSONAL_PHONE: string | null;
  };
  db: {
    voiceConfigRowFound: boolean;
    phoneNumber: string | null;
    voiceEnabled: boolean;
    voiceWebhookUrl: string | null;
    forwardingNumber: string | null;
    sipEnabled: boolean;
    sipDomain: string | null;
    ivrMode: string | null;
  };
  computed: {
    isVoiceConfigured: boolean;
    errors: string[];
    warnings: string[];
  };
}> {
  const status = await isVoiceConfiguredForTenant(tenantId);
  
  // Try to get slug if not provided
  let resolvedSlug = tenantSlug || null;
  if (!resolvedSlug) {
    try {
      const [tenant] = await db
        .select({ slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      resolvedSlug = tenant?.slug || null;
    } catch (e) {
      // Ignore
    }
  }

  return {
    tenantId,
    tenantSlug: resolvedSlug,
    env: {
      TWILIO_ACCOUNT_SID_PRESENT: !!process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN_PRESENT: !!process.env.TWILIO_AUTH_TOKEN,
      MAIN_PHONE_NUMBER: process.env.MAIN_PHONE_NUMBER || null,
      BUSINESS_OWNER_PERSONAL_PHONE: process.env.BUSINESS_OWNER_PERSONAL_PHONE || null,
    },
    db: {
      voiceConfigRowFound: !!status.config,
      phoneNumber: status.config?.phoneNumber || null,
      voiceEnabled: status.config?.voiceEnabled ?? false,
      voiceWebhookUrl: status.config?.voiceWebhookUrl || null,
      forwardingNumber: status.config?.forwardingNumber || null,
      sipEnabled: status.config?.sipEnabled ?? false,
      sipDomain: status.config?.sipDomain || null,
      ivrMode: status.config?.ivrMode || null,
    },
    computed: {
      isVoiceConfigured: status.isConfigured,
      errors: status.errors,
      warnings: status.warnings,
    },
  };
}
