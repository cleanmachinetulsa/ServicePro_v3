/**
 * Payer Approval API Routes
 * 
 * Public endpoints for third-party payers to review and approve jobs:
 * - Token-based access (no auth required)
 * - OTP verification for security
 * - Approve/decline actions
 * - Stripe payment link generation for deposits
 */

import { Router, Request, Response } from 'express';
import { appointments, contacts, authorizations, paymentLinks, auditLog } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { sendSMS } from './notifications';
import crypto from 'crypto';
import Stripe from 'stripe';

// Stripe client initialized lazily inside handlers to avoid crashing server if misconfigured
let stripe: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });
  }
  return stripe;
}

const router = Router();

/**
 * Generate and send OTP
 */
async function generateAndSendOTP(phoneE164: string): Promise<string> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  
  // Store OTP in memory (in production, use Redis or database with expiry)
  // For now, we'll use a simple in-memory store
  if (!(global as any).otpStore) {
    (global as any).otpStore = new Map();
  }
  
  (global as any).otpStore.set(phoneE164, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  
  // Send OTP via SMS
  const message = `Your security code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
  await sendSMS(phoneE164, message);
  
  return otp;
}

/**
 * Verify OTP
 */
function verifyOTP(phoneE164: string, otp: string): boolean {
  if (!(global as any).otpStore) {
    return false;
  }
  
  const stored = (global as any).otpStore.get(phoneE164);
  if (!stored) {
    return false;
  }
  
  if (Date.now() > stored.expiresAt) {
    (global as any).otpStore.delete(phoneE164);
    return false;
  }
  
  const isValid = stored.otp === otp;
  if (isValid) {
    (global as any).otpStore.delete(phoneE164); // One-time use
  }
  
  return isValid;
}

/**
 * GET /api/payer-approval/:token
 * Fetch approval details by token
 */
router.get('/api/payer-approval/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    if (!token || token.length < 20) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    // Find authorization
    const authResult = await req.tenantDb!
      .select()
      .from(authorizations)
      .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.token, token)))
      .execute();
    
    if (!authResult || authResult.length === 0) {
      return res.status(404).json({ error: 'Authorization not found or expired' });
    }
    
    const authorization = authResult[0];
    
    // Fetch associated appointment
    const apptResult = await req.tenantDb!
      .select()
      .from(appointments)
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, authorization.appointmentId)))
      .execute();
    
    if (!apptResult || apptResult.length === 0) {
      return res.status(404).json({ error: 'Associated appointment not found' });
    }
    
    const appointment = apptResult[0];
    
    // Fetch contacts
    const serviceContactResult = appointment.serviceContactId
      ? await req.tenantDb!.select().from(contacts).where(req.tenantDb!.withTenantFilter(contacts, eq(contacts.id, appointment.serviceContactId))).execute()
      : null;
    
    const payerResult = appointment.billingContactId
      ? await req.tenantDb!.select().from(contacts).where(req.tenantDb!.withTenantFilter(contacts, eq(contacts.id, appointment.billingContactId))).execute()
      : null;
    
    if (!serviceContactResult?.[0] || !payerResult?.[0]) {
      return res.status(404).json({ error: 'Required contacts not found' });
    }
    
    const serviceContact = serviceContactResult[0];
    const payer = payerResult[0];
    
    // Send OTP if this is the first access
    if (authorization.status === 'pending') {
      if (payer.phoneE164) {
        await generateAndSendOTP(payer.phoneE164);
        console.log('[PAYER APPROVAL] OTP sent to', payer.phoneE164);
      }
    }
    
    // Return approval data
    res.json({
      authorization: {
        id: authorization.id,
        token: authorization.token,
        expiresAt: authorization.expiresAt,
        status: authorization.status,
      },
      appointment: {
        id: appointment.id,
        serviceName: appointment.serviceType,
        scheduledTime: appointment.scheduledTime,
        estimatedPrice: appointment.estimatedPrice,
        depositPercent: appointment.depositPercent,
        depositAmount: appointment.depositAmount,
        address: appointment.location,
        isGift: appointment.isGift,
        giftMessage: appointment.giftMessage,
        vehicleDesc: `${appointment.vehicleMake} ${appointment.vehicleModel}`,
      },
      serviceContact: {
        name: serviceContact.name,
        phone: serviceContact.phone,
      },
      payer: {
        name: payer.name,
        phone: payer.phone,
      },
      businessName: process.env.BUSINESS_NAME || 'Clean Machine Auto Detail',
      businessPhone: process.env.BUSINESS_PHONE || '(555) 123-4567',
    });
  } catch (error: any) {
    console.error('[PAYER APPROVAL] Error fetching approval:', error);
    res.status(500).json({ error: 'Failed to fetch approval details' });
  }
});

/**
 * POST /api/payer-approval/:token/verify-otp
 * Verify OTP code
 */
router.post('/api/payer-approval/:token/verify-otp', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { otp } = req.body;
    
    if (!otp || otp.length < 4) {
      return res.status(400).json({ error: 'Invalid OTP format' });
    }
    
    // Find authorization
    const authResult = await req.tenantDb!
      .select()
      .from(authorizations)
      .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.token, token)))
      .execute();
    
    if (!authResult || authResult.length === 0) {
      return res.status(404).json({ error: 'Authorization not found' });
    }
    
    const authorization = authResult[0];
    
    // Get payer phone
    const apptResult = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, authorization.appointmentId))
      .execute();
    
    if (!apptResult?.[0]?.billingContactId) {
      return res.status(404).json({ error: 'Payer contact not found' });
    }
    
    const payerResult = await req.tenantDb!
      .select()
      .from(contacts)
      .where(req.tenantDb!.withTenantFilter(contacts, eq(contacts.id, apptResult[0].billingContactId)))
      .execute();
    
    if (!payerResult?.[0]?.phoneE164) {
      return res.status(404).json({ error: 'Payer phone not found' });
    }
    
    const payer = payerResult[0];
    
    // Verify OTP
    const isValid = verifyOTP(payer.phoneE164, otp);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired OTP code' });
    }
    
    // Mark OTP as verified on authorization
    await req.tenantDb!
      .update(authorizations)
      .set({
        otpVerified: true,
        otpVerifiedAt: new Date().toISOString(),
      })
      .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.id, authorization.id)))
      .execute();
    
    // Log successful OTP verification
    await req.tenantDb!.insert(auditLog).values({
      actionType: 'otp_verified',
      entityType: 'authorization',
      entityId: authorization.id,
      details: {
        token: token.substring(0, 8) + '...',
        payerPhone: payer.phone,
      },
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[PAYER APPROVAL] Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

/**
 * POST /api/payer-approval/:token/apply-referral
 * Apply and validate a referral code to the authorization (stores metadata for later invoice creation)
 * SECURITY: Requires OTP verification first
 */
router.post('/api/payer-approval/:token/apply-referral', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { referralCode } = req.body;
    
    if (!referralCode || typeof referralCode !== 'string') {
      return res.status(400).json({ error: 'Referral code is required' });
    }
    
    const code = referralCode.trim().toUpperCase();
    
    // SECURITY FIX: Load authorization AND appointment from database - never trust client pricing
    const { appointments } = await import('@shared/schema');
    const authResult = await req.tenantDb!
      .select({
        auth: authorizations,
        appointment: appointments,
      })
      .from(authorizations)
      .leftJoin(appointments, eq(authorizations.appointmentId, appointments.id))
      .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.token, token)))
      .execute();
    
    if (!authResult || authResult.length === 0) {
      return res.status(404).json({ error: 'Authorization not found' });
    }
    
    const { auth: authorization, appointment } = authResult[0];
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    // SECURITY: Use ONLY the database price, ignore any client input
    const estimatedPrice = parseFloat(appointment.estimatedPrice || '0');
    
    if (estimatedPrice <= 0) {
      return res.status(400).json({ error: 'Appointment has no valid price' });
    }
    
    // SECURITY FIX: Enforce OTP verification
    if (!authorization.otpVerified) {
      return res.status(401).json({ 
        error: 'OTP verification required before applying referral code' 
      });
    }
    
    // Check if already processed
    if (authorization.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Cannot apply referral code after approval/decline' 
      });
    }
    
    // ABUSE PREVENTION: Check if referral already applied
    if (authorization.referralCode) {
      return res.status(400).json({ 
        error: 'A referral code has already been applied to this authorization' 
      });
    }
    
    // Validate referral code using existing referral service
    const { referrals, customers } = await import('@shared/schema');
    const referralResult = await req.tenantDb!
      .select({
        referral: referrals,
        referrer: customers,
      })
      .from(referrals)
      .leftJoin(customers, eq(referrals.referrerCustomerId, customers.id))
      .where(req.tenantDb!.withTenantFilter(referrals, eq(referrals.code, code)))
      .execute();
    
    if (!referralResult || referralResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Invalid referral code' 
      });
    }
    
    const { referral, referrer } = referralResult[0];
    
    // Check if code is active
    if (referral.status !== 'active') {
      return res.status(400).json({ 
        success: false,
        message: 'This referral code is not active' 
      });
    }
    
    // Check expiration
    if (referral.expiresAt && new Date(referral.expiresAt) < new Date()) {
      return res.status(400).json({ 
        success: false,
        message: 'This referral code has expired' 
      });
    }
    
    // Get referral configuration to determine reward
    const { referralConfigurations } = await import('@shared/schema');
    const configResult = await req.tenantDb!
      .select()
      .from(referralConfigurations)
      .where(req.tenantDb!.withTenantFilter(referralConfigurations))
      .execute();
    
    if (!configResult || configResult.length === 0) {
      return res.status(500).json({ error: 'Referral configuration not found' });
    }
    
    const config = configResult[0];
    const rewardType = config.refereeRewardType;
    const rewardValue = parseFloat(config.refereeRewardValue || '0');
    
    // LOGIC FIX: Calculate COMPUTED discount amount (not raw reward value)
    let computedDiscount = 0;
    const isDiscount = rewardType === 'fixed_discount' || rewardType === 'percent_discount';
    
    if (isDiscount) {
      if (rewardType === 'fixed_discount') {
        // Fixed dollar amount
        computedDiscount = Math.min(rewardValue, estimatedPrice);
      } else if (rewardType === 'percent_discount') {
        // Percentage of total
        computedDiscount = (estimatedPrice * rewardValue) / 100;
      }
      
      // DEFENSIVE: Clamp discount to never exceed total (prevents negative totals from bad config)
      computedDiscount = Math.min(computedDiscount, estimatedPrice);
    }
    
    // CRITICAL FIX: Recalculate deposit based on discounted total
    let newDepositAmount = authorization.depositAmount;
    if (isDiscount && computedDiscount > 0 && authorization.depositAmount) {
      const discountedTotal = estimatedPrice - computedDiscount;
      const depositPercent = parseFloat(appointment.depositPercent || '0');
      if (depositPercent > 0) {
        // Recalculate deposit as percentage of NEW discounted total
        newDepositAmount = (discountedTotal * depositPercent) / 100;
      } else {
        // If no deposit percent, use original deposit amount (shouldn't happen)
        newDepositAmount = authorization.depositAmount;
      }
    }
    
    // Store referral metadata AND updated deposit on authorization
    await req.tenantDb!
      .update(authorizations)
      .set({
        referralCode: code,
        referralDiscount: isDiscount ? computedDiscount.toString() : null,
        referralDiscountType: rewardType,
        referralReferrerId: referral.referrerCustomerId,
        depositAmount: isDiscount && computedDiscount > 0 ? newDepositAmount : authorization.depositAmount,
      })
      .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.id, authorization.id)))
      .execute();
    
    // Log the application
    await req.tenantDb!.insert(auditLog).values({
      actionType: 'referral_code_applied',
      entityType: 'authorization',
      entityId: authorization.id,
      details: {
        referralCode: code,
        rewardType,
        rewardValue,
        computedDiscount,
        estimatedPrice,
        referrerId: referral.referrerCustomerId,
      },
    });
    
    // Calculate authoritative totals to prevent double-discount in UI
    const discountedTotal = isDiscount && computedDiscount > 0 
      ? estimatedPrice - computedDiscount 
      : estimatedPrice;
    
    res.json({
      success: true,
      isInformational: !isDiscount,
      message: isDiscount 
        ? `Referral code applied! You'll save $${computedDiscount.toFixed(2)}`
        : `Referral code saved! You'll receive: ${config.refereeRewardDescription || 'reward after first service'}`,
      rewardType,
      rewardValue, // Original reward config value
      computedDiscount, // Actual discount amount
      discountedTotal, // AUTHORITATIVE: New total after discount (UI should trust this, not calculate)
      discountedDeposit: isDiscount && computedDiscount > 0 ? newDepositAmount : authorization.depositAmount, // AUTHORITATIVE: New deposit
      referrerName: referrer?.firstName || 'your friend',
    });
  } catch (error: any) {
    console.error('[PAYER APPROVAL] Error applying referral code:', error);
    res.status(500).json({ error: 'Failed to apply referral code' });
  }
});

