/**
 * SMS Inbound Deduplication Service
 * Prevents duplicate webhook processing for the same Twilio MessageSid
 * 
 * Features:
 * - Relies on schema-based table creation (npm run db:push)
 * - Fail-open: Returns false/no-op if table missing (SMS proceeds without dedupe)
 */

import { db } from '../db';
import { smsInboundDedup } from '@shared/schema';
import { eq } from 'drizzle-orm';

const LOG_PREFIX = '[SMS DEDUPE]';

// Module-level flag to log table missing only once per process
let _tableUnavailableWarningLogged = false;

/**
 * Check if a MessageSid has already been processed
 * Returns true if duplicate (already processed), false if new
 * 
 * Fail-open: If dedupe table is missing, returns false (treats as new message)
 */
export async function isDuplicateInboundSms(messageSid: string): Promise<boolean> {
  if (!messageSid) return false;
  
  try {
    const existing = await db
      .select()
      .from(smsInboundDedup)
      .where(eq(smsInboundDedup.messageSid, messageSid))
      .limit(1);
    
    return existing.length > 0;
  } catch (error: any) {
    // If table is missing (error code 42P01) or doesn't exist, fail-open: treat as new
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      if (!_tableUnavailableWarningLogged) {
        console.warn(`${LOG_PREFIX} WARN dedup table unavailable; proceeding without dedup (fail-open)`);
        _tableUnavailableWarningLogged = true;
      }
      return false;
    }
    // Other errors: log but don't crash, return false to allow SMS
    console.warn(`${LOG_PREFIX} WARN error checking dedup:`, error?.message?.substring(0, 60));
    return false;
  }
}

/**
 * Record a processed MessageSid to prevent future duplicate processing
 * 
 * Fail-open: If table is missing, silently continues (no-op)
 */
export async function recordProcessedInboundSms(
  messageSid: string,
  fromNumber?: string,
  toNumber?: string,
  tenantId: string = 'root'
): Promise<void> {
  try {
    await db
      .insert(smsInboundDedup)
      .values({
        tenantId,
        messageSid,
        fromNumber: fromNumber || null,
        toNumber: toNumber || null,
      })
      .onConflictDoNothing(); // Ignore if somehow already exists
  } catch (error: any) {
    // If table is missing (42P01), silently continue (fail-open)
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      // Silent fail-open - don't spam logs, just continue
      return;
    }
    // Other errors: log but don't throw
    console.warn(`${LOG_PREFIX} WARN error recording processed SMS:`, error?.message?.substring(0, 60));
  }
}
