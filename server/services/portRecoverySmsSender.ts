/**
 * Port Recovery SMS Sender - Strict Single Sender for Campaigns
 * 
 * This module provides a deterministic, idempotent SMS sender for Port Recovery campaigns.
 * It ensures:
 * 1. SINGLE FROM NUMBER per tenant (no Messaging Service pool)
 * 2. ATOMIC claim-lock before sending (prevents duplicates)
 * 3. Compliance guard (21610 opt-out handling)
 */

import { twilioClient } from '../twilioClient';
import { db } from '../db';
import type { TenantDb } from '../tenantDb';
import { portRecoverySmsRemoteSends, customers } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { PHONE_TWILIO_MAIN } from '../config/phoneConfig';

// Config flag: when true, always use single FROM number (no MessagingService)
const STRICT_SINGLE_SENDER = process.env.STRICT_SINGLE_SENDER_FOR_CAMPAIGNS !== 'false';

export interface PortRecoverySendParams {
  tenantId: string;
  to: string;
  body: string;
  campaignKey: string;
  campaignId: number;
  customerId?: number | null;
  tenantDb: TenantDb;
  fromNumber?: string; // Override the FROM number if needed
}

export interface PortRecoverySendResult {
  ok: boolean;
  messageSid?: string;
  fromUsed?: string;
  errorCode?: number;
  errorMessage?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Normalize phone to E.164 format
 */
function normalizeE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
  if (!cleaned) return null;
  
  if (cleaned.startsWith('+')) {
    if (/^\+[1-9]\d{1,14}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }
  
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return null;
}

/**
 * Get tenant's primary SMS number for campaigns
 * Uses the configured MAIN_PHONE_NUMBER for root tenant
 * Future: fetch from tenant's businessSettings
 */
function getTenantPrimarySmsNumber(tenantId: string): string {
  // For now, use the configured main number
  // This is the number that all Port Recovery SMS should come from
  return PHONE_TWILIO_MAIN;
}

/**
 * Attempt atomic claim-lock INSERT
 * Returns true if lock acquired, false if already exists
 */
async function attemptClaimLock(
  tenantDb: TenantDb,
  tenantId: string,
  campaignKey: string,
  phone: string
): Promise<{ claimed: boolean; existingStatus?: string; existingSid?: string }> {
  try {
    // Use raw SQL for atomic INSERT ... ON CONFLICT DO NOTHING RETURNING
    const result = await tenantDb.execute(sql`
      INSERT INTO port_recovery_sms_sends (tenant_id, campaign_key, phone, status, sent_at)
      VALUES (${tenantId}, ${campaignKey}, ${phone}, 'attempted', NOW())
      ON CONFLICT (tenant_id, campaign_key, phone) DO NOTHING
      RETURNING id
    `);
    
    // If a row was returned, we got the lock
    if (result.rows && result.rows.length > 0) {
      return { claimed: true };
    }
    
    // Lock not acquired - check existing status
    const [existing] = await tenantDb
      .select({
        status: portRecoverySmsRemoteSends.status,
        twilioSid: portRecoverySmsRemoteSends.twilioSid,
      })
      .from(portRecoverySmsRemoteSends)
      .where(
        and(
          eq(portRecoverySmsRemoteSends.tenantId, tenantId),
          eq(portRecoverySmsRemoteSends.campaignKey, campaignKey),
          eq(portRecoverySmsRemoteSends.phone, phone)
        )
      )
      .limit(1);
    
    return {
      claimed: false,
      existingStatus: existing?.status,
      existingSid: existing?.twilioSid || undefined,
    };
  } catch (error: any) {
    console.error(`[PORT RECOVERY SMS SEND] Claim lock error: ${error.message}`);
    // Fail-open: return false so caller can decide
    return { claimed: false };
  }
}

/**
 * Update send status after Twilio attempt
 */
async function updateSendStatus(
  tenantDb: TenantDb,
  tenantId: string,
  campaignKey: string,
  phone: string,
  status: 'sent' | 'failed',
  messageSid?: string,
  fromNumber?: string,
  errorCode?: number,
  errorMessage?: string
): Promise<void> {
  try {
    await tenantDb
      .update(portRecoverySmsRemoteSends)
      .set({
        status,
        twilioSid: messageSid || null,
        fromNumber: fromNumber || null,
        errorCode: errorCode?.toString() || null,
        errorMessage: errorMessage || null,
        sentAt: new Date(),
      })
      .where(
        and(
          eq(portRecoverySmsRemoteSends.tenantId, tenantId),
          eq(portRecoverySmsRemoteSends.campaignKey, campaignKey),
          eq(portRecoverySmsRemoteSends.phone, phone)
        )
      );
  } catch (error: any) {
    console.warn(`[PORT RECOVERY SMS SEND] Update status error: ${error.message}`);
  }
}

/**
 * Mark customer as opted out (sms_consent=false)
 */
async function markCustomerOptedOut(
  tenantDb: TenantDb,
  tenantId: string,
  phone: string
): Promise<void> {
  try {
    const normalizedPhone = normalizeE164(phone);
    if (!normalizedPhone) return;
    
    await tenantDb
      .update(customers)
      .set({
        smsConsent: false,
        smsConsentTimestamp: new Date(),
      })
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.phone, normalizedPhone)
        )
      );
    
    console.log(`[PORT RECOVERY SMS SEND] Marked ${phone} as opted out (sms_consent=false)`);
  } catch (error: any) {
    console.warn(`[PORT RECOVERY SMS SEND] Failed to update opt-out status: ${error.message}`);
  }
}

