import { Router } from 'express';
import { callEvents, conversations } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';

export function registerCallEventsRoutes(app: Router) {
  const router = Router();

  // GET /api/call-events/recent - Last 20 incoming calls
  router.get('/recent', requireAuth, async (req, res) => {
    try {
      // Query recent inbound calls with conversation data
      const recentCalls = await req.tenantDb!
        .select({
          id: callEvents.id,
          from: callEvents.from,
          to: callEvents.to,
          direction: callEvents.direction,
          status: callEvents.status,
          duration: callEvents.duration,
          recordingUrl: callEvents.recordingUrl,
          transcriptionText: callEvents.transcriptionText,
          createdAt: callEvents.createdAt,
          customerName: conversations.customerName,
          customerPhone: conversations.customerPhone,
        })
        .from(callEvents)
        .leftJoin(conversations, eq(callEvents.conversationId, conversations.id))
        .where(req.tenantDb!.withTenantFilter(callEvents, eq(callEvents.direction, 'inbound')))
        .orderBy(desc(callEvents.createdAt))
        .limit(20);

      // Format for frontend
      const formatted = recentCalls.map(call => ({
        id: call.id,
        customerPhone: call.from,
        customerName: call.customerName || 'Unknown',
        direction: call.direction,
        status: call.status,
        duration: call.duration,
        recordingUrl: call.recordingUrl,
        transcription: call.transcriptionText,
        createdAt: call.createdAt,
      }));

      res.json(formatted);
    } catch (error) {
      console.error('Error fetching recent calls:', error);
      res.status(500).json({ error: 'Failed to fetch recent calls' });
    }
  });

  app.use('/api/call-events', router);
}
