/**
 * Admin Tenant Readiness Router
 * 
 * Provides an authenticated endpoint for super-admins to fetch
 * a comprehensive readiness report for any tenant.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../authMiddleware';
import { requireRole } from '../rbacMiddleware';
import { getTenantReadinessReportBySlug } from '../services/tenantReadinessService';

const router = Router();

router.get(
  '/api/admin/tenant-readiness/:tenantSlug',
  requireAuth,
  requireRole('owner'),
  async (req: Request, res: Response) => {
    try {
      const { tenantSlug } = req.params;

      if (!tenantSlug || tenantSlug.trim() === '') {
        return res.status(400).json({
          ok: false,
          error: 'Tenant slug is required.',
        });
      }

      const report = await getTenantReadinessReportBySlug(tenantSlug);

      return res.status(200).json({
        ok: true,
        report,
      });
    } catch (error: any) {
      console.error('[TENANT READINESS] Error generating report:', error);

      if (error.message?.includes('not found')) {
        return res.status(404).json({
          ok: false,
          error: 'Tenant not found.',
        });
      }

      return res.status(500).json({
        ok: false,
        error: error.message || 'Failed to generate readiness report.',
      });
    }
  }
);

export default router;
