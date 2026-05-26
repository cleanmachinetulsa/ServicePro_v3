import Stripe from 'stripe';
import { Request, Response } from 'express';
import type { TenantDb } from './tenantDb';
import { invoices, redeemedRewards, loyaltyTransactions } from '@shared/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { sendInvoiceNotification, sendReviewRequest } from './invoiceService';
import { checkAndRewardReferral } from './referralService';
import { addLoyaltyPointsFromInvoice } from './loyaltyService';
import { applyReservation, adjust as ledgerAdjust } from './services/loyaltyLedger';

const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;

if (!STRIPE_ENABLED) {
  console.warn('[STRIPE] STRIPE_SECRET_KEY not found in paymentHandler, payment webhooks will be disabled');
}

const stripe = STRIPE_ENABLED ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
}) : null;

/**
 * L4 Step 3A-continued — shared invoice-finalization chokepoint.
 *
 * All four invoice-finalization paths (markInvoiceAsPaid, handleStripeWebhook,
 * routes.stripeWebhooks.markInvoicePaid, tech job-completion) call this AFTER
 * the invoice row has been UPDATE'd to paid.
 *
 * Responsibilities (today): award loyalty points on the pre-tax subtotal
 * (falling back to amount for legacy invoices). 3B will add redemption
 * applyReservation here too.
 *
 * Contract: NEVER throws. Loyalty must NOT roll back or fail payment
 * finalization. The ledger dedupes on idempotency key
 * `invoice:${invoiceId}:${customerId}` so concurrent paths can't double-award.
 *
 * IMPORTANT: addLoyaltyPointsFromInvoice -> ledger.earn() opens its OWN
 * transaction via tenantDb.transaction(). Callers that are themselves inside a
 * db.transaction() MUST call this AFTER their transaction commits — otherwise
 * the inner transaction acquires a separate pool connection and can deadlock
 * against row locks held by the outer transaction.
 */
export async function finalizeInvoicePaid(
  tenantDb: TenantDb,
  invoice: {
    id: number;
    customerId: number | null;
    subtotal?: string | number | null;
    amount?: string | number | null;
    appointmentId?: number | null;
  },
): Promise<void> {
  // ── Block A: loyalty point award (L4 Step 3A) ────────────────────────────
  try {
    if (!invoice.customerId) return;
    const earnBasis = Number(invoice.subtotal ?? invoice.amount ?? 0);
    await addLoyaltyPointsFromInvoice(
      tenantDb,
      invoice.customerId,
      invoice.id,
      earnBasis,
    );
    console.log(
      `[PAYMENT] finalizeInvoicePaid: loyalty award attempted for invoice ${invoice.id} (basis: $${earnBasis})`,
    );
  } catch (loyaltyError) {
    console.error(
      `[PAYMENT] finalizeInvoicePaid: loyalty failure for invoice ${invoice.id} (non-fatal):`,
      loyaltyError,
    );
  }

  // ── Block B: redemption application (L4 Step 3B) ─────────────────────────
  // Independent try/catch from Block A — a redemption failure must not affect
  // the point award (or vice versa) and must NEVER throw out of this function.
  //
  // Matching strategy (HYBRID, decided in Step 1 investigation):
  //   1. If invoice.appointmentId is set AND a pending/scheduled reservation
  //      exists with the same appointmentId → use it (deterministic; the
  //      forward path once reserve() begins binding to appointments).
  //   2. Otherwise fall back to customerId + status in ('pending','scheduled').
  //      If multiple rows match (customer claimed two rewards, one invoice),
  //      pick the OLDEST by redeemedDate (FIFO, closer to expiry) and log a
  //      warning so the ambiguity is observable.
  //
  // applyReservation is idempotent (its own state-machine + idempotencyKey),
  // so concurrent paths finalizing the same invoice cannot double-apply.
  try {
    if (!invoice.customerId) return;
    const tenantId = tenantDb.tenant.id;

    // Step 1: try appointment-scoped match first.
    let reservation: { id: number; redeemedDate: Date | null } | null = null;
    if (typeof invoice.appointmentId === 'number') {
      const [byAppt] = await tenantDb
        .select({ id: redeemedRewards.id, redeemedDate: redeemedRewards.redeemedDate })
        .from(redeemedRewards)
        .where(
          and(
            eq(redeemedRewards.tenantId, tenantId),
            eq(redeemedRewards.customerId, invoice.customerId),
            eq(redeemedRewards.appointmentId, invoice.appointmentId),
            inArray(redeemedRewards.status, ['pending', 'scheduled']),
          ),
        )
        .orderBy(asc(redeemedRewards.redeemedDate))
        .limit(1);
      if (byAppt) reservation = byAppt;
    }

    // Step 2: fall back to customer-scoped FIFO match.
    if (!reservation) {
      const matches = await tenantDb
        .select({ id: redeemedRewards.id, redeemedDate: redeemedRewards.redeemedDate })
        .from(redeemedRewards)
        .where(
          and(
            eq(redeemedRewards.tenantId, tenantId),
            eq(redeemedRewards.customerId, invoice.customerId),
            inArray(redeemedRewards.status, ['pending', 'scheduled']),
          ),
        )
        .orderBy(asc(redeemedRewards.redeemedDate))
        .limit(2);
      if (matches.length > 1) {
        console.warn(
          `[PAYMENT] finalizeInvoicePaid: invoice ${invoice.id} customer ${invoice.customerId} has ${matches.length}+ pending reservations; consuming oldest (FIFO) reservation ${matches[0]!.id}. ` +
            `If this isn't the intended reservation, support can cancel and re-apply.`,
        );
      }
      reservation = matches[0] ?? null;
    }

    // No pending reservation → most invoices have none. Not an error.
    if (!reservation) return;

    const result = await applyReservation(tenantDb, {
      tenantId,
      reservationId: reservation.id,
      invoiceId: invoice.id,
      idempotencyKey: `apply:invoice:${invoice.id}:reservation:${reservation.id}`,
    });

    if (result.success) {
      console.log(
        `[PAYMENT] finalizeInvoicePaid: redemption applied for invoice ${invoice.id} (reservation ${reservation.id}, alreadyApplied=${result.alreadyApplied})`,
      );
    } else {
      // applyReservation returned a structured error — log but do not throw.
      console.warn(
        `[PAYMENT] finalizeInvoicePaid: redemption apply failed for invoice ${invoice.id} (reservation ${reservation.id}): ${result.error ?? 'unknown'}`,
      );
    }
  } catch (redemptionError) {
    console.error(
      `[PAYMENT] finalizeInvoicePaid: redemption failure for invoice ${invoice.id} (non-fatal):`,
      redemptionError,
    );
  }
}

