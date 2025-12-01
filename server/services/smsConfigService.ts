/**
 * SMS Configuration Service
 * 
 * Provides consistent SMS configuration for multi-tenant telephony.
 * Ensures the correct FROM number is used for each tenant's outbound SMS.
 */

import { db } from '../db';
import { tenantPhoneConfig, phoneLines, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { phoneConfig } from '../config/phoneConfig';

export interface SmsConfig {
  tenantId: string;
  tenantName: string;
  fromNumber: string;
  messagingServiceSid: string | null;
  mode: 'production' | 'test' | 'fallback';
  source: string;
  isConfigured: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Get the SMS configuration for a tenant.
 * This is the single source of truth for which FROM number to use.
 */
export async function getSmsConfig(tenantId: string): Promise<SmsConfig> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  let tenantName = tenantId;
  let fromNumber = '';
  let messagingServiceSid: string | null = null;
  let mode: SmsConfig['mode'] = 'production';
  let source = 'unknown';

  try {
    // Get tenant info
    if (tenantId !== 'root') {
      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (tenant) {
        tenantName = tenant.name;
      }
    } else {
      tenantName = 'Clean Machine Auto Detail';
    }

    // Check tenant_phone_config for SMS number
    const [config] = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.tenantId, tenantId))
      .limit(1);

    if (config) {
      // Prefer phone_number from tenant_phone_config
      if (config.phoneNumber) {
        fromNumber = config.phoneNumber;
        source = 'tenant_phone_config.phone_number';
      }
      
      // Get messaging service SID if available
      if (config.messagingServiceSid) {
        messagingServiceSid = config.messagingServiceSid;
      }
    }

    // Fallback to MAIN_PHONE_NUMBER for root tenant
    if (!fromNumber && tenantId === 'root') {
      const mainNumber = phoneConfig.twilioMain;
      if (mainNumber) {
        fromNumber = mainNumber;
        source = 'env.MAIN_PHONE_NUMBER';
      }
    }

    // Ultimate fallback: Check phone_lines table for primary line
    if (!fromNumber) {
      const [primaryLine] = await db
        .select()
        .from(phoneLines)
        .where(eq(phoneLines.tenantId, tenantId))
        .limit(1);
      
      if (primaryLine) {
        fromNumber = primaryLine.phoneNumber;
        source = 'phone_lines.primary';
        warnings.push('Using phone_lines fallback - consider setting tenant_phone_config.phone_number');
      }
    }

    // Validate configuration
    if (!fromNumber) {
      errors.push('No SMS from number configured');
    }

    if (!process.env.TWILIO_ACCOUNT_SID) {
      errors.push('Missing TWILIO_ACCOUNT_SID');
    }

    if (!process.env.TWILIO_AUTH_TOKEN) {
      errors.push('Missing TWILIO_AUTH_TOKEN');
    }

    // Check if this looks like a test number
    const testNumbers = [
      process.env.TWILIO_TEST_SMS_NUMBER,
      process.env.BUSINESS_TWILIO_TEST_SMS_NUMBER,
    ].filter(Boolean);

    if (testNumbers.includes(fromNumber)) {
      mode = 'test';
      warnings.push(`Using test number ${fromNumber} - not suitable for production`);
    }

  } catch (error) {
    errors.push(`Database error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    tenantId,
    tenantName,
    fromNumber,
    messagingServiceSid,
    mode,
    source,
    isConfigured: errors.length === 0 && !!fromNumber,
    errors,
    warnings,
  };
}

/**
 * Get SMS diagnostics for a tenant - more detailed than getSmsConfig
 */
export async function getSmsDiagnostics(tenantId: string): Promise<{
  config: SmsConfig;
  envVars: Record<string, string>;
  phoneLines: { id: number; label: string; phoneNumber: string }[];
  tenantPhoneConfig: Record<string, any> | null;
}> {
  const config = await getSmsConfig(tenantId);

  // Get all phone lines for this tenant
  const lines = await db
    .select({
      id: phoneLines.id,
      label: phoneLines.label,
      phoneNumber: phoneLines.phoneNumber,
    })
    .from(phoneLines)
    .where(eq(phoneLines.tenantId, tenantId));

  // Get tenant phone config
  const [tpc] = await db
    .select()
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.tenantId, tenantId))
    .limit(1);

  // Mask env vars for security
  const envVars: Record<string, string> = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'NOT SET',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET',
    MAIN_PHONE_NUMBER: phoneConfig.twilioMain || 'NOT SET',
    VIP_PHONE_NUMBER: phoneConfig.phoneAdmin || 'NOT SET',
    TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID || 'NOT SET',
    TWILIO_TEST_SMS_NUMBER: process.env.TWILIO_TEST_SMS_NUMBER || 'NOT SET',
  };

  return {
    config,
    envVars,
    phoneLines: lines,
    tenantPhoneConfig: tpc || null,
  };
}

/**
 * Validate that a tenant's SMS configuration is production-ready
 */
export async function isSmsConfiguredForTenant(tenantId: string): Promise<{
  isConfigured: boolean;
  errors: string[];
  warnings: string[];
}> {
  const config = await getSmsConfig(tenantId);
  return {
    isConfigured: config.isConfigured,
    errors: config.errors,
    warnings: config.warnings,
  };
}