/**
 * Send Port Recovery SMS with strict single sender and idempotency
 * 
 * This is the ONLY function that should be used to send Port Recovery campaign SMS.
 * It guarantees:
 * 1. Single FROM number per tenant
 * 2. Atomic claim-lock to prevent duplicates
 * 3. Proper error handling for compliance (21610)
 */
export async function sendPortRecoverySms(params: PortRecoverySendParams): Promise<PortRecoverySendResult> {
  const { tenantId, to, body, campaignKey, campaignId, customerId, tenantDb, fromNumber } = params;
  
  // Validate inputs
  if (!campaignKey) {
    console.error(`[PORT RECOVERY SMS SEND] CRITICAL: campaignKey is null/undefined! campaignId=${campaignId}`);
    return { ok: false, errorMessage: 'campaignKey is required (cannot be null)' };
  }
  
  const normalizedTo = normalizeE164(to);
  if (!normalizedTo) {
    console.log(`[PORT RECOVERY SMS SEND] Invalid phone: ${to}`);
    return { ok: false, errorMessage: 'Invalid phone number', skipped: true, skipReason: 'invalid_phone' };
  }
  
  // Determine FROM number - STRICT single sender
  const fromUsed = fromNumber || getTenantPrimarySmsNumber(tenantId);
  
  // Prevent to=from
  if (normalizedTo === fromUsed) {
    return { ok: false, errorMessage: 'to_equals_from', skipped: true, skipReason: 'to_equals_from' };
  }
  
  // Step 1: Atomic claim-lock
  const lockResult = await attemptClaimLock(tenantDb, tenantId, campaignKey, normalizedTo);
  
  if (!lockResult.claimed) {
    const skipReason = lockResult.existingSid ? 'already_sent_success' : 'already_attempted';
    console.log(`[PORT RECOVERY SMS SEND] tenantId=${tenantId} campaignKey=${campaignKey} to=${normalizedTo} skipped=true reason=${skipReason}`);
    return {
      ok: false,
      skipped: true,
      skipReason,
      messageSid: lockResult.existingSid,
    };
  }
  
  // Step 2: Check Twilio client
  if (!twilioClient) {
    await updateSendStatus(tenantDb, tenantId, campaignKey, normalizedTo, 'failed', undefined, fromUsed, undefined, 'Twilio client not configured');
    return { ok: false, errorMessage: 'Twilio client not configured', fromUsed };
  }
  
  // Step 3: Send SMS with STRICT single FROM number (no MessagingService)
  try {
    console.log(`[PORT RECOVERY SMS SEND] Sending: tenantId=${tenantId} campaignKey=${campaignKey} to=${normalizedTo} from=${fromUsed}`);
    
    const message = await twilioClient.messages.create({
      to: normalizedTo,
      from: fromUsed, // ALWAYS use specific FROM, never MessagingServiceSid
      body,
    });
    
    // Update status to sent
    await updateSendStatus(tenantDb, tenantId, campaignKey, normalizedTo, 'sent', message.sid, fromUsed);
    
    console.log(`[PORT RECOVERY SMS SEND] tenantId=${tenantId} campaignKey=${campaignKey} to=${normalizedTo} from=${fromUsed} ok=true messageSid=${message.sid}`);
    
    return {
      ok: true,
      messageSid: message.sid,
      fromUsed,
    };
  } catch (error: any) {
    const errorCode = error.code;
    const errorMessage = error.message || 'Unknown error';
    
    console.error(`[PORT RECOVERY SMS SEND] tenantId=${tenantId} campaignKey=${campaignKey} to=${normalizedTo} from=${fromUsed} ok=false errorCode=${errorCode} errorMessage=${errorMessage}`);
    
    // COMPLIANCE GUARD: 21610 = recipient opted out
    if (errorCode === 21610) {
      console.log(`[PORT RECOVERY SMS SEND] 21610 opt-out detected for ${normalizedTo} - marking sms_consent=false`);
      await markCustomerOptedOut(tenantDb, tenantId, normalizedTo);
    }
    
    // Update status to failed
    await updateSendStatus(tenantDb, tenantId, campaignKey, normalizedTo, 'failed', undefined, fromUsed, errorCode, errorMessage);
    
    return {
      ok: false,
      fromUsed,
      errorCode,
      errorMessage,
    };
  }
}

/**
 * Compute campaign key from campaign ID
 * This ensures campaignKey is NEVER null
 */
export function computeCampaignKey(campaignId: number): string {
  return `port-recovery-campaign-${campaignId}`;
}