/**
 * L5-A — Refund clawback chokepoint.
 *
 * Reverses loyalty points originally awarded by an invoice when that invoice is
 * refunded (full or partial — see partial-refund note below). Mirrors the
 * isolation contract of finalizeInvoicePaid: NEVER throws. A clawback failure
 * must not break the Stripe refund webhook.
 *
 * Lookup: the original earn row in loyalty_transactions is keyed by
 *   promoKey = `invoice:${invoiceId}:${customerId}`
 *   source  = 'invoice'
 *   status  = 'fulfilled'
 * (set by ledger.earn() via loyaltyService.addLoyaltyPointsFromInvoice).
 *
 * No earn row → clean no-op (customer wasn't enrolled, not eligible, or the
 * earn never happened). Not an error.
 *
 * Reversal: delegate to ledger.adjust() with a negative delta equal to the
 * original pointsAwarded (fall back to deltaPoints if pointsAwarded is null).
 * adjust() already clamps so the balance never goes below 0 — if the customer
 * already spent some/all of the awarded points, the clawback simply removes
 * whatever they still have. We rely on that clamp; no separate logic here.
 *
 * Idempotency: key is `clawback:invoice:${invoiceId}:${customerId}`. Stripe
 * can replay charge.refunded; adjust()'s promoKey dedupe makes that safe.
 *
 * Partial refunds: this function does a FULL clawback regardless of refund
 * amount — a refunded service didn't earn its points. Proportional clawback
 * (e.g. refund 30% → claw back 30% of points) is flagged as a follow-up but
 * intentionally not built here.
 */
