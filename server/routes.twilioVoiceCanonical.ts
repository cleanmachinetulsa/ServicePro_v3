/**
 * PHASE 2.2 - Canonical Voice Entry-Point with Dynamic Tenant Lookup
 * 
 * This is the standardized inbound voice webhook handler for ServicePro multi-tenant telephony.
 * 
 * CURRENT (Phase 2.2):
 * - ✅ Dynamic tenant lookup via tenantPhoneConfig table
 * - ✅ Looks up tenant by Twilio 'To' number
 * - ✅ Per-tenant SIP configuration from database
 * - ✅ Caller ID passthrough enabled
 * - ✅ Fallback to 'root' tenant if phone number not found
 * 
 * FUTURE (Phase 2.3+):
 * - Dynamic IVR mode selection (simple/ivr/ai-voice)
 * - AI-powered voice agent mode
 * 
 * ENDPOINT: POST /twilio/voice/incoming
 * 
 * Twilio Webhook Configuration:
 * Set your Twilio phone number's voice webhook to:
 * https://your-domain.replit.app/twilio/voice/incoming
 */

import { Express, Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { wrapTenantDb } from './tenantDb';
import { db } from './db';
import { getTenantByPhoneNumber } from './services/tenantPhone';

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Tenant Resolver Middleware for Twilio Voice Webhooks
 * 
 * Phase 2.2: Dynamic tenant lookup by phone number via tenantPhoneConfig table
 * 
 * How it works:
 * 1. Extract the 'To' number from Twilio request (e.g., +19188565304)
 * 2. Look up tenantPhoneConfig by phone number
 * 3. Resolve tenant ID (fallback to 'root' if not found)
 * 4. Attach tenant context to request for downstream handlers
 */
async function tenantResolverForTwilio(req: Request, res: Response, next: NextFunction) {
  try {
    const phoneNumber = req.body.To;
    
    if (!phoneNumber) {
      console.warn('[CANONICAL VOICE] No "To" number in request, defaulting to root tenant');
      req.tenant = { id: 'root' };
      req.tenantDb = wrapTenantDb(db, 'root');
      return next();
    }
    
    // ✅ Phase 2.2: Dynamic tenant lookup by phone number
    const phoneConfig = await getTenantByPhoneNumber(db, phoneNumber);
    
    const tenantId = phoneConfig?.tenantId || 'root';
    
    req.tenant = { id: tenantId };
    req.tenantDb = wrapTenantDb(db, tenantId);
    
    // Store phone config on request for handler to access SIP settings
    (req as any).phoneConfig = phoneConfig;
    
    console.log(`[CANONICAL VOICE] Tenant resolved: ${tenantId} for incoming call to ${phoneNumber}${phoneConfig ? '' : ' (fallback to root)'}`);
    next();
  } catch (error) {
    console.error('[CANONICAL VOICE] Error in tenant resolver:', error);
    // Fallback to root on error
    req.tenant = { id: 'root' };
    req.tenantDb = wrapTenantDb(db, 'root');
    next();
  }
}

/**
 * Canonical Inbound Voice Handler
 * 
 * Phase 2.2: Uses per-tenant SIP configuration from database
 * Returns TwiML that forwards the call to the tenant's configured SIP endpoint
 * with caller ID passthrough for proper caller identification
 */
async function handleIncomingVoice(req: Request, res: Response) {
  const response = new VoiceResponse();
  
  try {
    const fromNumber = req.body.From || 'Unknown';
    const toNumber = req.body.To || 'Unknown';
    const callSid = req.body.CallSid || 'Unknown';
    const tenantId = req.tenant?.id || 'root';
    
    console.log(`[CANONICAL VOICE] Incoming call from ${fromNumber} to ${toNumber}, CallSid: ${callSid}, Tenant: ${tenantId}`);
    
    // ✅ Phase 2.2: Get SIP endpoint from tenantPhoneConfig (attached by middleware)
    const phoneConfig = (req as any).phoneConfig;
    
    let sipEndpoint: string | null = null;
    
    if (phoneConfig?.sipDomain && phoneConfig?.sipUsername) {
      sipEndpoint = `${phoneConfig.sipUsername}@${phoneConfig.sipDomain}`;
      console.log(`[CANONICAL VOICE] Using database SIP config: ${sipEndpoint}`);
    } else {
      // Fallback for root tenant if no config found
      if (tenantId === 'root') {
        sipEndpoint = 'jody@cleanmachinetulsa.sip.twilio.com';
        console.log(`[CANONICAL VOICE] Using hardcoded root fallback: ${sipEndpoint}`);
      }
    }
    
    if (!sipEndpoint) {
      console.error(`[CANONICAL VOICE] No SIP endpoint configured for tenant ${tenantId}`);
      response.say({ voice: 'alice' }, 'This number is not configured. Please call back later.');
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }
    
    console.log(`[CANONICAL VOICE] Forwarding to SIP: ${sipEndpoint}`);
    
    // Dial the SIP endpoint with caller ID passthrough
    const dial = response.dial({
      callerId: fromNumber, // Pass through the actual caller's number
    });
    
    dial.sip(`sip:${sipEndpoint}`);
    
    // If dial fails/times out, the call will just end
    // TODO Phase 2.3: Add fallback to voicemail or IVR based on ivrMode
    
  } catch (error) {
    console.error('[CANONICAL VOICE] Error handling incoming call:', error);
    response.say({ voice: 'alice' }, 'We encountered an error. Please try again later.');
    response.hangup();
  }
  
  res.type('text/xml');
  res.send(response.toString());
}

/**
 * Register the canonical voice routes
 */
export function registerCanonicalVoiceRoutes(app: Express) {
  // POST /twilio/voice/incoming - Canonical inbound voice webhook
  // Security: Twilio signature verification + tenant resolver
  app.post(
    '/twilio/voice/incoming',
    verifyTwilioSignature,
    tenantResolverForTwilio,
    handleIncomingVoice
  );
  
  console.log('[CANONICAL VOICE] Routes registered: POST /twilio/voice/incoming');
}
