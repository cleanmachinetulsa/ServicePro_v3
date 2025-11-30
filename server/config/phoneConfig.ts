/**
 * CENTRALIZED PHONE CONFIGURATION
 * 
 * This file is the SINGLE SOURCE OF TRUTH for all phone number roles in ServicePro.
 * All phone number references in the codebase should import from this file.
 * 
 * ROLE MAPPING (DO NOT CHANGE ROLES - only update values via env vars):
 * 
 * twilioTest   = TWILIO_TEST_SMS_NUMBER         (+19189183265) - Dev/test only, NEVER customer-facing
 * twilioMain   = MAIN_PHONE_NUMBER              (+19188565304) - MAIN customer-facing line
 * phoneAdmin   = VIP_PHONE_NUMBER               (+19188565711) - VIP/Admin notifications line
 * ownerUrgent  = BUSINESS_OWNER_PERSONAL_PHONE  (+19182820103) - Owner's personal phone for urgent alerts
 * 
 * USAGE RULES:
 * - Customer-facing copy (headers, footers, emails, SMS) → twilioMain ONLY
 * - Admin/internal notifications → phoneAdmin
 * - Critical system alerts (bypasses Twilio) → ownerUrgent
 * - Development/testing flows → twilioTest
 * 
 * SAFE DEFAULTS:
 * - All phone roles have known defaults from Clean Machine for root tenant
 * - This ensures customer-facing flows always have a working phone number
 * - Non-root tenants should use getTenantBranding() for their own numbers
 */

// Known Clean Machine defaults (root tenant) - ensures flows work even without env vars
const DEFAULT_TWILIO_TEST = '+19189183265';
const DEFAULT_TWILIO_MAIN = '+19188565304'; // Main customer-facing line
const DEFAULT_PHONE_ADMIN = '+19188565711';  // VIP/Admin notifications
const DEFAULT_OWNER_URGENT = '+19182820103'; // Owner's personal phone for urgent alerts

// Environment variable mappings with safe defaults for root tenant
export const PHONE_TWILIO_TEST = process.env.TWILIO_TEST_SMS_NUMBER || DEFAULT_TWILIO_TEST;
export const PHONE_TWILIO_MAIN = process.env.MAIN_PHONE_NUMBER || DEFAULT_TWILIO_MAIN;
export const PHONE_ADMIN = process.env.VIP_PHONE_NUMBER || DEFAULT_PHONE_ADMIN;
export const PHONE_OWNER_URGENT = process.env.BUSINESS_OWNER_PERSONAL_PHONE || DEFAULT_OWNER_URGENT;

export interface PhoneConfig {
  twilioTest: string;
  twilioMain: string;
  phoneAdmin: string;
  ownerUrgent: string;
}

export const phoneConfig: PhoneConfig = {
  twilioTest: PHONE_TWILIO_TEST,
  twilioMain: PHONE_TWILIO_MAIN,
  phoneAdmin: PHONE_ADMIN,
  ownerUrgent: PHONE_OWNER_URGENT,
};

/**
 * Format phone number for display (US format)
 * +19188565304 → (918) 856-5304
 */
export function formatPhoneForDisplay(e164: string | null | undefined): string {
  if (!e164) return '';
  
  // Remove +1 prefix if present
  const digits = e164.replace(/^\+1/, '').replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  return e164; // Return as-is if not standard format
}

/**
 * Get the main customer-facing phone number
 * This is the ONLY number that should appear in customer-facing copy
 */
export function getMainPhoneDisplay(): string {
  return formatPhoneForDisplay(phoneConfig.twilioMain);
}

/**
 * Get the main phone number for tel: links
 */
export function getMainPhoneTel(): string {
  return phoneConfig.twilioMain;
}

/**
 * Validate phone configuration on startup
 * With safe defaults, this now just logs which source each number comes from
 */
export function validatePhoneConfig(): { valid: boolean; info: string[] } {
  const info: string[] = [];
  
  // All numbers now have safe defaults, log whether using env or default
  if (process.env.MAIN_PHONE_NUMBER) {
    info.push('twilioMain: using env var MAIN_PHONE_NUMBER');
  } else {
    info.push('twilioMain: using default (Clean Machine)');
  }
  
  if (process.env.VIP_PHONE_NUMBER) {
    info.push('phoneAdmin: using env var VIP_PHONE_NUMBER');
  } else {
    info.push('phoneAdmin: using default (Clean Machine)');
  }
  
  if (process.env.BUSINESS_OWNER_PERSONAL_PHONE) {
    info.push('ownerUrgent: using env var BUSINESS_OWNER_PERSONAL_PHONE');
  } else {
    info.push('ownerUrgent: using default (Clean Machine)');
  }
  
  if (process.env.TWILIO_TEST_SMS_NUMBER) {
    info.push('twilioTest: using env var TWILIO_TEST_SMS_NUMBER');
  } else {
    info.push('twilioTest: using default (Clean Machine)');
  }
  
  return {
    valid: true, // Always valid since we have defaults
    info,
  };
}

/**
 * Log phone configuration status (call on startup)
 */
export function logPhoneConfigStatus(): void {
  const { valid } = validatePhoneConfig();
  
  console.log('[PHONE CONFIG] Status:', valid ? 'OK' : 'ISSUES');
  console.log('[PHONE CONFIG] twilioMain (customer-facing):', 'SET');
  console.log('[PHONE CONFIG] phoneAdmin (VIP notifications):', 'SET');
  console.log('[PHONE CONFIG] ownerUrgent (personal alerts):', 'SET');
  console.log('[PHONE CONFIG] twilioTest (dev/test):', 'SET');
}
