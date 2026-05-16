/**
 * Audit T3 Task #23: offer_human_handoff state machine.
 *
 * When the AI invokes `offer_human_handoff`, we arm a flag on the
 * conversation (in JSONB `behavior_settings.handoffOffered`). The next
 * inbound customer message is intercepted BEFORE the LLM in
 * `twilioTestSms.ts`:
 *   - "call" / "yes call" → requestCallback → owner SMS + Slack + escalation
 *   - "text" / "stay text" → clear pause and continue automation
 *
 * The flag expires after `HANDOFF_OFFER_TTL_MIN` minutes so a 3-day-old
 * offer doesn't hijack a fresh "call you tomorrow" message.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations } from '@shared/schema';
import { eq } from 'drizzle-orm';

const HANDOFF_OFFER_TTL_MIN = 30;

export interface HandoffOfferState {
  handoffOffered: true;
  offeredAt: string; // ISO
  reason?: string;
  urgency?: 'low' | 'high';
}

interface BehaviorSettings {
  handoffOffered?: boolean;
  handoffOfferedAt?: string;
  handoffReason?: string;
  handoffUrgency?: 'low' | 'high';
  [k: string]: unknown;
}

export async function armHandoffOffer(
  tenantId: string,
  conversationId: number,
  opts: { reason?: string; urgency?: 'low' | 'high' } = {}
): Promise<void> {
  const tenantDb = wrapTenantDb(db, tenantId);
  const [conv] = await tenantDb
    .select({ behaviorSettings: conversations.behaviorSettings })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  const current = (conv?.behaviorSettings as BehaviorSettings | null) ?? {};
  const next: BehaviorSettings = {
    ...current,
    handoffOffered: true,
    handoffOfferedAt: new Date().toISOString(),
    handoffReason: opts.reason,
    handoffUrgency: opts.urgency ?? 'low',
  };
  await tenantDb
    .update(conversations)
    .set({ behaviorSettings: next })
    .where(eq(conversations.id, conversationId));
}

export async function clearHandoffOffer(tenantId: string, conversationId: number): Promise<void> {
  const tenantDb = wrapTenantDb(db, tenantId);
  const [conv] = await tenantDb
    .select({ behaviorSettings: conversations.behaviorSettings })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  const current = (conv?.behaviorSettings as BehaviorSettings | null) ?? {};
  const next: BehaviorSettings = { ...current };
  delete next.handoffOffered;
  delete next.handoffOfferedAt;
  delete next.handoffReason;
  delete next.handoffUrgency;
  await tenantDb
    .update(conversations)
    .set({ behaviorSettings: next })
    .where(eq(conversations.id, conversationId));
}

export async function hasLiveHandoffOffer(tenantId: string, conversationId: number): Promise<boolean> {
  const tenantDb = wrapTenantDb(db, tenantId);
  const [conv] = await tenantDb
    .select({ behaviorSettings: conversations.behaviorSettings })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  const settings = (conv?.behaviorSettings as BehaviorSettings | null) ?? {};
  if (!settings.handoffOffered || !settings.handoffOfferedAt) return false;
  const ageMs = Date.now() - new Date(settings.handoffOfferedAt).getTime();
  return ageMs < HANDOFF_OFFER_TTL_MIN * 60 * 1000;
}

export type HandoffReplyAction = 'call' | 'text' | null;

const CALL_RE = /^\s*(yes,?\s*)?(call|phone|ring)( me)?\b/i;
const TEXT_RE = /^\s*(text|stay( on)? text|sms|keep texting|keep it text(ing)?)\b/i;

export function classifyHandoffReply(body: string): HandoffReplyAction {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.length > 60) return null; // Long messages aren't simple call/text replies
  if (CALL_RE.test(trimmed)) return 'call';
  if (TEXT_RE.test(trimmed)) return 'text';
  return null;
}
