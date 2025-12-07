/**
 * SP-19: Billing Enforcement Middleware
 * 
 * Blocks outbound communications (SMS, voice, email) for suspended tenants.
 * Allows inbound communications to still be received and logged.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

const LOG_PREFIX = '[BILLING ENFORCEMENT]';

export interface BillingEnforcementOptions {
  allowInbound?: boolean;
  blockMessage?: string;
}

const DEFAULT_BLOCK_MESSAGE = 'Account is suspended due to billing issues. Please update your payment method to restore service.';

/**
 * Middleware to check if tenant billing is active
 * Blocks outbound communications for suspended tenants
 */
export function requireBillingActive(options: BillingEnforcementOptions = {}) {
  const blockMessage = options.blockMessage || DEFAULT_BLOCK_MESSAGE;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenant?.id || (req as any).tenantId || req.session?.tenantId;
      
      if (!tenantId) {
        console.warn(`${LOG_PREFIX} No tenant context available`);
        return next();
      }

      const [tenant] = await db
        .select({
          id: tenants.id,
          status: tenants.status,
          planTier: tenants.planTier,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) {
        console.warn(`${LOG_PREFIX} Tenant ${tenantId} not found`);
        return next();
      }

      if (tenant.status === 'suspended') {
        console.warn(`${LOG_PREFIX} Blocked outbound request for suspended tenant ${tenantId}`);
        return res.status(403).json({
          success: false,
          error: 'account_suspended',
          message: blockMessage,
          billingStatus: 'suspended',
        });
      }

      next();
    } catch (error) {
      console.error(`${LOG_PREFIX} Error checking billing status:`, error);
      next();
    }
  };
}

/**
 * Check if tenant is suspended (non-middleware version)
 */
export async function isTenantSuspended(tenantId: string): Promise<boolean> {
  try {
    const [tenant] = await db
      .select({ status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant?.status === 'suspended';
  } catch (error) {
    console.error(`${LOG_PREFIX} Error checking suspension status:`, error);
    return false;
  }
}

/**
 * Get tenant billing status for display
 */
export async function getTenantBillingStatus(tenantId: string): Promise<{
  status: string;
  isSuspended: boolean;
  isPastDue: boolean;
  canSendOutbound: boolean;
} | null> {
  try {
    const [tenant] = await db
      .select({
        status: tenants.status,
        planTier: tenants.planTier,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) return null;

    const status = tenant.status;
    const isSuspended = status === 'suspended';
    const isPastDue = status === 'past_due';

    return {
      status,
      isSuspended,
      isPastDue,
      canSendOutbound: !isSuspended,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting billing status:`, error);
    return null;
  }
}
