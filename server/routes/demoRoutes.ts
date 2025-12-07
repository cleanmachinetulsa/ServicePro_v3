/**
 * CM-DEMO-1: Demo Mode API Routes
 * 
 * Public routes for demo session management and phone verification.
 * These routes do NOT require authentication - they use demo session tokens.
 * 
 * SECURITY:
 * - Session tokens are cryptographically random and stored hashed
 * - Phone verification uses real SMS with 10-min expiry codes
 * - Token rotation on verification prevents session fixation
 * - Rate limiting prevents abuse
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import {
  createDemoSession,
  getDemoSession,
  getDemoSessionInfo,
  sendDemoVerificationCode,
  verifyDemoCode,
  ensureDemoTenantExists,
} from '../services/demoService';
import { DEMO_TENANT_ID } from '@shared/demoConfig';

const router = Router();

const demoStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many demo sessions requested. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const demoCodeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: 'Too many verification code requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const demoVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification attempts. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/start', demoStartLimiter, async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await ensureDemoTenantExists();

    const result = await createDemoSession(ipAddress, userAgent);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    console.log(`[DEMO API] Demo session started: ${result.sessionId}`);

    res.json({
      success: true,
      demoSessionToken: result.sessionToken,
      expiresAt: result.expiresAt,
      tenantId: DEMO_TENANT_ID,
    });
  } catch (error) {
    console.error('[DEMO API] Failed to start demo session:', error);
    res.status(500).json({ error: 'Failed to start demo session' });
  }
});

const sendCodeSchema = z.object({
  demoSessionToken: z.string().min(40).max(60),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
});

router.post('/send-code', demoCodeLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = sendCodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.flatten(),
      });
    }

    const { demoSessionToken, phone } = parseResult.data;

    const sendSmsFn = async (to: string, body: string): Promise<boolean> => {
      try {
        const { twilioClient } = await import('../twilioClient');
        if (!twilioClient) {
          console.error('[DEMO API] Twilio client not available');
          return false;
        }
        const fromNumber = process.env.TWILIO_TEST_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER;
        if (!fromNumber) {
          console.error('[DEMO API] No Twilio phone number configured');
          return false;
        }
        await twilioClient.messages.create({
          to,
          from: fromNumber,
          body,
        });
        return true;
      } catch (error) {
        console.error('[DEMO API] SMS send failed:', error);
        return false;
      }
    };

    const result = await sendDemoVerificationCode(demoSessionToken, phone, sendSmsFn);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Verification code sent',
    });
  } catch (error) {
    console.error('[DEMO API] Failed to send verification code:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

const verifyCodeSchema = z.object({
  demoSessionToken: z.string().min(40).max(60),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

router.post('/verify-code', demoVerifyLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = verifyCodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.flatten(),
      });
    }

    const { demoSessionToken, phone, code } = parseResult.data;

    const result = await verifyDemoCode(demoSessionToken, code, phone);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Phone verified successfully',
      verifiedPhone: phone,
      newToken: result.newToken,
    });
  } catch (error) {
    console.error('[DEMO API] Failed to verify code:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

router.get('/session', async (req: Request, res: Response) => {
  try {
    const token = req.headers['x-demo-session'] as string || req.query.token as string;

    if (!token) {
      return res.status(400).json({ error: 'Demo session token required' });
    }

    if (token.length < 40 || token.length > 60) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    const info = await getDemoSessionInfo(token);

    if (!info) {
      return res.status(404).json({ error: 'Demo session not found or expired' });
    }

    res.json({
      success: true,
      verified: info.verified,
      phone: info.phone,
      expiresAt: info.expiresAt,
    });
  } catch (error) {
    console.error('[DEMO API] Failed to get session info:', error);
    res.status(500).json({ error: 'Failed to get session info' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  res.json({
    enabled: true,
    tenantId: DEMO_TENANT_ID,
    sessionDurationHours: 2,
  });
});

export default router;
