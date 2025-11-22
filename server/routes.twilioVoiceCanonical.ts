/**
 * PHASE 2.3 - Canonical Voice Entry-Point with IVR Mode Support
 * 
 * This is the standardized inbound voice webhook handler for ServicePro multi-tenant telephony.
 * 
 * CURRENT (Phase 2.3):
 * - ✅ Dynamic tenant lookup via tenantPhoneConfig table
 * - ✅ Looks up tenant by Twilio 'To' number
 * - ✅ Per-tenant SIP configuration from database
 * - ✅ IVR mode branching (simple/ivr/ai-voice)
 * - ✅ Caller ID passthrough enabled
 * - ✅ Fallback to 'root' tenant if phone number not found
 * 
 * FUTURE (Phase 3+):
 * - AI-powered voice agent mode (ai-voice)
 * - Per-tenant IVR configurations from database
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
import { tenantConfig } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { buildMainMenuTwiml, getIvrConfigForTenant } from './services/ivrHelper';

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
 * Phase 2.3: Branches on ivrMode to provide different call experiences
 * - 'simple': Direct SIP forward (legacy behavior)
 * - 'ivr': Interactive voice menu
 * - 'ai-voice': AI-powered voice agent (future, falls back to simple for now)
 */
async function handleIncomingVoice(req: Request, res: Response) {
  const response = new VoiceResponse();
  
  try {
    const fromNumber = req.body.From || 'Unknown';
    const toNumber = req.body.To || 'Unknown';
    const callSid = req.body.CallSid || 'Unknown';
    const tenantId = req.tenant?.id || 'root';
    
    console.log(`[CANONICAL VOICE] Incoming call from ${fromNumber} to ${toNumber}, CallSid: ${callSid}, Tenant: ${tenantId}`);
    
    // ✅ Phase 2.2: Get phone config from database (attached by middleware)
    const phoneConfig = (req as any).phoneConfig;
    const ivrMode = phoneConfig?.ivrMode || 'simple';
    
    console.log(`[CANONICAL VOICE] tenant=${tenantId}, ivrMode=${ivrMode}`);
    
    // ✅ Phase 2.3: Branch on IVR mode
    if (ivrMode === 'ivr') {
      return handleIvrMode(req, res, tenantId, phoneConfig);
    } else if (ivrMode === 'ai-voice') {
      // TODO: Phase 4 - Implement AI-voice mode
      console.log(`[CANONICAL VOICE] AI-voice mode not yet implemented, falling back to simple`);
      return handleSimpleMode(req, res, tenantId, phoneConfig, fromNumber);
    } else {
      // Default: simple mode (direct SIP forward)
      return handleSimpleMode(req, res, tenantId, phoneConfig, fromNumber);
    }
    
  } catch (error) {
    console.error('[CANONICAL VOICE] Error handling incoming call:', error);
    response.say({ voice: 'alice' }, 'We encountered an error. Please try again later.');
    response.hangup();
    res.type('text/xml');
    res.send(response.toString());
  }
}

/**
 * Handle simple mode: Direct SIP forwarding (Phase 2.2 behavior)
 */
async function handleSimpleMode(
  req: Request,
  res: Response,
  tenantId: string,
  phoneConfig: any,
  fromNumber: string
) {
  const response = new VoiceResponse();
  
  let sipEndpoint: string | null = null;
  
  if (phoneConfig?.sipDomain && phoneConfig?.sipUsername) {
    sipEndpoint = `${phoneConfig.sipUsername}@${phoneConfig.sipDomain}`;
    console.log(`[CANONICAL VOICE] mode=simple, using database SIP config: ${sipEndpoint}`);
  } else {
    // Fallback for root tenant if no config found
    if (tenantId === 'root') {
      sipEndpoint = 'jody@cleanmachinetulsa.sip.twilio.com';
      console.log(`[CANONICAL VOICE] mode=simple, using hardcoded root fallback: ${sipEndpoint}`);
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
    callerId: fromNumber,
  });
  
  dial.sip(`sip:${sipEndpoint}`);
  
  res.type('text/xml');
  res.send(response.toString());
}

/**
 * Handle IVR mode: Interactive voice menu (Phase 2.3)
 */
async function handleIvrMode(
  req: Request,
  res: Response,
  tenantId: string,
  phoneConfig: any
) {
  console.log(`[CANONICAL VOICE] mode=ivr, tenant=${tenantId}, action=main-menu`);
  
  // Get tenant business name from config
  const tenantConfigData = await db
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);
  
  const businessName = tenantConfigData[0]?.businessName;
  
  // Build IVR config
  const ivrConfig = getIvrConfigForTenant(tenantId, phoneConfig, businessName);
  
  // Get callback base URL
  const callbackBaseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'https://your-domain.repl.co';
  
  // Generate main menu TwiML
  const twiml = buildMainMenuTwiml(ivrConfig, callbackBaseUrl);
  
  res.type('text/xml');
  res.send(twiml);
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
