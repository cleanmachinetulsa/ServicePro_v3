/**
 * Deposit & Invoice Management Service
 * 
 * Handles:
 * - Deposit tracking and reminders
 * - Invoice generation and delivery
 * - Payment status monitoring
 * - Automatic retry logic for failed payments
 * - Integration with Stripe payment links
 */

import type { TenantDb } from './tenantDb';
import { appointments, invoices, paymentLinks, contacts, auditLog } from "@shared/schema";
import { eq, and, or, lt, isNull } from "drizzle-orm";
import { sendSMS } from "./notifications";
import { sendBusinessEmail } from "./emailService";
import Stripe from "stripe";

const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_ENABLED ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
}) : null;

if (!STRIPE_ENABLED) {
  console.warn('[DEPOSIT MANAGER] STRIPE_SECRET_KEY not configured - deposit payment links will be disabled');
}

interface DepositReminderResult {
  sent: number;
  failed: number;
  details: { appointmentId: number; status: 'sent' | 'failed'; error?: string }[];
}

/**
 * Send deposit reminder to payer
 */
export async function sendDepositReminder(
  tenantDb: TenantDb,
  appointmentId: number,
  reminderType: 'first' | 'second' | 'final' = 'first'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch appointment
    const appt = await tenantDb.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
    });

    if (!appt) {
      return { success: false, error: 'Appointment not found' };
    }

    // Check if deposit already paid
    if (appt.depositPaid) {
      return { success: false, error: 'Deposit already paid' };
    }

    // Check if deposit is required
    if (!appt.depositAmount || appt.depositAmount <= 0) {
      return { success: false, error: 'No deposit required' };
    }

    // Fetch payer contact
    if (!appt.billingContactId) {
      return { success: false, error: 'No billing contact assigned' };
    }

    const payer = await tenantDb.query.contacts.findFirst({
      where: eq(contacts.id, appt.billingContactId),
    });

    if (!payer) {
      return { success: false, error: 'Payer contact not found' };
    }

    // Get or create payment link
    let paymentLinkRecord = await tenantDb.query.paymentLinks.findFirst({
      where: and(
        eq(paymentLinks.appointmentId, appointmentId),
        eq(paymentLinks.status, 'pending')
      ),
    });

    if (!paymentLinkRecord) {
      if (!stripe) {
        return { success: false, error: 'Payment links are not available - Stripe not configured' };
      }

      // Create new Stripe payment link
      const paymentLink = await createStripePaymentLink(appt, payer);
      
      // Store in database
      const [newLink] = await tenantDb.insert(paymentLinks).values({
        appointmentId: appt.id,
        amount: appt.depositAmount,
        description: `Deposit for ${appt.serviceType}`,
        url: paymentLink.url,
        stripePaymentLinkId: paymentLink.id,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      }).returning();

      paymentLinkRecord = newLink;
    }

    // Compose reminder message
    const urgencyMap = {
      first: 'Reminder',
      second: 'Important Reminder',
      final: 'FINAL NOTICE',
    };

    const message = `${urgencyMap[reminderType]}: Your $${appt.depositAmount.toFixed(2)} deposit is due for your ${appt.serviceType} appointment on ${new Date(appt.scheduledTime).toLocaleDateString()}. Pay now: ${paymentLinkRecord.url}`;

    // Send via SMS (primary)
    let smsSuccess = false;
    if (payer.phoneE164 && !payer.smsOptOut) {
      try {
        // Use Main Line (ID 1) for automated deposit reminders
        const smsResult = await sendSMS(tenantDb, payer.phoneE164, message, undefined, undefined, 1);
        smsSuccess = smsResult.success;
      } catch (error) {
        console.error('[DEPOSIT MGR] SMS send failed:', error);
      }
    }

    // Send via email (fallback or both)
    let emailSuccess = false;
    if (payer.email) {
      try {
        const emailResult = await sendBusinessEmail(
          tenantDb,
          payer.email,
          `Deposit Due - ${appt.serviceType}`,
          message
        );
        emailSuccess = emailResult.success;
      } catch (error) {
        console.error('[DEPOSIT MGR] Email send failed:', error);
      }
    }

    if (!smsSuccess && !emailSuccess) {
      return { success: false, error: 'Failed to send reminder via SMS or email' };
    }

    // Log reminder
    await tenantDb.insert(auditLog).values({
      actionType: 'deposit_reminder_sent',
      entityType: 'appointment',
      entityId: appointmentId,
      details: {
        reminderType,
        amount: appt.depositAmount,
        payerPhone: payer.phone,
        smsSuccess,
        emailSuccess,
      },
    });

    console.log(`[DEPOSIT MGR] Reminder sent for appointment ${appointmentId} (${reminderType})`);

    return { success: true };
  } catch (error: any) {
    console.error('[DEPOSIT MGR] Error sending deposit reminder:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Find appointments needing deposit reminders
 * Sends reminders at:
 * - 48 hours before appointment (first reminder)
 * - 24 hours before appointment (second reminder)
 * - 12 hours before appointment (final reminder)
 */
export async function processDepositReminders(tenantDb: TenantDb): Promise<DepositReminderResult> {
  const result: DepositReminderResult = {
    sent: 0,
    failed: 0,
    details: [],
  };

  try {
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    // Find appointments with unpaid deposits
    const appts = await tenantDb
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.depositPaid, false),
          eq(appointments.status, 'confirmed'),
          isNull(appointments.completedAt)
        )
      )
      .execute();

    for (const appt of appts) {
      if (!appt.depositAmount || appt.depositAmount <= 0) {
        continue;
      }

      const scheduledTime = new Date(appt.scheduledTime);
      const hoursDiff = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Determine reminder type based on time until appointment
      let reminderType: 'first' | 'second' | 'final' | null = null;

      if (hoursDiff <= 12 && hoursDiff > 0) {
        reminderType = 'final';
      } else if (hoursDiff <= 24 && hoursDiff > 12) {
        reminderType = 'second';
      } else if (hoursDiff <= 48 && hoursDiff > 24) {
        reminderType = 'first';
      }

      if (!reminderType) {
        continue;
      }

      // Check if we already sent this reminder type
      const recentLogs = await tenantDb
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.entityType, 'appointment'),
            eq(auditLog.entityId, appt.id),
            eq(auditLog.actionType, 'deposit_reminder_sent')
          )
        )
        .execute();

      const alreadySent = recentLogs.some(
        (log) => (log.details as any)?.reminderType === reminderType
      );

      if (alreadySent) {
        continue;
      }

      // Send reminder
      const sendResult = await sendDepositReminder(tenantDb, appt.id, reminderType);

      if (sendResult.success) {
        result.sent++;
        result.details.push({ appointmentId: appt.id, status: 'sent' });
      } else {
        result.failed++;
        result.details.push({
          appointmentId: appt.id,
          status: 'failed',
          error: sendResult.error,
        });
      }
    }

    console.log(`[DEPOSIT MGR] Processed ${result.sent + result.failed} reminders (${result.sent} sent, ${result.failed} failed)`);
  } catch (error: any) {
    console.error('[DEPOSIT MGR] Error processing reminders:', error);
  }

  return result;
}

