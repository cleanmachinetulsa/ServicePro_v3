/**
 * SMS FAILOVER SERVICE
 * 
 * Emergency fix for Twilio Error 30024 (Numeric Sender ID Not Provisioned)
 * 
 * SECURITY UPDATE: Customer-facing SMS must ONLY use MAIN_PHONE_NUMBER.
 * Failover for customer-facing SMS will:
 * 1. First try messaging service (if configured)
 * 2. FAIL CLOSED rather than use admin line for customer SMS
 * 
 * Admin-only notifications may still use phoneAdmin as backup.
 * 
 * Uses phoneConfig for number references:
 * - twilioMain (+19188565304) = ONLY number for customer-facing SMS
 * - phoneAdmin (+19188565711) = Admin notifications ONLY, not customer SMS
 */

import type { TenantDb } from './db';
import { phoneLines } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as Twilio from 'twilio';
import { phoneConfig, PHONE_TWILIO_MAIN } from './config/phoneConfig';
import { enforceCustomerSmsSender } from './services/smsSendGuard';

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

let twilio: any = null;
if (twilioAccountSid && twilioAuthToken) {
  try {
    twilio = Twilio.default(twilioAccountSid, twilioAuthToken);
    console.log('[SMS FAILOVER] Twilio client initialized');
  } catch (error) {
    console.error('[SMS FAILOVER] Failed to initialize Twilio client:', error);
  }
}

// Cache backup phone line to avoid repeated DB queries
let backupPhoneLineCache: { number: string; id: number; label: string } | null = null;

/**
 * Get backup phone line (Admin line for failover)
 * Uses phoneConfig.phoneAdmin as the backup when main line fails
 */
async function getBackupPhoneLine(tenantDb: TenantDb): Promise<{ number: string; id: number; label: string } | null> {
  if (backupPhoneLineCache) {
    return backupPhoneLineCache;
  }

  try {
    // Use phoneConfig.phoneAdmin as the backup line
    const backupLineNumber = phoneConfig.phoneAdmin;
    if (!backupLineNumber) {
      console.error('[SMS FAILOVER] phoneAdmin not configured in phoneConfig');
      return null;
    }
    
    const [backupLine] = await tenantDb
      .select()
      .from(phoneLines)
      .where(eq(phoneLines.phoneNumber, backupLineNumber))
      .limit(1);

    if (backupLine) {
      backupPhoneLineCache = {
        number: backupLine.phoneNumber,
        id: backupLine.id,
        label: backupLine.label || 'Backup Line'
      };
      console.log(`[SMS FAILOVER] Backup line configured: ${backupPhoneLineCache.label} (${backupPhoneLineCache.number})`);
      return backupPhoneLineCache;
    }

    console.error('[SMS FAILOVER] Backup phone line not found in database');
    return null;
  } catch (error) {
    console.error('[SMS FAILOVER] Error loading backup phone line:', error);
    return null;
  }
}

/**
 * Check if a Twilio error is Error 30024 (provisioning issue)
 */
function isProvisioningError(error: any): boolean {
  return (
    error?.code === 30024 ||
    error?.message?.includes('30024') ||
    error?.message?.toLowerCase().includes('numeric sender id not provisioned')
  );
}

/**
 * Send SMS with automatic failover
 * 
 * SECURITY: Customer-facing SMS only sends from MAIN_PHONE_NUMBER.
 * Failover will NOT use admin line for customer SMS - fails closed instead.
 * 
 * @param toPhone - Recipient phone number (E.164 format)
 * @param message - SMS message body
 * @param fromPhone - Primary phone number to send from (used as fallback if messaging service fails)
 * @param phoneLineId - Optional: Phone line ID for tracking
 * @param statusCallback - Optional: Webhook URL for delivery status
 * @param messagingServiceSid - Optional: Twilio Messaging Service SID (preferred over fromPhone)
 * @param purpose - Purpose of the SMS (for guard validation), defaults to 'customer_sms'
 * @param allowAdmin - Allow admin line for this send (for admin-only notifications)
 * @returns Success status and message SID
 */
