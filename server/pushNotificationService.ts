import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { wrapTenantDb } from './tenantDb';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@cleanmachinetulsa.com';

// Deduplication cache to prevent duplicate push notifications
// Key: tag, Value: timestamp when sent
const recentPushTags = new Map<string, number>();
const DEDUPE_TTL_MS = 30000; // 30 seconds - prevent duplicate pushes within this window

function cleanupExpiredTags() {
  const now = Date.now();
  for (const [tag, timestamp] of recentPushTags.entries()) {
    if (now - timestamp > DEDUPE_TTL_MS) {
      recentPushTags.delete(tag);
    }
  }
}

// Clean up expired tags every minute
setInterval(cleanupExpiredTags, 60000);

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn('[PUSH] VAPID keys not configured - push notifications disabled');
  console.warn('[PUSH] Run: tsx server/generateVapidKeys.ts to generate keys');
} else {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('[PUSH] Push notification service initialized with VAPID keys');
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export async function sendPushNotification(
  userId: number,
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  const tenantDb = wrapTenantDb(db, 'root');
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[PUSH] Cannot send notification - VAPID keys not configured');
    return { success: 0, failed: 0 };
  }

  try {
    const subscriptions = await tenantDb
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subscriptions.length === 0) {
      console.log(`[PUSH] No subscriptions found for user ${userId}`);
      return { success: 0, failed: 0 };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.requireInteraction || false,
      actions: payload.actions || [],
    });

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, notificationPayload);

        await tenantDb
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));

        successCount++;
        console.log(`[PUSH] Notification sent successfully to subscription ${sub.id}`);
      } catch (error: any) {
        failCount++;
        console.error(`[PUSH] Failed to send to subscription ${sub.id}:`, error.message);

        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[PUSH] Subscription ${sub.id} is invalid, removing from database`);
          await tenantDb.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }

    console.log(`[PUSH] Sent to user ${userId}: ${successCount} success, ${failCount} failed`);
    return { success: successCount, failed: failCount };
  } catch (error) {
    console.error('[PUSH] Error sending push notifications:', error);
    return { success: 0, failed: 0 };
  }
}

export async function sendPushToAllUsers(payload: PushNotificationPayload): Promise<void> {
  const tenantDb = wrapTenantDb(db, 'root');
  
  // Deduplication check: if we've recently sent a push with this tag, skip
  if (payload.tag) {
    const lastSent = recentPushTags.get(payload.tag);
    if (lastSent && Date.now() - lastSent < DEDUPE_TTL_MS) {
      console.log(`[PUSH] Skipping duplicate push for tag '${payload.tag}' (sent ${Date.now() - lastSent}ms ago)`);
      return;
    }
    // Mark this tag as sent
    recentPushTags.set(payload.tag, Date.now());
  }
  
  try {
    const allSubscriptions = await tenantDb.select().from(pushSubscriptions);

    const uniqueUserIds = Array.from(new Set(allSubscriptions.map((sub) => sub.userId).filter(Boolean)));

    console.log(`[PUSH] Broadcasting to ${uniqueUserIds.length} users`);

    for (const userId of uniqueUserIds) {
      if (userId) {
        await sendPushNotification(userId, payload);
      }
    }
  } catch (error) {
    console.error('[PUSH] Error broadcasting push notifications:', error);
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
