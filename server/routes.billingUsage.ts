import express, { Request, Response } from 'express';
import { getUsageMetricsForTenant, getUsageSummaryForTenant } from './services/usageCollectorService';
import { getDailyRollups, getAllTenantsUsageSummary, rollupDailyUsage } from './services/usageRollupService';
import { usagePricing } from '@shared/pricing/usagePricing';

const router = express.Router();

router.get('/api/admin/usage/summary', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const tenantId = req.tenant?.id || 'root';
    const summary = await getUsageSummaryForTenant(tenantId);
    
    res.json({
      success: true,
      summary,
      pricing: usagePricing,
    });
  } catch (error: any) {
    console.error('[BILLING USAGE] Error fetching summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/admin/usage/daily', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const tenantId = req.tenant?.id || 'root';
    const days = parseInt(req.query.days as string) || 30;
    
    const rollups = await getDailyRollups(tenantId, days);
    
    res.json({
      success: true,
      rollups,
      pricing: usagePricing,
    });
  } catch (error: any) {
    console.error('[BILLING USAGE] Error fetching daily rollups:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/admin/usage/metrics', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const tenantId = req.tenant?.id || 'root';
    const days = parseInt(req.query.days as string) || 30;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const metrics = await getUsageMetricsForTenant(tenantId, startDate, endDate);
    
    res.json({
      success: true,
      metrics,
    });
  } catch (error: any) {
    console.error('[BILLING USAGE] Error fetching metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/root-admin/usage/tenants', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    if (req.session?.role !== 'root_admin' && req.session?.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Root admin access required' });
    }
    
    const tenantsSummary = await getAllTenantsUsageSummary();
    
    res.json({
      success: true,
      tenants: tenantsSummary,
      pricing: usagePricing,
    });
  } catch (error: any) {
    console.error('[BILLING USAGE] Error fetching tenants usage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/root-admin/usage/rollup', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    if (req.session?.role !== 'root_admin' && req.session?.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Root admin access required' });
    }
    
    const { date } = req.body;
    const targetDate = date ? new Date(date) : undefined;
    
    await rollupDailyUsage(targetDate);
    
    res.json({
      success: true,
      message: 'Usage rollup completed successfully',
    });
  } catch (error: any) {
    console.error('[BILLING USAGE] Error running rollup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export function registerBillingUsageRoutes(app: express.Application) {
  app.use(router);
  console.log('[BILLING USAGE] Routes registered: /api/admin/usage/*, /api/root-admin/usage/*');
}

export default router;