export async function clawbackInvoiceLoyalty(
  tenantDb: TenantDb,
  args: { invoiceId: number; customerId: number },
): Promise<void> {
  const { invoiceId, customerId } = args;
  try {
    const tenantId = tenantDb.tenant.id;
    const promoKey = `invoice:${invoiceId}:${customerId}`;

    // Locate the original earn row (indexed on tenantId+customerId+promoKey).
    const [earnRow] = await tenantDb
      .select({
        id: loyaltyTransactions.id,
        deltaPoints: loyaltyTransactions.deltaPoints,
        pointsAwarded: loyaltyTransactions.pointsAwarded,
      })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, tenantId),
          eq(loyaltyTransactions.customerId, customerId),
          eq(loyaltyTransactions.promoKey, promoKey),
          eq(loyaltyTransactions.source, 'invoice'),
          eq(loyaltyTransactions.status, 'fulfilled'),
        ),
      )
      .limit(1);

    if (!earnRow) {
      console.log(
        `[PAYMENT] clawbackInvoiceLoyalty: no earn row for invoice ${invoiceId} customer ${customerId} (no-op — customer may not have earned points on this invoice)`,
      );
      return;
    }

    const originalAwarded = earnRow.pointsAwarded ?? earnRow.deltaPoints;
    if (!originalAwarded || originalAwarded <= 0) {
      console.warn(
        `[PAYMENT] clawbackInvoiceLoyalty: earn row ${earnRow.id} for invoice ${invoiceId} has non-positive pointsAwarded (${originalAwarded}); skipping clawback`,
      );
      return;
    }

    const result = await ledgerAdjust(tenantDb, {
      tenantId,
      customerId,
      delta: -originalAwarded,
      reason: `Clawback: invoice #${invoiceId} refunded`,
      actorId: null,
      idempotencyKey: `clawback:invoice:${invoiceId}:${customerId}`,
      metadata: { invoiceId, originalEarnTransactionId: earnRow.id, originalAwarded },
    });

    if (!result.success) {
      console.warn(
        `[PAYMENT] clawbackInvoiceLoyalty: ledger.adjust failed for invoice ${invoiceId} customer ${customerId} (non-fatal)`,
      );
      return;
    }

    if (result.alreadyApplied) {
      console.log(
        `[PAYMENT] clawbackInvoiceLoyalty: invoice ${invoiceId} customer ${customerId} already clawed back (idempotent replay) — new balance ${result.newBalance}`,
      );
    } else {
      console.log(
        `[PAYMENT] clawbackInvoiceLoyalty: clawed back ${originalAwarded} points for invoice ${invoiceId} customer ${customerId}` +
          (result.clamped ? ' (CLAMPED — customer balance was insufficient, clawback reduced to land balance at 0)' : '') +
          ` — new balance ${result.newBalance}`,
      );
    }
  } catch (clawbackError) {
    console.error(
      `[PAYMENT] clawbackInvoiceLoyalty: failure for invoice ${invoiceId} customer ${customerId} (non-fatal):`,
      clawbackError,
    );
  }
}

/**
 * Create a Stripe payment intent for an invoice
 */
