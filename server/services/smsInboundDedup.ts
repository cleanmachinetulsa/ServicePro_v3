/**
 * SMS Inbound Deduplication Service
 * Prevents duplicate webhook processing for the same Twilio MessageSid
 * 
 * Features:
 * - Auto-bootstrap: Creates table on first call if missing
 * - Fail-open: Returns false/no-op if table missing (SMS proceeds without dedupe)
 */

import { db } from '../db';
import { smsInboundDedup } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const LOG_PREFIX = '[SMS DEDUPE]';

// Bootstrap state - ensures table exists exactly once per process
let _tableEnsured = false;

/**
 * Ensure the sms_inbound_dedup table exists
 * Runs exactly once per process; subsequent calls are no-ops
 */
async function ensureTableExists(): Promise<void> {
  if (_tableEnsured) return;
  
  try {
    // Create table with all necessary columns and indexes
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_inbound_dedup (
        id serial PRIMARY KEY,
        tenant_id varchar(50) NOT NULL DEFAULT 'root',
        message_sid text NOT NULL,
        from text,
        to text,
        received_at timestamp NOT NULL DEFAULT now()
      )
    `);
    
    // Create unique index on message_sid
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS sms_inbound_dedup_message_sid_idx
      ON sms_inbound_dedup (message_sid)
    `);
    
    // Create index on tenant_id
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sms_inbound_dedup_tenant_id_idx
      ON sms_inbound_dedup (tenant_id)
    `);
    
    _tableEnsured = true;
    console.log(`${LOG_PREFIX} ensured sms_inbound_dedup table exists`);
  } catch (error: any) {
    console.warn(`${LOG_PREFIX} WARN failed to ensure table (will fail-open) ${error?.message?.substring(0, 80)}`);
    _tableEnsured = true; // Mark as ensured anyway to avoid repeated attempts
  }
}

/**
 * Check if a MessageSid has already been processed
 * Returns true if duplicate (already processed), false if new
 * 
 * Fail-open: If dedupe table is missing, returns false (treats as new message)
 */
export async function isDuplicateInboundSms(messageSid: string): Promise<boolean> {
  if (!messageSid) return false;
  
  // Ensure table exists on first call
  await ensureTableExists();
  
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
      console.warn(`${LOG_PREFIX} WARN dedupe table missing; proceeding without dedupe (fail-open)`);
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
  from?: string,
  to?: string,
  tenantId: string = 'root'
): Promise<void> {
  // Ensure table exists
  await ensureTableExists();
  
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
