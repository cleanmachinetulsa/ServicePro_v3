import { Router, Request, Response } from 'express';
import { pwaNotificationSettings, notificationEventLogs, insertPwaNotificationSettingsSchema } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { sendPushNotification } from './pushNotificationService';
import { clearSettingsCache } from './services/pwaNotificationDecisionService';

const router = Router();

router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    
    const settings = await req.tenantDb!
      .select()
      .from(pwaNotificationSettings)
      .where(eq(pwaNotificationSettings.tenantId, tenantId))
      .limit(1);

    if (settings.length === 0) {
      return res.json({
        success: true,
        settings: null,
        message: 'No settings configured yet',
      });
    }

    res.json({
      success: true,
      settings: settings[0],
    });
  } catch (error: any) {
    console.error('[PWA ADMIN] Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message,
    });
  }
});

router.put('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    const userId = (req as any).user?.id;
    
    const existingSettings = await req.tenantDb!
      .select()
      .from(pwaNotificationSettings)
      .where(eq(pwaNotificationSettings.tenantId, tenantId))
      .limit(1);

    const settingsData = {
      ...req.body,
      tenantId,
      updatedAt: new Date(),
    };

    const validatedData = insertPwaNotificationSettingsSchema.parse(settingsData);
    
    let result;
    if (existingSettings.length === 0) {
      result = await req.tenantDb!
        .insert(pwaNotificationSettings)
        .values(validatedData)
        .returning();
      console.log(`[PWA ADMIN] Created new settings for tenant ${tenantId}`);
    } else {
      const { tenantId: _, ...updateData } = validatedData;
      result = await req.tenantDb!
        .update(pwaNotificationSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(pwaNotificationSettings.tenantId, tenantId))
        .returning();
      console.log(`[PWA ADMIN] Updated settings for tenant ${tenantId}`);
    }

    clearSettingsCache(tenantId);

    res.json({
      success: true,
      settings: result[0],
      message: 'Settings saved successfully',
    });
  } catch (error: any) {
    console.error('[PWA ADMIN] Error saving settings:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to save settings',
      error: error.message,
    });
  }
});

router.post('/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const tenantId = req.tenantId || 'root';

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const result = await sendPushNotification(userId, {
      title: 'Test Notification',
      body: 'This is a test push notification from the PWA Notification Settings.',
      tag: 'pwa-admin-test',
      data: { url: '/admin/pwa-notifications' },
    });

    await req.tenantDb!.insert(notificationEventLogs).values({
      tenantId,
      type: 'test',
      target: String(userId),
      channel: 'push',
      status: result.success > 0 ? 'sent' : 'failed',
      error: result.failed > 0 ? `${result.failed} devices failed` : null,
      metadata: { testType: 'manual', result },
    });

    res.json({
      success: result.success > 0,
      message: `Sent to ${result.success} devices, ${result.failed} failed`,
      result,
    });
  } catch (error: any) {
    console.error('[PWA ADMIN] Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message,
    });
  }
});

router.get('/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string | undefined;

    let query = req.tenantDb!
      .select()
      .from(notificationEventLogs)
      .where(eq(notificationEventLogs.tenantId, tenantId))
      .orderBy(desc(notificationEventLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const logs = await query;

    const filteredLogs = type 
      ? logs.filter(log => log.type === type)
      : logs;

    res.json({
      success: true,
      logs: filteredLogs,
      pagination: {
        limit,
        offset,
        count: filteredLogs.length,
      },
    });
  } catch (error: any) {
    console.error('[PWA ADMIN] Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs',
      error: error.message,
    });
  }
});

router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    
    const logs = await req.tenantDb!
      .select()
      .from(notificationEventLogs)
      .where(eq(notificationEventLogs.tenantId, tenantId))
      .orderBy(desc(notificationEventLogs.createdAt))
      .limit(1000);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: logs.length,
      last24h: logs.filter(l => new Date(l.createdAt!) > last24h).length,
      last7d: logs.filter(l => new Date(l.createdAt!) > last7d).length,
      byChannel: {
        push: logs.filter(l => l.channel === 'push').length,
        sms: logs.filter(l => l.channel === 'sms').length,
        email: logs.filter(l => l.channel === 'email').length,
      },
      byStatus: {
        sent: logs.filter(l => l.status === 'sent').length,
        failed: logs.filter(l => l.status === 'failed').length,
        suppressed: logs.filter(l => l.status === 'suppressed').length,
        queued: logs.filter(l => l.status === 'queued').length,
      },
      byType: logs.reduce((acc, l) => {
        acc[l.type] = (acc[l.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('[PWA ADMIN] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message,
    });
  }
});

export default router;
