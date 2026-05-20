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
import { pushSubscriptions, users } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
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

    // Audit T3 Task #23 (review fix): restrict push delivery to owner-role
    // users only. We INNER JOIN push_subscriptions ↔ users on tenant + role
    // so a manager/employee who happens to have a subscription does not
    // receive owner-only escalation pings.
    const subs = await tenantDb
      .select({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .innerJoin(
        users,
        and(
          eq(users.id, pushSubscriptions.userId),
          eq(users.tenantId, tenantId),
          eq(users.role, 'owner'),
          eq(users.isActive, true),
        ),
      )
      .where(eq(pushSubscriptions.tenantId, tenantId));

    const userIds = Array.from(new Set(subs.map((s) => s.userId).filter((u): u is number => typeof u === 'number')));
    if (userIds.length === 0) {
      console.log(`[OWNER PUSH] No owner subscribers for tenant=${tenantId}`);
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
        // Review fix: service-worker click handler reads `data.url`. We send
        // both `url` (canonical) and `deepLink` (back-compat) so the push
        // reliably opens the correct thread instead of falling back to /messages.
        url: `/messages?conversationId=${conversationId}`,
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
