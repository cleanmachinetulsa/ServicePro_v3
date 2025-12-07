import express, { Request, Response } from 'express';
import { getUsageMetricsForTenant, getUsageSummaryForTenant } from './services/usageCollectorService';
import { getDailyRollups, getAllTenantsUsageSummary, rollupDailyUsage } from './services/usageRollupService';
import { 
  getUsageFeatureBreakdown, 
  getUsageSummaryByChannel,
  getDailyUsageForExport,
  getAllTenantsUsageSummaryV2,
  rollupFeatureUsageDaily
} from './services/usageEventService';
import { usagePricing } from '@shared/pricing/usagePricing';
import { requireRole } from './rbacMiddleware';

const router = express.Router();

router.get('/api/admin/usage/summary', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
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
    
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
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
    
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
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

router.get('/api/root-admin/usage/tenants', requireRole(['owner', 'root_admin']), async (req: Request, res: Response) => {
  try {
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

router.post('/api/root-admin/usage/rollup', requireRole(['owner', 'root_admin']), async (req: Request, res: Response) => {
  try {
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

// ============================================================
// SP-7: ENHANCED USAGE METRICS V2 ENDPOINTS
// ============================================================

router.get('/api/admin/usage/v2/features', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const days = parseInt(req.query.days as string) || 30;
    const breakdown = await getUsageFeatureBreakdown(tenantId, days);
    
    res.json({
      success: true,
      breakdown,
      pricing: usagePricing,
    });
  } catch (error: any) {
    console.error('[BILLING USAGE V2] Error fetching feature breakdown:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/admin/usage/v2/channels', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const days = parseInt(req.query.days as string) || 30;
    const channelSummary = await getUsageSummaryByChannel(tenantId, days);
    
    res.json({
      success: true,
      channels: channelSummary,
      pricing: usagePricing,
    });
  } catch (error: any) {
    console.error('[BILLING USAGE V2] Error fetching channel summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/admin/usage/v2/export', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const days = parseInt(req.query.days as string) || 30;
    const format = req.query.format as string || 'json';
    
    const exportData = await getDailyUsageForExport(tenantId, days);
    
    if (format === 'csv') {
      const csvHeader = 'Date,Channel,Direction,Source,Feature,Count,Estimated Cost\n';
      const csvRows = exportData.map(row => 
        `${row.date},${row.channel},${row.direction},${row.source},${row.feature},${row.count},${row.estimatedCost.toFixed(4)}`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=usage-export-${tenantId}-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csvHeader + csvRows);
    }
    
    res.json({
      success: true,
      exportData,
      pricing: usagePricing,
    });
  } catch (error: any) {
    console.error('[BILLING USAGE V2] Error exporting usage data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/root-admin/usage/v2/tenants', requireRole(['owner', 'root_admin']), async (req: Request, res: Response) => {
  try {
    const tenantsSummary = await getAllTenantsUsageSummaryV2();
    
    res.json({
      success: true,
      tenants: tenantsSummary,
      pricing: usagePricing,
    });
  } catch (error: any) {
    console.error('[BILLING USAGE V2] Error fetching tenants usage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/root-admin/usage/v2/rollup', requireRole(['owner', 'root_admin']), async (req: Request, res: Response) => {
  try {
    const { date } = req.body;
    const targetDate = date ? new Date(date) : undefined;
    
    await rollupFeatureUsageDaily(targetDate);
    
    res.json({
      success: true,
      message: 'Feature usage rollup completed successfully',
    });
  } catch (error: any) {
    console.error('[BILLING USAGE V2] Error running feature rollup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export function registerBillingUsageRoutes(app: express.Application) {
  app.use(router);
  console.log('[BILLING USAGE] Routes registered: /api/admin/usage/*, /api/root-admin/usage/*, /api/*/usage/v2/*');
}

export default router;
