/**
 * Phase 15 - Customer Authentication Routes
 * 
 * Public routes for customer portal OTP-based authentication.
 * These routes do not require prior authentication but DO require tenant context.
 */

import { Router } from 'express';
import { z } from 'zod';
import { requestCustomerOtp, verifyCustomerOtp } from './services/customerOtpService';
import { CUSTOMER_SESSION_COOKIE } from './customerPortalAuthMiddleware';
import type { TenantDb } from './tenantDb';
import { tenantMiddleware } from './tenantMiddleware';

const router = Router();

// Apply tenant middleware to all customer auth routes
router.use(tenantMiddleware);

// Request OTP schema
const requestOtpSchema = z.object({
  channel: z.enum(['sms', 'email']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
}).refine(
  (data) => (data.channel === 'sms' && data.phone) || (data.channel === 'email' && data.email),
  {
    message: 'Phone is required for SMS, email is required for email channel',
  }
);

// Verify OTP schema
const verifyOtpSchema = z.object({
  channel: z.enum(['sms', 'email']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  code: z.string().length(6, 'OTP code must be 6 digits'),
}).refine(
  (data) => (data.channel === 'sms' && data.phone) || (data.channel === 'email' && data.email),
  {
    message: 'Phone is required for SMS, email is required for email channel',
  }
);

/**
 * POST /api/public/customer-auth/request-otp
 * 
 * Request an OTP code for customer authentication
 */
router.post('/request-otp', async (req, res) => {
  try {
    const tenantDb = req.tenantDb as TenantDb;
    const tenant = req.tenant;

    if (!tenantDb || !tenant) {
      return res.status(500).json({ 
        success: false,
        error: 'Tenant context not found' 
      });
    }

    // Validate request body
    const validationResult = requestOtpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }

    const { channel, phone, email } = validationResult.data;

    // Request OTP
    const result = await requestCustomerOtp(tenantDb, {
      tenantId: tenant.id,
      destinationType: channel,
      phone,
      email,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    if (!result.success) {
      // Map internal reasons to user-friendly messages
      let message = 'Failed to send verification code';
      let statusCode = 400;

      switch (result.reason) {
        case 'rate_limited_hourly':
          message = 'Too many requests. Please try again in an hour.';
          statusCode = 429;
          break;
        case 'rate_limited_daily':
          message = 'Daily limit reached. Please try again tomorrow.';
          statusCode = 429;
          break;
        case 'invalid_phone':
          message = 'Invalid phone number format';
          break;
        case 'invalid_email':
          message = 'Invalid email address';
          break;
        case 'email_not_implemented':
          message = 'Email OTP is not yet available. Please use SMS.';
          statusCode = 501;
          break;
        case 'sms_send_failed':
          message = 'Failed to send SMS. Please try again.';
          statusCode = 500;
          break;
      }

      return res.status(statusCode).json({
        success: false,
        error: message,
        reason: result.reason,
      });
    }

    return res.json({
      success: true,
      maskedDestination: result.maskedDestination,
      message: `Verification code sent to ${result.maskedDestination}`,
    });
  } catch (error) {
    console.error('[CustomerAuth] Request OTP error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/public/customer-auth/verify-otp
 * 
 * Verify an OTP code and create a customer session
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const tenantDb = req.tenantDb as TenantDb;
    const tenant = req.tenant;

    if (!tenantDb || !tenant) {
      return res.status(500).json({ 
        success: false,
        error: 'Tenant context not found' 
      });
    }

    // Validate request body
    const validationResult = verifyOtpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }

    const { channel, phone, email, code } = validationResult.data;

    // Verify OTP
    const result = await verifyCustomerOtp(tenantDb, {
      tenantId: tenant.id,
      destinationType: channel,
      phone,
      email,
      code,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    if (!result.success) {
      // Map internal reasons to user-friendly messages
      let message = 'Verification failed';
      let statusCode = 400;

      switch (result.reason) {
        case 'invalid_code':
          message = 'Invalid or incorrect verification code';
          break;
        case 'expired':
          message = 'Verification code has expired. Please request a new one.';
          break;
        case 'too_many_attempts':
          message = 'Too many failed attempts. Please request a new code.';
          statusCode = 429;
          break;
        case 'invalid_phone':
          message = 'Invalid phone number format';
          break;
        case 'invalid_email':
          message = 'Invalid email address';
          break;
      }

      return res.status(statusCode).json({
        success: false,
        error: message,
        reason: result.reason,
      });
    }

    // Set session cookie
    res.cookie(CUSTOMER_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Calculate expiry date
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return res.json({
      success: true,
      customerId: result.customerId,
      expiresAt: expiresAt.toISOString(),
      message: 'Successfully authenticated',
    });
  } catch (error) {
    console.error('[CustomerAuth] Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/public/customer-auth/logout
 * 
 * Revoke customer session (logout)
 */
router.post('/logout', async (req, res) => {
  try {
    const sessionToken = req.cookies?.[CUSTOMER_SESSION_COOKIE];

    if (sessionToken) {
      const tenantDb = req.tenantDb as TenantDb;
      const { revokeSession } = await import('./services/customerOtpService');
      await revokeSession(tenantDb, sessionToken);
    }

    // Clear session cookie
    res.clearCookie(CUSTOMER_SESSION_COOKIE);

    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[CustomerAuth] Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
