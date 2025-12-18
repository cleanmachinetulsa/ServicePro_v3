/**
 * SMS SEND GUARD - Centralized Security Choke Point
 * 
 * CRITICAL: This is the SINGLE POINT OF ENFORCEMENT for all outbound SMS sender validation.
 * 
 * PURPOSE:
 * - Ensure customer-facing SMS ONLY sends from MAIN_PHONE_NUMBER (+19188565304)
 * - BLOCK any attempt to send customer-facing SMS from admin/test numbers
 * - Provide clear audit trail and error messages for blocked sends
 * 
 * SECURITY RULES:
 * - Customer-facing sends MUST use MAIN_PHONE_NUMBER only
 * - Admin-only sends MAY use PHONE_ADMIN (5711) with explicit allowAdmin=true
 * - Test sends MAY use TWILIO_TEST_SMS_NUMBER with explicit allowTest=true
 * - All blocked sends throw with [SMS BLOCK] prefix for easy log searching
 */

import { phoneConfig, PHONE_TWILIO_MAIN, PHONE_ADMIN, PHONE_TWILIO_TEST } from '../config/phoneConfig';

// Blocked numbers - NEVER allow for customer-facing SMS
const BLOCKED_CUSTOMER_NUMBERS = [
  '+19188565711', // Admin/VIP line - admin only
  '+19189183265', // Old test number - never use
];

// Purposes that are customer-facing and require MAIN_PHONE_NUMBER
const CUSTOMER_FACING_PURPOSES = [
  'booking_confirmation',
  'booking_reminder',
  'appointment_reminder',
  'conversational_reply',
  'campaign',
  'sms_campaign',
  'portal_notification',
  'opt_in_confirmation',
  'payment_reminder',
  'review_request',
  'general_notification',
  'customer_sms', // Generic customer-facing
  'failover_retry', // Failover must still use main number
];

// Purposes that are admin-only and may use phoneAdmin
const ADMIN_ONLY_PURPOSES = [
  'admin_alert',
  'system_alert',
  'failover_notification',
  'port_monitoring',
  'critical_alert',
  'urgent_alert',
  'internal_notification',
];

// Purposes that are test-only and may use test number
const TEST_ONLY_PURPOSES = [
  'test_sms',
  'debug_sms',
  'development_test',
];

export interface SmsSendGuardParams {
  from?: string | null;
  messagingServiceSid?: string | null;
  purpose: string;
  tenantId?: string;
  to: string;
  allowAdmin?: boolean;
  allowTest?: boolean;
}

export interface SmsSendGuardResult {
  allowed: boolean;
  from: string;
  reason: string;
  usedMessagingService: boolean;
}

/**
 * Enforce sender security for customer-facing SMS
 * 
 * THROWS if the sender is not allowed for the given purpose.
 * 
 * @returns The validated FROM number to use for sending
 */
