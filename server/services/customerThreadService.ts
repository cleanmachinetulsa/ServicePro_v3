/**
 * Audit T1 (Task #17): Cross-channel customer threads.
 *
 * One `customer_threads` row per (tenant_id, customer_id). Every conversation
 * we can identify (SMS phone, email, FB PSID, web cookie that resolved to a
 * customer) gets its `thread_id` set to that row, so SMS / web chat / FB /
 * email share one source of truth for:
 *
 *   - escalation        (needs_human_attention, needs_human_reason)
 *   - automation pause  (automation_paused_until)
 *   - control mode      (auto vs manual)
 *   - live booking offer arming (booking_offer_*)
 *
 * Anonymous conversations (no resolved customer_id) keep `thread_id = NULL`
 * and continue to read state from their own conversation row. Read paths
 * therefore always check the thread first and fall back to the conversation.
 *
 * This module is the only place that writes to `customer_threads`; callers
 * use the small public API below.
 */

import { eq, and, isNull } from 'drizzle-orm';
import {
  conversations,
  customerThreads,
  type CustomerThread,
  type InsertCustomerThread,
} from '@shared/schema';
import type { TenantDb } from '../tenantDb';

/**
 * Find or create the customer_threads row for (tenantId, customerId).
 * Idempotent and safe under concurrency thanks to the
 * `customer_threads_tenant_customer_unique` index.
 */
export async function findOrCreateThread(
  tenantDb: TenantDb,
  tenantId: string,
  customerId: number,
): Promise<CustomerThread> {
  const existing = await tenantDb
    .select()
    .from(customerThreads)
    .where(
      tenantDb.withTenantFilter(
        customerThreads,
        eq(customerThreads.customerId, customerId),
      ),
    )
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Race-safe insert: rely on the unique index. If a concurrent inbound
  // already inserted the row, re-select. `tenantId` is auto-injected by
  // `tenantDb.insert` (registered in TABLE_METADATA), so the insert payload
  // only needs `customerId`.
  try {
    const insertValues: Pick<InsertCustomerThread, 'customerId'> = { customerId };
    const inserted = await tenantDb
      .insert(customerThreads)
      .values(insertValues)
      .returning();
    if (inserted.length > 0) return inserted[0];
  } catch (err) {
    // unique_violation → another worker won the race; fall through to re-select.
    console.warn(
      `[CUSTOMER_THREAD] insert race for tenant=${tenantId} customer=${customerId}, falling back to select`,
    );
  }

  const reSelect = await tenantDb
    .select()
    .from(customerThreads)
    .where(
      tenantDb.withTenantFilter(
        customerThreads,
        eq(customerThreads.customerId, customerId),
      ),
    )
    .limit(1);
  if (reSelect.length === 0) {
    throw new Error(
      `[CUSTOMER_THREAD] could not find or create thread for tenant=${tenantId} customer=${customerId}`,
    );
  }
  return reSelect[0];
}

/**
 * Set `conversations.thread_id` if it is currently NULL. Safe to call
 * multiple times; never overwrites a non-null thread_id.
 */
export async function attachConversationToThread(
  tenantDb: TenantDb,
  conversationId: number,
  threadId: number,
): Promise<void> {
  // Only set when NULL so we never silently reassign a conversation to a
  // different thread on a late identity change.
  await tenantDb
    .update(conversations)
    .set({ threadId })
    .where(
      and(
        eq(conversations.id, conversationId),
        isNull(conversations.threadId),
      ),
    );
}

/**
 * Load the thread row for a given conversation, or NULL if the conversation
 * is anonymous / has no thread_id yet.
 */
