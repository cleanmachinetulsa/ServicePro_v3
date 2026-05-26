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
import { appointments, paymentLinks, auditLog, invoices, tenants, stripeWebhookEvents } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { markDepositPaid } from './depositManager';
import { finalizeInvoicePaid, clawbackInvoiceLoyalty } from './paymentHandler';
import { getTierForPriceId } from './services/stripeService';
import { createTenantDb, type TenantDb } from './tenantDb';
import { db } from './db';
import { rejectIfProduction } from './services/webhookVerifierPolicy';
import type { TenantInfo } from './tenantMiddleware';
import {
  mapStripeToBillingStatus,
  updateTenantBillingStatus,
  checkAndApplySuspension,
  sendPaymentFailedEmail,
  sendPaymentRecoveredEmail,
} from './services/billingStatusService';
import {
  logPaymentFailed,
  logPaymentRecovered,
  logTenantSuspended,
  logSubscriptionChange,
  logPlanChange,
} from './services/billingEventService';
import {
  incrementFailedAttempts,
  resetFailedAttempts,
} from './services/billingService';

const router = Router();

const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_ENABLED ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
}) : null;

if (!STRIPE_ENABLED) {
  console.warn('[STRIPE WEBHOOKS] STRIPE_SECRET_KEY not configured - Stripe webhooks will be disabled');
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

if (STRIPE_ENABLED && !webhookSecret && process.env.NODE_ENV === 'production') {
  console.error('[STRIPE WEBHOOKS] FATAL: STRIPE_WEBHOOK_SECRET not configured in production. Webhooks will be rejected.');
}

// In-memory cache for quick duplicate detection (DB is source of truth)
const processedEventsCache = new Set<string>();

/**
 * SP-27: Check if webhook event has already been processed (DB-based idempotency)
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  if (processedEventsCache.has(eventId)) {
    return true;
  }

  const [existing] = await db
    .select({ id: stripeWebhookEvents.id })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, eventId))
    .limit(1);

  if (existing) {
    processedEventsCache.add(eventId);
    return true;
  }

  return false;
}

/**
 * SP-27: Record webhook event as processed
 */
async function markEventProcessed(
  eventId: string,
  eventType: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await db.insert(stripeWebhookEvents).values({
      eventId,
      eventType,
      success,
      errorMessage: errorMessage || null,
    });
    processedEventsCache.add(eventId);

    if (processedEventsCache.size > 1000) {
      const oldEntries = Array.from(processedEventsCache).slice(0, processedEventsCache.size - 1000);
      oldEntries.forEach(id => processedEventsCache.delete(id));
    }
  } catch (error: any) {
    if (error.code === '23505') {
      console.log(`[STRIPE WEBHOOK] Event ${eventId} already recorded (concurrent insert)`);
    } else {
      console.error(`[STRIPE WEBHOOK] Failed to record event ${eventId}:`, error.message);
    }
  }
}

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

  if (!webhookSecret) {
    if (!rejectIfProduction(res, { provider: 'stripe', reason: 'missing_secret' })) return;
    // Dev soft-pass: accept the unverified body so local testing still works.
    const event = req.body as Stripe.Event;
    return res.status(200).json({ received: true, devUnverified: true });
  }

  const sig = req.headers['stripe-signature'];

  if (!sig) {
    if (!rejectIfProduction(res, { provider: 'stripe', reason: 'missing_signature' })) return;
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
    if (!rejectIfProduction(res, { provider: 'stripe', reason: 'invalid_signature', detail: err.message })) return;
    // Dev soft-pass when the signature didn't validate: parse the raw body and continue.
    try {
      event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body));
    } catch {
      return res.status(400).send('Malformed body');
    }
  }

  // SP-27: DB-based idempotency check
  const alreadyProcessed = await isEventProcessed(event.id);
  if (alreadyProcessed) {
    console.log(`[STRIPE WEBHOOK] Duplicate event ${event.id}, skipping`);
    return res.status(200).json({ received: true, skipped: 'duplicate' });
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

      // SP-6: Invoice events for billing dunning
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
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

    // SP-27: Mark event as processed in DB
    await markEventProcessed(event.id, event.type, true);

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[STRIPE WEBHOOK] Error processing event:', error);
    
    // SP-27: Still record the event even on error to prevent infinite retries
    await markEventProcessed(event.id, event.type, false, error.message);
    
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
    // Mark invoice as paid. Pass req.tenantDb! (not req) — markInvoicePaid expects
    // TenantDb as its first arg. req.tenantDb is always populated here because
    // tenantMiddleware runs before this router; for webhook requests without a
    // session it falls back to the root tenant.
    await markInvoicePaid(req.tenantDb!, parseInt(appointmentId), session.payment_intent as string);

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

  const tenantDb = req.tenantDb!;
  const appointmentIdRaw = charge.metadata?.appointmentId;
  const invoiceIdRaw = charge.metadata?.invoiceId;
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id ?? null;

  // Resolve the invoice via a fall-through chain ordered from most-precise to
  // least-precise to avoid mis-resolving when multiple invoices share an
  // appointment (no uniqueness constraint on invoices.appointmentId):
  //   1. invoiceId in metadata — exact match (createStripePaymentIntent flow,
  //      manual-invoice path that does NOT include appointmentId)
  //   2. payment_intent — exact match against invoices.stripePaymentIntentId
  //      (written by both markInvoicePaid and createStripePaymentIntent)
  //   3. appointmentId in metadata — last resort (depositManager / payerApproval
  //      / checkout-session paths). Ambiguous if multiple invoices exist per
  //      appointment; we log a warning when that happens.
  let invoice: { id: number; customerId: number | null; appointmentId: number | null } | null = null;
  let resolutionPath: 'invoiceId' | 'paymentIntentId' | 'appointmentId' | null = null;

  try {
    if (invoiceIdRaw) {
      const parsedInvoiceId = parseInt(invoiceIdRaw);
      if (!Number.isNaN(parsedInvoiceId)) {
        const [byId] = await tenantDb
          .select({ id: invoices.id, customerId: invoices.customerId, appointmentId: invoices.appointmentId })
          .from(invoices)
          .where(tenantDb.withTenantFilter(invoices, eq(invoices.id, parsedInvoiceId)))
          .limit(1);
        if (byId) { invoice = byId; resolutionPath = 'invoiceId'; }
      }
    }

    if (!invoice && paymentIntentId) {
      const [byPi] = await tenantDb
        .select({ id: invoices.id, customerId: invoices.customerId, appointmentId: invoices.appointmentId })
        .from(invoices)
        .where(tenantDb.withTenantFilter(invoices, eq(invoices.stripePaymentIntentId, paymentIntentId)))
        .limit(1);
      if (byPi) { invoice = byPi; resolutionPath = 'paymentIntentId'; }
    }

    if (!invoice && appointmentIdRaw) {
      const parsedAppointmentId = parseInt(appointmentIdRaw);
      if (!Number.isNaN(parsedAppointmentId)) {
        const apptMatches = await tenantDb
          .select({ id: invoices.id, customerId: invoices.customerId, appointmentId: invoices.appointmentId })
          .from(invoices)
          .where(tenantDb.withTenantFilter(invoices, eq(invoices.appointmentId, parsedAppointmentId)))
          .limit(2);
        if (apptMatches.length > 1) {
          // Ambiguous — multiple invoices on this appointment and no precise key
          // resolved it. Refuse to guess; clawback skipped.
          console.warn(
            `[STRIPE WEBHOOK] Refund ${charge.id} matches ${apptMatches.length}+ invoices on appointment ${parsedAppointmentId} ` +
              `with no invoiceId/paymentIntentId to disambiguate; skipping loyalty clawback to avoid mis-clawback.`,
          );
        } else if (apptMatches[0]) {
          invoice = apptMatches[0];
          resolutionPath = 'appointmentId';
        }
      }
    }
  } catch (lookupErr) {
    console.error('[STRIPE WEBHOOK] Refund invoice lookup failed (non-fatal):', lookupErr);
  }

  if (invoice) {
    console.log(
      `[STRIPE WEBHOOK] Refund ${charge.id} resolved to invoice ${invoice.id} via ${resolutionPath}`,
    );
  }

  // Audit log — preserve the prior behavior shape, but include richer fields.
  // If we resolved an invoice, key the audit row to 'invoice'; otherwise fall
  // back to 'appointment' (legacy shape) or 'charge' when nothing resolves.
  try {
    if (invoice) {
      await tenantDb.insert(auditLog).values({
        actionType: 'payment_refunded',
        entityType: 'invoice',
        entityId: invoice.id,
        details: {
          chargeId: charge.id,
          paymentIntentId,
          appointmentId: invoice.appointmentId ?? (appointmentIdRaw ? parseInt(appointmentIdRaw) : null),
          amountRefunded: charge.amount_refunded / 100, // dollars
          refundReason: charge.refund?.reason,
        },
      });
    } else if (appointmentIdRaw) {
      // Legacy behavior — invoice lookup failed but we have an appointmentId.
      await tenantDb.insert(auditLog).values({
        actionType: 'payment_refunded',
        entityType: 'appointment',
        entityId: parseInt(appointmentIdRaw),
        details: {
          chargeId: charge.id,
          paymentIntentId,
          amountRefunded: charge.amount_refunded / 100,
          refundReason: charge.refund?.reason,
        },
      });
    } else {
      console.warn(
        `[STRIPE WEBHOOK] Refund ${charge.id} could not be resolved to an invoice or appointment ` +
          `(no invoiceId/appointmentId in metadata, no matching stripePaymentIntentId). ` +
          `Logging as orphan audit row; loyalty clawback skipped.`,
      );
    }
  } catch (auditErr) {
    console.error('[STRIPE WEBHOOK] Refund audit-log write failed (non-fatal):', auditErr);
  }

  // L5-A: loyalty clawback. clawbackInvoiceLoyalty is never-throws (same
  // isolation contract as finalizeInvoicePaid) — a loyalty failure cannot
  // break refund webhook processing.
  if (invoice && invoice.customerId) {
    await clawbackInvoiceLoyalty(tenantDb, {
      invoiceId: invoice.id,
      customerId: invoice.customerId,
    });
  } else if (!invoice) {
    // Cannot resolve → no-op (do NOT guess). Already warned above.
  } else {
    console.log(
      `[STRIPE WEBHOOK] Refund for invoice ${invoice.id} has no customerId; skipping loyalty clawback`,
    );
  }

  console.log(
    `[STRIPE WEBHOOK] Refund processed: charge=${charge.id} invoice=${invoice?.id ?? 'unresolved'} appointment=${appointmentIdRaw ?? 'n/a'}`,
  );
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

    // L4 Step 3A-continued: shared loyalty chokepoint. finalizeInvoicePaid is
    // never-throws, so even a loyalty failure cannot break webhook processing.
    await finalizeInvoicePaid(tenantDb, invoice);
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

    // Log billing event
    const previousPlan = tenant.planTier || 'free';
    if (previousPlan !== targetTier) {
      await logPlanChange(tenantId, previousPlan, targetTier, subscription.id, {
        priceId,
        subscriptionStatus: subscription.status,
      });
    }
    await logSubscriptionChange(
      tenantId,
      tenant.stripeSubscriptionId ? 'subscription_updated' : 'subscription_created',
      subscription.id,
      previousPlan,
      targetTier,
      { status: subscription.status, priceId }
    );

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

    // Log billing event
    const previousPlan = tenant.planTier || 'free';
    await logSubscriptionChange(tenantId, 'subscription_cancelled', subscription.id, previousPlan, 'free', {
      reason: 'subscription_deleted',
    });
    if (previousPlan !== 'free') {
      await logPlanChange(tenantId, previousPlan, 'free', subscription.id, {
        reason: 'subscription_cancelled',
      });
    }

    console.log(`[STRIPE WEBHOOK] Tenant ${tenantId} downgraded to free tier (subscription cancelled)`);
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error handling subscription deletion:', error);
  }
}

