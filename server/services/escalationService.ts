import { sendDirectTwilioSMS } from './smsSendGuard'; // SMS-AUDIT-T1 S-8: outbound SMS choke-point
/**
 * R1-STRICT Escalation Service
 * 
 * Tenant-aware escalation for SMS booking failures.
 * Ensures human attention is flagged and owner is notified.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations, tenantConfig } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export type EscalationReason = 
  | 'tenant_unroutable'
  | 'calendar_sync_failed'
  | 'booking_failed'
  | 'confirm_failed'
  | 'no_booking_found'
  | 'loop_detected'
  | 'vehicle_invalid'
  | 'unknown';

export interface EscalationContext {
  /** R1.6 / Audit T2: override default 6-hour pause */
  pauseHours?: number;
  /** Audit T2: free-form label appended after the reason tag in the owner SMS */
  customReasonLabel?: string;
  tenantId: string | null;
  reason: EscalationReason;
  fromPhone: string;
  toPhone: string;
  conversationId?: number;
  messageSid?: string;
  additionalInfo?: string;
}

/**
 * Get tenant owner phone for escalation
 * Prefers tenant settings; fallback to BUSINESS_OWNER_PERSONAL_PHONE only for root tenant
 */
export async function getTenantOwnerPhone(tenantId: string | null): Promise<string | null> {
  if (!tenantId) {
    return process.env.BUSINESS_OWNER_PERSONAL_PHONE || null;
  }
  
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    const [config] = await tenantDb
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    
    const ownerPhone = config?.alertPhone || config?.ownerPhone;
    if (ownerPhone) {
      return ownerPhone;
    }
  } catch (err) {
    console.warn(`[ESCALATION] Failed to lookup tenant owner phone for ${tenantId}:`, err);
  }
  
  if (tenantId === 'root') {
    return process.env.BUSINESS_OWNER_PERSONAL_PHONE || null;
  }
  
  return null;
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

// R1.6: Default automation pause duration (6 hours)
const AUTOMATION_PAUSE_HOURS = 6;

/**
 * Mark conversation as needing human attention and pause automation
 * R1.6: Also sets automation_paused_until to prevent AI from responding
 */
async function markConversationNeedsHuman(
  tenantId: string,
  conversationId: number,
  reason: string,
  pauseHours: number = AUTOMATION_PAUSE_HOURS
): Promise<boolean> {
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    const pauseUntil = new Date(Date.now() + pauseHours * 60 * 60 * 1000);
    
    await tenantDb
      .update(conversations)
      .set({
        needsHumanAttention: true,
        needsHumanReason: reason,
        automationPausedUntil: pauseUntil,
      })
      .where(eq(conversations.id, conversationId));

    // Audit T1 (Task #17): Propagate to the customer thread so escalation is
    // cross-channel. If the conversation has no thread (anonymous), the
    // per-conversation row above still drives the behavior.
    try {
      const [conv] = await tenantDb
        .select({ threadId: conversations.threadId })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      if (conv?.threadId) {
        const { setThreadEscalation } = await import('./customerThreadService');
        await setThreadEscalation(tenantDb, conv.threadId, {
          needsHumanAttention: true,
          needsHumanReason: reason,
          automationPausedUntil: pauseUntil,
        });
      }
    } catch (propErr) {
      console.warn(`[ESCALATION] thread propagation failed for conv=${conversationId}:`, propErr);
    }

    console.log(`[ESCALATION] Marked conversation=${conversationId} needsHumanAttention=true automationPausedUntil=${pauseUntil.toISOString()} reason=${reason}`);
    return true;
  } catch (err) {
    console.error(`[ESCALATION] Failed to mark conversation ${conversationId}:`, err);
    return false;
  }
}

/**
 * Escalate SMS booking issue to human
 * 
 * - Marks conversation as needing human attention
 * - Sends urgent SMS to owner phone
 * - Never throws (fail-safe)
 */
