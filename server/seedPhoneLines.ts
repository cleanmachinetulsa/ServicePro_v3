import { db } from './db';
import { phoneLines, phoneSchedules } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { wrapTenantDb } from './tenantDb';

/**
 * Seeds the database with Clean Machine's phone lines and default business hours
 * Configuration is driven by environment variables for flexibility:
 * - MAIN_PHONE_NUMBER: Main Twilio line for customer-facing SMS (default: +19188565304)
 * - VIP_PHONE_NUMBER: VIP/Admin line for internal alerts only (default: +19188565711)
 * - BUSINESS_OWNER_PHONE: Forwarding destination
 * 
 * SECURITY NOTE: Main line MUST be the customer-facing number (+19188565304).
 * The VIP line (+19188565711) is for ADMIN ONLY, never customer SMS.
 */
export async function seedPhoneLines() {
  const tenantDb = wrapTenantDb(db, 'root');
  try {
    console.log('[SEED] Checking phone lines...');

    // Check if phone lines already exist
    const existingLines = await tenantDb.select().from(phoneLines);
    
    if (existingLines.length > 0) {
      console.log('[SEED] Phone lines already seeded, skipping...');
      return;
    }

    // SECURITY FIX: Main line defaults to MAIN_PHONE_NUMBER (5304), NOT 5711
    // 5711 is for admin-only alerts, not customer-facing SMS
    const mainLineNumber = process.env.MAIN_PHONE_NUMBER || '+19188565304';
    const vipLineNumber = process.env.VIP_PHONE_NUMBER || '+19188565711';
    const forwardingNumber = process.env.BUSINESS_OWNER_PERSONAL_PHONE || null;

    // Create Main Line - Primary Twilio business number
    const [mainLine] = await tenantDb.insert(phoneLines).values({
      phoneNumber: mainLineNumber,
      label: 'Main Line',
      forwardingEnabled: true,
      forwardingNumber: forwardingNumber,
      voicemailGreeting: 'Thank you for calling Clean Machine Auto Detail. Press 1 to receive a text message with booking information and a link to our web app. Press 2 to speak with someone.',
    }).returning();

    console.log('[SEED] Created Main Line:', mainLine.phoneNumber);

    // Create VIP Line - Emergency alerts and priority customers
    const [vipLine] = await tenantDb.insert(phoneLines).values({
      phoneNumber: vipLineNumber,
      label: 'VIP Line',
      forwardingEnabled: true,
      forwardingNumber: forwardingNumber,
      voicemailGreeting: 'Thank you for calling Clean Machine Auto Detail. Please leave a message and we will get back to you shortly.',
    }).returning();

    console.log('[SEED] Created VIP Line:', vipLine.phoneNumber);

    // Create default business hours for Main Line (Monday-Friday 9am-6pm)
    const weekDays = [1, 2, 3, 4, 5]; // Monday through Friday
    const schedules = weekDays.map(day => ({
      phoneLineId: mainLine.id,
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '18:00',
      action: 'forward' as const,
    }));

    await tenantDb.insert(phoneSchedules).values(schedules);
    console.log('[SEED] Created business hours for Main Line (Mon-Fri 9am-6pm)');

    // Create same schedule for VIP Line
    const vipSchedules = weekDays.map(day => ({
      phoneLineId: vipLine.id,
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '18:00',
      action: 'forward' as const,
    }));

    await tenantDb.insert(phoneSchedules).values(vipSchedules);
    console.log('[SEED] Created business hours for VIP Line (Mon-Fri 9am-6pm)');

    console.log('[SEED] ✅ Phone lines seeded successfully!');
  } catch (error) {
    console.error('[SEED] Failed to seed phone lines:', error);
    throw error;
  }
}