/**
 * Handle invoice payment failed (SP-6 + SP-27 enhanced dunning)
 * Updates tenant billing status, increments failed attempts, and sends dunning email
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[STRIPE WEBHOOK] Invoice payment failed:', invoice.id);

  try {
    const customerId = invoice.customer as string;
    if (!customerId) {
      console.warn('[STRIPE WEBHOOK] No customer ID in invoice');
      return;
    }

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.stripeCustomerId, customerId))
      .limit(1);

    if (!tenant) {
      console.warn(`[STRIPE WEBHOOK] No tenant found for Stripe customer ${customerId}`);
      return;
    }

    const subscriptionId = invoice.subscription as string | null;
    let subscriptionStatus: string | null = null;

    if (subscriptionId && stripe) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        subscriptionStatus = subscription.status;
      } catch (err) {
        console.warn(`[STRIPE WEBHOOK] Could not fetch subscription ${subscriptionId}`);
      }
    }

    const isTrial = tenant.status === 'trialing';
    const newStatus = mapStripeToBillingStatus(subscriptionStatus, 'past_due', isTrial);

    // SP-27: Track failed payment attempts and delinquency start date
    const currentAttempts = tenant.failedPaymentAttempts || 0;
    const newAttempts = currentAttempts + 1;
    const now = new Date();
    
    // Set delinquentSince on first failure, keep existing on subsequent failures
    const delinquentSince = tenant.delinquentSince || now;

    await updateTenantBillingStatus(tenant.id, {
      billingStatus: newStatus,
      lastInvoiceStatus: 'past_due',
      lastInvoiceDueAt: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
    });

    // Update dunning tracking fields
    await db.update(tenants)
      .set({
        failedPaymentAttempts: newAttempts,
        delinquentSince: delinquentSince,
        updatedAt: now,
      })
      .where(eq(tenants.id, tenant.id));

    await sendPaymentFailedEmail(tenant.id);

    // Log billing event with attempt count
    await logPaymentFailed(
      tenant.id,
      customerId,
      invoice.id,
      tenant.status,
      invoice.amount_due,
      { 
        invoiceNumber: invoice.number,
        failedAttempts: newAttempts,
        delinquentSince: delinquentSince.toISOString(),
      }
    );

    const wasSuspended = await checkAndApplySuspension(tenant.id);
    if (wasSuspended) {
      await logTenantSuspended(tenant.id, customerId, 'past_due', {
        reason: 'grace_period_expired',
        invoiceId: invoice.id,
        failedAttempts: newAttempts,
      });
    }

    console.log(`[STRIPE WEBHOOK] Tenant ${tenant.id} billing status updated to ${newStatus} after invoice payment failed (attempt ${newAttempts})`);
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error handling invoice payment failed:', error);
  }
}

/**
 * Handle invoice payment succeeded (SP-6 + SP-27 enhanced dunning)
 * Updates tenant billing status back to active, clears cancelAtPeriodEnd, resets dunning counters, sends recovery email
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('[STRIPE WEBHOOK] Invoice payment succeeded:', invoice.id);

  try {
    const customerId = invoice.customer as string;
    if (!customerId) {
      console.warn('[STRIPE WEBHOOK] No customer ID in invoice');
      return;
    }

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.stripeCustomerId, customerId))
      .limit(1);

    if (!tenant) {
      console.warn(`[STRIPE WEBHOOK] No tenant found for Stripe customer ${customerId}`);
      return;
    }

    const wasSuspendedOrPastDue = tenant.status === 'past_due' || tenant.status === 'suspended';
    const now = new Date();

    // SP-27: Always reset dunning tracking on successful payment
    const previousAttempts = tenant.failedPaymentAttempts || 0;
    const wasDelinquent = tenant.delinquentSince != null;

    if (wasSuspendedOrPastDue) {
      await updateTenantBillingStatus(tenant.id, {
        billingStatus: 'active',
        cancelAtPeriodEnd: false,
        lastInvoiceStatus: 'paid',
      });

      await sendPaymentRecoveredEmail(tenant.id);

      // Log billing event with recovery info
      await logPaymentRecovered(
        tenant.id,
        customerId,
        invoice.id,
        tenant.status,
        invoice.amount_paid,
        { 
          invoiceNumber: invoice.number,
          previousAttempts,
          wasDelinquent,
          recoveredFrom: tenant.status,
        }
      );

      console.log(`[STRIPE WEBHOOK] Tenant ${tenant.id} billing status restored to active after successful payment (recovered from ${previousAttempts} failed attempts)`);
    } else {
      await db.update(tenants)
        .set({
          lastInvoiceStatus: 'paid',
          cancelAtPeriodEnd: false,
          updatedAt: now,
        })
        .where(eq(tenants.id, tenant.id));
    }

    // SP-27: Reset dunning tracking fields on any successful payment
    await db.update(tenants)
      .set({
        failedPaymentAttempts: 0,
        delinquentSince: null,
        updatedAt: now,
      })
      .where(eq(tenants.id, tenant.id));

    if (previousAttempts > 0 || wasDelinquent) {
      console.log(`[STRIPE WEBHOOK] Dunning counters reset for tenant ${tenant.id} (was ${previousAttempts} attempts, delinquent: ${wasDelinquent})`);
    }
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error handling invoice payment succeeded:', error);
  }
}

export default router;
