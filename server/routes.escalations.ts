import { Router } from 'express';
import { db } from './db';
import { humanEscalationRequests } from '@shared/schema';
import { desc } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { acknowledgeEscalation, resolveEscalation } from './escalationService';

export function registerEscalationRoutes(app: Router) {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    try {
      const escalations = await db.query.humanEscalationRequests.findMany({
        orderBy: [desc(humanEscalationRequests.requestedAt)],
        limit: 100,
      });

      res.json(escalations);
    } catch (error) {
      console.error('[ESCALATIONS API] Error fetching:', error);
      res.status(500).json({ error: 'Failed to fetch escalations' });
    }
  });

  router.post('/:id/acknowledge', async (req, res) => {
    try {
      const escalationId = parseInt(req.params.id);
      await acknowledgeEscalation(escalationId, (req as any).user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('[ESCALATIONS API] Error acknowledging:', error);
      res.status(500).json({ error: 'Failed to acknowledge escalation' });
    }
  });

  router.post('/:id/resolve', async (req, res) => {
    try {
      const escalationId = parseInt(req.params.id);
      await resolveEscalation(escalationId, (req as any).user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('[ESCALATIONS API] Error resolving:', error);
      res.status(500).json({ error: 'Failed to resolve escalation' });
    }
  });

  app.use('/api/escalations', router);
}
