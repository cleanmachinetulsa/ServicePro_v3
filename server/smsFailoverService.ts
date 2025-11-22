/**
 * SMS FAILOVER SERVICE
 * 
 * Emergency fix for Twilio Error 30024 (Numeric Sender ID Not Provisioned)
 * Automatically retries failed SMS with backup phone line
 * 
 * Context: Main line +19188565304 (ported Google Voice) hasn't completed
 * carrier provisioning. This service automatically falls back to working
 * line +19188565711 when Error 30024 is detected.
 */

import type { TenantDb } from './db';
import { phoneLines } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as Twilio from 'twilio';

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
 * Get backup phone line (Jody's Line +19188565711)
 * This is the working Twilio number that can send SMS while main line is provisioning
 */
async function getBackupPhoneLine(tenantDb: TenantDb): Promise<{ number: string; id: number; label: string } | null> {
  if (backupPhoneLineCache) {
    return backupPhoneLineCache;
  }

  try {
    // Jody's Line should be ID 2 in the database, or we can search by number
    const backupLineNumber = '+19188565711';
    
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
 * If primary phone line fails with Error 30024, automatically retry with backup line
 * 
 * @param toPhone - Recipient phone number (E.164 format)
 * @param message - SMS message body
 * @param fromPhone - Primary phone number to send from
 * @param phoneLineId - Optional: Phone line ID for tracking
 * @param statusCallback - Optional: Webhook URL for delivery status
 * @returns Success status and message SID
 */
export async function sendSMSWithFailover(
  tenantDb: TenantDb,
  toPhone: string,
  message: string,
  fromPhone: string,
  phoneLineId?: number,
  statusCallback?: string
): Promise<{ success: boolean; messageSid?: string; error?: any; usedBackup: boolean }> {
  
  if (!twilio) {
    return { 
      success: false, 
      error: 'Twilio client not initialized',
      usedBackup: false
    };
  }

  try {
    // ATTEMPT 1: Try sending with primary phone line
    console.log(`[SMS FAILOVER] Attempting send from primary line: ${fromPhone}`);
    
    const smsParams: any = {
      body: message,
      from: fromPhone,
      to: toPhone,
    };

    if (statusCallback) {
      smsParams.statusCallback = statusCallback;
    }

    try {
      const response = await twilio.messages.create(smsParams);
      console.log(`[SMS FAILOVER] ✅ SUCCESS via primary line ${fromPhone} - SID: ${response.sid}`);
      return { 
        success: true, 
        messageSid: response.sid,
        usedBackup: false
      };
    } catch (primaryError: any) {
      // Check if this is Error 30024 (provisioning issue)
      if (isProvisioningError(primaryError)) {
        console.warn(`[SMS FAILOVER] ⚠️ Error 30024 detected on ${fromPhone} - Number not fully provisioned`);
        console.log(`[SMS FAILOVER] Initiating automatic failover to backup line...`);
        
        // ATTEMPT 2: Retry with backup phone line
        const backupLine = await getBackupPhoneLine(tenantDb);
        
        if (!backupLine) {
          console.error('[SMS FAILOVER] ❌ No backup line available - failing');
          return { 
            success: false, 
            error: primaryError,
            usedBackup: false
          };
        }

        console.log(`[SMS FAILOVER] Retrying with ${backupLine.label} (${backupLine.number})`);
        
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
          console.log(`[SMS FAILOVER] 🔄 FAILOVER SUCCESSFUL - Message delivered via ${backupLine.label}`);
          
          // Send alert to business owner about repeated failovers
          await notifyOwnerOfFailover(fromPhone, backupLine.number);
          
          return { 
            success: true, 
            messageSid: backupResponse.sid,
            usedBackup: true
          };
        } catch (backupError: any) {
          console.error('[SMS FAILOVER] ❌ Backup line also failed:', backupError);
          return { 
            success: false, 
            error: backupError,
            usedBackup: true
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
  } catch (error) {
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
 * Notify business owner when SMS failover is triggered
 * Rate-limited to once per hour to avoid spam
 */
async function notifyOwnerOfFailover(primaryNumber: string, backupNumber: string): Promise<void> {
  try {
    const now = Date.now();
    
    // Check cooldown
    if (now - lastFailoverNotification < NOTIFICATION_COOLDOWN) {
      console.log('[SMS FAILOVER] Skipping owner notification (cooldown active)');
      return;
    }

    const ownerPhone = process.env.BUSINESS_OWNER_PHONE;
    if (!ownerPhone || !twilio) {
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
      to: ownerPhone,
    });

    lastFailoverNotification = now;
    console.log('[SMS FAILOVER] Owner notified of failover event');
  } catch (error) {
    console.error('[SMS FAILOVER] Failed to notify owner:', error);
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
