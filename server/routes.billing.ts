/**
 * Billing Routes (Phase 7C)
 * 
 * Handles Stripe subscription checkout and billing portal
 * for tenant plan upgrades.
 * 
 * Endpoints:
 * - POST /api/tenant/billing/checkout-session - Create Stripe checkout for upgrade
 * - POST /api/tenant/billing/portal-session - Create billing portal session
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  stripe,
  getPriceIdForTier,
  isValidUpgrade,
  isStripeConfigured,
} from './services/stripeService';

const router = Router();

/**
 * Request schema for checkout session creation
 */
const createCheckoutSessionSchema = z.object({
  targetTier: z.enum(['starter', 'pro', 'elite']),
});

/**
 * POST /api/tenant/billing/checkout-session
 * 
 * Creates a Stripe Checkout Session for upgrading to a higher tier
 * 
 * Security: Requires tenant authentication
 * 
 * Request body:
 * - targetTier: 'starter' | 'pro' | 'elite'
 * 
 * Response:
 * - checkoutUrl: Stripe checkout URL to redirect to
 */
router.post('/api/tenant/billing/checkout-session', async (req: Request, res: Response) => {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured() || !stripe) {
      return res.status(503).json({
        error: 'Billing is not configured. Please contact support.',
      });
    }

    // Validate tenant auth (using existing multi-tenant auth middleware)
    if (!req.tenant) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request body
    const parseResult = createCheckoutSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
    }

    const { targetTier } = parseResult.data;
    const tenant = req.tenant;

    // Validate upgrade is to a higher tier
    if (!isValidUpgrade(tenant.planTier, targetTier)) {
      return res.status(400).json({
        error: 'Invalid upgrade',
        message: `Cannot upgrade from ${tenant.planTier} to ${targetTier}. Target tier must be higher than current tier.`,
      });
    }

    // Get Stripe price ID for target tier
    let priceId: string;
    try {
      priceId = getPriceIdForTier(targetTier);
    } catch (error: any) {
      console.error('[BILLING] Price ID not configured:', error.message);
      return res.status(503).json({
        error: 'Billing configuration incomplete',
        message: error.message,
      });
    }

    // Determine customer ID (reuse existing or create new)
    let customerId = tenant.stripeCustomerId;

    // If no existing Stripe customer, create one
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.name,
        },
      });
      customerId = customer.id;

      // Update tenant with new Stripe customer ID
      await req.db.update(tenants)
        .set({ stripeCustomerId: customerId })
        .where(eq(tenants.id, tenant.id));

      console.log(`[BILLING] Created Stripe customer ${customerId} for tenant ${tenant.id}`);
    }

    // Create Checkout Session
    const appUrl = process.env.REPL_SLUG
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : process.env.APP_URL || 'http://localhost:5000';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/app/billing`,
      metadata: {
        tenantId: tenant.id,
        targetTier: targetTier,
        currentTier: tenant.planTier,
      },
      subscription_data: {
        metadata: {
          tenantId: tenant.id,
          targetTier: targetTier,
        },
      },
    });

    console.log(`[BILLING] Created checkout session ${session.id} for tenant ${tenant.id} (${tenant.planTier} → ${targetTier})`);

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });

  } catch (error: any) {
    console.error('[BILLING] Error creating checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message,
    });
  }
});

/**
 * POST /api/tenant/billing/portal-session
 * 
 * Creates a Stripe Billing Portal session for managing subscription
 * 
 * Security: Requires tenant authentication
 * 
 * Response:
 * - portalUrl: Stripe billing portal URL to redirect to
 */
router.post('/api/tenant/billing/portal-session', async (req: Request, res: Response) => {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured() || !stripe) {
      return res.status(503).json({
        error: 'Billing is not configured. Please contact support.',
      });
    }

    // Validate tenant auth
    if (!req.tenant) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tenant = req.tenant;

    // Require existing Stripe customer
    if (!tenant.stripeCustomerId) {
      return res.status(400).json({
        error: 'No billing account found',
        message: 'Please upgrade your plan first to access billing management.',
      });
    }

    // Create billing portal session
    const appUrl = process.env.REPL_SLUG
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : process.env.APP_URL || 'http://localhost:5000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${appUrl}/app/billing`,
    });

    console.log(`[BILLING] Created portal session for tenant ${tenant.id}`);

    res.json({
      success: true,
      portalUrl: portalSession.url,
    });

  } catch (error: any) {
    console.error('[BILLING] Error creating portal session:', error);
    res.status(500).json({
      error: 'Failed to create billing portal session',
      message: error.message,
    });
  }
});

/**
 * GET /api/tenant/billing/status
 * 
 * Get current billing status for authenticated tenant
 * 
 * Response:
 * - planTier: Current tier
 * - status: Subscription status
 * - hasStripeCustomer: Whether tenant has billing set up
 * - subscriptionId: Stripe subscription ID (if exists)
 */
router.get('/api/tenant/billing/status', async (req: Request, res: Response) => {
  try {
    if (!req.tenant) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Fetch full tenant record from database (req.tenant only has basic info)
    const { db } = await import('./db');
    const [fullTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, req.tenant.id))
      .limit(1);

    if (!fullTenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      success: true,
      planTier: fullTenant.planTier || 'free',
      status: fullTenant.status || 'active',
      hasStripeCustomer: !!fullTenant.stripeCustomerId,
    });

  } catch (error: any) {
    console.error('[BILLING] Error fetching billing status:', error);
    res.status(500).json({
      error: 'Failed to fetch billing status',
      message: error.message,
    });
  }
});

export default router;
