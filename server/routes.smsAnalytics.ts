import { Express, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { 
  getCampaignRunAnalytics, 
  getTenantSmsSummary, 
  getCampaignsList 
} from './services/smsAnalyticsService';
import { parseISO, subDays, startOfDay, endOfDay } from 'date-fns';

export function registerSmsAnalyticsRoutes(app: Express) {
  
  app.get('/api/admin/analytics/sms/campaigns', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId || 'root';
      const campaigns = await getCampaignsList(tenantId);
      res.json({ success: true, campaigns });
    } catch (error: any) {
      console.error('[SMS ANALYTICS] Failed to get campaigns list:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/admin/analytics/sms/campaign-run/:campaignId', requireAuth, async (req: Request, res: Response) => {
    try {
      const campaignId = parseInt(req.params.campaignId, 10);
      if (isNaN(campaignId)) {
        return res.status(400).json({ success: false, error: 'Invalid campaign ID' });
      }

      const tenantId = req.tenantId || 'root';
      const analytics = await getCampaignRunAnalytics(campaignId, tenantId);

      if (!analytics) {
        return res.status(404).json({ success: false, error: 'Campaign not found' });
      }

      res.json({ success: true, ...analytics });
    } catch (error: any) {
      console.error('[SMS ANALYTICS] Failed to get campaign run analytics:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/admin/analytics/sms/summary', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId || 'root';
      
      let fromDate: Date;
      let toDate: Date;

      if (req.query.from) {
        fromDate = startOfDay(parseISO(req.query.from as string));
      } else {
        fromDate = startOfDay(subDays(new Date(), 30));
      }

      if (req.query.to) {
        toDate = endOfDay(parseISO(req.query.to as string));
      } else {
        toDate = endOfDay(new Date());
      }

      const summary = await getTenantSmsSummary(tenantId, fromDate, toDate);

      res.json({
        success: true,
        tenantId,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        ...summary,
      });
    } catch (error: any) {
      console.error('[SMS ANALYTICS] Failed to get tenant SMS summary:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
