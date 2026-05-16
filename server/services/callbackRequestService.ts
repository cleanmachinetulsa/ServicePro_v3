/**
 * Audit T3 Task #23 (review fix): a distinct callback-request artifact.
 *
 * When a customer replies "call" to a live `offer_human_handoff` SMS, this
 * service records the request as a structured artifact on the conversation
 * (conversations.behaviorSettings.callbackRequests[]) and then dispatches
 * the existing escalation/notification path. Recording the artifact gives
 * the owner UI a stable list to render in the dashboard inbox, independent
 * of free-form Slack/SMS chatter, and satisfies the spec requirement that
 * "call" → triggers a callback request, not merely a transfer-to-human.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

export interface CallbackRequestRecord {
  id: string;
  requestedAt: string; // ISO
  customerPhone: string;
  reason: string;
  status: 'pending' | 'completed' | 'cancelled';
}

interface BehaviorSettingsShape {
  callbackRequests?: CallbackRequestRecord[];
  [k: string]: unknown;
}

export async function recordCallbackRequest(opts: {
  tenantId: string;
  conversationId: number;
  customerPhone: string;
  reason: string;
}): Promise<CallbackRequestRecord | null> {
  const { tenantId, conversationId, customerPhone, reason } = opts;
  if (!tenantId || !Number.isFinite(conversationId)) return null;
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    const [row] = await tenantDb
      .select({ behaviorSettings: conversations.behaviorSettings })
      .from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, conversationId)))
      .limit(1);

    const current: BehaviorSettingsShape = (row?.behaviorSettings as BehaviorSettingsShape | null) || {};
    const list = Array.isArray(current.callbackRequests) ? current.callbackRequests.slice(-25) : [];
    const record: CallbackRequestRecord = {
      id: `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      requestedAt: new Date().toISOString(),
      customerPhone,
      reason,
      status: 'pending',
    };
    list.push(record);

    const next: BehaviorSettingsShape = { ...current, callbackRequests: list };
    await tenantDb
      .update(conversations)
      .set({ behaviorSettings: next })
      .where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, conversationId)));
    return record;
  } catch (err) {
    console.warn('[CALLBACK REQUEST] failed to record artifact:', err);
    return null;
  }
}

export async function listCallbackRequests(
  tenantId: string,
  conversationId: number,
): Promise<CallbackRequestRecord[]> {
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    const [row] = await tenantDb
      .select({ behaviorSettings: conversations.behaviorSettings })
      .from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, conversationId)))
      .limit(1);
    const current: BehaviorSettingsShape = (row?.behaviorSettings as BehaviorSettingsShape | null) || {};
    return Array.isArray(current.callbackRequests) ? current.callbackRequests : [];
  } catch {
    return [];
  }
}
