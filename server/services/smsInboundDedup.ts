/**
 * SMS Inbound Deduplication Service
 * Prevents duplicate webhook processing for the same Twilio MessageSid
 */

import { db } from '../db';
import { smsInboundDedup } from '@shared/schema';
import { eq } from 'drizzle-orm';

const LOG_PREFIX = '[SMS DEDUPE]';

/**
 * Check if a MessageSid has already been processed
 * Returns true if duplicate (already processed), false if new
 */
export async function isDuplicateInboundSms(messageSid: string): Promise<boolean> {
  if (!messageSid) return false;
  
  const existing = await db
    .select()
    .from(smsInboundDedup)
    .where(eq(smsInboundDedup.messageSid, messageSid))
    .limit(1);
  
  return existing.length > 0;
}

/**
 * Record a processed MessageSid to prevent future duplicate processing
 */
export async function recordProcessedInboundSms(
  messageSid: string,
  from?: string,
  to?: string,
  tenantId: string = 'root'
): Promise<void> {
  try {
    await db
      .insert(smsInboundDedup)
      .values({
        tenantId,
        messageSid,
        from: from || null,
        to: to || null,
      })
      .onConflictDoNothing(); // Ignore if somehow already exists
  } catch (error) {
    console.error(`${LOG_PREFIX} Error recording processed SMS:`, error);
  }
}
