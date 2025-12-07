/**
 * SP-18: Usage Metering v2 API Routes
 * 
 * Tenant-facing:
 *   GET /api/billing/usage/v2/summary - Current month usage with caps and status
 *   GET /api/billing/usage/v2/daily - Daily breakdown for charts
 *   GET /api/billing/usage/v2/status - Quick status check
 * 
 * Admin-facing:
 *   GET /api/admin/usage/v2/system-summary - All tenants usage overview
 *   POST /api/admin/usage/v2/rebuild - Trigger usage aggregation rebuild
 *   PUT /api/admin/usage/v2/:tenantId/hard-stop - Toggle hard stop for tenant
 */

import { Router, Request, Response } from 'express';
import {
  getTenantUsageStatus,
  getDailyUsageBreakdown,
  getAllTenantsUsageStatus,
  rebuildUsageForAllTenants,
  updateTenantUsageStatus,
  setHardStopEnabled,
  canTenantUseChannel,
} from '../services/usageMeteringService';
import { USAGE_CHANNELS_V2 } from '@shared/schema';
import { PlanTier } from '@shared/addonsConfig';
import { UsageStatus } from '@shared/usageCapsConfig';

const router = Router();

interface AuthenticatedRequest extends Request {
  session: {
    tenantId?: string;
    userId?: number;
    passport?: {
      user?: {
        id: number;
        username: string;
        role: string;
      };
    };
  } & Request['session'];
}

function getTenantId(req: AuthenticatedRequest): string | null {
  return req.session?.tenantId || 'root';
}

function isAuthenticated(req: AuthenticatedRequest): boolean {
  return !!(req.session?.passport?.user || req.session?.userId);
}

function isAdmin(req: AuthenticatedRequest): boolean {
  const user = req.session?.passport?.user;
  return user?.role === 'owner' || user?.role === 'admin';
}

function isRootAdmin(req: AuthenticatedRequest): boolean {
  const tenantId = getTenantId(req);
  const user = req.session?.passport?.user;
  return tenantId === 'root' && (user?.role === 'owner' || user?.role === 'admin');
}

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    const periodKey = req.query.period as string | undefined;
    const status = await getTenantUsageStatus(tenantId, periodKey);

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[USAGE V2] Error fetching usage summary:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch usage summary' });
  }
});

router.get('/daily', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const breakdown = await getDailyUsageBreakdown(tenantId, Math.min(days, 90));

    return res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    console.error('[USAGE V2] Error fetching daily breakdown:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch daily breakdown' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    const status = await getTenantUsageStatus(tenantId);

    return res.json({
      success: true,
      data: {
        overallStatus: status.overallStatus,
        hardStopEnabled: status.hardStopEnabled,
        period: status.period,
        channelStatuses: Object.fromEntries(
          Object.entries(status.channels).map(([k, v]) => [k, v.status])
        ),
      },
    });
  } catch (error) {
    console.error('[USAGE V2] Error fetching usage status:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch usage status' });
  }
});

router.get('/can-use/:channel', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    const channel = req.params.channel as any;
    if (!USAGE_CHANNELS_V2.includes(channel)) {
      return res.status(400).json({ success: false, error: 'Invalid channel' });
    }

    const result = await canTenantUseChannel(tenantId, channel);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[USAGE V2] Error checking channel allowance:', error);
    return res.status(500).json({ success: false, error: 'Failed to check channel allowance' });
  }
});

router.get('/system-summary', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isRootAdmin(authReq)) {
      return res.status(403).json({ success: false, error: 'Root admin access required' });
    }

    const statusFilter = req.query.status as UsageStatus | undefined;
    const tierFilter = req.query.tier as PlanTier | undefined;

    const results = await getAllTenantsUsageStatus({
      status: statusFilter,
      planTier: tierFilter,
    });

    return res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('[USAGE V2] Error fetching system summary:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch system summary' });
  }
});

router.post('/rebuild', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isRootAdmin(authReq)) {
      return res.status(403).json({ success: false, error: 'Root admin access required' });
    }

    const result = await rebuildUsageForAllTenants();

    return res.json({
      success: true,
      message: `Rebuilt usage for ${result.tenantsProcessed} tenants`,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('[USAGE V2] Error rebuilding usage:', error);
    return res.status(500).json({ success: false, error: 'Failed to rebuild usage' });
  }
});

router.put('/:tenantId/hard-stop', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isRootAdmin(authReq)) {
      return res.status(403).json({ success: false, error: 'Root admin access required' });
    }

    const { tenantId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }

    await setHardStopEnabled(tenantId, enabled);

    return res.json({
      success: true,
      message: `Hard stop ${enabled ? 'enabled' : 'disabled'} for tenant ${tenantId}`,
    });
  } catch (error) {
    console.error('[USAGE V2] Error setting hard stop:', error);
    return res.status(500).json({ success: false, error: 'Failed to set hard stop' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    await updateTenantUsageStatus(tenantId);
    const status = await getTenantUsageStatus(tenantId);

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[USAGE V2] Error refreshing usage:', error);
    return res.status(500).json({ success: false, error: 'Failed to refresh usage' });
  }
});

export default router;
