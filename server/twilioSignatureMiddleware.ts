import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';

/**
 * Twilio Signature Verification Middleware
 * 
 * Verifies that incoming webhook requests are genuinely from Twilio
 * by validating the X-Twilio-Signature header against the request URL and body.
 * 
 * Security: Prevents malicious actors from spoofing Twilio webhooks
 * 
 * Usage:
 *   import { verifyTwilioSignature } from './twilioSignatureMiddleware';
 *   router.post('/webhook', verifyTwilioSignature, handler);
 */

const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

if (!twilioAuthToken) {
  console.warn('[TWILIO SECURITY] ⚠️ TWILIO_AUTH_TOKEN not configured - webhook signature verification DISABLED');
  console.warn('[TWILIO SECURITY] This is a SECURITY RISK in production. Set TWILIO_AUTH_TOKEN environment variable.');
}

/**
 * Middleware to verify Twilio webhook signatures
 * Automatically disabled in development if auth token is missing
 */
export function verifyTwilioSignature(req: Request, res: Response, next: NextFunction): void {
  // Skip verification if auth token not configured (development only)
  if (!twilioAuthToken) {
    console.warn(`[TWILIO SECURITY] Skipping signature verification for ${req.path} - no auth token`);
    return next();
  }

  const signature = req.headers['x-twilio-signature'] as string;

  if (!signature) {
    console.error('[TWILIO SECURITY] ❌ Rejected webhook - missing X-Twilio-Signature header');
    res.status(403).json({ 
      success: false, 
      error: 'Missing Twilio signature' 
    });
    return;
  }

  // Construct the full URL that Twilio used to make the request
  // Must match exactly what Twilio signed
  // IMPORTANT: Behind Replit proxy, use X-Forwarded-Proto or default to https for production
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : req.protocol);
  const host = req.get('host');
  const url = `${protocol}://${host}${req.originalUrl}`;
  
  console.log(`[TWILIO SECURITY] Validating signature for URL: ${url}`);

  // Get request body (for POST requests)
  const params = req.body || {};

  try {
    // Validate signature using Twilio's validation utility
    const isValid = twilio.validateRequest(
      twilioAuthToken,
      signature,
      url,
      params
    );

    if (isValid) {
      console.log(`[TWILIO SECURITY] ✅ Valid signature for ${req.path}`);
      next();
    } else {
      console.error('[TWILIO SECURITY] ❌ Invalid Twilio signature detected!');
      console.error(`[TWILIO SECURITY] URL: ${url}`);
      console.error(`[TWILIO SECURITY] Signature: ${signature}`);
      res.status(403).json({ 
        success: false, 
        error: 'Invalid Twilio signature' 
      });
    }
  } catch (error) {
    console.error('[TWILIO SECURITY] Error validating signature:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Signature validation failed' 
    });
  }
}

/**
 * Optional: Twilio signature verification for GET requests
 * (Less common, but used for some Twilio features)
 */
export function verifyTwilioSignatureGET(req: Request, res: Response, next: NextFunction): void {
  if (!twilioAuthToken) {
    console.warn(`[TWILIO SECURITY] Skipping GET signature verification for ${req.path}`);
    return next();
  }

  const signature = req.headers['x-twilio-signature'] as string;

  if (!signature) {
    console.error('[TWILIO SECURITY] ❌ Rejected GET webhook - missing signature');
    res.status(403).json({ success: false, error: 'Missing Twilio signature' });
    return;
  }

  // IMPORTANT: Behind Replit proxy, use X-Forwarded-Proto or default to https for production
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : req.protocol);
  const host = req.get('host');
  const url = `${protocol}://${host}${req.originalUrl}`;

  try {
    const isValid = twilio.validateRequest(
      twilioAuthToken,
      signature,
      url,
      req.query // Use query params for GET requests
    );

    if (isValid) {
      console.log(`[TWILIO SECURITY] ✅ Valid GET signature for ${req.path}`);
      next();
    } else {
      console.error('[TWILIO SECURITY] ❌ Invalid GET signature');
      res.status(403).json({ success: false, error: 'Invalid Twilio signature' });
    }
  } catch (error) {
    console.error('[TWILIO SECURITY] Error validating GET signature:', error);
    res.status(500).json({ success: false, error: 'Signature validation failed' });
  }
}
