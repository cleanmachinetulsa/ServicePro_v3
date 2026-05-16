/**
 * Audit T3 Task #23: Read-only AI replay.
 * Returns every assistant message on a conversation/thread with the captured
 * tool calls, their arguments, the raw model output, and the final sent text
 * so an owner/admin can audit what the AI did turn-by-turn.
 *
 * Gated by:
 *   - requireAuth (session)
 *   - aiSmsAgent feature (Pro/Elite/Internal tiers)
 *   - tenant-scoped query (cannot see other tenants' replay)
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from './authMiddleware';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { messages, conversations, tenants } from '@shared/schema';
import { and, eq, or } from 'drizzle-orm';
import { hasFeature } from '@shared/features';

const router = Router();

router.get('/:threadId', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = ((req as any).tenantId as string | undefined) || (req as any).session?.activeTenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant context required' });

    // Plan gate — replay is a Pro+ feature surfaced through aiSmsAgent.
    const rootDb = wrapTenantDb(db, 'root');
    const [tenant] = await rootDb
      .select({ id: tenants.id, planTier: tenants.planTier })
      .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) return res.status(404).json({ error: 'tenant not found' });
    if (!hasFeature({ planTier: tenant.planTier }, 'aiSmsAgent')) {
      return res.status(403).json({
        error: 'AI replay requires the Pro plan or higher.',
        upgradeRequired: 'pro',
      });
    }

    const rawId = req.params.threadId;
    const threadOrConvId = Number(rawId);
    if (!Number.isFinite(threadOrConvId) || threadOrConvId <= 0) {
      return res.status(400).json({ error: 'invalid threadId' });
    }

    const tenantDb = wrapTenantDb(db, tenantId);

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
      .map((m) => {
        const md = (m.metadata as any) || {};
        const toolNames: string[] = Array.isArray(md.toolCalls) ? md.toolCalls : [];
        const toolCallDetails: Array<{ name: string; args?: any }> = Array.isArray(md.toolCallDetails) ? md.toolCallDetails : [];
        return {
          id: m.id,
          conversationId: m.conversationId,
          content: m.content,
          finalSentText: typeof md.finalSentText === 'string' ? md.finalSentText : m.content,
          modelOutput: typeof md.modelOutput === 'string' ? md.modelOutput : m.content,
          timestamp: m.timestamp,
          toolNames,
          toolCalls: toolCallDetails.length > 0
            ? toolCallDetails
            : toolNames.map((name) => ({ name, args: null })),
        };
      });

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
