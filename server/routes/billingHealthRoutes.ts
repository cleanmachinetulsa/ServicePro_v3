/**
 * Billing Health Routes (SP-27)
 * 
 * Root admin only endpoints for Stripe configuration health monitoring.
 */

import { Router, Request, Response } from 'express';
import { requireRole } from '../rbacMiddleware';
import { getStripeConfigHealth, testStripeConnectivity } from '../services/stripeSafeCall';
import { getTenantBillingSummary } from '../services/billingService';

const router = Router();

/**
 * GET /api/root/billing/health
 * Returns Stripe configuration health status (root admin only)
 */
router.get('/api/root/billing/health', requireRole('root'), async (req: Request, res: Response) => {
  try {
    const configHealth = getStripeConfigHealth();
    
    let connectivityTest = null;
    if (configHealth.hasStripeApiKey) {
      const testResult = await testStripeConnectivity();
      connectivityTest = {
        tested: true,
        connected: testResult.ok,
        error: testResult.error || null,
      };
    }

    res.json({
      ...configHealth,
      connectivity: connectivityTest,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[BILLING HEALTH] Error checking health:', error);
    res.status(500).json({ error: 'Failed to check billing health' });
  }
});

/**
 * GET /api/admin/billing/status
 * Returns billing status for current tenant (owner only)
 */
router.get('/api/admin/billing/status', requireRole('owner'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not found' });
    }

    const summary = await getTenantBillingSummary(tenantId);
    if (!summary) {
      return res.status(404).json({ error: 'Billing summary not found' });
    }

    const statusMessage = getBillingStatusMessage(summary);

    res.json({
      ...summary,
      statusMessage,
    });
  } catch (error) {
    console.error('[BILLING STATUS] Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch billing status' });
  }
});

function getBillingStatusMessage(summary: {
  status: string;
  failedPaymentAttempts: number;
  stripeConfigured: boolean;
}): string {
  if (!summary.stripeConfigured) {
    return 'Billing is not configured. Contact support for assistance.';
  }

  switch (summary.status) {
    case 'active':
      return 'Your account is in good standing.';
    case 'trialing':
      return 'You are currently on a trial period.';
    case 'past_due':
      if (summary.failedPaymentAttempts > 0) {
        return `Payment failed (${summary.failedPaymentAttempts} attempt${summary.failedPaymentAttempts > 1 ? 's' : ''}). Please update your payment method.`;
      }
      return 'Your payment is past due. Please update your payment method.';
    case 'suspended':
      return 'Your account has been suspended due to unpaid balance. Update your payment method to restore access.';
    case 'cancelled':
      return 'Your subscription has been cancelled.';
    default:
      return 'Unable to determine billing status.';
  }
}

export default router;