export function enforceCustomerSmsSender(params: SmsSendGuardParams): SmsSendGuardResult {
  const { from, messagingServiceSid, purpose, tenantId, to, allowAdmin, allowTest } = params;
  
  // Get canonical main number (required in production)
  const mainNumber = PHONE_TWILIO_MAIN;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Validate main number exists
  if (!mainNumber) {
    const error = `[SMS BLOCK] MAIN_PHONE_NUMBER not configured - cannot send SMS. purpose=${purpose} tenant=${tenantId} to=${to}`;
    console.error(error);
    throw new Error(error);
  }
  
  // Normalize the from number for comparison
  const normalizedFrom = from?.trim() || '';
  
  // Determine purpose type
  const isCustomerFacing = CUSTOMER_FACING_PURPOSES.includes(purpose.toLowerCase()) || 
                           !ADMIN_ONLY_PURPOSES.includes(purpose.toLowerCase()) && 
                           !TEST_ONLY_PURPOSES.includes(purpose.toLowerCase());
  const isAdminPurpose = ADMIN_ONLY_PURPOSES.includes(purpose.toLowerCase());
  const isTestPurpose = TEST_ONLY_PURPOSES.includes(purpose.toLowerCase());
  
  // Check if using messaging service
  if (messagingServiceSid && !normalizedFrom) {
    // Using messaging service - we can't inspect the pool, but we log it
    console.log(`[SMS GUARD] ✅ ALLOW via Messaging Service: purpose=${purpose} tenant=${tenantId} to=${maskPhone(to)} svc=${messagingServiceSid}`);
    return {
      allowed: true,
      from: '', // Messaging service will choose
      reason: 'Messaging service SID used',
      usedMessagingService: true,
    };
  }
  
  // BLOCK: Customer-facing SMS from blocked numbers
  if (isCustomerFacing && BLOCKED_CUSTOMER_NUMBERS.includes(normalizedFrom)) {
    const error = `[SMS BLOCK] Illegal FROM=${normalizedFrom} for customer-facing purpose=${purpose} tenant=${tenantId} to=${maskPhone(to)} main=${mainNumber}. Customer SMS must only use MAIN_PHONE_NUMBER.`;
    console.error(error);
    throw new Error(error);
  }
  
  // BLOCK: Customer-facing SMS from any number except main
  if (isCustomerFacing && normalizedFrom && normalizedFrom !== mainNumber) {
    const error = `[SMS BLOCK] Illegal FROM=${normalizedFrom} for customer-facing purpose=${purpose} tenant=${tenantId} to=${maskPhone(to)} main=${mainNumber}. Customer SMS must only use MAIN_PHONE_NUMBER.`;
    console.error(error);
    throw new Error(error);
  }
  
  // ALLOW: Customer-facing with main number or no from (will default to main)
  if (isCustomerFacing) {
    const fromToUse = normalizedFrom || mainNumber;
    console.log(`[SMS GUARD] ✅ ALLOW customer-facing: purpose=${purpose} tenant=${tenantId} to=${maskPhone(to)} from=${fromToUse}`);
    return {
      allowed: true,
      from: fromToUse,
      reason: 'Customer-facing SMS using main number',
      usedMessagingService: false,
    };
  }
  
  // ALLOW: Admin-only with allowAdmin flag
  if (isAdminPurpose && allowAdmin) {
    const fromToUse = normalizedFrom || PHONE_ADMIN || mainNumber;
    console.log(`[SMS GUARD] ✅ ALLOW admin-only: purpose=${purpose} tenant=${tenantId} to=${maskPhone(to)} from=${fromToUse} (allowAdmin=true)`);
    return {
      allowed: true,
      from: fromToUse,
      reason: 'Admin-only SMS with explicit allowAdmin flag',
      usedMessagingService: false,
    };
  }
  
  // BLOCK: Admin-only without allowAdmin flag
  if (isAdminPurpose && !allowAdmin) {
    const error = `[SMS BLOCK] Admin-only purpose=${purpose} requires allowAdmin=true. tenant=${tenantId} to=${maskPhone(to)}`;
    console.error(error);
    throw new Error(error);
  }
  
  // ALLOW: Test-only with allowTest flag and test number configured
  if (isTestPurpose && allowTest) {
    if (!PHONE_TWILIO_TEST) {
      const error = `[SMS BLOCK] Test purpose=${purpose} requires TWILIO_TEST_SMS_NUMBER env var. tenant=${tenantId} to=${maskPhone(to)}`;
      console.error(error);
      throw new Error(error);
    }
    const fromToUse = normalizedFrom || PHONE_TWILIO_TEST;
    console.log(`[SMS GUARD] ✅ ALLOW test-only: purpose=${purpose} tenant=${tenantId} to=${maskPhone(to)} from=${fromToUse} (allowTest=true)`);
    return {
      allowed: true,
      from: fromToUse,
      reason: 'Test-only SMS with explicit allowTest flag',
      usedMessagingService: false,
    };
  }
  
  // BLOCK: Test-only without allowTest flag
  if (isTestPurpose && !allowTest) {
    const error = `[SMS BLOCK] Test purpose=${purpose} requires allowTest=true. tenant=${tenantId} to=${maskPhone(to)}`;
    console.error(error);
    throw new Error(error);
  }
  
  // Default: Use main number for unclassified purposes (treat as customer-facing)
  const fromToUse = normalizedFrom || mainNumber;
  
  // Final check: Block any attempt to use blocked numbers
  if (BLOCKED_CUSTOMER_NUMBERS.includes(fromToUse)) {
    const error = `[SMS BLOCK] Illegal FROM=${fromToUse} for purpose=${purpose} tenant=${tenantId} to=${maskPhone(to)} main=${mainNumber}`;
    console.error(error);
    throw new Error(error);
  }
  
  console.log(`[SMS GUARD] ✅ ALLOW (default to main): purpose=${purpose} tenant=${tenantId} to=${maskPhone(to)} from=${fromToUse}`);
  return {
    allowed: true,
    from: fromToUse,
    reason: 'Default to main number for unclassified purpose',
    usedMessagingService: false,
  };
}

/**
 * Validate SMS sender without throwing (for dry-run testing)
 */
export function validateSmsSender(params: SmsSendGuardParams): SmsSendGuardResult & { error?: string } {
  try {
    return enforceCustomerSmsSender(params);
  } catch (error: any) {
    return {
      allowed: false,
      from: params.from || '',
      reason: error.message || 'Unknown error',
      usedMessagingService: false,
      error: error.message,
    };
  }
}

/**
 * Get current SMS sender configuration for debugging
 */
export function getSmsSenderConfig(): {
  mainNumber: string;
  mainNumberMasked: string;
  testNumberPresent: boolean;
  phoneAdminMasked: string;
  messagingServiceSidPresent: boolean;
  blockedNumbers: string[];
} {
  return {
    mainNumber: PHONE_TWILIO_MAIN,
    mainNumberMasked: maskPhone(PHONE_TWILIO_MAIN),
    testNumberPresent: !!PHONE_TWILIO_TEST,
    phoneAdminMasked: maskPhone(PHONE_ADMIN),
    messagingServiceSidPresent: !!process.env.TWILIO_MESSAGING_SERVICE_SID,
    blockedNumbers: BLOCKED_CUSTOMER_NUMBERS,
  };
}

/**
 * Mask phone number for logging (show last 4 digits only)
 */
function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '(none)';
  if (phone.length <= 4) return phone;
  return `***${phone.slice(-4)}`;
}