export async function getThreadForConversation(
  tenantDb: TenantDb,
  conversationId: number,
): Promise<CustomerThread | null> {
  const [conv] = await tenantDb
    .select({ threadId: conversations.threadId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv?.threadId) return null;

  const [thread] = await tenantDb
    .select()
    .from(customerThreads)
    .where(
      tenantDb.withTenantFilter(
        customerThreads,
        eq(customerThreads.id, conv.threadId),
      ),
    )
    .limit(1);
  return thread ?? null;
}

/**
 * Mark a thread as needing human attention and pause automation across every
 * channel that belongs to this thread. Callers (escalationService,
 * conversationHandler) still write the same fields on the conversation row
 * so anonymous (thread_id NULL) conversations continue to work.
 */
export async function setThreadEscalation(
  tenantDb: TenantDb,
  threadId: number,
  opts: {
    needsHumanAttention?: boolean;
    needsHumanReason?: string | null;
    automationPausedUntil?: Date | null;
    controlMode?: string;
  },
): Promise<void> {
  const patch: Record<string, any> = {};
  if (opts.needsHumanAttention !== undefined) patch.needsHumanAttention = opts.needsHumanAttention;
  if (opts.needsHumanReason !== undefined) patch.needsHumanReason = opts.needsHumanReason;
  if (opts.automationPausedUntil !== undefined) patch.automationPausedUntil = opts.automationPausedUntil;
  if (opts.controlMode !== undefined) patch.controlMode = opts.controlMode;
  if (Object.keys(patch).length === 0) return;

  await tenantDb
    .update(customerThreads)
    .set(patch)
    .where(eq(customerThreads.id, threadId));
}

/**
 * Resolve the effective automation/escalation state for a conversation.
 * Prefers the thread row (cross-channel) and falls back to the conversation
 * row when no thread is attached (anonymous web chat). The conversation row
 * is the same shape returned by `tenantDb.select().from(conversations)`.
 */
export async function resolveAutomationState(
  tenantDb: TenantDb,
  conversation: {
    id: number;
    threadId?: number | null;
    needsHumanAttention?: boolean | null;
    automationPausedUntil?: Date | string | null;
    controlMode?: string | null;
  },
): Promise<{
  needsHumanAttention: boolean;
  automationPausedUntil: Date | null;
  controlMode: string;
  source: 'thread' | 'conversation';
}> {
  if (conversation.threadId) {
    try {
      const [thread] = await tenantDb
        .select({
          needsHumanAttention: customerThreads.needsHumanAttention,
          automationPausedUntil: customerThreads.automationPausedUntil,
          controlMode: customerThreads.controlMode,
        })
        .from(customerThreads)
        .where(eq(customerThreads.id, conversation.threadId))
        .limit(1);
      if (thread) {
        return {
          needsHumanAttention: thread.needsHumanAttention === true,
          automationPausedUntil: thread.automationPausedUntil
            ? new Date(thread.automationPausedUntil as any)
            : null,
          controlMode: thread.controlMode || 'auto',
          source: 'thread',
        };
      }
    } catch (err) {
      console.warn(
        `[CUSTOMER_THREAD] resolveAutomationState thread read failed for conv=${conversation.id}:`,
        err,
      );
    }
  }
  return {
    needsHumanAttention: conversation.needsHumanAttention === true,
    automationPausedUntil: conversation.automationPausedUntil
      ? new Date(conversation.automationPausedUntil as any)
      : null,
    controlMode: conversation.controlMode || 'auto',
    source: 'conversation',
  };
}

/**
 * Arm a booking offer at the thread level, so a YES on SMS confirms an
 * offer that was armed in web chat (and vice versa).
 */
export async function armThreadBookingOffer(
  tenantDb: TenantDb,
  threadId: number,
  payloadHash: string,
  expiresAt: Date,
): Promise<void> {
  await tenantDb
    .update(customerThreads)
    .set({
      bookingOfferArmedAt: new Date(),
      bookingOfferExpiresAt: expiresAt,
      bookingOfferPayloadHash: payloadHash,
    })
    .where(eq(customerThreads.id, threadId));
}

/**
 * Clear the thread-level offer (called when offer is consumed or expires).
 */
export async function clearThreadBookingOffer(
  tenantDb: TenantDb,
  threadId: number,
): Promise<void> {
  await tenantDb
    .update(customerThreads)
    .set({
      bookingOfferArmedAt: null,
      bookingOfferExpiresAt: null,
      bookingOfferPayloadHash: null,
    })
    .where(eq(customerThreads.id, threadId));
}