export async function createStripePaymentIntent(req: Request, res: Response) {
  try {
    if (!STRIPE_ENABLED || !stripe) {
      return res.status(503).json({ error: 'Payment processing is not available. Please configure STRIPE_SECRET_KEY.' });
    }

    const tenantDb = (req as any).tenantDb as TenantDb;
    const { invoiceId } = req.params;
    
    // Fetch the invoice details
    const [invoice] = await tenantDb
      .select()
      .from(invoices)
      .where(tenantDb.withTenantFilter(invoices, eq(invoices.id, parseInt(invoiceId))));
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // If already paid, return an error
    if (invoice.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Invoice already paid' });
    }
    
    // Convert amount to cents (Stripe works with smallest currency unit)
    const amountInCents = Math.round(Number(invoice.amount) * 100);
    
    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        invoiceId: invoiceId,
      },
    });
    
    // Update the invoice with the payment intent ID
    await tenantDb
      .update(invoices)
      .set({ stripePaymentIntentId: paymentIntent.id })
      .where(tenantDb.withTenantFilter(invoices, eq(invoices.id, parseInt(invoiceId))));
    
    // Return the client secret to the client
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      invoiceDetails: {
        id: invoice.id,
        amount: invoice.amount,
        description: invoice.serviceDescription,
        status: invoice.paymentStatus,
      }
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  if (!STRIPE_ENABLED || !stripe) {
    return res.status(503).json({ error: 'Payment webhooks are not available. Please configure STRIPE_SECRET_KEY.' });
  }

  const tenantDb = (req as any).tenantDb as TenantDb;
  const sig = req.headers['stripe-signature'] as string;
  
  const { rejectIfProduction } = await import('./services/webhookVerifierPolicy');

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    if (!rejectIfProduction(res, { provider: 'stripe', reason: 'missing_secret' })) return;
    // Dev soft-pass: accept body as-is.
  }

  let event;

  try {
    event = process.env.STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
      : req.body;
    
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const invoiceId = paymentIntent.metadata.invoiceId;
        
        // Update invoice status with both legacy and new payment status fields
        const [paidInvoice] = await tenantDb
          .update(invoices)
          .set({
            status: 'paid',          // Legacy field - backward compatibility
            paymentStatus: 'paid',   // Primary payment status field
            paymentMethod: 'stripe',
            paidAt: new Date(),
          })
          .where(tenantDb.withTenantFilter(invoices, eq(invoices.id, parseInt(invoiceId))))
          .returning();
        
        console.log(`Invoice ${invoiceId} marked as paid via Stripe`);
        
        // Check if this customer was referred and reward the referrer
        // This triggers when the referee completes their first service via Stripe payment
        if (paidInvoice && paidInvoice.customerId) {
          try {
            const referralResult = await checkAndRewardReferral(
              paidInvoice.customerId,
              paidInvoice.id  // Pass invoice ID for validation
            );
            
            if (referralResult.success) {
              console.log(`Referral reward awarded via Stripe: ${referralResult.pointsAwarded} points for customer ${paidInvoice.customerId}`);
            }
          } catch (referralError) {
            // Log error but don't fail the payment processing
            console.error('Error processing referral reward (Stripe):', referralError);
          }
        }

        // L4 Step 3A-continued: shared loyalty chokepoint.
        if (paidInvoice) {
          await finalizeInvoicePaid(tenantDb, paidInvoice);
        }
        break;
        
      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

/**
 * Mark an invoice as paid with a non-Stripe payment method
 */
export async function markInvoiceAsPaid(req: Request, res: Response) {
  try {
    const tenantDb = (req as any).tenantDb as TenantDb;
    const { invoiceId } = req.params;
    const { paymentMethod } = req.body;
    
    if (!paymentMethod || !['venmo', 'cashapp', 'paypal', 'cash', 'check'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }
    
    // Update the invoice with both legacy and new payment status fields
    const [updatedInvoice] = await tenantDb
      .update(invoices)
      .set({
        status: 'paid',          // Legacy field - backward compatibility
        paymentStatus: 'paid',   // Primary payment status field
        paymentMethod,
        paidAt: new Date(),
      })
      .where(tenantDb.withTenantFilter(invoices, eq(invoices.id, parseInt(invoiceId))))
      .returning();
    
    if (!updatedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Check if this customer was referred and reward the referrer
    // This triggers when the referee completes their first service
    if (updatedInvoice.customerId) {
      try {
        const referralResult = await checkAndRewardReferral(
          updatedInvoice.customerId,
          updatedInvoice.id  // Pass invoice ID for validation
        );
        
        if (referralResult.success) {
          console.log(`Referral reward awarded: ${referralResult.pointsAwarded} points for customer ${updatedInvoice.customerId}`);
        }
      } catch (referralError) {
        // Log error but don't fail the payment
        console.error('Error processing referral reward:', referralError);
      }
    }
    
    // Trigger post-payment automations (review request, receipt email, loyalty points)
    try {
      await sendReviewRequest(tenantDb.tenant.id, tenantDb, updatedInvoice.id);
      console.log(`[PAYMENT] Review request sent for invoice ${updatedInvoice.id}`);
    } catch (error) {
      console.error('[PAYMENT] Error sending review request:', error);
      // Don't fail the payment if review request fails
    }

    // L4 Step 3A-continued: route through the shared finalizeInvoicePaid
    // chokepoint so every payment-method path awards loyalty consistently.
    await finalizeInvoicePaid(tenantDb, updatedInvoice);

    res.status(200).json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
}

/**
 * Get payment details and options for an invoice
 */
export async function getPaymentDetails(req: Request, res: Response) {
  try {
    const tenantDb = (req as any).tenantDb as TenantDb;
    const { invoiceId } = req.params;
    
    // Fetch the invoice with customer details
    const [invoiceData] = await tenantDb.execute(`
      SELECT 
        i.id, i.amount, i.service_description, i.payment_status as status, i.payment_method,
        c.name as customer_name, c.phone as customer_phone
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = $1 AND i.tenant_id = $2
    `, [invoiceId, tenantDb.tenant.id]);
    
    if (!invoiceData || invoiceData.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Format payment options
    const paymentOptions = {
      stripe: {
        name: 'Credit/Debit Card',
        url: `/pay/${invoiceId}`,
      },
      venmo: {
        name: 'Venmo',
        account: process.env.VENMO_USERNAME || '',
      },
      cashapp: {
        name: 'CashApp',
        account: process.env.CASHAPP_USERNAME || '',
      },
      paypal: {
        name: 'PayPal',
        account: process.env.PAYPAL_USERNAME || '',
      },
    };
    
    res.status(200).json({
      invoice: invoiceData[0],
      paymentOptions,
    });
  } catch (error) {
    console.error('Error getting payment details:', error);
    res.status(500).json({ error: 'Failed to get payment details' });
  }
}

/**
 * Send a payment reminder for unpaid invoices
 */
export async function sendPaymentReminder(req: Request, res: Response) {
  try {
    const tenantDb = (req as any).tenantDb as TenantDb;
    const { invoiceId } = req.params;
    
    // Check if invoice exists and is unpaid
    const [invoice] = await tenantDb
      .select()
      .from(invoices)
      .where(tenantDb.withTenantFilter(invoices, eq(invoices.id, parseInt(invoiceId))));
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    if (invoice.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Invoice already paid' });
    }
    
    // Send notification
    const success = await sendInvoiceNotification(tenantDb.tenant.id, tenantDb, invoice.id, 'both');
    
    if (success) {
      res.status(200).json({ success: true, message: 'Payment reminder sent' });
    } else {
      res.status(500).json({ error: 'Failed to send payment reminder' });
    }
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    res.status(500).json({ error: 'Failed to send payment reminder' });
  }
}