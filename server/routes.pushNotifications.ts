import { Router, Request, Response } from 'express';
import { db } from './db';
import { pushSubscriptions, insertPushSubscriptionSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getVapidPublicKey, sendPushNotification } from './pushNotificationService';
import { requireAuth } from './authMiddleware';

const router = Router();

router.get('/vapid-public-key', (req: Request, res: Response) => {
  const publicKey = getVapidPublicKey();
  
  if (!publicKey) {
    return res.status(503).json({
      success: false,
      message: 'Push notifications are not configured on this server',
    });
  }

  res.json({
    success: true,
    publicKey,
  });
});

router.post('/subscribe', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const validatedData = insertPushSubscriptionSchema.parse({
      ...req.body,
      userId,
    });

    const existingSubscription = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, validatedData.endpoint))
      .limit(1);

    if (existingSubscription.length > 0) {
      await db
        .update(pushSubscriptions)
        .set({
          p256dh: validatedData.p256dh,
          auth: validatedData.auth,
          userAgent: validatedData.userAgent,
          lastUsedAt: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, validatedData.endpoint));

      console.log(`[PUSH API] Updated existing subscription for user ${userId}`);
    } else {
      await db.insert(pushSubscriptions).values(validatedData);
      console.log(`[PUSH API] Created new subscription for user ${userId}`);
    }

    res.json({
      success: true,
      message: 'Push notification subscription saved',
    });
  } catch (error: any) {
    console.error('[PUSH API] Error saving subscription:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to save subscription',
      error: error.message,
    });
  }
});

router.delete('/unsubscribe', requireAuth, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint is required',
      });
    }

    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));

    console.log(`[PUSH API] Removed subscription with endpoint: ${endpoint.substring(0, 50)}...`);

    res.json({
      success: true,
      message: 'Push notification subscription removed',
    });
  } catch (error: any) {
    console.error('[PUSH API] Error removing subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove subscription',
      error: error.message,
    });
  }
});

router.get('/subscriptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    res.json({
      success: true,
      subscriptions: subs.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
      })),
    });
  } catch (error: any) {
    console.error('[PUSH API] Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message,
    });
  }
});

router.post('/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const result = await sendPushNotification(userId, {
      title: '🚗 Clean Machine Auto Detail',
      body: 'Test notification successful! You\'ll receive alerts for new messages, appointments, and updates.',
      tag: 'test',
      data: { url: '/dashboard' },
    });

    res.json({
      ...result,
      message: `Sent to ${result.success} devices, ${result.failed} failed`,
    });
  } catch (error: any) {
    console.error('[PUSH API] Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message,
    });
  }
});

export default router;
