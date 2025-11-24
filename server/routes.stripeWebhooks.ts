/**
 * Stripe Webhook Handler
 * 
 * Processes Stripe webhook events with:
 * - Signature verification for security
 * - Idempotent event processing (no duplicates)
 * - Automatic deposit tracking
 * - Payment status updates
 * - Audit logging
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { appointments, paymentLinks, auditLog, invoices, tenants } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { markDepositPaid } from './depositManager';
import { getTierForPriceId } from './services/stripeService';
import { createTenantDb, type TenantDb } from './tenantDb';
import { db } from './db';
import type { TenantInfo } from './tenantMiddleware';

const router = Router();

const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_ENABLED ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
}) : null;

if (!STRIPE_ENABLED) {
  console.warn('[STRIPE WEBHOOKS] STRIPE_SECRET_KEY not configured - Stripe webhooks will be disabled');
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Store processed event IDs to prevent duplicate processing
const processedEvents = new Set<string>();

/**
 * Resolve tenant context from webhook metadata
 * CRITICAL: Webhooks bypass tenant middleware, so we must explicitly resolve tenant
 * 
 * @param tenantId - Tenant ID from webhook metadata
 * @returns {tenant, tenantDb} or null if tenant not found
 */
async function resolveTenantContext(tenantId: string | null | undefined): Promise<{tenant: TenantInfo, tenantDb: TenantDb} | null> {
  if (!tenantId) {
    return null;
  }

  // Look up tenant record
  const [tenantRecord] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenantRecord) {
    console.error(`[CRITICAL] [WEBHOOK] Tenant ${tenantId} not found in database`);
    return null;
  }

  // Create tenant info object
  const tenant: TenantInfo = {
    id: tenantRecord.id,
    name: tenantRecord.name,
    subdomain: tenantRecord.subdomain,
    isRoot: tenantRecord.isRoot,
  };

  // Create tenant-scoped DB
  const tenantDb = createTenantDb(tenant);

  return { tenant, tenantDb };
}

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
router.post('/api/webhooks/stripe', async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(503).send('Stripe webhooks not configured');
  }

  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('[STRIPE WEBHOOK] Missing stripe-signature header');
    return res.status(400).send('Missing signature');
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      webhookSecret
    );
  } catch (err: any) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Check for duplicate events (idempotency)
  if (processedEvents.has(event.id)) {
    console.log(`[STRIPE WEBHOOK] Duplicate event ${event.id}, skipping`);
    return res.status(200).json({ received: true, skipped: 'duplicate' });
  }

  // Mark event as processed
  processedEvents.add(event.id);

  // Clean up old processed events (keep last 1000)
  if (processedEvents.size > 1000) {
    const oldEvents = Array.from(processedEvents).slice(0, processedEvents.size - 1000);
    oldEvents.forEach(id => processedEvents.delete(id));
  }

  console.log(`[STRIPE WEBHOOK] Processing event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(req, event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(req, event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(req, event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(req, event.data.object as Stripe.Charge);
        break;

      // Phase 7C: Subscription events for billing
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(req, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(req, event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // Log webhook event (only for tenant-scoped events)
    // Subscription events already log via their handlers using createTenantDb()
    if (req.tenantDb) {
      await req.tenantDb.insert(auditLog).values({
        actionType: 'stripe_webhook_received',
        entityType: 'payment',
        details: {
          eventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
        },
      });
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[STRIPE WEBHOOK] Error processing event:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(req: Request, session: Stripe.Checkout.Session) {
  console.log('[STRIPE WEBHOOK] Checkout session completed:', session.id);

  const appointmentId = session.metadata?.appointmentId;
  const type = session.metadata?.type;

  if (!appointmentId) {
    console.warn('[STRIPE WEBHOOK] No appointmentId in metadata');
    return;
  }

  if (type === 'deposit') {
    // Mark deposit as paid
    await markDepositPaid(parseInt(appointmentId), session.payment_intent as string);

    console.log(`[STRIPE WEBHOOK] Deposit paid for appointment ${appointmentId}`);
  } else if (type === 'balance') {
    // Mark invoice as paid
    await markInvoicePaid(req, parseInt(appointmentId), session.payment_intent as string);

    console.log(`[STRIPE WEBHOOK] Balance paid for appointment ${appointmentId}`);
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(req: Request, paymentIntent: Stripe.PaymentIntent) {
  console.log('[STRIPE WEBHOOK] Payment intent succeeded:', paymentIntent.id);

  const appointmentId = paymentIntent.metadata?.appointmentId;
  const type = paymentIntent.metadata?.type;

  if (!appointmentId) {
    console.warn('[STRIPE WEBHOOK] No appointmentId in metadata');
    return;
  }

  // Update payment link status
  await req.tenantDb!
    .update(paymentLinks)
    .set({
      status: 'paid',
      paidAt: new Date().toISOString(),
      stripePaymentIntentId: paymentIntent.id,
    })
    .where(
      req.tenantDb!.withTenantFilter(
        paymentLinks,
        and(
          eq(paymentLinks.appointmentId, parseInt(appointmentId)),
          eq(paymentLinks.status, 'pending')
        )
      )
    )
    .execute();

  console.log(`[STRIPE WEBHOOK] Payment link updated for appointment ${appointmentId}`);
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(req: Request, paymentIntent: Stripe.PaymentIntent) {
  console.log('[STRIPE WEBHOOK] Payment intent failed:', paymentIntent.id);

  const appointmentId = paymentIntent.metadata?.appointmentId;

  if (!appointmentId) {
    console.warn('[STRIPE WEBHOOK] No appointmentId in metadata');
    return;
  }

  // Update payment link status
  await req.tenantDb!
    .update(paymentLinks)
    .set({
      status: 'failed',
      failureReason: paymentIntent.last_payment_error?.message,
    })
    .where(
      req.tenantDb!.withTenantFilter(
        paymentLinks,
        and(
          eq(paymentLinks.appointmentId, parseInt(appointmentId)),
          eq(paymentLinks.status, 'pending')
        )
      )
    )
    .execute();

  // Log failure
  await req.tenantDb!.insert(auditLog).values({
    actionType: 'payment_failed',
    entityType: 'appointment',
    entityId: parseInt(appointmentId),
    details: {
      paymentIntentId: paymentIntent.id,
      failureMessage: paymentIntent.last_payment_error?.message,
    },
  });

  console.log(`[STRIPE WEBHOOK] Payment failed for appointment ${appointmentId}`);
}

/**
 * Handle charge refunded
 */
async function handleChargeRefunded(req: Request, charge: Stripe.Charge) {
  console.log('[STRIPE WEBHOOK] Charge refunded:', charge.id);

  const appointmentId = charge.metadata?.appointmentId;

  if (!appointmentId) {
    console.warn('[STRIPE WEBHOOK] No appointmentId in metadata');
    return;
  }

  // Log refund
  await req.tenantDb!.insert(auditLog).values({
    actionType: 'payment_refunded',
    entityType: 'appointment',
    entityId: parseInt(appointmentId),
    details: {
      chargeId: charge.id,
      amountRefunded: charge.amount_refunded / 100, // Convert from cents
      refundReason: charge.refund?.reason,
    },
  });

  console.log(`[STRIPE WEBHOOK] Refund processed for appointment ${appointmentId}`);
}

/**
 * Mark invoice as paid
 */
async function markInvoicePaid(
  tenantDb: TenantDb,
  appointmentId: number,
  stripePaymentIntentId: string
): Promise<void> {
  try {
    const [invoice] = await tenantDb
      .select()
      .from(invoices)
      .where(tenantDb.withTenantFilter(invoices, eq(invoices.appointmentId, appointmentId)));

    if (!invoice) {
      console.warn(`[STRIPE WEBHOOK] Invoice not found for appointment ${appointmentId}`);
      return;
    }

    // Update invoice with both legacy and new payment status fields
    await tenantDb
      .update(invoices)
      .set({
        status: 'paid',                    // Legacy field - backward compatibility
        paymentStatus: 'paid',             // Primary payment status field
        paymentMethod: 'Stripe',           // Payment method
        paidAt: new Date(),                // Payment timestamp
        stripePaymentIntentId,             // Stripe payment intent ID
      })
      .where(tenantDb.withTenantFilter(invoices, eq(invoices.id, invoice.id)));

    // Log payment
    await tenantDb.insert(auditLog).values({
      actionType: 'invoice_paid',
      entityType: 'invoice',
      entityId: invoice.id,
      details: {
        appointmentId,
        stripePaymentIntentId,
        amount: invoice.amount,
        paymentMethod: 'Stripe',
      },
    });

    console.log(`[STRIPE WEBHOOK] Invoice ${invoice.id} marked as paid via Stripe`);
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error marking invoice paid:', error);
  }
}

/**
 * Handle subscription created/updated (Phase 7C)
 * Updates tenant planTier based on active subscription
 */
async function handleSubscriptionChange(req: Request, subscription: Stripe.Subscription) {
  console.log('[STRIPE WEBHOOK] Subscription change:', subscription.id);

  try {
    // Get tenant ID from subscription metadata
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) {
      console.warn('[STRIPE WEBHOOK] No tenantId in subscription metadata');
      return;
    }

    // Look up tenant record to validate it exists
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      console.error(`[CRITICAL] [STRIPE WEBHOOK] Tenant ${tenantId} not found - aborting subscription update for ${subscription.id}. ALERT: Billing state will be inconsistent!`);
      // TODO: Send alert to operations/support team
      return;
    }

    // Determine target tier from subscription price
    const priceId = subscription.items.data[0]?.price.id;
    if (!priceId) {
      console.warn('[STRIPE WEBHOOK] No price ID in subscription');
      return;
    }

    const targetTier = getTierForPriceId(priceId);
    if (!targetTier) {
      console.warn(`[STRIPE WEBHOOK] Unknown price ID: ${priceId}`);
      return;
    }

    // Determine subscription status
    let status: 'active' | 'past_due' | 'cancelled' | 'trialing' = 'active';
    if (subscription.status === 'trialing') {
      status = 'trialing';
    } else if (subscription.status === 'past_due') {
      status = 'past_due';
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      status = 'cancelled';
    }

    // Update tenant with new tier and subscription info (GLOBAL table)
    const result = await db.update(tenants)
      .set({
        planTier: targetTier,
        status: status,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    // Verify update succeeded
    if (result.rowCount === 0) {
      console.error(`[CRITICAL] [STRIPE WEBHOOK] Failed to update tenant ${tenantId} - row not found. ALERT: Stripe subscription ${subscription.id} active but planTier not upgraded!`);
      // TODO: Send alert to operations/support team
      return;
    }

    // Create tenant-scoped DB for audit logging
    const tenantDb = createTenantDb({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      isRoot: tenant.isRoot,
    });

    // Log the upgrade (TENANT-SCOPED table)
    await tenantDb.insert(auditLog).values({
      actionType: 'subscription_updated',
      entityType: 'tenant',
      entityId: null,
      details: {
        tenantId,
        subscriptionId: subscription.id,
        tier: targetTier,
        status: status,
        priceId: priceId,
      },
    });

    console.log(`[STRIPE WEBHOOK] Tenant ${tenantId} upgraded to ${targetTier} (subscription ${subscription.id})`);
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error handling subscription change:', error);
  }
}

/**
 * Handle subscription deleted/cancelled (Phase 7C)
 * Downgrades tenant to free tier
 */
async function handleSubscriptionDeleted(req: Request, subscription: Stripe.Subscription) {
  console.log('[STRIPE WEBHOOK] Subscription deleted:', subscription.id);

  try {
    // Get tenant ID from subscription metadata (primary)
    let tenantId = subscription.metadata?.tenantId;
    let tenant = null;

    if (tenantId) {
      // Look up tenant record to validate it exists
      [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
    }

    // Fallback: Try to find tenant by subscription ID
    if (!tenant) {
      [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.stripeSubscriptionId, subscription.id))
        .limit(1);
      
      if (tenant) {
        tenantId = tenant.id;
      }
    }

    if (!tenant || !tenantId) {
      console.error(`[CRITICAL] [STRIPE WEBHOOK] Cannot find tenant for subscription ${subscription.id} - aborting cancellation. ALERT: Stripe subscription cancelled but tenant planTier not downgraded!`);
      // TODO: Send alert to operations/support team
      return;
    }

    // Update tenant to free tier and clear Stripe identifiers (GLOBAL table)
    const result = await db.update(tenants)
      .set({
        planTier: 'free',
        status: 'cancelled',
        stripeSubscriptionId: null,
        stripeCustomerId: null, // Clear customer ID to allow fresh upgrades
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    // Verify update succeeded
    if (result.rowCount === 0) {
      console.error(`[CRITICAL] [STRIPE WEBHOOK] Failed to downgrade tenant ${tenantId} - row not found. ALERT: Stripe subscription ${subscription.id} cancelled but planTier not downgraded!`);
      // TODO: Send alert to operations/support team
      return;
    }

    // Create tenant-scoped DB for audit logging
    const tenantDb = createTenantDb({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      isRoot: tenant.isRoot,
    });

    // Log the downgrade (TENANT-SCOPED table)
    await tenantDb.insert(auditLog).values({
      actionType: 'subscription_cancelled',
      entityType: 'tenant',
      entityId: null,
      details: {
        tenantId,
        subscriptionId: subscription.id,
        downgradedTo: 'free',
      },
    });

    console.log(`[STRIPE WEBHOOK] Tenant ${tenantId} downgraded to free tier (subscription cancelled)`);
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error handling subscription deletion:', error);
  }
}

export default router;
