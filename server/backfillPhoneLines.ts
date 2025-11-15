import { db } from './db';
import { conversations, messages, phoneLines } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Backfill phoneLineId for existing conversations and messages
 * 
 * Strategy:
 * - All existing SMS conversations → assign to Main Line (+19188565304)
 * - Non-SMS conversations → keep phoneLineId as null
 * - This is a one-time migration for historical data
 */
export async function backfillPhoneLineIds() {
  try {
    console.log('[BACKFILL] Starting phone line ID backfill...');

    // Get the Main Line ID
    const [mainLine] = await db
      .select()
      .from(phoneLines)
      .where(eq(phoneLines.phoneNumber, '+19188565304'))
      .limit(1);

    if (!mainLine) {
      console.error('[BACKFILL] Main Line not found in database!');
      return;
    }

    console.log(`[BACKFILL] Main Line ID: ${mainLine.id}`);

    // Update all SMS conversations without a phoneLineId
    const smsConversationsResult = await db
      .update(conversations)
      .set({ phoneLineId: mainLine.id })
      .where(
        and(
          eq(conversations.platform, 'sms'),
          isNull(conversations.phoneLineId)
        )
      )
      .returning({ id: conversations.id });

    console.log(`[BACKFILL] Updated ${smsConversationsResult.length} SMS conversations to Main Line`);

    // Update all SMS messages without a phoneLineId
    const smsMessagesResult = await db
      .update(messages)
      .set({ phoneLineId: mainLine.id })
      .where(
        and(
          eq(messages.channel, 'sms'),
          isNull(messages.phoneLineId)
        )
      )
      .returning({ id: messages.id });

    console.log(`[BACKFILL] Updated ${smsMessagesResult.length} SMS messages to Main Line`);

    console.log('[BACKFILL] ✅ Phone line ID backfill complete!');
  } catch (error) {
    console.error('[BACKFILL] Error during backfill:', error);
    throw error;
  }
}
