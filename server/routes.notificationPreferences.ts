import { Router } from 'express';
import { notificationPreferences } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { z } from 'zod';

const router = Router();

export function registerNotificationPreferencesRoutes(app: Router) {
  // GET current user's preferences
  router.get('/me', requireAuth, async (req, res) => {
    try {
      const prefs = await req.tenantDb!
        .select()
        .from(notificationPreferences)
        .where(req.tenantDb!.withTenantFilter(notificationPreferences, eq(notificationPreferences.userId, req.user!.id)))
        .limit(1)
        .then(results => results[0]);

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
    } catch (error) {
      console.error('[NOTIFICATION PREFS] Error fetching:', error);
      res.status(500).json({ error: 'Failed to fetch notification preferences' });
    }
  });

  // PUT update preferences
  router.put('/me', requireAuth, async (req, res) => {
    try {
      // Strict validation - only allow expected fields
      const schema = z.object({
        voicemailSms: z.boolean().optional(),
        voicemailPush: z.boolean().optional(),
        cashPaymentSms: z.boolean().optional(),
        cashPaymentPush: z.boolean().optional(),
        systemErrorSms: z.boolean().optional(),
        systemErrorPush: z.boolean().optional(),
        missedCallSms: z.boolean().optional(),
        appointmentReminderPush: z.boolean().optional()
      }).strict();

      const validated = schema.parse(req.body);

      const existing = await req.tenantDb!
        .select()
        .from(notificationPreferences)
        .where(req.tenantDb!.withTenantFilter(notificationPreferences, eq(notificationPreferences.userId, req.user!.id)))
        .limit(1)
        .then(results => results[0]);

      if (existing) {
        await req.tenantDb!.update(notificationPreferences)
          .set({ ...validated, updatedAt: new Date() })
          .where(req.tenantDb!.withTenantFilter(notificationPreferences, eq(notificationPreferences.userId, req.user!.id)));
      } else {
        await req.tenantDb!.insert(notificationPreferences).values({
          ...validated,
          userId: req.user!.id
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[NOTIFICATION PREFS] Error updating:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid preference data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update notification preferences' });
    }
  });

  app.use('/api/notification-preferences', router);
}
