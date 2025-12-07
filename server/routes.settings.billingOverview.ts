import { Router, Request, Response } from 'express';
import { getBillingOverview } from './services/usageOverviewService';

const router = Router();

router.get('/api/settings/billing/overview', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const tenantId = req.session.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const overview = await getBillingOverview(tenantId);
    
    res.json({
      success: true,
      overview,
    });
  } catch (error: any) {
    console.error('[BILLING OVERVIEW] Error fetching overview:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch billing overview' 
    });
  }
});

export function registerBillingOverviewRoutes(app: import('express').Application) {
  app.use(router);
  console.log('[BILLING OVERVIEW] Routes registered: GET /api/settings/billing/overview');
}

export default router;
