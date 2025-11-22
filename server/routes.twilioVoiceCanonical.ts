/**
 * PHASE 2.1 - Canonical Voice Entry-Point
 * 
 * This is the standardized inbound voice webhook handler for ServicePro multi-tenant telephony.
 * 
 * CURRENT (Phase 2.1):
 * - Hardcoded to 'root' tenant (Clean Machine)
 * - Simple SIP forwarding to jody@cleanmachinetulsa.sip.twilio.com
 * - Caller ID passthrough enabled
 * 
 * FUTURE (Phase 2.3+):
 * - Tenant lookup via tenantPhoneConfig by Twilio 'To' number
 * - Dynamic IVR mode selection (simple/ivr/ai-voice)
 * - Per-tenant SIP/forwarding configuration
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

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Tenant Resolver Middleware for Twilio Voice Webhooks
 * 
 * Phase 2.1: Hardcoded to 'root' tenant
 * Phase 2.3: Will look up tenant by req.body.To via tenantPhoneConfig table
 */
function tenantResolverForTwilio(req: Request, res: Response, next: NextFunction) {
  try {
    // TODO Phase 2.3: Dynamic tenant lookup
    // const phoneNumber = req.body.To;
    // const tenantPhone = await db.query.tenantPhoneConfig.findFirst({
    //   where: eq(tenantPhoneConfig.phoneNumber, phoneNumber)
    // });
    // const tenantId = tenantPhone?.tenantId || 'root';
    
    const tenantId = 'root';
    
    req.tenant = { id: tenantId };
    req.tenantDb = wrapTenantDb(db, tenantId);
    
    console.log(`[CANONICAL VOICE] Tenant resolved: ${tenantId} for incoming call to ${req.body.To}`);
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
 * Returns TwiML that forwards the call to the root tenant's SIP endpoint
 * with caller ID passthrough for proper caller identification
 */
async function handleIncomingVoice(req: Request, res: Response) {
  const response = new VoiceResponse();
  
  try {
    const fromNumber = req.body.From || 'Unknown';
    const toNumber = req.body.To || 'Unknown';
    const callSid = req.body.CallSid || 'Unknown';
    
    console.log(`[CANONICAL VOICE] Incoming call from ${fromNumber} to ${toNumber}, CallSid: ${callSid}`);
    
    // TODO Phase 2.3: Look up SIP endpoint from tenantPhoneConfig
    // const tenantPhone = await req.tenantDb!.query.tenantPhoneConfig.findFirst({
    //   where: req.tenantDb!.withTenantFilter(tenantPhoneConfig, eq(tenantPhoneConfig.phoneNumber, toNumber))
    // });
    // const sipEndpoint = tenantPhone?.sipDomain && tenantPhone?.sipUsername 
    //   ? `${tenantPhone.sipUsername}@${tenantPhone.sipDomain}`
    //   : null;
    
    // For now: Hardcoded Clean Machine SIP endpoint
    const sipEndpoint = 'jody@cleanmachinetulsa.sip.twilio.com';
    
    if (!sipEndpoint) {
      console.error('[CANONICAL VOICE] No SIP endpoint configured for tenant');
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
    // TODO Phase 2.2: Add fallback to voicemail or IVR based on tenant config
    
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
