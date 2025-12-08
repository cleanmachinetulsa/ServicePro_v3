import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { 
  getTenantUsageSummary, 
  getAllTenantsUsageSummaryForPeriod,
  calculateTenantUsageForPeriod,
} from './services/usageRollupService';

const router = Router();

const dateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

function getDefaultDateRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from, to };
}

function parseDateRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const defaults = getDefaultDateRange();
  
  const from = fromStr ? new Date(fromStr) : defaults.from;
  const to = toStr ? new Date(toStr) : defaults.to;
  
  if (isNaN(from.getTime())) return { from: defaults.from, to };
  if (isNaN(to.getTime())) return { from, to: defaults.to };
  
  return { from, to };
}

router.get('/api/admin/usage/summary', async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    
    if (!session?.tenantId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const tenantId = session.tenantId;
    const { from, to } = parseDateRange(
      req.query.from as string,
      req.query.to as string
    );
    
    const summary = await getTenantUsageSummary(tenantId, from, to);
    
    return res.json({
      success: true,
      data: {
        ...summary,
        period: {
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
          label: `${from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        },
      },
    });
  } catch (error) {
    console.error('[USAGE SUMMARY] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch usage summary' });
  }
});

router.get('/api/root/usage/summary', async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    
    if (!session?.tenantId || session.tenantId !== 'root') {
      return res.status(403).json({ success: false, error: 'Root access required' });
    }
    
    const role = session.role;
    if (role !== 'root_admin' && role !== 'owner' && role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Admin role required' });
    }
    
    const { from, to } = parseDateRange(
      req.query.from as string,
      req.query.to as string
    );
    
    const tenantSummaries = await getAllTenantsUsageSummaryForPeriod(from, to);
    
    const totalCostCents = tenantSummaries.reduce((sum, t) => sum + (t.totalCostCents || 0), 0);
    const totalSmsCostCents = tenantSummaries.reduce((sum, t) => sum + (t.smsCostCents || 0), 0);
    const totalMmsCostCents = tenantSummaries.reduce((sum, t) => sum + (t.mmsCostCents || 0), 0);
    const totalVoiceCostCents = tenantSummaries.reduce((sum, t) => sum + (t.voiceCostCents || 0), 0);
    const totalEmailCostCents = tenantSummaries.reduce((sum, t) => sum + (t.emailCostCents || 0), 0);
    const totalAiCostCents = tenantSummaries.reduce((sum, t) => sum + (t.aiCostCents || 0), 0);
    
    return res.json({
      success: true,
      data: {
        tenants: tenantSummaries,
        totals: {
          totalCostCents,
          totalCostUsd: totalCostCents / 100,
          smsCostCents: totalSmsCostCents,
          mmsCostCents: totalMmsCostCents,
          voiceCostCents: totalVoiceCostCents,
          emailCostCents: totalEmailCostCents,
          aiCostCents: totalAiCostCents,
        },
        period: {
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
          label: `${from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        },
        tenantCount: tenantSummaries.length,
      },
    });
  } catch (error) {
    console.error('[ROOT USAGE SUMMARY] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch system usage summary' });
  }
});

router.get('/api/admin/usage/billing-data', async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    
    if (!session?.tenantId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const tenantId = session.tenantId;
    const { from, to } = parseDateRange(
      req.query.from as string,
      req.query.to as string
    );
    
    const billingData = await calculateTenantUsageForPeriod(tenantId, from, to);
    
    return res.json({
      success: true,
      data: {
        ...billingData,
        period: {
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
        },
      },
    });
  } catch (error) {
    console.error('[BILLING DATA] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch billing data' });
  }
});

export default router;
