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
import { db } from './db';
import { appointments, paymentLinks, auditLog, invoices } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { markDepositPaid } from './depositManager';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Store processed event IDs to prevent duplicate processing
const processedEvents = new Set<string>();

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
router.post('/api/webhooks/stripe', async (req: Request, res: Response) => {
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
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // Log webhook event
    await db.insert(auditLog).values({
      actionType: 'stripe_webhook_received',
      entityType: 'payment',
      details: {
        eventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
      },
    });

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[STRIPE WEBHOOK] Error processing event:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
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
    await markInvoicePaid(parseInt(appointmentId), session.payment_intent as string);

    console.log(`[STRIPE WEBHOOK] Balance paid for appointment ${appointmentId}`);
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('[STRIPE WEBHOOK] Payment intent succeeded:', paymentIntent.id);

  const appointmentId = paymentIntent.metadata?.appointmentId;
  const type = paymentIntent.metadata?.type;

  if (!appointmentId) {
    console.warn('[STRIPE WEBHOOK] No appointmentId in metadata');
    return;
  }

  // Update payment link status
  await db
    .update(paymentLinks)
    .set({
      status: 'paid',
      paidAt: new Date().toISOString(),
      stripePaymentIntentId: paymentIntent.id,
    })
    .where(
      and(
        eq(paymentLinks.appointmentId, parseInt(appointmentId)),
        eq(paymentLinks.status, 'pending')
      )
    )
    .execute();

  console.log(`[STRIPE WEBHOOK] Payment link updated for appointment ${appointmentId}`);
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('[STRIPE WEBHOOK] Payment intent failed:', paymentIntent.id);

  const appointmentId = paymentIntent.metadata?.appointmentId;

  if (!appointmentId) {
    console.warn('[STRIPE WEBHOOK] No appointmentId in metadata');
    return;
  }

  // Update payment link status
  await db
    .update(paymentLinks)
    .set({
      status: 'failed',
      failureReason: paymentIntent.last_payment_error?.message,
    })
    .where(
      and(
        eq(paymentLinks.appointmentId, parseInt(appointmentId)),
        eq(paymentLinks.status, 'pending')
      )
    )
    .execute();

  // Log failure
  await db.insert(auditLog).values({
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
async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log('[STRIPE WEBHOOK] Charge refunded:', charge.id);

  const appointmentId = charge.metadata?.appointmentId;

  if (!appointmentId) {
    console.warn('[STRIPE WEBHOOK] No appointmentId in metadata');
    return;
  }

  // Log refund
  await db.insert(auditLog).values({
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
  appointmentId: number,
  stripePaymentIntentId: string
): Promise<void> {
  try {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.appointmentId, appointmentId));

    if (!invoice) {
      console.warn(`[STRIPE WEBHOOK] Invoice not found for appointment ${appointmentId}`);
      return;
    }

    // Update invoice with both legacy and new payment status fields
    await db
      .update(invoices)
      .set({
        status: 'paid',                    // Legacy field - backward compatibility
        paymentStatus: 'paid',             // Primary payment status field
        paymentMethod: 'Stripe',           // Payment method
        paidAt: new Date(),                // Payment timestamp
        stripePaymentIntentId,             // Stripe payment intent ID
      })
      .where(eq(invoices.id, invoice.id));

    // Log payment
    await db.insert(auditLog).values({
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

export default router;
