/**
 * Staff Manual Action Routes — Audit T2 Task #19 (U-10)
 *
 * Same backend helpers the gpt-4o tools use, mounted as authenticated
 * admin endpoints so the Messaging Center profile drawer can invoke them
 * as one-click buttons. Each route:
 *   1. requires a logged-in session (tenantId on session)
 *   2. resolves the target conversation -> customerPhone
 *   3. calls the shared helper in `services/aiToolHelpers.ts`
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { conversations } from '@shared/schema';
import { requireAuth } from './authMiddleware';
import {
  sendInvoiceToCustomer,
  sendGiftCardBalance,
  sendRewardsLinkToCustomer,
  sendReferralLinkToCustomer,
  transferConversationToHuman,
  weatherCheckForAppointment,
} from './services/aiToolHelpers';

const router = Router();
const LOG = '[AI-ACTIONS]';

// Audit T2 Task #19 — apply standard auth middleware to every staff action
// route. These endpoints sit alongside other admin endpoints and must reject
// unauthenticated callers BEFORE any tenant/conversation lookup runs.
router.use(requireAuth);

async function resolveConversation(
  tenantId: string,
  conversationId: number,
): Promise<{ phone: string | null; convId: number | null }> {
  const tenantDb = wrapTenantDb(db, tenantId);
  const [conv] = await tenantDb
    .select({ id: conversations.id, customerPhone: conversations.customerPhone })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)))
    .limit(1);
  if (!conv) return { phone: null, convId: null };
  return { phone: conv.customerPhone, convId: conv.id };
}

function getTenantId(req: Request): string | null {
  return ((req.session as any)?.tenantId as string | undefined) || null;
}

const baseSchema = z.object({ conversationId: z.number().int().positive() });

router.post('/admin/ai-actions/send-invoice', async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const parsed = baseSchema.extend({
    channel: z.enum(['sms', 'email', 'both']).optional(),
    appointmentId: z.union([z.string(), z.number()]).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });

  const { phone } = await resolveConversation(tenantId, parsed.data.conversationId);
  if (!phone) return res.status(404).json({ success: false, error: 'Conversation has no phone on file' });

  const result = await sendInvoiceToCustomer(tenantId, {
    phone,
    channel: parsed.data.channel || 'sms',
    appointmentId: parsed.data.appointmentId,
  });
  console.log(`${LOG} send-invoice tenant=${tenantId} conv=${parsed.data.conversationId} -> ${JSON.stringify(result)}`);
  return res.json(result);
});

router.post('/admin/ai-actions/send-gift-card-balance', async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const parsed = baseSchema.extend({ giftCardCode: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });

  const { phone } = await resolveConversation(tenantId, parsed.data.conversationId);
  if (!phone) return res.status(404).json({ success: false, error: 'Conversation has no phone on file' });

  const result = await sendGiftCardBalance(tenantId, phone, parsed.data.giftCardCode);
  return res.json(result);
});

router.post('/admin/ai-actions/send-rewards-link', async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });

  const { phone } = await resolveConversation(tenantId, parsed.data.conversationId);
  if (!phone) return res.status(404).json({ success: false, error: 'Conversation has no phone on file' });

  const result = await sendRewardsLinkToCustomer(tenantId, phone);
  return res.json(result);
});

router.post('/admin/ai-actions/send-referral-link', async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });

  const { phone } = await resolveConversation(tenantId, parsed.data.conversationId);
  if (!phone) return res.status(404).json({ success: false, error: 'Conversation has no phone on file' });

  const result = await sendReferralLinkToCustomer(tenantId, phone);
  return res.json(result);
});

router.post('/admin/ai-actions/transfer-to-human', async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const parsed = baseSchema
    .extend({ reason: z.string().min(1).optional(), urgency: z.enum(['low', 'high']).optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });

  const { phone, convId } = await resolveConversation(tenantId, parsed.data.conversationId);
  if (!phone || !convId) return res.status(404).json({ success: false, error: 'Conversation not found' });

  const result = await transferConversationToHuman(
    tenantId,
    phone,
    parsed.data.reason || 'staff_initiated',
    parsed.data.urgency || 'low',
    convId,
  );
  return res.json(result);
});

router.post('/admin/ai-actions/weather-check', async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });

  const { phone } = await resolveConversation(tenantId, parsed.data.conversationId);
  if (!phone) return res.status(404).json({ success: false, error: 'Conversation has no phone on file' });

  const result = await weatherCheckForAppointment(tenantId, { phone });
  return res.json(result);
});

export function registerAiActionRoutes(app: any) {
  app.use('/api', router);
  console.log(`${LOG} Routes registered: /api/admin/ai-actions/*`);
}

export default router;
