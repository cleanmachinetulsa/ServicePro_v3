/**
 * Audit T3 Task #23: Read-only AI replay.
 * Returns every assistant message on a conversation/thread together with
 * the tool calls captured in metadata, so an owner/admin can audit what the
 * AI did turn-by-turn from /admin/ai-replay/:threadId.
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from './authMiddleware';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { messages, conversations } from '@shared/schema';
import { and, eq, or } from 'drizzle-orm';

const router = Router();

router.get('/:threadId', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = ((req as any).tenantId as string | undefined) || (req as any).session?.activeTenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant context required' });
    const rawId = req.params.threadId;
    const threadOrConvId = Number(rawId);
    if (!Number.isFinite(threadOrConvId) || threadOrConvId <= 0) {
      return res.status(400).json({ error: 'invalid threadId' });
    }

    const tenantDb = wrapTenantDb(db, tenantId);

    // Find conversation ids belonging to this thread (or treat the id itself
    // as a conversation id when no thread linkage exists).
    const convRows = await tenantDb
      .select({ id: conversations.id, threadId: conversations.threadId, customerPhone: conversations.customerPhone })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          or(eq(conversations.threadId, threadOrConvId), eq(conversations.id, threadOrConvId)),
        ),
      );

    const convIds = convRows.map((c) => c.id);
    if (convIds.length === 0) {
      return res.json({ threadId: threadOrConvId, conversations: [], messages: [] });
    }

    const rows = await tenantDb
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        content: messages.content,
        sender: messages.sender,
        timestamp: messages.timestamp,
        metadata: messages.metadata,
      })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          eq(messages.sender, 'ai'),
        ),
      );

    const filtered = rows
      .filter((m) => convIds.includes(m.conversationId))
      .sort((a, b) => {
        const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return at - bt;
      })
      .map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        content: m.content,
        timestamp: m.timestamp,
        toolCalls: Array.isArray((m.metadata as any)?.toolCalls) ? (m.metadata as any).toolCalls as string[] : [],
      }));

    return res.json({
      threadId: threadOrConvId,
      conversations: convRows,
      messages: filtered,
    });
  } catch (err) {
    console.error('[AI REPLAY] error:', err);
    return res.status(500).json({ error: 'Failed to load AI replay' });
  }
});

export default router;
