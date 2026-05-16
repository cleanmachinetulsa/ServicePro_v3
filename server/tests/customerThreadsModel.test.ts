/**
 * Audit T1 (Task #17): Cross-channel customer threads model.
 *
 * Verifies the core invariant: two conversations created in the same tenant
 * for the same identified customer (via SMS phone) end up sharing exactly one
 * customer_threads row, and an anonymous web-chat conversation (no
 * customerId) keeps thread_id NULL and is unaffected.
 *
 * This is a lightweight node:test that exercises the real DB (the only DB the
 * project supports) and cleans up after itself. It is skipped when
 * DATABASE_URL is not configured (e.g. minimal CI).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations, customers, customerThreads } from '@shared/schema';
import { getOrCreateConversation } from '../conversationService';

const TENANT_ID = `t1-thread-test-${Date.now()}`;
const PHONE = `+1555${Date.now().toString().slice(-7)}`;

describe('customer_threads cross-channel model', () => {
  let tenantDb: ReturnType<typeof wrapTenantDb>;
  const createdConversationIds: number[] = [];
  let createdCustomerId: number | null = null;
  let createdThreadId: number | null = null;

  before(async () => {
    tenantDb = wrapTenantDb(db, TENANT_ID);
  });

  after(async () => {
    // Best-effort cleanup so reruns don't accumulate rows.
    try {
      if (createdConversationIds.length > 0) {
        for (const id of createdConversationIds) {
          await db.delete(conversations).where(eq(conversations.id, id));
        }
      }
      if (createdThreadId) {
        await db.delete(customerThreads).where(eq(customerThreads.id, createdThreadId));
      }
      if (createdCustomerId) {
        await db.delete(customers).where(eq(customers.id, createdCustomerId));
      }
    } catch (cleanupErr) {
      console.warn('[customer_threads test] cleanup warning:', cleanupErr);
    }
  });

  it('SMS + web for the same identified customer share one thread; anonymous web stays NULL', async () => {
    // 1) Inbound SMS for a never-seen-before phone => creates customer + conv + thread.
    const smsResult = await getOrCreateConversation(
      tenantDb,
      PHONE,
      'Thread Test User',
      'sms',
    );
    createdConversationIds.push(smsResult.conversation.id);
    createdCustomerId = smsResult.conversation.customerId ?? null;

    assert.ok(smsResult.isNew, 'sms conversation should be newly created');
    assert.ok(smsResult.conversation.customerId, 'sms conversation must resolve a customer');
    assert.ok(
      smsResult.conversation.threadId,
      'sms conversation must be attached to a thread',
    );
    createdThreadId = smsResult.conversation.threadId!;

    // 2) Web chat for the same phone => same customer, MUST reuse the same thread.
    const webResult = await getOrCreateConversation(
      tenantDb,
      PHONE,
      'Thread Test User',
      'web',
    );
    createdConversationIds.push(webResult.conversation.id);

    assert.equal(
      webResult.conversation.customerId,
      smsResult.conversation.customerId,
      'web conversation must resolve to the same customer as sms',
    );
    assert.equal(
      webResult.conversation.threadId,
      smsResult.conversation.threadId,
      'web conversation must share the SAME thread row as sms',
    );

    // 3) Verify there is exactly one thread row for (tenant, customer).
    const threads = await tenantDb
      .select()
      .from(customerThreads)
      .where(
        tenantDb.withTenantFilter(
          customerThreads,
          eq(customerThreads.customerId, smsResult.conversation.customerId!),
        ),
      );
    assert.equal(threads.length, 1, 'exactly one thread row must exist for (tenant, customer)');

    // 4) Anonymous web chat (no phone, no email) keeps thread_id NULL.
    const anonResult = await getOrCreateConversation(
      tenantDb,
      '',
      null,
      'web',
    );
    createdConversationIds.push(anonResult.conversation.id);
    assert.equal(
      anonResult.conversation.threadId ?? null,
      null,
      'anonymous web-chat conversation must keep thread_id NULL',
    );
  });
});
