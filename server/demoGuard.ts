/**
 * Demo Mode Security Middleware
 * Protects production data and services from demo user access
 */

import { Request, Response, NextFunction } from 'express';
import { platformSettings } from '@shared/schema';

/**
 * Checks if demo mode is enabled platform-wide
 * Blocks access if demo mode is disabled
 */
export async function requireDemoEnabled(req: Request, res: Response, next: NextFunction) {
  try {
    const [settings] = await req.tenantDb!.select().from(platformSettings).limit(1);
    
    if (!settings || !settings.demoModeEnabled) {
      return res.status(403).json({ 
        success: false, 
        message: 'Demo mode is currently disabled' 
      });
    }
    
    next();
  } catch (error) {
    console.error('[DEMO GUARD] Error checking demo mode status:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Checks if current session is a demo session
 * Returns true if demo mode, false otherwise
 */
export function isDemoSession(req: Request): boolean {
  return req.session.isDemo === true;
}

/**
 * Checks if demo session has expired (2 hours)
 */
export function isDemoSessionExpired(req: Request): boolean {
  if (!req.session.isDemo || !req.session.demoStartedAt) {
    return false;
  }
  
  const TWO_HOURS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  const sessionAge = Date.now() - req.session.demoStartedAt;
  
  return sessionAge > TWO_HOURS;
}

/**
 * Intercepts mutating operations (POST/PUT/DELETE) in demo mode
 * Blocks actual database/API mutations and returns mock success
 */
export function demoRequestGuard(req: Request, res: Response, next: NextFunction) {
  if (!isDemoSession(req)) {
    return next(); // Not a demo session, allow normal processing
  }
  
  // Check if session expired
  if (isDemoSessionExpired(req)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Demo session expired. Please start a new demo session.',
      demoExpired: true,
    });
  }
  
  const method = req.method.toUpperCase();
  const path = req.path;
  
  // Allow GET requests (read-only)
  if (method === 'GET') {
    return next();
  }
  
  // Check if this is a sensitive route that should be blocked
  const sensitiveRoutes = [
    '/api/sms',
    '/api/email',
    '/api/stripe',
    '/api/twilio',
    '/api/google',
    '/api/media',
    '/api/upload',
    '/api/payments',
    '/api/invoices/send',
    '/api/appointments/create',
    '/api/appointments/update',
    '/api/appointments/delete',
    '/api/customers/create',
    '/api/customers/update',
    '/api/customers/delete',
  ];
  
  const isSensitiveRoute = sensitiveRoutes.some(route => path.startsWith(route));
  
  if (isSensitiveRoute && (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH')) {
    console.log(`[DEMO GUARD] Blocked ${method} request to ${path} in demo mode`);
    
    // Return mock success response
    return res.json({
      success: true,
      message: 'Demo mode: Operation simulated successfully',
      demoMode: true,
      data: {
        id: Math.floor(Math.random() * 10000),
        created: true,
        mockResponse: true,
      },
    });
  }
  
  // Allow other requests (non-sensitive routes)
  next();
}

/**
 * Blocks SMS sending in demo mode
 */
export function blockDemoSMS(req: Request, res: Response, next: NextFunction) {
  if (isDemoSession(req)) {
    console.log('[DEMO GUARD] Blocked SMS sending in demo mode');
    return res.json({
      success: true,
      message: 'Demo mode: SMS not sent (simulated)',
      demoMode: true,
      sid: `DEMO_MSG_${Date.now()}`,
    });
  }
  next();
}

/**
 * Blocks email sending in demo mode
 */
export function blockDemoEmail(req: Request, res: Response, next: NextFunction) {
  if (isDemoSession(req)) {
    console.log('[DEMO GUARD] Blocked email sending in demo mode');
    return res.json({
      success: true,
      message: 'Demo mode: Email not sent (simulated)',
      demoMode: true,
      messageId: `demo-email-${Date.now()}`,
    });
  }
  next();
}

/**
 * Blocks Stripe payment operations in demo mode
 */
export function blockDemoPayments(req: Request, res: Response, next: NextFunction) {
  if (isDemoSession(req)) {
    console.log('[DEMO GUARD] Blocked payment operation in demo mode');
    return res.json({
      success: true,
      message: 'Demo mode: Payment not processed (simulated)',
      demoMode: true,
      paymentId: `demo-payment-${Date.now()}`,
      amount: req.body.amount || 0,
      status: 'succeeded',
    });
  }
  next();
}

/**
 * Blocks Twilio voice operations in demo mode
 */
export function blockDemoVoice(req: Request, res: Response, next: NextFunction) {
  if (isDemoSession(req)) {
    console.log('[DEMO GUARD] Blocked voice operation in demo mode');
    
    // Return TwiML mock response for voice webhooks
    if (req.path.includes('/twiml') || req.path.includes('/voice')) {
      return res.type('text/xml').send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>This is a demo environment. Voice features are simulated.</Say>
          <Hangup/>
        </Response>
      `);
    }
    
    return res.json({
      success: true,
      message: 'Demo mode: Voice operation not executed (simulated)',
      demoMode: true,
      callSid: `DEMO_CALL_${Date.now()}`,
    });
  }
  next();
}

/**
 * Blocks Google API operations in demo mode
 */
export function blockDemoGoogleAPI(req: Request, res: Response, next: NextFunction) {
  if (isDemoSession(req)) {
    console.log('[DEMO GUARD] Blocked Google API operation in demo mode');
    return res.json({
      success: true,
      message: 'Demo mode: Google API operation not executed (simulated)',
      demoMode: true,
      data: {},
    });
  }
  next();
}

/**
 * Blocks file upload operations in demo mode
 */
export function blockDemoFileUpload(req: Request, res: Response, next: NextFunction) {
  if (isDemoSession(req)) {
    console.log('[DEMO GUARD] Blocked file upload in demo mode');
    return res.json({
      success: true,
      message: 'Demo mode: File upload not executed (simulated)',
      demoMode: true,
      fileUrl: `/demo/mock-file-${Date.now()}.jpg`,
    });
  }
  next();
}

/**
 * Middleware to log demo API usage for monitoring
 */
export function logDemoActivity(req: Request, res: Response, next: NextFunction) {
  if (isDemoSession(req)) {
    const sessionAge = req.session.demoStartedAt 
      ? Math.floor((Date.now() - req.session.demoStartedAt) / 1000 / 60) 
      : 0;
    
    console.log(`[DEMO ACTIVITY] ${req.method} ${req.path} | Session age: ${sessionAge} minutes`);
  }
  next();
}
