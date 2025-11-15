import { db } from './db';
import { phoneLines, phoneSchedules } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Seeds the database with Clean Machine's phone lines and default business hours
 * - Main Line: +19188565304 (FULLY PORTED - primary customer service line)
 * - Owner Business Line: +19188565711 (direct owner contact line)
 */
export async function seedPhoneLines() {
  try {
    console.log('[SEED] Checking phone lines...');

    // Check if phone lines already exist
    const existingLines = await db.select().from(phoneLines);
    
    if (existingLines.length > 0) {
      console.log('[SEED] Phone lines already seeded, skipping...');
      return;
    }

    // Create Main Line (5304) - FULLY PORTED
    const [mainLine] = await db.insert(phoneLines).values({
      phoneNumber: '+19188565304',
      label: 'Main Line (Customer Service)',
      forwardingEnabled: true,
      forwardingNumber: process.env.BUSINESS_OWNER_PHONE || null,
      voicemailGreeting: 'Thank you for calling Clean Machine Auto Detail. Press 1 to receive a text message with booking information and a link to our web app. Press 2 to speak with someone.',
    }).returning();

    console.log('[SEED] Created Main Line (FULLY PORTED):', mainLine.phoneNumber);

    // Create Owner Business Line (5711)
    const [ownerLine] = await db.insert(phoneLines).values({
      phoneNumber: '+19188565711',
      label: 'Owner Business Line',
      forwardingEnabled: true,
      forwardingNumber: process.env.BUSINESS_OWNER_PHONE || null,
      voicemailGreeting: 'You have reached the owner business line for Clean Machine Auto Detail. Please leave a message and I will get back to you as soon as possible.',
    }).returning();

    console.log('[SEED] Created Owner Business Line:', ownerLine.phoneNumber);

    // Create default business hours for Main Line (Monday-Friday 9am-6pm)
    const weekDays = [1, 2, 3, 4, 5]; // Monday through Friday
    const schedules = weekDays.map(day => ({
      phoneLineId: mainLine.id,
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '18:00',
      action: 'forward' as const,
    }));

    await db.insert(phoneSchedules).values(schedules);
    console.log('[SEED] Created business hours for Main Line (Mon-Fri 9am-6pm)');

    // Create same schedule for Owner Business Line
    const ownerSchedules = weekDays.map(day => ({
      phoneLineId: ownerLine.id,
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '18:00',
      action: 'forward' as const,
    }));

    await db.insert(phoneSchedules).values(ownerSchedules);
    console.log('[SEED] Created business hours for Owner Business Line (Mon-Fri 9am-6pm)');

    console.log('[SEED] ✅ Phone lines seeded successfully!');
  } catch (error) {
    console.error('[SEED] Failed to seed phone lines:', error);
    throw error;
  }
}