export async function sendSMSWithFailover(
  tenantDb: TenantDb,
  toPhone: string,
  message: string,
  fromPhone: string,
  phoneLineId?: number,
  statusCallback?: string,
  messagingServiceSid?: string | null,
  purpose: string = 'customer_sms',
  allowAdmin: boolean = false
): Promise<{ success: boolean; messageSid?: string; error?: any; usedBackup: boolean; fromNumber?: string }> {
  
  if (!twilio) {
    return { 
      success: false, 
      error: 'Twilio client not initialized',
      usedBackup: false
    };
  }

  try {
    // SECURITY: Validate sender before any send attempt
    const guardResult = enforceCustomerSmsSender({
      from: messagingServiceSid ? null : fromPhone, // If using messaging service, from is null
      messagingServiceSid,
      purpose,
      tenantId: tenantDb.tenantId || 'root',
      to: toPhone,
      allowAdmin,
    });
    
    // Use the validated FROM number (or empty if using messaging service)
    const validatedFrom = guardResult.usedMessagingService ? fromPhone : guardResult.from;
    
    // ATTEMPT 1: Try sending with messaging service or primary phone line
    const usingMessagingService = !!messagingServiceSid;
    
    if (usingMessagingService) {
      console.log(`[SMS FAILOVER] Attempting send via Messaging Service: ${messagingServiceSid}`);
    } else {
      console.log(`[SMS FAILOVER] Attempting send from validated line: ${validatedFrom}`);
    }
    
    const smsParams: any = {
      body: message,
      to: toPhone,
    };
    
    // Prefer Messaging Service SID if provided (better A2P compliance)
    if (messagingServiceSid) {
      smsParams.messagingServiceSid = messagingServiceSid;
    } else {
      smsParams.from = validatedFrom;
    }

    if (statusCallback) {
      smsParams.statusCallback = statusCallback;
    }

    try {
      const response = await twilio.messages.create(smsParams);
      const sendMethod = usingMessagingService ? `Messaging Service ${messagingServiceSid}` : `primary line ${validatedFrom}`;
      console.log(`[SMS FAILOVER] ✅ SUCCESS via ${sendMethod} - SID: ${response.sid}`);
      return { 
        success: true, 
        messageSid: response.sid,
        usedBackup: false,
        fromNumber: response.from || validatedFrom
      };
    } catch (primaryError: any) {
      // Check if this is Error 30024 (provisioning issue)
      if (isProvisioningError(primaryError)) {
        console.warn(`[SMS FAILOVER] ⚠️ Error 30024 detected on ${validatedFrom} - Number not fully provisioned`);
        
        // SECURITY FIX: For customer-facing SMS, DO NOT use admin line as backup
        // Instead, try messaging service if available, or fail closed
        if (!allowAdmin) {
          console.log(`[SMS FAILOVER] 🔒 Customer-facing SMS - will NOT use admin line as backup`);
          
          // If we weren't already using messaging service, try it now
          if (!usingMessagingService && process.env.TWILIO_MESSAGING_SERVICE_SID) {
            console.log(`[SMS FAILOVER] Attempting failover via Messaging Service...`);
            try {
              const msgSvcParams: any = {
                body: message,
                to: toPhone,
                messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
              };
              if (statusCallback) {
                msgSvcParams.statusCallback = statusCallback;
              }
              
              const msgSvcResponse = await twilio.messages.create(msgSvcParams);
              console.log(`[SMS FAILOVER] ✅ SUCCESS via Messaging Service failover - SID: ${msgSvcResponse.sid}`);
              return {
                success: true,
                messageSid: msgSvcResponse.sid,
                usedBackup: true,
                fromNumber: msgSvcResponse.from || PHONE_TWILIO_MAIN
              };
            } catch (msgSvcError: any) {
              console.error('[SMS FAILOVER] ❌ Messaging service failover also failed:', msgSvcError);
            }
          }
          
          // FAIL CLOSED: Do not use admin line for customer SMS
          console.error('[SMS FAILOVER] ❌ FAIL CLOSED - Customer SMS cannot use admin line as backup');
          return { 
            success: false, 
            error: 'Primary line failed and customer SMS cannot use admin backup. Error 30024 - number not fully provisioned.',
            usedBackup: false
          };
        }
        
        // Admin-only notifications CAN use backup admin line
        console.log(`[SMS FAILOVER] Admin notification - attempting backup line...`);
        
        // ATTEMPT 2: Retry with backup phone line (admin-only)
        const backupLine = await getBackupPhoneLine(tenantDb);
        
        if (!backupLine) {
          console.error('[SMS FAILOVER] ❌ No backup line available - failing');
          return { 
            success: false, 
            error: primaryError,
            usedBackup: false
          };
        }

        console.log(`[SMS FAILOVER] Retrying admin notification with ${backupLine.label} (${backupLine.number})`);
        
        const backupParams: any = {
          body: message,
          from: backupLine.number,
          to: toPhone,
        };

        if (statusCallback) {
          backupParams.statusCallback = statusCallback;
        }

        try {
          const backupResponse = await twilio.messages.create(backupParams);
          console.log(`[SMS FAILOVER] ✅ SUCCESS via backup line ${backupLine.number} - SID: ${backupResponse.sid}`);
          console.log(`[SMS FAILOVER] 🔄 FAILOVER SUCCESSFUL (admin) - Message delivered via ${backupLine.label}`);
          
          // Send alert to business owner about repeated failovers
          await notifyOwnerOfFailover(validatedFrom, backupLine.number);
          
          return { 
            success: true, 
            messageSid: backupResponse.sid,
            usedBackup: true,
            fromNumber: backupLine.number
          };
        } catch (backupError: any) {
          console.error('[SMS FAILOVER] ❌ Backup line also failed:', backupError);
          return { 
            success: false, 
            error: backupError,
            usedBackup: true,
            fromNumber: backupLine.number
          };
        }
      } else {
        // Different error - not a provisioning issue
        console.error('[SMS FAILOVER] ❌ Primary send failed with non-provisioning error:', primaryError);
        return { 
          success: false, 
          error: primaryError,
          usedBackup: false
        };
      }
    }
  } catch (error: any) {
    // Check if this is a guard block
    if (error.message?.includes('[SMS BLOCK]')) {
      console.error('[SMS FAILOVER] 🚫 BLOCKED by SMS Guard:', error.message);
      return { 
        success: false, 
        error: error.message,
        usedBackup: false
      };
    }
    
    console.error('[SMS FAILOVER] Unexpected error:', error);
    return { 
      success: false, 
      error,
      usedBackup: false
    };
  }
}