export async function escalateSmsToHuman(context: EscalationContext): Promise<{
  success: boolean;
  ownerNotified: boolean;
  conversationFlagged: boolean;
}> {
  const { tenantId, reason, fromPhone, toPhone, conversationId, messageSid, additionalInfo, pauseHours, customReasonLabel } = context;
  
  let conversationFlagged = false;
  let ownerNotified = false;
  
  if (tenantId && conversationId) {
    const reasonText = customReasonLabel ? `${reason}: ${customReasonLabel}` : reason;
    conversationFlagged = await markConversationNeedsHuman(tenantId, conversationId, reasonText, pauseHours ?? AUTOMATION_PAUSE_HOURS);
    // Audit T3 Task #23: fire owner Web Push deep-linked to the thread.
    try {
      const { notifyOwnerEscalation } = await import('./ownerPushService');
      void notifyOwnerEscalation({
        tenantId,
        conversationId,
        reason: reasonText,
        customerLabel: fromPhone,
        urgency: 'high',
      });
    } catch (pushErr) {
      console.warn('[ESCALATION] owner push notify failed:', pushErr);
    }
  }
  
  const ownerPhone = await getTenantOwnerPhone(tenantId);
  if (!ownerPhone) {
    console.warn(`[ESCALATION] No owner phone for tenant=${tenantId}, cannot send SMS alert`);
    return { success: conversationFlagged, ownerNotified: false, conversationFlagged };
  }
  
  const normalizedOwner = normalizeE164(ownerPhone);
  const normalizedFrom = normalizeE164(toPhone);
  
  if (!normalizedOwner || !normalizedFrom) {
    console.warn(`[ESCALATION] Invalid phone numbers: owner=${ownerPhone} from=${toPhone}`);
    return { success: conversationFlagged, ownerNotified: false, conversationFlagged };
  }
  
  if (normalizedOwner === normalizedFrom) {
    console.warn(`[ESCALATION] Skipping SMS: to_equals_from owner=${normalizedOwner}`);
    return { success: conversationFlagged, ownerNotified: false, conversationFlagged };
  }
  
  const reasonLabels: Record<EscalationReason, string> = {
    tenant_unroutable: 'TENANT UNROUTABLE',
    calendar_sync_failed: 'CALENDAR SYNC FAILED',
    booking_failed: 'BOOKING FAILED',
    confirm_failed: 'CONFIRM FAILED',
    no_booking_found: 'NO BOOKING FOUND',
    loop_detected: 'LOOP DETECTED',
    vehicle_invalid: 'VEHICLE INVALID',
    unknown: 'UNKNOWN ERROR',
  };
  
  const alertBody = [
    `[${reasonLabels[reason]}]`,
    `Customer: ${fromPhone}`,
    conversationId ? `Conv: ${conversationId}` : null,
    additionalInfo || null,
    `Action required.`,
  ].filter(Boolean).join('\n');
  
  try {
    // Review fix: removed unused `twilioClient = twilio(...)` instantiation —
    // sendDirectTwilioSMS owns its own Twilio client.
    await sendDirectTwilioSMS({
      to: normalizedOwner,
      from: normalizedFrom,
      body: alertBody.slice(0, 1600),
    });
    
    ownerNotified = true;
    console.log(`[ESCALATION] SMS sent to owner=${normalizedOwner} reason=${reason} from=${normalizedFrom}`);
  } catch (err: any) {
    console.error(`[ESCALATION] Failed to send SMS to owner:`, err?.message || err);
  }
  
  return { success: conversationFlagged || ownerNotified, ownerNotified, conversationFlagged };
}

/**
 * Check if a booking is truly confirmed (has calendar event)
 */
export function isBookingConfirmed(bookingRecord: { eventId?: string | null; calendarEventId?: string | null } | null): boolean {
  if (!bookingRecord) return false;
  return !!(bookingRecord.eventId || bookingRecord.calendarEventId);
}

/**
 * R1.6: Clear automation pause and human attention flags when issue is resolved
 * Call this when a human agent resolves the escalation
 */
export async function clearEscalation(
  tenantId: string,
  conversationId: number
): Promise<boolean> {
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    await tenantDb
      .update(conversations)
      .set({
        needsHumanAttention: false,
        automationPausedUntil: null,
      })
      .where(eq(conversations.id, conversationId));

    // Audit T1 (Task #17): clear at the thread level too so other channels
    // (web chat, email, FB) resume automation in lock-step.
    try {
      const [conv] = await tenantDb
        .select({ threadId: conversations.threadId })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      if (conv?.threadId) {
        const { setThreadEscalation } = await import('./customerThreadService');
        await setThreadEscalation(tenantDb, conv.threadId, {
          needsHumanAttention: false,
          needsHumanReason: null,
          automationPausedUntil: null,
        });
      }
    } catch (propErr) {
      console.warn(`[ESCALATION] thread clear propagation failed for conv=${conversationId}:`, propErr);
    }

    console.log(`[ESCALATION] Cleared conversation=${conversationId} needsHumanAttention=false automationPausedUntil=null`);
    return true;
  } catch (err) {
    console.error(`[ESCALATION] Failed to clear conversation ${conversationId}:`, err);
    return false;
  }
}
