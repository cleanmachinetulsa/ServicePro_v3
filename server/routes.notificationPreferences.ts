import { Router } from 'express';
import { db } from './db';
import { notificationPreferences, insertNotificationPreferencesSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

export function registerNotificationPreferencesRoutes(app: Router) {
  // GET current user's preferences
  router.get('/me', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const prefs = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, req.user.id)
    });

    // Return defaults if not set
    if (!prefs) {
      return res.json({
        voicemailSms: true,
        voicemailPush: true,
        cashPaymentSms: true,
        cashPaymentPush: true,
        systemErrorSms: true,
        systemErrorPush: true,
        missedCallSms: false,
        appointmentReminderPush: true
      });
    }

    res.json(prefs);
  });

  // PUT update preferences
  router.put('/me', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const validated = insertNotificationPreferencesSchema.parse(req.body);

      const existing = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, req.user.id)
      });

      if (existing) {
        await db.update(notificationPreferences)
          .set({ ...validated, updatedAt: new Date() })
          .where(eq(notificationPreferences.userId, req.user.id));
      } else {
        await db.insert(notificationPreferences).values({
          ...validated,
          userId: req.user.id
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[NOTIFICATION_PREFS] Error updating preferences:', error);
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.use('/api/notification-preferences', router);
}
