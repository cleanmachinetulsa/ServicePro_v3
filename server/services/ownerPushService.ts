/**
 * Audit T3 Task #23: Owner Web Push on escalation / transfer_to_human.
 *
 * Sends a push notification to every user with an active push subscription
 * scoped to the given tenant. The notification carries a `deepLink` payload
 * the service worker uses to focus / open the staff inbox at
 * `/messages?conversationId=…`.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { pushSubscriptions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sendPushNotification, type PushNotificationPayload } from '../pushNotificationService';

export interface OwnerEscalationPushOptions {
  tenantId: string;
  conversationId: number;
  reason: string;
  customerLabel?: string;
  urgency?: 'low' | 'high';
}

export async function notifyOwnerEscalation(opts: OwnerEscalationPushOptions): Promise<{
  attempted: number;
  succeeded: number;
}> {
  const { tenantId, conversationId, reason, customerLabel, urgency } = opts;
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    const subs = await tenantDb
      .select({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.tenantId, tenantId));

    const userIds = Array.from(new Set(subs.map((s) => s.userId).filter((u): u is number => typeof u === 'number')));
    if (userIds.length === 0) {
      console.log(`[OWNER PUSH] No subscribers for tenant=${tenantId}`);
      return { attempted: 0, succeeded: 0 };
    }

    const payload: PushNotificationPayload = {
      title: urgency === 'high' ? '🚨 Customer needs you' : '👋 Customer needs you',
      body: customerLabel
        ? `${customerLabel} — ${reason}`
        : `New escalation: ${reason}`,
      tag: `escalation-${conversationId}`,
      requireInteraction: urgency === 'high',
      data: {
        deepLink: `/messages?conversationId=${conversationId}`,
        conversationId,
        reason,
        tenantId,
      },
      actions: [
        { action: 'open', title: 'Open thread' },
      ],
    };

    let succeeded = 0;
    for (const userId of userIds) {
      try {
        const result = await sendPushNotification(userId, payload);
        succeeded += result.success;
      } catch (err) {
        console.warn(`[OWNER PUSH] send failed user=${userId}:`, err);
      }
    }
    console.log(
      `[OWNER PUSH] tenant=${tenantId} conv=${conversationId} attempted=${userIds.length} succeeded=${succeeded} reason=${reason}`
    );
    return { attempted: userIds.length, succeeded };
  } catch (err) {
    console.error('[OWNER PUSH] notifyOwnerEscalation failed:', err);
    return { attempted: 0, succeeded: 0 };
  }
}
