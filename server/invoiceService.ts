import { db } from './db';
import { invoices, appointments, customers, services, loyaltyPoints, referrals, type Invoice, type InsertInvoice } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { sendBusinessEmail } from './emailService';
import { sendSMS } from './notifications';
import { renderInvoiceEmail, renderInvoiceEmailPlainText, type InvoiceEmailData } from './emailTemplates/invoice';
import { signPayToken } from './security/paylink';
import { applyRefereeReward, calculateInvoiceWithReferralDiscount, markReferralDiscountApplied } from './referralService';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-04-30.basil",
});

/**
 * Create an invoice for a completed appointment
 */
export async function createInvoice(appointmentId: number): Promise<Invoice> {
  // Get appointment details with customer and service info
  const [appointmentWithDetails] = await db
    .select({
      appointment: appointments,
      customer: customers,
      service: services,
    })
    .from(appointments)
    .leftJoin(customers, eq(appointments.customerId, customers.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(eq(appointments.id, appointmentId));

  if (!appointmentWithDetails) {
    throw new Error(`Appointment with ID ${appointmentId} not found`);
  }

  const { appointment, customer, service } = appointmentWithDetails;

  if (!customer || !service) {
    throw new Error('Customer or service not found for appointment');
  }

  // Parse the price range to get a specific amount
  // Format is typically "$X - $Y", "$X.XX - $Y.YY", or "$Z"
  const priceText = service.priceRange;
  // Updated regex to support decimals: matches "$149.99 - $199.99" or "$50"
  const priceMatch = priceText.match(/\$(\d+(?:\.\d{1,2})?)(?:\s*-\s*\$(\d+(?:\.\d{1,2})?))?/);
  
  let amount;
  if (priceMatch) {
    if (priceMatch[2]) {
      // If there's a range, use the higher value
      amount = parseFloat(priceMatch[2]);
    } else {
      // If there's a single value
      amount = parseFloat(priceMatch[1]);
    }
  } else {
    // Fallback if we can't parse the price - log warning
    console.warn(`[INVOICE] Unable to parse price range: ${priceText}`);
    amount = 0;
  }

  // Create service description
  const serviceDescription = `${service.name} - ${service.overview}`;

  // ATOMIC TRANSACTION: Apply referee reward, calculate discount, create invoice, mark reward as applied
  const invoice = await db.transaction(async (tx) => {
    // Check for referral signup and apply referee reward
    try {
      const [referralRecord] = await tx
        .select()
        .from(referrals)
        .where(
          and(
            eq(referrals.refereeCustomerId, customer.id),
            eq(referrals.status, 'signed_up')
          )
        )
        .limit(1);

      if (referralRecord) {
        console.log(`[REFERRAL] Found referral record ${referralRecord.id} for customer ${customer.id}, applying referee reward`);
        
        // Apply referee reward within transaction (creates pending reward_audit)
        const rewardResult = await applyRefereeReward(referralRecord.id, customer.id, tx);
        
        if (rewardResult.success) {
          console.log(`[REFERRAL] Successfully applied referee reward: ${rewardResult.message}`);
        } else {
          console.warn(`[REFERRAL] Failed to apply referee reward: ${rewardResult.message}`);
          // Don't throw - continue with invoice creation even if reward fails
        }
      }
    } catch (referralError) {
      console.error('[REFERRAL] Error checking/applying referee reward:', referralError);
      // Don't throw - continue with invoice creation even if referral reward fails
    }

    // Calculate final amount with any pending referral discounts (within transaction)
    const { finalAmount, discount, discountType, rewardAuditId } = await calculateInvoiceWithReferralDiscount(
      amount,
      customer.id,
      tx  // Pass transaction executor
    );

    // Create the invoice with discounted amount if applicable
    const newInvoice: InsertInvoice = {
      appointmentId,
      customerId: customer.id,
      amount: finalAmount.toString(),
      serviceDescription,
      notes: discount > 0 
        ? `Service completed at ${customer.address || appointment.address}\nReferral ${discountType} applied: -$${discount.toFixed(2)} (Original: $${amount.toFixed(2)})`
        : `Service completed at ${customer.address || appointment.address}`,
    };

    const [createdInvoice] = await tx
      .insert(invoices)
      .values(newInvoice)
      .returning();

    // Mark referral discount as applied if one was used (within transaction)
    if (rewardAuditId && discount > 0) {
      await markReferralDiscountApplied(rewardAuditId, createdInvoice.id, tx);  // Pass transaction executor
      console.log(`[REFERRAL] Marked reward_audit ${rewardAuditId} as applied to invoice ${createdInvoice.id}`);
    }

    return createdInvoice;
  });

  return invoice;
}

/**
 * Create a manual invoice (dashboard flow - no appointment)
 * Looks up or creates customer, then creates invoice record
 */
export async function createManualInvoice(params: {
  customerPhone: string;
  customerEmail?: string;
  customerName: string;
  amount: number;
  serviceDescription: string;
  notes?: string;
}): Promise<Invoice> {
  const { customerPhone, customerEmail, customerName, amount, serviceDescription, notes } = params;

  let customer = await db.query.customers.findFirst({
    where: eq(customers.phone, customerPhone),
  });

  if (!customer) {
    if (customerEmail) {
      customer = await db.query.customers.findFirst({
        where: eq(customers.email, customerEmail),
      });
    }
  }

  if (!customer) {
    const [newCustomer] = await db
      .insert(customers)
      .values({
        name: customerName,
        phone: customerPhone,
        email: customerEmail || null,
        smsConsent: false,
      })
      .returning();
    
    customer = newCustomer;
  }

  const newInvoice: InsertInvoice = {
    customerId: customer.id,
    appointmentId: null,
    invoiceType: 'manual',
    amount: amount.toString(),
    serviceDescription,
    notes: notes || `Manual invoice created via dashboard`,
  };

  const [invoice] = await db
    .insert(invoices)
    .values(newInvoice)
    .returning();

  return invoice;
}

/**
 * Get invoice details by ID
 */
export async function getInvoice(invoiceId: number): Promise<Invoice | undefined> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));
  
  return invoice;
}

