import { Express, Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import axios from 'axios';
import { facebookPageTokens, conversations, messageReactions, messages, customers, appointments, usageEvents } from '@shared/schema';
import { eq, and, inArray, gte, lte, ne, sql, desc } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './authMiddleware';
import { normalizePhone } from './phoneValidationMiddleware';
import {
  getAllConversations,
  getConversationById,
  getOrCreateConversation,
  addMessage,
  takeoverConversation,
  handoffConversation,
  updateBehaviorSettings,
  pauseConversation,
  resumeConversation,
  closeConversation,
} from './conversationService';

/**
 * Register conversation monitoring routes
 */
export function registerConversationRoutes(app: Express) {
  // Apply authentication middleware to all conversation routes
  app.use('/api/conversations*', requireAuth);

  // ============================================================
  // Audit T3 Task #21 — Power-user polish: per-thread AI usage,
  // thread summary, channel switching, and bulk actions.
  // ============================================================

  // GPT-4o public pricing per 1k tokens (input/output). Kept inline since
  // there is no central rate table yet; safe to read-only estimate.
  const AI_RATES: Record<string, { in: number; out: number }> = {
    'gpt-4o': { in: 0.005, out: 0.015 },
    'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  };
  const estimateAiCost = (model: string | undefined, inTok: number, outTok: number): number => {
    const r = AI_RATES[model || 'gpt-4o'] || AI_RATES['gpt-4o'];
    return (inTok / 1000) * r.in + (outTok / 1000) * r.out;
  };

  // In-process LRU-ish cache for thread summaries. Bounded to avoid leaks.
  const summaryCache = new Map<string, { summary: string; generatedAt: number; messageCount: number }>();
  const SUMMARY_CACHE_MAX = 500;

  // -------- GET /api/conversations/:id/ai-usage --------
  // Sums AI usage events tagged with this conversationId in metadata
  // over the last 90 days, tenant-scoped. Returns call count, tokens,
  // and estimated cost in USD.
  app.get('/api/conversations/:id/ai-usage', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) {
        return res.status(400).json({ success: false, message: 'Invalid conversation ID' });
      }
      const tenantId = (req.tenant as any)?.id || 'root';

      // Confirm conversation belongs to tenant before exposing anything.
      const own = await req.tenantDb!
        .select({ id: conversations.id })
        .from(conversations)
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .limit(1);
      if (own.length === 0) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const rows = await db
        .select({
          model: sql<string>`COALESCE(${usageEvents.metadata}->>'model', 'gpt-4o')`,
          inputTokens: sql<number>`COALESCE((${usageEvents.metadata}->>'inputTokens')::int, 0)`,
          outputTokens: sql<number>`COALESCE((${usageEvents.metadata}->>'outputTokens')::int, 0)`,
        })
        .from(usageEvents)
        .where(and(
          eq(usageEvents.tenantId, tenantId),
          eq(usageEvents.channel, 'ai'),
          gte(usageEvents.timestamp, since),
          sql`(${usageEvents.metadata}->>'conversationId')::int = ${conversationId}`,
        ));

      let calls = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let costUsd = 0;
      for (const r of rows) {
        calls += 1;
        inputTokens += r.inputTokens || 0;
        outputTokens += r.outputTokens || 0;
        costUsd += estimateAiCost(r.model, r.inputTokens || 0, r.outputTokens || 0);
      }

      res.json({
        success: true,
        data: {
          conversationId,
          calls,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          costUsd: Math.round(costUsd * 10000) / 10000,
          windowDays: 90,
        },
      });
    } catch (error) {
      console.error('[AI USAGE] Error:', error);
      res.status(500).json({ success: false, message: 'Failed to load AI usage' });
    }
  });

  // -------- GET /api/conversations/:id/summary --------
  // gpt-4o-mini 2-line summary of the last 40 messages. Cached in-memory by
  // (conversationId, lastMessageId) so repeat opens are free.
  app.get('/api/conversations/:id/summary', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) {
        return res.status(400).json({ success: false, message: 'Invalid conversation ID' });
      }

      const own = await req.tenantDb!
        .select({ id: conversations.id })
        .from(conversations)
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .limit(1);
      if (own.length === 0) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      const recent = await req.tenantDb!
        .select({
          id: messages.id,
          content: messages.content,
          sender: messages.sender,
          timestamp: messages.timestamp,
        })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.timestamp))
        .limit(40);

      if (recent.length <= 20) {
        return res.json({
          success: true,
          data: { summary: null, messageCount: recent.length, reason: 'thread_too_short' },
        });
      }

      const ordered = recent.reverse();
      const lastId = ordered[ordered.length - 1].id;
      const cacheKey = `${conversationId}:${lastId}`;
      const hit = summaryCache.get(cacheKey);
      if (hit) {
        return res.json({
          success: true,
          data: { summary: hit.summary, messageCount: hit.messageCount, cached: true },
        });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.json({
          success: true,
          data: { summary: null, messageCount: ordered.length, reason: 'openai_not_configured' },
        });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const transcript = ordered
        .map(m => `${m.sender}: ${(m.content || '').slice(0, 400)}`)
        .join('\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 160,
        messages: [
          {
            role: 'system',
            content:
              'You summarize customer service chat threads for a support agent in 2 short lines. '
              + 'Line 1: what the customer wants. Line 2: open questions or next action. '
              + 'No greetings, no preamble, no markdown. Plain text only.',
          },
          { role: 'user', content: transcript },
        ],
      });
      const summary = (completion.choices?.[0]?.message?.content || '').trim();

      const tenantId = (req.tenant as any)?.id || 'root';
      try {
        const { recordAiUsage } = await import('./services/usageEventService');
        await recordAiUsage(
          tenantId,
          'ai_chat',
          completion.usage?.prompt_tokens || 0,
          completion.usage?.completion_tokens || 0,
          'gpt-4o-mini',
          conversationId,
        );
      } catch (usageErr) {
        console.warn('[THREAD SUMMARY] usage record failed:', usageErr);
      }

      // bounded LRU eviction
      if (summaryCache.size >= SUMMARY_CACHE_MAX) {
        const oldestKey = summaryCache.keys().next().value;
        if (oldestKey) summaryCache.delete(oldestKey);
      }
      summaryCache.set(cacheKey, { summary, generatedAt: Date.now(), messageCount: ordered.length });

      res.json({
        success: true,
        data: { summary, messageCount: ordered.length, cached: false },
      });
    } catch (error) {
      console.error('[THREAD SUMMARY] Error:', error);
      res.status(500).json({ success: false, message: 'Failed to summarize thread' });
    }
  });

  // -------- POST /api/conversations/:id/switch-channel --------
  // Appends a handoff system message on the current conversation, then
  // finds-or-creates a sibling conversation on the target platform for the
  // same customer phone. Returns the target conversation id so the UI can
  // jump to it. Caller is responsible for the actual outbound message on
  // the new channel — this only stages the thread.
  app.post('/api/conversations/:id/switch-channel', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { to } = req.body as { to?: string };
      const allowed = ['sms', 'web', 'email', 'facebook', 'instagram'] as const;
      if (isNaN(conversationId) || !to || !(allowed as readonly string[]).includes(to)) {
        return res.status(400).json({ success: false, message: 'Invalid id or target channel' });
      }

      const current = await req.tenantDb!
        .select()
        .from(conversations)
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .limit(1);
      if (current.length === 0) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }
      const curr = current[0];
      if (curr.platform === to) {
        return res.status(400).json({ success: false, message: 'Already on that channel' });
      }

      const handoffNote = `↪️ Switched channel: continuing on ${to.toUpperCase()}.`;
      try {
        await addMessage(req.tenantDb!, conversationId, handoffNote, 'agent', curr.platform as any, {
          type: 'channel_switch',
          to,
        });
      } catch (e) {
        console.warn('[SWITCH-CHANNEL] handoff note insert failed (non-blocking):', e);
      }

      if (!curr.customerPhone) {
        return res.status(400).json({
          success: false,
          message: 'Cannot switch channel: conversation has no phone number',
        });
      }

      const target = await getOrCreateConversation(
        req.tenantDb!,
        curr.customerPhone,
        curr.customerName,
        to,
        undefined,
        undefined,
        curr.emailAddress || undefined,
      );
      const targetId = target.conversation.id;

      try {
        await addMessage(
          req.tenantDb!,
          targetId,
          `↩️ Continued from ${String(curr.platform).toUpperCase()}.`,
          'agent',
          to as any,
          { type: 'channel_switch', from: curr.platform },
        );
      } catch (e) {
        console.warn('[SWITCH-CHANNEL] target note insert failed (non-blocking):', e);
      }

      res.json({ success: true, data: { targetConversationId: targetId, platform: to } });
    } catch (error) {
      console.error('[SWITCH-CHANNEL] Error:', error);
      res.status(500).json({ success: false, message: 'Failed to switch channel' });
    }
  });

  // -------- POST /api/conversations/bulk-action --------
  // Apply mark-read | snooze | resolve | archive | assign to a batch of
  // tenant-owned conversations. The frontend is responsible for expanding
  // a thread row into siblingConversationIds before posting.
  app.post('/api/conversations/bulk-action', async (req: Request, res: Response) => {
    try {
      const { action, ids, payload } = req.body as {
        action?: string;
        ids?: number[];
        payload?: any;
      };
      const validActions = ['mark-read', 'snooze', 'resolve', 'archive', 'assign'] as const;
      if (!action || !(validActions as readonly string[]).includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid action' });
      }
      const cleanIds = Array.isArray(ids)
        ? ids.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0)
        : [];
      if (cleanIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No conversations selected' });
      }
      if (cleanIds.length > 200) {
        return res.status(400).json({ success: false, message: 'Too many conversations (max 200)' });
      }

      let updateSet: Record<string, any> | null = null;
      switch (action) {
        case 'mark-read':
          updateSet = { unreadCount: 0 };
          break;
        case 'snooze': {
          const until = payload?.snoozedUntil
            ? new Date(payload.snoozedUntil)
            : new Date(Date.now() + 60 * 60 * 1000);
          updateSet = { snoozedUntil: until };
          break;
        }
        case 'resolve':
          updateSet = { status: 'closed', resolved: true };
          break;
        case 'archive':
          updateSet = { archived: true, archivedAt: new Date() };
          break;
        case 'assign':
          if (!payload?.agentUsername || typeof payload.agentUsername !== 'string') {
            return res.status(400).json({ success: false, message: 'agentUsername required' });
          }
          updateSet = {
            controlMode: 'manual',
            assignedAgent: payload.agentUsername,
          };
          break;
      }

      const updated = await req.tenantDb!
        .update(conversations)
        .set(updateSet!)
        .where(req.tenantDb!.withTenantFilter(conversations, inArray(conversations.id, cleanIds)))
        .returning({ id: conversations.id });

      res.json({
        success: true,
        data: { action, requested: cleanIds.length, updated: updated.length },
      });
    } catch (error) {
      console.error('[BULK-ACTION] Error:', error);
      res.status(500).json({ success: false, message: 'Failed to apply bulk action' });
    }
  });
  // Create a new conversation (from Messages UI)
  // Phone validation happens via conditional middleware below
  app.post('/api/conversations/create', async (req: Request, res: Response, next: NextFunction) => {
    const { platform } = req.body;
    
    // Apply phone normalization only for SMS platform
    if (platform === 'sms') {
      return normalizePhone('phone', { required: true })(req, res, () => {
        handleConversationCreate(req, res);
      });
    }
    
    // For other platforms, skip phone validation
    handleConversationCreate(req, res);
  });

  // Separated handler for conversation creation logic
  async function handleConversationCreate(req: Request, res: Response) {
    try {
      const { phone, email, socialId, name, platform, phoneLineId } = req.body;

      if (platform === 'sms') {
        // Phone is already validated and normalized to E.164 by middleware
        const { conversation, isNew } = await getOrCreateConversation(
          req.tenantDb!,
          phone,
          name || null,
          'sms',
          undefined, // facebookSenderId
          undefined, // facebookPageId
          undefined, // emailAddress
          undefined, // emailThreadId
          undefined, // emailSubject
          phoneLineId // Pass phoneLineId for SMS
        );

        res.json({
          success: true,
          conversation,
          isNewConversation: isNew,
          message: isNew ? 'SMS conversation created successfully' : 'Existing conversation found',
        });
      } else if (platform === 'email') {
        if (!email) {
          return res.status(400).json({
            success: false,
            message: 'Email is required for email conversations',
          });
        }

        const { conversation, isNew } = await getOrCreateConversation(
          req.tenantDb!,
          email,
          name || null,
          'email'
        );

        res.json({
          success: true,
          conversation,
          isNewConversation: isNew,
          message: isNew ? 'Email conversation created successfully' : 'Existing conversation found',
        });
      } else if (platform === 'facebook' || platform === 'instagram') {
        if (!socialId) {
          return res.status(400).json({
            success: false,
            message: `${platform} user ID is required`,
          });
        }

        const { conversation, isNew } = await getOrCreateConversation(
          req.tenantDb!,
          socialId,
          name || null,
          platform
        );

        res.json({
          success: true,
          conversation,
          isNewConversation: isNew,
          message: isNew ? `${platform} conversation created successfully` : 'Existing conversation found',
        });
      } else if (platform === 'web') {
        const identifier = phone || email || `web-${Date.now()}`;
        
        const { conversation, isNew } = await getOrCreateConversation(
          req.tenantDb!,
          identifier,
          name || null,
          'web'
        );

        res.json({
          success: true,
          conversation,
          isNewConversation: isNew,
          message: isNew ? 'Web conversation created successfully' : 'Existing conversation found',
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid platform specified',
        });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Get all conversations (CM-MESSAGE-PERF: supports pagination)
  app.get('/api/conversations', async (req: Request, res: Response) => {
    try {
      const { status, phoneLineId, limit, offset } = req.query;
      const phoneLineIdNum = phoneLineId ? parseInt(phoneLineId as string) : undefined;
      
      // CM-MESSAGE-PERF: Parse pagination parameters
      const paginationOptions: { limit?: number; offset?: number } = {};
      if (limit && typeof limit === 'string') {
        const limitNum = parseInt(limit);
        if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 100) {
          paginationOptions.limit = limitNum;
        }
      }
      if (offset && typeof offset === 'string') {
        const offsetNum = parseInt(offset);
        if (!isNaN(offsetNum) && offsetNum >= 0) {
          paginationOptions.offset = offsetNum;
        }
      }
      
      const conversations = await getAllConversations(
        req.tenantDb!, 
        status as string, 
        phoneLineIdNum,
        paginationOptions
      );

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      console.error('Error getting conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversations',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get conversation by ID with paginated message history
  app.get('/api/conversations/:id', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { before, limit } = req.query;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      // Parse pagination parameters
      const options: { before?: Date; limit?: number } = {};
      if (before && typeof before === 'string') {
        options.before = new Date(before);
      }
      if (limit && typeof limit === 'string') {
        const limitNum = parseInt(limit);
        if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 100) {
          options.limit = limitNum;
        }
      }

      const conversation = await getConversationById(req.tenantDb!, conversationId, options);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      console.error('Error getting conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Take over conversation (switch to manual mode)
  app.post('/api/conversations/:id/takeover', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { agentUsername } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      if (!agentUsername) {
        return res.status(400).json({
          success: false,
          message: 'Agent username is required',
        });
      }

      const conversation = await takeoverConversation(req.tenantDb!, conversationId, agentUsername);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation taken over successfully',
      });
    } catch (error) {
      console.error('Error taking over conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to take over conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Hand off conversation back to AI
  app.post('/api/conversations/:id/handoff', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await handoffConversation(req.tenantDb!, conversationId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation handed off to AI successfully',
      });
    } catch (error) {
      console.error('Error handing off conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to hand off conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update behavior settings
  app.patch('/api/conversations/:id/behavior', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const behaviorSettings = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await updateBehaviorSettings(req.tenantDb!, conversationId, behaviorSettings);

      res.json({
        success: true,
        data: conversation,
        message: 'Behavior settings updated successfully',
      });
    } catch (error) {
      console.error('Error updating behavior settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update behavior settings',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Pause conversation
  app.post('/api/conversations/:id/pause', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await pauseConversation(req.tenantDb!, conversationId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation paused successfully',
      });
    } catch (error) {
      console.error('Error pausing conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to pause conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Resume conversation
  app.post('/api/conversations/:id/resume', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await resumeConversation(req.tenantDb!, conversationId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation resumed successfully',
      });
    } catch (error) {
      console.error('Error resuming conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resume conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Close conversation
  app.post('/api/conversations/:id/close', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await closeConversation(req.tenantDb!, conversationId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation closed successfully',
      });
    } catch (error) {
      console.error('Error closing conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to close conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Send manual message as agent
  app.post('/api/conversations/:id/send-message', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, channel, attachments = [], phoneLineId } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      // Allow empty content if attachments are present
      if ((!content || !content.trim()) && attachments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Either message content or attachments are required',
        });
      }

      // Get conversation to find customer phone
      const conversation = await getConversationById(req.tenantDb!, conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      // Replace template variables with actual data
      const { replaceTemplateVariables } = await import('./templateVariableService');
      const processedContent = await replaceTemplateVariables(req.tenantDb!, content, {
        conversationId,
        operatorName: req.body.operatorName || 'agent',
        userId: (req as any).session?.userId, // Pass authenticated user ID for operator name lookup
      });

      // Deliver message to customer based on channel BEFORE saving to database
      if (conversation.platform === 'sms') {
        // Check if customer has opted out of SMS
        const { isOptedOut } = await import('./smsConsentService');
        const optedOut = await isOptedOut(req.tenantDb!, conversationId);
        
        if (optedOut) {
          return res.status(403).json({
            success: false,
            message: 'Customer has opted out of SMS messages',
            details: 'This customer replied STOP and cannot receive SMS messages. They must send START to opt back in.',
          });
        }
        
        // Check if Twilio is configured
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.MAIN_PHONE_NUMBER) {
          return res.status(500).json({
            success: false,
            message: 'SMS delivery is not configured. Missing Twilio credentials.',
          });
        }

        // Send via Twilio for SMS
        try {
          if (!conversation.customerPhone) {
            return res.status(400).json({
              success: false,
              message: 'No customer phone number available for SMS delivery',
            });
          }

          // Use sendSMS from notifications to handle phone line properly
          const { sendSMS } = await import('./notifications');
          await sendSMS(
            req.tenantDb!,
            conversation.customerPhone,
            processedContent,
            conversationId,
            undefined,
            phoneLineId || conversation.phoneLineId || undefined
          );
          
          console.log(`[SMS SEND SUCCESS] Manual message sent via SMS to ${conversation.customerPhone} using phone line ${phoneLineId || conversation.phoneLineId || 'default'}`);
        } catch (smsError: any) {
          console.error('[SMS SEND ERROR] Failed to deliver SMS:', {
            conversationId,
            customerPhone: conversation.customerPhone,
            error: smsError.message || String(smsError),
            errorCode: smsError.code,
            errorStatus: smsError.status,
            phoneLineId: phoneLineId || conversation.phoneLineId,
          });
          return res.status(500).json({
            success: false,
            message: 'Failed to deliver SMS message',
            error: smsError.message || String(smsError),
            errorCode: smsError.code,
            details: 'The message was not sent to the customer. Please try again or contact them via another channel.',
          });
        }
      } else if (conversation.platform === 'facebook' || conversation.platform === 'instagram') {
        // Send via Facebook/Instagram Messenger
        try {
          if (!conversation.facebookSenderId || !conversation.facebookPageId) {
            return res.status(400).json({
              success: false,
              message: 'No Facebook sender ID or page ID available for message delivery',
            });
          }

          // Get page access token
          const pageTokens = await req.tenantDb!
            .select()
            .from(facebookPageTokens)
            .where(req.tenantDb!.withTenantFilter(facebookPageTokens, eq(facebookPageTokens.pageId, conversation.facebookPageId)));

          if (pageTokens.length === 0 || !pageTokens[0].isActive) {
            return res.status(404).json({
              success: false,
              message: 'Facebook page not configured or inactive',
            });
          }

          const accessToken = pageTokens[0].pageAccessToken;

          // Send message via Facebook Graph API
          const response = await axios.post(
            `https://graph.facebook.com/v18.0/me/messages`,
            {
              recipient: { id: conversation.facebookSenderId },
              message: { text: processedContent },
              messaging_type: 'RESPONSE', // Required for agent replies
            },
            {
              params: { access_token: accessToken },
            }
          );

          // Log success for debugging
          console.log(`[Facebook API] Message sent successfully:`, response.data);

          console.log(`Manual message sent via ${conversation.platform} to ${conversation.facebookSenderId}`);
        } catch (fbError: any) {
          console.error('Error sending Facebook/Instagram message:', fbError);
          return res.status(500).json({
            success: false,
            message: 'Failed to deliver message via Facebook/Instagram',
            error: fbError.response?.data || fbError.message || String(fbError),
            details: 'The message was not sent to the customer. Please try again or contact them via another channel.',
          });
        }
      }

      // Save message to database after successful delivery (or for web chat)
      const messageMetadata = attachments.length > 0 ? { attachments } : null;
      let message;
      
      try {
        message = await addMessage(
          req.tenantDb!,
          conversationId, 
          processedContent || '', 
          'agent', 
          channel || 'web',
          messageMetadata,
          phoneLineId || conversation.phoneLineId || undefined
        );
        // For web chat, the message is broadcast via WebSocket in addMessage
      } catch (dbError: any) {
        // CRITICAL ERROR: Database save failed - this is unacceptable
        console.error('[MESSAGE DB SAVE ERROR] CRITICAL: Message was delivered but failed to save to database:', {
          conversationId,
          error: dbError.message || String(dbError),
          platform: conversation.platform,
          stack: dbError.stack,
        });
        
        // Log as CRITICAL error - triggers SMS alert to business owner
        try {
          const { logError } = await import('./errorMonitoring');
          await logError({
            type: 'database',
            severity: 'critical',
            message: `Database save failed for delivered message (conversation ${conversationId})`,
            endpoint: req.path,
            metadata: {
              conversationId,
              platform: conversation.platform,
              errorMessage: dbError.message || String(dbError),
              errorStack: dbError.stack,
              messageContent: processedContent ? processedContent.substring(0, 100) : '[no text content]',
            },
          });
        } catch (logErr) {
          console.error('[MESSAGE DB SAVE ERROR] Failed to log critical error:', logErr);
        }
        
        // If message was sent via SMS/Facebook/Instagram, return success=false but 200 status
        // This ensures Twilio doesn't retry, but UI knows there was a problem
        if (conversation.platform !== 'web') {
          return res.status(200).json({
            success: false,
            data: null,
            message: 'Message delivered but database save failed',
            error: 'Database save failed - message history may be incomplete',
            details: conversation.platform === 'sms' 
              ? 'Message sent via SMS but not saved to database. Technical team has been notified.'
              : conversation.platform === 'facebook'
              ? 'Message sent via Facebook Messenger but not saved to database. Technical team has been notified.'
              : conversation.platform === 'instagram'
              ? 'Message sent via Instagram DM but not saved to database. Technical team has been notified.'
              : 'Message sent but not saved to database. Technical team has been notified.',
          });
        }
        
        // For web chat, database save is critical since there's no external delivery
        throw dbError;
      }

      res.json({
        success: true,
        data: message,
        message: conversation.platform === 'sms' 
          ? 'Message sent successfully via SMS'
          : conversation.platform === 'facebook'
          ? 'Message sent successfully via Facebook Messenger'
          : conversation.platform === 'instagram'
          ? 'Message sent successfully via Instagram DM'
          : 'Message sent successfully',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get messages for a conversation
  app.get('/api/conversations/:id/messages', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await getConversationById(req.tenantDb!, conversationId);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: conversation.messages || [],
      });
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve messages',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get AI reply suggestions for a conversation
  app.get('/api/conversations/:id/suggestions', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await getConversationById(req.tenantDb!, conversationId);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      // Generate AI suggestions
      const { generateReplySuggestions } = await import('./aiSuggestionService');
      const suggestions = await generateReplySuggestions(
        conversationId,
        conversation.customerPhone || '',
        conversation.messages || [],
        conversation.platform as 'sms' | 'web'
      );

      res.json({
        success: true,
        suggestions,
      });
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate AI suggestions',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Return conversation to AI mode
  app.post('/api/conversations/:id/return-to-ai', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { agentName, notifyCustomer } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const { returnToAI } = await import('./handoffDetectionService');
      const { notifyReturnToAI } = await import('./smsNotificationService');
      const { sendSMS } = await import('./notifications');

      const conversation = await getConversationById(req.tenantDb!, conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      // Return to AI
      const customerNotification = await returnToAI(conversationId, agentName, notifyCustomer !== false);

      // Send notification to customer if requested and on SMS
      if (notifyCustomer !== false && conversation.platform === 'sms' && customerNotification && conversation.customerPhone) {
        // Use the conversation's phoneLineId if available, otherwise default to Main Line
        await sendSMS(conversation.customerPhone, customerNotification, conversationId, undefined, conversation.phoneLineId || 1);
      }

      // Notify business owner
      await notifyReturnToAI(
        conversationId,
        conversation.customerName,
        conversation.customerPhone || 'Unknown',
        agentName
      );

      res.json({
        success: true,
        message: 'Conversation returned to AI',
      });
    } catch (error) {
      console.error('Error returning to AI:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to return conversation to AI',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Mark conversation as read (reset unread count)
  app.post('/api/conversations/:id/mark-read', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const updated = await req.tenantDb!
        .update(conversations)
        .set({ unreadCount: 0 })
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: updated[0],
        message: 'Conversation marked as read',
      });
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark conversation as read',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Mark specific messages as read (iMessage-quality read receipts)
  app.post('/api/conversations/:id/messages/read', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { messageIds, readerRole } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'messageIds array is required and must not be empty',
        });
      }

      if (!readerRole || !['agent', 'customer'].includes(readerRole)) {
        return res.status(400).json({
          success: false,
          message: 'readerRole must be either "agent" or "customer"',
        });
      }

      // Get messages to determine which ones weren't authored by the reader
      const messagesToCheck = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            inArray(messages.id, messageIds)
          )
        );

      if (messagesToCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No messages found',
        });
      }

      // Filter out messages authored by the reader (agents don't mark their own messages as read)
      const messagesToMarkAsRead = messagesToCheck.filter(msg => {
        if (readerRole === 'agent') {
          // Agents mark customer messages as read
          return msg.sender === 'customer';
        } else {
          // Customers mark agent/AI messages as read
          return msg.sender === 'agent' || msg.sender === 'ai';
        }
      });

      if (messagesToMarkAsRead.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'No eligible messages to mark as read',
        });
      }

      const readAt = new Date();
      const idsToUpdate = messagesToMarkAsRead.map(m => m.id);

      // Update messages to mark as read
      const updatedMessages = await db
        .update(messages)
        .set({ 
          deliveryStatus: 'read',
          readAt 
        })
        .where(inArray(messages.id, idsToUpdate))
        .returning();

      // Emit WebSocket event for real-time updates
      const { emitToRoom } = await import('./websocketService');
      emitToRoom(`conversation-${conversationId}`, 'messages_read', {
        conversationId,
        messageIds: idsToUpdate,
        reader: {
          role: readerRole
        },
        readAt: readAt.toISOString()
      });

      res.json({
        success: true,
        data: updatedMessages,
        message: `${updatedMessages.length} message(s) marked as read`,
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark messages as read',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Atomic "read up to" receipts (Audit T2): mark every message in a conversation
  // up to and including :messageId as read by the agent. Idempotent and safe to
  // call repeatedly with the same or higher message id.
  app.patch('/api/messages/read-up-to/:messageId', requireAuth, async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.messageId);
      if (isNaN(messageId)) {
        return res.status(400).json({ success: false, message: 'Invalid messageId' });
      }

      // Tenant-scoped lookup: prevents cross-tenant disclosure / mutation
      const target = await req.tenantDb!
        .select()
        .from(messages)
        .where(req.tenantDb!.withTenantFilter(messages, eq(messages.id, messageId)))
        .limit(1);
      if (target.length === 0) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }
      const conversationId = target[0].conversationId;
      const readAt = new Date();

      // Mark every customer-authored message in this conversation with id <= messageId
      // as read, but only if it isn't already marked read. Tenant-scoped.
      const updated = await req.tenantDb!
        .update(messages)
        .set({ deliveryStatus: 'read', readAt })
        .where(
          req.tenantDb!.withTenantFilter(
            messages,
            and(
              eq(messages.conversationId, conversationId),
              eq(messages.sender, 'customer'),
              lte(messages.id, messageId),
              ne(messages.deliveryStatus, 'read'),
            ),
          ),
        )
        .returning({ id: messages.id });

      // Recompute remaining unread (customer messages with id > messageId that
      // aren't yet read) instead of zeroing — preserves accuracy if a new
      // customer message arrived between client read and this request.
      const remaining = await req.tenantDb!
        .select({ id: messages.id })
        .from(messages)
        .where(
          req.tenantDb!.withTenantFilter(
            messages,
            and(
              eq(messages.conversationId, conversationId),
              eq(messages.sender, 'customer'),
              gte(messages.id, messageId + 1),
              ne(messages.deliveryStatus, 'read'),
            ),
          ),
        );

      await req.tenantDb!
        .update(conversations)
        .set({ unreadCount: remaining.length })
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)));

      // Broadcast over WS so other open clients pick it up
      try {
        const { emitToRoom } = await import('./websocketService');
        emitToRoom(`conversation-${conversationId}`, 'messages_read', {
          conversationId,
          messageIds: updated.map(u => u.id),
          reader: { role: 'agent' },
          readAt: readAt.toISOString(),
        });
      } catch (wsErr) {
        console.warn('[READ-UP-TO] WS emit failed (non-fatal):', wsErr);
      }

      res.json({
        success: true,
        data: { conversationId, upToMessageId: messageId, markedCount: updated.length, readAt },
      });
    } catch (error) {
      console.error('Error in read-up-to:', error);
      res.status(500).json({ success: false, message: 'Failed to mark read-up-to' });
    }
  });

  // Get available template variables (static list with examples)
  app.get('/api/template-variables', async (req: Request, res: Response) => {
    const { AVAILABLE_VARIABLES } = await import('./templateVariableService');
    res.json({
      success: true,
      variables: AVAILABLE_VARIABLES,
    });
  });

  // Get template variables with REAL values for a specific conversation
  app.get('/api/conversations/:id/template-variables', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      // Get conversation
      const conversation = await getConversationById(req.tenantDb!, conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      // Get customer data
      let vehicleInfo = 'your vehicle';
      let nextSlot = 'Contact us to schedule';
      if (conversation.customerPhone) {
        const customerData = await req.tenantDb!
          .select()
          .from(customers)
          .where(req.tenantDb!.withTenantFilter(customers, eq(customers.phone, conversation.customerPhone)))
          .limit(1);

        if (customerData.length > 0) {
          if (customerData[0].vehicleInfo) {
            vehicleInfo = customerData[0].vehicleInfo;
          }

          // Get next appointment
          const upcomingAppointment = await req.tenantDb!
            .select()
            .from(appointments)
            .where(
              req.tenantDb!.withTenantFilter(appointments,
                and(
                  eq(appointments.customerId, customerData[0].id),
                  gte(appointments.scheduledTime, new Date())
                )
              )
            )
            .orderBy(appointments.scheduledTime)
            .limit(1);

          if (upcomingAppointment.length > 0) {
            // Use tenant timezone for proper local time display
            const { getTenantTimezone, formatForSms } = await import('./timezoneUtils');
            const timezone = await getTenantTimezone(req.tenantDb!);
            nextSlot = formatForSms(upcomingAppointment[0].scheduledTime, timezone);
          }
        }
      }

      // Get operator name from current user
      let operatorName = 'Jody';
      if ((req as any).session?.userId) {
        const { users } = await import('@shared/schema');
        const userData = await req.tenantDb!
          .select()
          .from(users)
          .where(req.tenantDb!.withTenantFilter(users, eq(users.id, (req as any).session.userId)))
          .limit(1);
        
        if (userData.length > 0 && userData[0].operatorName) {
          operatorName = userData[0].operatorName;
        }
      }

      // Get more appointment details if available
      let serviceName = '';
      let appointmentDate = '';
      let appointmentTime = '';
      let daysUntilAppointment = '';
      let estimatedDuration = '';
      
      if (conversation.customerPhone) {
        const customerData = await req.tenantDb!
          .select()
          .from(customers)
          .where(req.tenantDb!.withTenantFilter(customers, eq(customers.phone, conversation.customerPhone)))
          .limit(1);

        if (customerData.length > 0) {
          const nextAppointment = await req.tenantDb!
            .select()
            .from(appointments)
            .where(
              req.tenantDb!.withTenantFilter(appointments,
                and(
                  eq(appointments.customerId, customerData[0].id),
                  gte(appointments.scheduledTime, new Date())
                )
              )
            )
            .orderBy(appointments.scheduledTime)
            .limit(1);

          if (nextAppointment.length > 0) {
            serviceName = nextAppointment[0].serviceType || 'Auto Detail';
            const apptDate = new Date(nextAppointment[0].scheduledTime);
            appointmentDate = apptDate.toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            });
            appointmentTime = apptDate.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            
            const now = new Date();
            const diffTime = apptDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysUntilAppointment = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `${diffDays} days`;
            
            estimatedDuration = nextAppointment[0].estimatedDuration ? `${nextAppointment[0].estimatedDuration} min` : '2-3 hours';
          }
        }
      }

      // Build variables with actual values
      const variables = [
        {
          variable: '{{customer_name}}',
          description: "Customer's name",
          value: conversation.customerName || 'there',
        },
        {
          variable: '{{phone}}',
          description: "Customer's phone number",
          value: conversation.customerPhone || '',
        },
        {
          variable: '{{vehicle}}',
          description: "Customer's vehicle",
          value: vehicleInfo,
        },
        {
          variable: '{{business_name}}',
          description: 'Your business name',
          value: 'Clean Machine Auto Detail',
        },
        {
          variable: '{{business_phone}}',
          description: 'Main business phone',
          value: '918-856-5304',
        },
        {
          variable: '{{operator_name}}',
          description: 'Name of person sending message',
          value: operatorName,
        },
        {
          variable: '{{service_name}}',
          description: 'Upcoming service type',
          value: serviceName || 'Auto detail service',
        },
        {
          variable: '{{appointment_date}}',
          description: 'Date of next appointment',
          value: appointmentDate || 'Contact us to schedule',
        },
        {
          variable: '{{appointment_time}}',
          description: 'Time of next appointment',
          value: appointmentTime || 'TBD',
        },
        {
          variable: '{{days_until_appointment}}',
          description: 'Days until next appointment',
          value: daysUntilAppointment || 'No appointment scheduled',
        },
        {
          variable: '{{estimated_duration}}',
          description: 'Estimated service duration',
          value: estimatedDuration || '2-3 hours',
        },
        {
          variable: '{{next_available_slot}}',
          description: 'Full next appointment details',
          value: nextSlot,
        },
      ];

      res.json({
        success: true,
        variables,
      });
    } catch (error) {
      console.error('Error fetching template variables:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch template variables',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get booking draft from conversation state (AI Behavior V2)
  app.get('/api/conversations/:id/booking-draft', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const tenantId = (req.tenant as any)?.id || 'root';
      const { buildBookingDraftFromConversation } = await import('./services/bookingDraftService');
      
      const draft = await buildBookingDraftFromConversation(tenantId, conversationId);
      
      if (!draft) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or no draft available',
        });
      }

      // Return draft directly for frontend query (not wrapped)
      res.json(draft);
    } catch (error) {
      console.error('Error building booking draft:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to build booking draft',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get all vehicles for a customer (Vehicle Auto-Create feature)
  app.get('/api/customers/:customerId/vehicles', async (req: Request, res: Response) => {
    try {
      const customerId = parseInt(req.params.customerId);

      if (isNaN(customerId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customer ID',
        });
      }

      const tenantId = (req.tenant as any)?.id || 'root';
      const { getCustomerVehicles } = await import('./services/vehicleCardService');
      
      const vehicles = await getCustomerVehicles(tenantId, customerId);
      
      res.json(vehicles);
    } catch (error) {
      console.error('Error fetching customer vehicles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch vehicles',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Assign conversation to agent
  app.post('/api/conversations/:id/assign', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { agentName } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const updated = await req.tenantDb!
        .update(conversations)
        .set({ assignedAgent: agentName || null })
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .returning();

      res.json({
        success: true,
        data: updated[0],
        message: agentName ? `Assigned to ${agentName}` : 'Assignment removed',
      });
    } catch (error) {
      console.error('Error assigning conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Snooze conversation until a specific time
  app.post('/api/conversations/:id/snooze', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { snoozedUntil } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const updated = await req.tenantDb!
        .update(conversations)
        .set({ snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null })
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .returning();

      res.json({
        success: true,
        data: updated[0],
        message: snoozedUntil ? 'Conversation snoozed' : 'Snooze removed',
      });
    } catch (error) {
      console.error('Error snoozing conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to snooze conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Mark conversation as resolved
  app.post('/api/conversations/:id/resolve', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const updated = await req.tenantDb!
        .update(conversations)
        .set({ 
          status: 'closed',
          resolved: true,
        })
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .returning();

      res.json({
        success: true,
        data: updated[0],
        message: 'Conversation marked as resolved',
      });
    } catch (error) {
      console.error('Error resolving conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get call events for a conversation
  app.get('/api/conversations/:id/call-events', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const { getCallEventsForConversation } = await import('./callLoggingService');
      const callEvents = await getCallEventsForConversation(conversationId);

      res.json({
        success: true,
        data: callEvents,
      });
    } catch (error) {
      console.error('Error fetching call events:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch call events',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  
  // Message Reactions API
  // Add a reaction to a message
  app.post('/api/messages/:messageId/reactions', requireAuth, async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const user = (req as any).user as { id: number } | undefined;
      const userId = user?.id;
      
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      if (!emoji) {
        return res.status(400).json({ success: false, message: 'Emoji is required' });
      }
      
      // Insert reaction (ignore if duplicate due to unique constraint)
      const [reaction] = await req.tenantDb!.insert(messageReactions).values({
        messageId: parseInt(messageId),
        userId,
        emoji,
      }).returning().catch((err) => {
        if (err.code === '23505') { // Duplicate key error
          return [null];
        }
        throw err;
      });
      
      res.json({ success: true, reaction });
    } catch (error) {
      console.error('Error adding reaction:', error);
      res.status(500).json({ success: false, message: 'Failed to add reaction' });
    }
  });
  
  // Remove a reaction
  app.delete('/api/messages/reactions/:reactionId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { reactionId } = req.params;
      const user = (req as any).user as { id: number } | undefined;
      const userId = user?.id;
      
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      // Delete reaction (only if it belongs to the user)
      await req.tenantDb!.delete(messageReactions).where(
        req.tenantDb!.withTenantFilter(messageReactions,
          and(
            eq(messageReactions.id, parseInt(reactionId)),
            eq(messageReactions.userId, userId)
          )
        )
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing reaction:', error);
      res.status(500).json({ success: false, message: 'Failed to remove reaction' });
    }
  });
  
  // Get reactions for a conversation's messages
  app.get('/api/conversations/:conversationId/reactions', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      
      // Get all message IDs for this conversation
      const conversationMessages = await req.tenantDb!.query.messages.findMany({
        where: req.tenantDb!.withTenantFilter(messages, eq(messages.conversationId, parseInt(conversationId))),
        columns: { id: true },
      });
      
      const messageIds = conversationMessages.map(m => m.id);
      
      if (messageIds.length === 0) {
        return res.json({ success: true, reactions: [] });
      }
      
      // Get all reactions for these messages
      const reactions = await req.tenantDb!.query.messageReactions.findMany({
        where: req.tenantDb!.withTenantFilter(messageReactions, inArray(messageReactions.messageId, messageIds)),
      });
      
      res.json({ success: true, reactions });
    } catch (error) {
      console.error('Error getting reactions:', error);
      res.status(500).json({ success: false, message: 'Failed to get reactions' });
    }
  });
  
  // Search messages within a conversation
  app.get('/api/conversations/:conversationId/search', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const { q } = req.query;
      
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.json({ success: true, results: [] });
      }
      
      const searchTerm = q.trim().toLowerCase();
      
      // Get all messages for this conversation
      const conversationMessages = await req.tenantDb!.query.messages.findMany({
        where: req.tenantDb!.withTenantFilter(messages, eq(messages.conversationId, parseInt(conversationId))),
        orderBy: (messages, { desc }) => [desc(messages.timestamp)],
      });
      
      // Filter messages that contain the search term
      const results = conversationMessages.filter(msg => 
        msg.content.toLowerCase().includes(searchTerm)
      );
      
      res.json({ 
        success: true, 
        results,
        count: results.length 
      });
    } catch (error) {
      console.error('Error searching messages:', error);
      res.status(500).json({ success: false, message: 'Failed to search messages' });
    }
  });
  
  // ==================== PHASE 12: PROFESSIONAL CONVERSATION MANAGEMENT ====================
  
  /**
   * Smart Schedule from Thread
   * 
   * Uses LLM to analyze the entire conversation and extract booking/job details.
   * Returns structured data that can be used to pre-fill a booking form or create an appointment directly.
   * 
   * Works across all channels: SMS, web chat, email, Facebook, Instagram.
   */
  app.post('/api/conversations/:id/smart-schedule', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      
      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }
      
      // SECURITY: Verify conversation exists and belongs to this tenant
      const [conv] = await req.tenantDb!
        .select({ id: conversations.id })
        .from(conversations)
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .limit(1);
      
      if (!conv) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or access denied',
        });
      }
      
      // Get conversation and all messages (already tenant-filtered via getConversationById)
      const conversation = await getConversationById(req.tenantDb!, conversationId);
      
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }
      
      const tenantId = (req.tenant as any)?.id || 'root';
      
      // Use Smart Conversation Parser to extract booking info
      const { parseConversationForBooking } = await import('./smartConversationParser');
      
      const parsedInfo = await parseConversationForBooking(
        req.tenantDb!,
        tenantId,
        conversation.messages || [],
        conversation.customerPhone || undefined
      );
      
      res.json({
        success: true,
        data: parsedInfo,
        message: parsedInfo.readyToBook 
          ? 'Booking information extracted successfully - ready to schedule!'
          : 'Partial information extracted - additional details needed',
      });
      
    } catch (error) {
      console.error('[SMART SCHEDULE] Error parsing conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to parse conversation for scheduling',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  
  /**
   * Smart Handback to AI
   * 
   * Intelligently hand conversation back to AI with context preservation.
   * Analyzes readiness, generates context summary, optionally notifies customer.
   */
  app.post('/api/conversations/:id/smart-handback', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { force, notifyCustomer, customMessage } = req.body;
      const agentName = (req.user as any)?.username || undefined;
      
      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }
      
      // SECURITY: Verify conversation exists and belongs to this tenant
      const [conv] = await req.tenantDb!
        .select({ id: conversations.id })
        .from(conversations)
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .limit(1);
      
      if (!conv) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or access denied',
        });
      }
      
      const { smartHandbackToAI } = await import('./enhancedHandoffService');
      
      const result = await smartHandbackToAI(
        req.tenantDb!,
        conversationId,
        {
          force: force || false,
          notifyCustomer: notifyCustomer !== false, // Default to true
          customMessage,
          agentName,
        }
      );
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json({
        success: true,
        data: {
          analysis: result.analysis,
          contextSummary: result.contextSummary,
        },
        message: result.message,
      });
      
    } catch (error) {
      console.error('[SMART HANDBACK] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to hand back conversation to AI',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  
  /**
   * Analyze Handback Readiness
   * 
   * Get AI analysis of whether conversation is ready to be handed back to AI.
   * Does NOT perform the handback - just provides analysis and recommendation.
   */
  app.get('/api/conversations/:id/handback-analysis', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const agentName = (req.user as any)?.username || undefined;
      
      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }
      
      // SECURITY: Verify conversation exists and belongs to this tenant
      const [conv] = await req.tenantDb!
        .select({ id: conversations.id })
        .from(conversations)
        .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
        .limit(1);
      
      if (!conv) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or access denied',
        });
      }
      
      const { analyzeHandbackReadiness } = await import('./enhancedHandoffService');
      
      const analysis = await analyzeHandbackReadiness(
        req.tenantDb!,
        conversationId,
        agentName
      );
      
      res.json({
        success: true,
        data: analysis,
        message: analysis.shouldHandback 
          ? 'Conversation is ready to hand back to AI'
          : 'Not recommended to hand back yet',
      });
      
    } catch (error) {
      console.error('[HANDBACK ANALYSIS] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze handback readiness',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
