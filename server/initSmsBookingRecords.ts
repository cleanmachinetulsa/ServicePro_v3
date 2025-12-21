import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Initialize the sms_booking_records table if it doesn't exist.
 * This provides a safe, idempotent way to ensure the table exists at startup.
 */
export async function initializeSmsBookingRecordsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_booking_records (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(50) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        event_id TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        service TEXT NOT NULL,
        address TEXT,
        needs_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
        confirmed_at TIMESTAMP,
        last_confirmation_reminder_at TIMESTAMP,
        auto_canceled_at TIMESTAMP,
        reschedule_requested BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create indexes idempotently
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sms_booking_records_tenant_phone_idx 
      ON sms_booking_records(tenant_id, phone);
    `);
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS sms_booking_records_event_id_idx 
      ON sms_booking_records(tenant_id, event_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sms_booking_records_start_time_idx 
      ON sms_booking_records(start_time);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sms_booking_records_needs_confirm_idx 
      ON sms_booking_records(needs_confirmation);
    `);
    
    console.log('[SMS BOOKING RECORDS] Table initialized successfully');
  } catch (error) {
    // Log but don't throw - fail-open for table initialization
    console.error('[SMS BOOKING RECORDS] Error initializing table (non-fatal):', error);
  }
}