/**
 * Create a Stripe payment intent for an invoice
 */
export async function createStripePaymentIntent(invoiceId: number): Promise<string> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice with ID ${invoiceId} not found`);
  }

  const amountInCents = Math.round(Number(invoice.amount) * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    metadata: {
      invoiceId: invoice.id.toString(),
    },
  });

  // Update the invoice with the payment intent ID
  await db
    .update(invoices)
    .set({ stripePaymentIntentId: paymentIntent.id })
    .where(eq(invoices.id, invoiceId));

  return paymentIntent.client_secret as string;
}

/**
 * Update invoice payment status
 */
export async function updateInvoicePaymentStatus(
  invoiceId: number,
  status: 'paid' | 'unpaid',
  paymentMethod?: string
): Promise<Invoice> {
  const [updatedInvoice] = await db
    .update(invoices)
    .set({
      status, // Legacy field - kept for backward compatibility
      paymentStatus: status, // Primary payment status field
      paymentMethod,
      paidAt: status === 'paid' ? new Date() : null,
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  return updatedInvoice;
}

/**
 * Mark review request as sent for an invoice
 */
export async function markReviewRequested(invoiceId: number): Promise<Invoice> {
  const [updatedInvoice] = await db
    .update(invoices)
    .set({
      reviewRequestSent: true,
      reviewRequestedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  return updatedInvoice;
}

/**
 * Mark an appointment as completed and generate an invoice
 */
export async function completeAppointmentAndGenerateInvoice(
  appointmentId: number
): Promise<Invoice> {
  // First mark the appointment as completed
  await db
    .update(appointments)
    .set({ completed: true })
    .where(eq(appointments.id, appointmentId));

  // Then create and return the invoice
  return createInvoice(appointmentId);
}

/**
 * Send invoice notification to customer
 */
export async function sendInvoiceNotification(
  invoiceId: number,
  platform: 'sms' | 'email' | 'both'
): Promise<boolean> {
  // Get invoice with customer and appointment details
  const [invoiceDetails] = await db
    .select({
      invoice: invoices,
      customer: customers,
      appointment: appointments,
      service: services,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(appointments, eq(invoices.appointmentId, appointments.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(eq(invoices.id, invoiceId));

  if (!invoiceDetails) {
    throw new Error('Invoice details not found');
  }

  const { invoice, customer, service, appointment } = invoiceDetails;

  if (!customer || !service) {
    throw new Error('Customer or service not found for invoice');
  }
  
  // Get customer's current loyalty points balance
  const [loyaltyRecord] = await db
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customer.id))
    .limit(1);
  
  const currentPoints = loyaltyRecord?.points || 0;
  
  // Construct payment options message
  const paymentOptions = `
Payment Options:
1. Card Payment via Stripe: ${process.env.CLIENT_BASE_URL || 'https://cleanmachine-detailer.replit.app'}/pay/${invoice.id}
2. Venmo: ${process.env.VENMO_USERNAME || '@cleanmachinetulsa'}
3. CashApp: ${process.env.CASHAPP_USERNAME || '$CleanMachineTulsa'}
4. PayPal: CleanMachineTulsa
`;

  // Build messages based on platform
  let success = true;

  if (platform === 'sms' || platform === 'both') {
    // Only send SMS if customer has a phone number
    if (customer.phone) {
      // SMS version - concise but warm
      const smsMessage = `Thank you for choosing Clean Machine Auto Detail! 
Your ${service.name} service is complete.
Amount due: $${invoice.amount}

${paymentOptions}

We'd love to hear your feedback! Please leave a review:
Google: https://g.page/r/CQo53O2yXrN8EBM/review
Facebook: https://www.facebook.com/CLEANMACHINETULSA