/**
 * POST /api/payer-approval/:token/approve
 * Approve the job and create payment link if needed
 */
router.post('/api/payer-approval/:token/approve', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { ipAddress, userAgent } = req.body;
    
    // Find authorization
    const authResult = await req.tenantDb!
      .select()
      .from(authorizations)
      .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.token, token)))
      .execute();
    
    if (!authResult || authResult.length === 0) {
      return res.status(404).json({ error: 'Authorization not found' });
    }
    
    const authorization = authResult[0];
    
    // Check if already processed
    if (authorization.status !== 'pending') {
      return res.status(400).json({ error: `Authorization already ${authorization.status}` });
    }
    
    // Check if expired
    if (new Date(authorization.expiresAt) < new Date()) {
      await req.tenantDb!
        .update(authorizations)
        .set({ status: 'expired' })
        .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.id, authorization.id)))
        .execute();
      
      return res.status(400).json({ error: 'Authorization link has expired' });
    }
    
    // Update authorization status
    await req.tenantDb!
      .update(authorizations)
      .set({
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedByIp: ipAddress,
        approvedByUserAgent: userAgent,
      })
      .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.id, authorization.id)))
      .execute();
    
    // Fetch appointment to check if deposit required
    const apptResult = await req.tenantDb!
      .select()
      .from(appointments)
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, authorization.appointmentId)))
      .execute();
    
    const appointment = apptResult[0];
    
    // Log approval
    await req.tenantDb!.insert(auditLog).values({
      actionType: 'payer_approved',
      entityType: 'appointment',
      entityId: appointment.id,
      details: {
        authorizationId: authorization.id,
        depositRequired: !!appointment.depositAmount,
        ipAddress,
      },
    });
    
    let paymentLink = null;
    
    // CRITICAL FIX: Use authorization.depositAmount (may be discounted) instead of appointment.depositAmount
    const depositAmount = authorization.depositAmount || appointment.depositAmount;
    
    // Create Stripe payment link if deposit required
    if (depositAmount && depositAmount > 0) {
      try {
        // Convert to cents for Stripe (e.g., $50 → 5000 cents)
        const amountInCents = Math.round(Number(depositAmount) * 100);
        
        // Get base URL for success/cancel redirects from environment variable
        // MUST be HTTPS for Stripe to accept redirects
        // Example: https://cleanmachinetulsa.com or https://yourapp.repl.co
        const baseUrl = process.env.PUBLIC_BASE_URL || 
          (process.env.REPL_SLUG && process.env.REPL_OWNER 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : 'https://cleanmachinetulsa.com'); // Fallback to production domain
        
        // Get Stripe client (lazy initialization)
        const stripeClient = getStripeClient();
        
        // Create Stripe Checkout Session
        const session = await stripeClient.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Deposit for ${appointment.serviceType}`,
                  description: `Clean Machine Auto Detail - ${appointment.customerName}`,
                },
                unit_amount: amountInCents,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${baseUrl}/deposit-payment-success?session_id={CHECKOUT_SESSION_ID}&auth=${authorization.token}`,
          cancel_url: `${baseUrl}/deposit-payment-cancelled?auth=${authorization.token}`,
          metadata: {
            appointmentId: appointment.id.toString(),
            authorizationId: authorization.id.toString(),
            type: 'deposit',
          },
          expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
        });
        
        paymentLink = session.url;
        
        // Store payment link in database (matching actual schema)
        await req.tenantDb!.insert(paymentLinks).values({
          appointmentId: appointment.id,
          contactId: authorization.payerId, // Who should pay
          linkType: 'deposit',
          amount: depositAmount.toString(), // Use potentially discounted amount from authorization
          stripePaymentLinkId: session.id, // Stripe checkout session ID
          publicUrl: paymentLink!,
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        });
        
        console.log(`[PAYER APPROVAL] Created Stripe checkout session ${session.id} for appointment ${appointment.id}`);
      } catch (stripeError: any) {
        console.error('[PAYER APPROVAL] Stripe checkout creation failed:', stripeError);
        
        // Log critical error (triggers SMS alert to business owner)
        try {
          const { logError } = await import('./errorMonitoring');
          await logError({
            type: 'payment',
            severity: 'critical',
            message: `Stripe checkout failed for deposit: ${stripeError.message}`,
            endpoint: '/api/payer-approval/:token/approve',
            metadata: {
              appointmentId: appointment.id,
              depositAmount,
              stripeErrorCode: stripeError.code,
              stripeErrorType: stripeError.type,
            },
          });
        } catch (logErr) {
          console.error('[PAYER APPROVAL] Failed to log Stripe error:', logErr);
        }
        
        // Don't fail the entire approval - customer can pay another way
        // Continue without payment link
        paymentLink = null;
      }
    }
    
    res.json({
      success: true,
      paymentLink,
      message: paymentLink
        ? 'Approval successful! Redirecting to payment...'
        : 'Approval successful! You will receive a confirmation SMS.',
    });
  } catch (error: any) {
    console.error('[PAYER APPROVAL] Error approving:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

/**
 * GET /api/payer-approval/verify-payment/:sessionId
 * Verify Stripe Checkout session payment status
 * Returns payment status without requiring authentication
 */
router.get('/api/payer-approval/verify-payment/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    try {
      const stripeClient = getStripeClient();
      const session = await stripeClient.checkout.sessions.retrieve(sessionId);
      
      return res.json({
        success: true,
        paymentStatus: session.payment_status, // 'paid', 'unpaid', 'no_payment_required'
        status: session.status, // 'complete', 'expired', 'open'
        amountTotal: session.amount_total,
        customerEmail: session.customer_details?.email,
      });
    } catch (stripeError: any) {
      console.error('[PAYMENT VERIFY] Stripe error:', stripeError);
      return res.status(404).json({ 
        error: 'Payment session not found',
        code: stripeError.code 
      });
    }
  } catch (error: any) {
    console.error('[PAYMENT VERIFY] Error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

/**
 * POST /api/payer-approval/:token/decline
 * Decline the job
 */
router.post('/api/payer-approval/:token/decline', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { reason, ipAddress, userAgent } = req.body;
    
    // Find authorization
    const authResult = await req.tenantDb!
      .select()
      .from(authorizations)
      .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.token, token)))
      .execute();
    
    if (!authResult || authResult.length === 0) {
      return res.status(404).json({ error: 'Authorization not found' });
    }
    
    const authorization = authResult[0];
    
    // Check if already processed
    if (authorization.status !== 'pending') {
      return res.status(400).json({ error: `Authorization already ${authorization.status}` });
    }
    
    // Update authorization status
    await req.tenantDb!
      .update(authorizations)
      .set({
        status: 'declined',
        declinedAt: new Date().toISOString(),
        declineReason: reason,
      })
      .where(req.tenantDb!.withTenantFilter(authorizations, eq(authorizations.id, authorization.id)))
      .execute();
    
    // Log decline
    await req.tenantDb!.insert(auditLog).values({
      actionType: 'payer_declined',
      entityType: 'appointment',
      entityId: authorization.appointmentId,
      details: {
        authorizationId: authorization.id,
        reason,
        ipAddress,
      },
    });
    
    res.json({
      success: true,
      message: 'Appointment declined. The business will be notified.',
    });
  } catch (error: any) {
    console.error('[PAYER APPROVAL] Error declining:', error);
    res.status(500).json({ error: 'Failed to process decline' });
  }
});

export default router;
