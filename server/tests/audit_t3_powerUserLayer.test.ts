/**
 * Audit T3 Task #21 — Power-user polish & productivity layer.
 *
 * Covers:
 *  - Bulk-action tenant scoping: an update issued via a tenant-scoped
 *    write must not affect conversations belonging to another tenant
 *    (bulk-action permission boundary).
 *  - AI cost aggregation: usage_events tagged with conversationId in
 *    metadata are summed for the right thread + tenant only.
 *  - Summary cache invalidation: cache key is (conversationId, lastMessageId),
 *    so adding a new message must produce a different cache lookup.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import {
  conversations,
  customers,
  messages,
  usageEvents,
} from '@shared/schema';
import { getOrCreateConversation } from '../conversationService';

const STAMP = Date.now();
const TENANT_A = `t3-pwr-A-${STAMP}`;
const TENANT_B = `t3-pwr-B-${STAMP}`;
const PHONE_A = `+1555${STAMP.toString().slice(-7)}`;
const PHONE_B = `+1444${STAMP.toString().slice(-7)}`;

describe('Audit T3 Task #21 — power-user backend invariants', () => {
  const createdConvIds: number[] = [];
  const createdCustomerIds: number[] = [];

  after(async () => {
    try {
      if (createdConvIds.length > 0) {
        await db.delete(messages).where(inArray(messages.conversationId, createdConvIds));
        await db.delete(conversations).where(inArray(conversations.id, createdConvIds));
      }
      await db
        .delete(usageEvents)
        .where(inArray(usageEvents.tenantId, [TENANT_A, TENANT_B]));
      if (createdCustomerIds.length > 0) {
        await db.delete(customers).where(inArray(customers.id, createdCustomerIds));
      }
    } catch (e) {
      console.warn('[audit_t3 power user] cleanup warning:', e);
    }
  });

  it('bulk-action style update is scoped to the issuing tenant', async () => {
    const dbA = wrapTenantDb(db, TENANT_A);
    const dbB = wrapTenantDb(db, TENANT_B);

    const a = await getOrCreateConversation(dbA, PHONE_A, 'Alice', 'sms');
    const b = await getOrCreateConversation(dbB, PHONE_B, 'Bob', 'sms');
    createdConvIds.push(a.conversation.id, b.conversation.id);
    if (a.customerId) createdCustomerIds.push(a.customerId);
    if (b.customerId) createdCustomerIds.push(b.customerId);

    // Simulate bulk archive: ids includes BOTH tenants' conversations, but
    // the write is issued through tenant A's wrapped db — tenant B's row
    // must remain unaffected.
    await dbA
      .update(conversations)
      .set({ archived: true })
      .where(
        dbA.withTenantFilter(
          conversations,
          inArray(conversations.id, [a.conversation.id, b.conversation.id]),
        ),
      );

    const [refreshedA] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, a.conversation.id));
    const [refreshedB] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, b.conversation.id));
    assert.equal(refreshedA?.archived, true, 'A should be archived');
    assert.equal(refreshedB?.archived, false, 'B must NOT be archived by A');
  });

  it('AI cost aggregation sums only tokens tagged for that conversation + tenant', async () => {
    const dbA = wrapTenantDb(db, TENANT_A);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.tenantId, TENANT_A))
      .limit(1);
    assert.ok(conv, 'expected at least one conversation for tenant A');

    // Insert 3 usage events: 2 for this conversation (tenant A) and 1 for
    // another conversation in tenant B with the SAME conversationId number.
    await db.insert(usageEvents).values([
      {
        tenantId: TENANT_A,
        channel: 'ai',
        direction: 'outbound',
        source: 'openai',
        feature: 'ai_sms',
        quantity: 1500,
        metadata: { model: 'gpt-4o', inputTokens: 1000, outputTokens: 500, conversationId: conv.id },
      },
      {
        tenantId: TENANT_A,
        channel: 'ai',
        direction: 'outbound',
        source: 'openai',
        feature: 'ai_sms',
        quantity: 2400,
        metadata: { model: 'gpt-4o', inputTokens: 2000, outputTokens: 400, conversationId: conv.id },
      },
      {
        tenantId: TENANT_B,
        channel: 'ai',
        direction: 'outbound',
        source: 'openai',
        feature: 'ai_sms',
        quantity: 19998,
        metadata: { model: 'gpt-4o', inputTokens: 9999, outputTokens: 9999, conversationId: conv.id },
      },
    ]);

    const rows = await dbA
      .select({
        inTok: sql<number>`COALESCE(SUM((${usageEvents.metadata}->>'inputTokens')::int), 0)`,
        outTok: sql<number>`COALESCE(SUM((${usageEvents.metadata}->>'outputTokens')::int), 0)`,
      })
      .from(usageEvents)
      .where(
        dbA.withTenantFilter(
          usageEvents,
          sql`${usageEvents.channel} = 'ai' AND ${usageEvents.metadata}->>'conversationId' = ${String(conv.id)}`,
        ),
      );

    const inTok = Number(rows[0]?.inTok ?? 0);
    const outTok = Number(rows[0]?.outTok ?? 0);
    assert.equal(inTok, 3000, 'only tenant A tokens should be summed');
    assert.equal(outTok, 900, 'only tenant A tokens should be summed');
  });

  it('summary cache key changes when a new message is appended', async () => {
    const dbA = wrapTenantDb(db, TENANT_A);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.tenantId, TENANT_A))
      .limit(1);
    assert.ok(conv);

    const buildKey = async () => {
      const [latest] = await dbA
        .select({ id: messages.id })
        .from(messages)
        .where(dbA.withTenantFilter(messages, eq(messages.conversationId, conv.id)))
        .orderBy(sql`${messages.id} DESC`)
        .limit(1);
      return `${conv.id}:${latest?.id ?? 0}`;
    };

    const keyBefore = await buildKey();
    await db.insert(messages).values({
      conversationId: conv.id,
      tenantId: TENANT_A,
      content: 'audit t3 cache bust',
      sender: 'customer',
      fromCustomer: true,
      channel: 'sms',
    });
    const keyAfter = await buildKey();
    assert.notEqual(keyBefore, keyAfter, 'cache key must change after new message');
  });
});
