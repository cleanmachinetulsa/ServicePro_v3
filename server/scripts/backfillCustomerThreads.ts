/**
 * Audit T1 (Task #17): One-shot backfill for cross-channel customer threads.
 *
 * For every conversation with `customer_id IS NOT NULL` and `thread_id IS NULL`,
 * find/create the (tenant_id, customer_id) thread row and link the conversation
 * to it.
 *
 * Anonymous conversations (`customer_id IS NULL`) are intentionally left alone
 * and continue to read state from their own conversation row.
 *
 * Run once after the 0004 migration:
 *
 *   tsx server/scripts/backfillCustomerThreads.ts
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations } from '@shared/schema';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { findOrCreateThread, attachConversationToThread } from '../services/customerThreadService';

async function main() {
  console.log('[BACKFILL_THREADS] starting');

  // Get the distinct (tenant_id, customer_id) pairs needing a thread.
  const pairs = await db
    .select({
      tenantId: conversations.tenantId,
      customerId: conversations.customerId,
    })
    .from(conversations)
    .where(and(isNotNull(conversations.customerId), isNull(conversations.threadId)))
    .groupBy(conversations.tenantId, conversations.customerId);

  console.log(`[BACKFILL_THREADS] ${pairs.length} (tenant, customer) pairs to link`);

  let linkedConversations = 0;
  let createdThreads = 0;
  let failures = 0;

  for (const { tenantId, customerId } of pairs) {
    if (!tenantId || !customerId) continue;
    try {
      const tenantDb = wrapTenantDb(db, tenantId);
      const thread = await findOrCreateThread(tenantDb, tenantId, customerId);
      createdThreads++;

      // Attach every conversation row for this (tenant, customer) that is
      // still NULL. attachConversationToThread is a no-op when thread_id is
      // already set, so this is safe to re-run.
      const convs = await tenantDb
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          tenantDb.withTenantFilter(
            conversations,
            and(eq(conversations.customerId, customerId), isNull(conversations.threadId)),
          ),
        );

      for (const c of convs) {
        await attachConversationToThread(tenantDb, c.id, thread.id);
        linkedConversations++;
      }
    } catch (err) {
      failures++;
      console.error(
        `[BACKFILL_THREADS] failed for tenant=${tenantId} customer=${customerId}:`,
        err,
      );
    }
  }

  // Sanity row count: how many anonymous conversations remain (informational
  // only — these are expected and intentional).
  const [{ remaining } = { remaining: 0 } as any] = await db
    .select({ remaining: sql<number>`COUNT(*)::int` })
    .from(conversations)
    .where(isNull(conversations.threadId));

  console.log(
    `[BACKFILL_THREADS] done. threads_touched=${createdThreads} conversations_linked=${linkedConversations} failures=${failures} anonymous_remaining=${remaining}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[BACKFILL_THREADS] fatal:', err);
    process.exit(1);
  });
