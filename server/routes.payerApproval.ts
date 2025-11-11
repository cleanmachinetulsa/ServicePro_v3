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
import { db } from './db';
import { appointments, contacts, authorizations, paymentLinks, auditLog } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { sendSMS } from './notifications';
import crypto from 'crypto';

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
    const authResult = await db
      .select()
      .from(authorizations)
      .where(eq(authorizations.token, token))
      .execute();
    
    if (!authResult || authResult.length === 0) {
      return res.status(404).json({ error: 'Authorization not found or expired' });
    }
    
    const authorization = authResult[0];
    
    // Fetch associated appointment
    const apptResult = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, authorization.appointmentId))
      .execute();
    
    if (!apptResult || apptResult.length === 0) {
      return res.status(404).json({ error: 'Associated appointment not found' });
    }
    
    const appointment = apptResult[0];
    
    // Fetch contacts
    const serviceContactResult = appointment.serviceContactId
      ? await db.select().from(contacts).where(eq(contacts.id, appointment.serviceContactId)).execute()
      : null;
    
    const payerResult = appointment.billingContactId
      ? await db.select().from(contacts).where(eq(contacts.id, appointment.billingContactId)).execute()
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
    const authResult = await db
      .select()
      .from(authorizations)
      .where(eq(authorizations.token, token))
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
    
    const payerResult = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, apptResult[0].billingContactId))
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
    
    // Log successful OTP verification
    await db.insert(auditLog).values({
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
 * POST /api/payer-approval/:token/approve
 * Approve the job and create payment link if needed
 */
router.post('/api/payer-approval/:token/approve', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { ipAddress, userAgent } = req.body;
    
    // Find authorization
    const authResult = await db
      .select()
      .from(authorizations)
      .where(eq(authorizations.token, token))
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
      await db
        .update(authorizations)
        .set({ status: 'expired' })
        .where(eq(authorizations.id, authorization.id))
        .execute();
      
      return res.status(400).json({ error: 'Authorization link has expired' });
    }
    
    // Update authorization status
    await db
      .update(authorizations)
      .set({
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedByIp: ipAddress,
        approvedByUserAgent: userAgent,
      })
      .where(eq(authorizations.id, authorization.id))
      .execute();
    
    // Fetch appointment to check if deposit required
    const apptResult = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, authorization.appointmentId))
      .execute();
    
    const appointment = apptResult[0];
    
    // Log approval
    await db.insert(auditLog).values({
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
    
    // Create Stripe payment link if deposit required
    if (appointment.depositAmount && appointment.depositAmount > 0) {
      // TODO: Integrate with Stripe API to create payment link
      // For now, return placeholder
      paymentLink = `https://checkout.stripe.com/pay/cs_test_${crypto.randomBytes(16).toString('hex')}`;
      
      // Store payment link
      await db.insert(paymentLinks).values({
        appointmentId: appointment.id,
        amount: appointment.depositAmount,
        description: `Deposit for ${appointment.serviceType}`,
        url: paymentLink,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });
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
 * POST /api/payer-approval/:token/decline
 * Decline the job
 */
router.post('/api/payer-approval/:token/decline', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { reason, ipAddress, userAgent } = req.body;
    
    // Find authorization
    const authResult = await db
      .select()
      .from(authorizations)
      .where(eq(authorizations.token, token))
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
    await db
      .update(authorizations)
      .set({
        status: 'declined',
        declinedAt: new Date().toISOString(),
        declineReason: reason,
      })
      .where(eq(authorizations.id, authorization.id))
      .execute();
    
    // Log decline
    await db.insert(auditLog).values({
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
