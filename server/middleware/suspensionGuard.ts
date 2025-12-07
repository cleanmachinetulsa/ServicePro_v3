/**
 * Suspension Guard Middleware (SP-6)
 * 
 * Blocks access to protected routes when tenant is suspended.
 * Returns 403 with ACCOUNT_SUSPENDED code for frontend handling.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function ensureTenantNotSuspended(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.session?.tenantId;
    
    if (!tenantId) {
      return next();
    }

    const [tenant] = await db
      .select({ status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return next();
    }

    if (tenant.status === 'suspended') {
      console.log(`[SUSPENSION GUARD] Blocked request for suspended tenant ${tenantId}`);
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account is currently suspended due to an unpaid balance.',
      });
    }

    next();
  } catch (error) {
    console.error('[SUSPENSION GUARD] Error checking tenant status:', error);
    next();
  }
}

export function isSuspendedRoute(path: string): boolean {
  const exemptPaths = [
    '/api/settings/billing',
    '/api/billing',
    '/api/tenant/billing',
    '/api/support',
    '/api/auth',
    '/api/webhooks',
  ];

  return !exemptPaths.some(exempt => path.startsWith(exempt));
}
