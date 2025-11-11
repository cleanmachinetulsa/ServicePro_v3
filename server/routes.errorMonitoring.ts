import { Express, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { getRecentErrors, markErrorResolved } from './errorMonitoring';

export function registerErrorMonitoringRoutes(app: Express) {
  // Get recent errors for admin dashboard
  app.get('/api/errors/recent', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const errors = await getRecentErrors(limit);
      
      res.json({
        success: true,
        errors,
      });
    } catch (error: any) {
      console.error('Error fetching error logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch error logs',
      });
    }
  });

  // Mark error as resolved
  app.post('/api/errors/:id/resolve', requireAuth, async (req: Request, res: Response) => {
    try {
      const errorId = parseInt(req.params.id);
      await markErrorResolved(errorId);
      
      res.json({
        success: true,
        message: 'Error marked as resolved',
      });
    } catch (error: any) {
      console.error('Error marking error as resolved:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark error as resolved',
      });
    }
  });
}