// Track failover notifications to avoid spam
let lastFailoverNotification = 0;
const NOTIFICATION_COOLDOWN = 3600000; // 1 hour

/**
 * Notify admin when SMS failover is triggered
 * Rate-limited to once per hour to avoid spam
 * Uses phoneConfig for proper number routing
 */
async function notifyOwnerOfFailover(primaryNumber: string, backupNumber: string): Promise<void> {
  try {
    const now = Date.now();
    
    // Check cooldown
    if (now - lastFailoverNotification < NOTIFICATION_COOLDOWN) {
      console.log('[SMS FAILOVER] Skipping admin notification (cooldown active)');
      return;
    }

    // Use phoneConfig.phoneAdmin for failover notifications
    const adminPhone = phoneConfig.phoneAdmin;
    if (!adminPhone || !twilio) {
      return;
    }

    const alertMessage = `🚨 SMS FAILOVER ACTIVE

Primary line ${primaryNumber} failed (Error 30024 - not provisioned). 

Automatically using backup line ${backupNumber} for outbound SMS.

This is normal for recently ported numbers. The port should complete within 1-7 business days.

No action needed - failover is automatic.`;

    await twilio.messages.create({
      body: alertMessage,
      from: backupNumber, // Use backup since primary is down
      to: adminPhone,
    });

    lastFailoverNotification = now;
    console.log('[SMS FAILOVER] Admin notified of failover event');
  } catch (error) {
    console.error('[SMS FAILOVER] Failed to notify admin:', error);
  }
}

/**
 * Get failover status for monitoring
 */
export function getFailoverStatus(): {
  backupConfigured: boolean;
  backupNumber: string | null;
  lastNotification: number;
} {
  return {
    backupConfigured: backupPhoneLineCache !== null,
    backupNumber: backupPhoneLineCache?.number || null,
    lastNotification: lastFailoverNotification,
  };
}
