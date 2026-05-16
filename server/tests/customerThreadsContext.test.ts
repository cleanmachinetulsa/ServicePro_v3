/**
 * Audit T1 (Task #17): Cross-channel SMS context hydration.
 *
 * Proves that `buildSmsLlmContext`, when called from the SMS path with the
 * thread id of a conversation, hydrates messages from EVERY sibling
 * conversation on that customer thread (e.g. messages the customer wrote
 * in web chat are visible to the SMS agent), in chronological order.
 *
 * Also proves the anonymous fallback: with no thread id, only the
 * single conversation's messages are returned.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations, customers, customerThreads, messages } from '@shared/schema';
import { getOrCreateConversation } from '../conversationService';
import { buildSmsLlmContext } from '../services/smsConversationContextService';

const TENANT_ID = `t1-thread-ctx-${Date.now()}`;
const PHONE = `+1555${Date.now().toString().slice(-7)}`;

describe('cross-channel SMS context hydration', () => {
  let tenantDb: ReturnType<typeof wrapTenantDb>;
  const createdConversationIds: number[] = [];
  let createdCustomerId: number | null = null;
  let createdThreadId: number | null = null;

  before(async () => {
    tenantDb = wrapTenantDb(db, TENANT_ID);
  });

  after(async () => {
    try {
      if (createdConversationIds.length > 0) {
        await db.delete(messages).where(inArray(messages.conversationId, createdConversationIds));
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
      console.warn('[customer_threads context test] cleanup warning:', cleanupErr);
    }
  });

  it('SMS context includes web-chat messages from the same customer thread, in order', async () => {
    // Create SMS + web conversations for the same phone (same customer/thread).
    const smsResult = await getOrCreateConversation(tenantDb, PHONE, 'Ctx Test User', 'sms');
    createdConversationIds.push(smsResult.conversation.id);
    createdCustomerId = smsResult.conversation.customerId ?? null;
    createdThreadId = smsResult.conversation.threadId ?? null;
    assert.ok(createdThreadId, 'sms conversation must be attached to a thread');

    const webResult = await getOrCreateConversation(tenantDb, PHONE, 'Ctx Test User', 'web');
    createdConversationIds.push(webResult.conversation.id);
    assert.equal(
      webResult.conversation.threadId,
      smsResult.conversation.threadId,
      'web conversation must share the same thread as sms',
    );

    // Insert a chronologically interleaved series of messages across both
    // conversations: web "hi" -> sms "and follow-up" -> web "still here?".
    const t0 = Date.now();
    await tenantDb.insert(messages).values([
      {
        conversationId: webResult.conversation.id,
        content: 'hi from web',
        sender: 'customer',
        fromCustomer: true,
        channel: 'web',
        timestamp: new Date(t0),
      },
      {
        conversationId: smsResult.conversation.id,
        content: 'sms follow-up',
        sender: 'customer',
        fromCustomer: true,
        channel: 'sms',
        timestamp: new Date(t0 + 1000),
      },
      {
        conversationId: webResult.conversation.id,
        content: 'still here on web?',
        sender: 'customer',
        fromCustomer: true,
        channel: 'web',
        timestamp: new Date(t0 + 2000),
      },
    ]);

    // Build context from the SMS side, passing the thread id as the SMS
    // route does. Cross-channel messages should be included in order.
    const ctxThreaded = await buildSmsLlmContext({
      tenantId: TENANT_ID,
      conversationId: smsResult.conversation.id,
      fromPhone: PHONE,
      toPhone: '+15550000000',
      tenantDb,
      threadId: smsResult.conversation.threadId ?? null,
    });

    const contents = ctxThreaded.recentMessages.map((m) => m.content);
    assert.ok(
      contents.includes('hi from web') && contents.includes('still here on web?'),
      `expected web-chat messages in cross-channel context, got: ${contents.join(' | ')}`,
    );
    assert.ok(
      contents.includes('sms follow-up'),
      'expected own sms message in context',
    );
    const idxWeb1 = contents.indexOf('hi from web');
    const idxSms = contents.indexOf('sms follow-up');
    const idxWeb2 = contents.indexOf('still here on web?');
    assert.ok(
      idxWeb1 < idxSms && idxSms < idxWeb2,
      `cross-channel messages must be ordered by timestamp, got order: ${contents.join(' | ')}`,
    );

    // Without threadId, only the SMS conversation's own messages are loaded.
    const ctxAnon = await buildSmsLlmContext({
      tenantId: TENANT_ID,
      conversationId: smsResult.conversation.id,
      fromPhone: PHONE,
      toPhone: '+15550000000',
      tenantDb,
      // threadId omitted -> single-conversation behavior
    });
    const anonContents = ctxAnon.recentMessages.map((m) => m.content);
    assert.ok(
      anonContents.includes('sms follow-up'),
      'single-conv context must include own sms message',
    );
    assert.ok(
      !anonContents.includes('hi from web') && !anonContents.includes('still here on web?'),
      `single-conv context must NOT include web-chat siblings, got: ${anonContents.join(' | ')}`,
    );
  });
});