Thanks for trusting us with your vehicle!`;

      try {
        await sendSMS(customer.phone, smsMessage);
      } catch (error) {
        console.error('Error sending SMS invoice notification:', error);
        success = false;
      }
    } else {
      console.warn(`Customer ${customer.id} has no phone number, skipping SMS`);
    }
  }

  if (platform === 'email' || platform === 'both') {
    if (customer.email) {
      try {
        // Generate secure HMAC-signed payment link (fallback to unencrypted if secret missing)
        const baseUrl = process.env.CLIENT_BASE_URL || 'https://clean-machine-chatbot-cleanmachinetul.replit.app';
        let paymentLink: string;
        
        try {
          const paymentToken = signPayToken(invoice.id);
          paymentLink = `${baseUrl}/pay/${paymentToken}`;
        } catch (hmacError) {
          console.warn('PAYLINK_SECRET not set, using fallback payment link:', hmacError);
          paymentLink = `${baseUrl}/pay/${invoice.id}`;
        }
        
        // Calculate points earned (10% of invoice amount)
        const pointsEarned = Math.floor(parseFloat(invoice.amount) * 0.1);
        const newBalance = currentPoints + pointsEarned;
        
        // Build vehicle info string from appointment if available
        let vehicleInfo: string | undefined;
        if (appointment?.vehicleMake || appointment?.vehicleModel) {
          const parts = [
            appointment.vehicleMake || '',
            appointment.vehicleModel || ''
          ].filter(p => p);
          vehicleInfo = parts.length > 0 ? parts.join(' ') : undefined;
        }
        
        // Prepare invoice email data
        const invoiceEmailData: InvoiceEmailData = {
          invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoice.id).padStart(6, '0')}`,
          customerName: customer.name || 'Valued Customer',
          customerEmail: customer.email,
          customerPhone: customer.phone || '',
          serviceDate: appointment?.scheduledTime 
            ? new Date(appointment.scheduledTime).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }),
          vehicleInfo: vehicleInfo,
          items: [
            {
              service: service.name,
              quantity: 1,
              price: parseFloat(invoice.amount)
            }
          ],
          subtotal: parseFloat(invoice.amount),
          tax: 0, // Tax already included in service price
          taxRate: 0,
          total: parseFloat(invoice.amount),
          loyaltyPoints: {
            earned: pointsEarned,
            newBalance: newBalance
          },
          paymentLink: paymentLink,
          venmoUsername: process.env.VENMO_USERNAME || '@cleanmachinetulsa',
          cashappUsername: process.env.CASHAPP_USERNAME || '$CleanMachineTulsa',
          paypalUsername: 'CleanMachineTulsa',
          upsell: {
            title: 'Keep Your Vehicle Looking Fresh',
            description: 'Join our Maintenance Detail Program for regular upkeep every 3 months. Perfect for vehicles we\'ve already detailed!',
            ctaText: 'Learn More',
            ctaUrl: `${baseUrl}/services`
          },
          notes: invoice.notes || undefined
        };
        
        // Render branded HTML email
        const emailHtml = renderInvoiceEmail(invoiceEmailData);
        const emailText = renderInvoiceEmailPlainText(invoiceEmailData);
        
        await sendBusinessEmail(
          customer.email,
          `Invoice ${invoiceEmailData.invoiceNumber} - Clean Machine Auto Detail`,
          emailText, // plain text first
          emailHtml  // HTML second
        );
      } catch (error) {
        console.error('Error sending email invoice notification:', error);
        success = false;
      }
    } else {
      console.warn(`Customer ${customer.id} has no email address, skipping email`);
    }
  }

  return success;
}

/**
 * Send a review request 2 days after the service
 */
export async function sendReviewRequest(invoiceId: number): Promise<boolean> {
  const [invoiceDetails] = await db
    .select({
      invoice: invoices,
      customer: customers,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(
      eq(invoices.id, invoiceId),
      eq(invoices.reviewRequestSent, false)
    ));

  if (!invoiceDetails) {
    return false;
  }

  const { invoice, customer } = invoiceDetails;

  if (!customer) {
    throw new Error('Customer not found for review request');
  }

  // Only send review request if customer has a phone number
  if (!customer.phone) {
    console.warn(`Customer ${customer.id} has no phone number, skipping review request`);
    return false;
  }

  // SMS review request - warm and conversational
  const smsMessage = `Hi ${customer.name || 'there'}! It's been a couple days since we detailed your vehicle. How is everything looking? We'd love to hear your feedback!

If you're happy with our service, please consider leaving a review:
Google: https://g.page/r/CQo53O2yXrN8EBM/review
Facebook: https://www.facebook.com/CLEANMACHINETULSA

Thank you for choosing Clean Machine Auto Detail!`;

  try {
    await sendSMS(customer.phone, smsMessage);

    // Mark review request as sent with timestamp
    await markReviewRequested(invoiceId);

    return true;
  } catch (error) {
    console.error('Error sending review request:', error);
    return false;
  }
}

/**
 * Get all unpaid invoices
 */
export async function getUnpaidInvoices(): Promise<Invoice[]> {
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.paymentStatus, 'unpaid'));
}

/**
 * Get all invoices for a customer
 */
export async function getCustomerInvoices(customerId: number): Promise<Invoice[]> {
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.customerId, customerId));
}