/**
 * Create Stripe payment link for deposit
 */
async function createStripePaymentLink(
  appointment: any,
  payer: any
): Promise<{ id: string; url: string }> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Create Stripe price
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(appointment.depositAmount * 100), // Convert to cents
      product_data: {
        name: `Deposit - ${appointment.serviceType}`,
        description: `Deposit for appointment on ${new Date(appointment.scheduledTime).toLocaleDateString()}`,
      },
    });

    // Create payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      metadata: {
        appointmentId: appointment.id.toString(),
        type: 'deposit',
        payerContactId: payer.id.toString(),
      },
      after_completion: {
        type: 'hosted_confirmation',
        hosted_confirmation: {
          custom_message: 'Thank you! Your deposit has been received. We look forward to serving you!',
        },
      },
    });

    return {
      id: paymentLink.id,
      url: paymentLink.url,
    };
  } catch (error: any) {
    console.error('[DEPOSIT MGR] Error creating Stripe payment link:', error);
    throw error;
  }
}

/**
 * Generate invoice for completed appointment
 */
export async function generateInvoice(tenantDb: TenantDb, appointmentId: number): Promise<{ invoiceId: number; url: string }> {
  try {
    const appt = await tenantDb.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
    });

    if (!appt) {
      throw new Error('Appointment not found');
    }

    if (!appt.completedAt) {
      throw new Error('Appointment not completed yet');
    }

    // Check if invoice already exists
    const existingInvoice = await tenantDb.query.invoices.findFirst({
      where: eq(invoices.appointmentId, appointmentId),
    });

    if (existingInvoice) {
      return {
        invoiceId: existingInvoice.id,
        url: `/invoices/${existingInvoice.id}`,
      };
    }

    // Calculate totals
    const subtotal = appt.estimatedPrice || 0;
    const tax = subtotal * 0.08; // 8% tax (adjust as needed)
    const total = subtotal + tax;
    const depositPaid = appt.depositPaid ? appt.depositAmount || 0 : 0;
    const balanceDue = total - depositPaid;

    // Create invoice
    const [newInvoice] = await tenantDb.insert(invoices).values({
      appointmentId: appt.id,
      billToContactId: appt.billingContactId,
      subtotal,
      taxAmount: tax,
      totalAmount: total,
      depositPaid,
      balanceDue,
      status: balanceDue > 0 ? 'pending' : 'paid',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    }).returning();

    // Log invoice creation
    await tenantDb.insert(auditLog).values({
      actionType: 'invoice_created',
      entityType: 'invoice',
      entityId: newInvoice.id,
      details: {
        appointmentId,
        total,
        balanceDue,
      },
    });

    console.log(`[DEPOSIT MGR] Invoice ${newInvoice.id} created for appointment ${appointmentId}`);

    return {
      invoiceId: newInvoice.id,
      url: `/invoices/${newInvoice.id}`,
    };
  } catch (error: any) {
    console.error('[DEPOSIT MGR] Error generating invoice:', error);
    throw error;
  }
}

/**
 * Mark deposit as paid
 */
export async function markDepositPaid(
  tenantDb: TenantDb,
  appointmentId: number,
  stripePaymentIntentId?: string
): Promise<{ success: boolean }> {
  try {
    // Update appointment
    await tenantDb
      .update(appointments)
      .set({
        depositPaid: true,
        priceLocked: true,
        priceLockedAmount: (await tenantDb.query.appointments.findFirst({
          where: eq(appointments.id, appointmentId)
        }))?.estimatedPrice,
      })
      .where(eq(appointments.id, appointmentId))
      .execute();

    // Update payment link status
    await tenantDb
      .update(paymentLinks)
      .set({
        status: 'paid',
        paidAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(paymentLinks.appointmentId, appointmentId),
          eq(paymentLinks.status, 'pending')
        )
      )
      .execute();

    // Log payment
    await tenantDb.insert(auditLog).values({
      actionType: 'deposit_paid',
      entityType: 'appointment',
      entityId: appointmentId,
      details: {
        stripePaymentIntentId,
        priceLocked: true,
      },
    });

    console.log(`[DEPOSIT MGR] Deposit marked as paid for appointment ${appointmentId}`);

    return { success: true };
  } catch (error: any) {
    console.error('[DEPOSIT MGR] Error marking deposit paid:', error);
    return { success: false };
  }
}
