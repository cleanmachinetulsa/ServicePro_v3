import { db } from './db';
import { conversations, messages, phoneLines } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { wrapTenantDb } from './tenantDb';

/**
 * Backfill phoneLineId for existing conversations and messages
 * 
 * Strategy:
 * - All existing SMS conversations → assign to Main Line (+19188565304)
 * - Non-SMS conversations → keep phoneLineId as null
 * - This is a one-time migration for historical data
 */
export async function backfillPhoneLineIds() {
  const tenantDb = wrapTenantDb(db, 'root');
  try {
    console.log('[BACKFILL] Starting phone line ID backfill...');

    // Get the Main Line ID by label (flexible - works regardless of phone number)
    const [mainLine] = await tenantDb
      .select()
      .from(phoneLines)
      .where(tenantDb.withTenantFilter(phoneLines, eq(phoneLines.label, 'Main Business Line')))
      .limit(1);

    if (!mainLine) {
      console.error('[BACKFILL] Main Business Line not found in database! Please ensure a phone line with label "Main Business Line" exists.');
      return;
    }

    console.log(`[BACKFILL] Main Line ID: ${mainLine.id}`);

    // Update all SMS conversations without a phoneLineId
    const smsConversationsResult = await tenantDb
      .update(conversations)
      .set({ phoneLineId: mainLine.id })
      .where(
        tenantDb.withTenantFilter(conversations,
          and(
            eq(conversations.platform, 'sms'),
            isNull(conversations.phoneLineId)
          )
        )
      )
      .returning({ id: conversations.id });

    console.log(`[BACKFILL] Updated ${smsConversationsResult.length} SMS conversations to Main Line`);

    // Update all SMS messages without a phoneLineId
    const smsMessagesResult = await tenantDb
      .update(messages)
      .set({ phoneLineId: mainLine.id })
      .where(
        tenantDb.withTenantFilter(messages,
          and(
            eq(messages.channel, 'sms'),
            isNull(messages.phoneLineId)
          )
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
