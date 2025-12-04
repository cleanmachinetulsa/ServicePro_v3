/**
 * PHASE 3 - Canonical Voice Entry-Point with Centralized Tenant Routing
 * 
 * This is the standardized inbound voice webhook handler for ServicePro multi-tenant telephony.
 * 
 * CURRENT (Phase 3):
 * - ✅ Centralized tenant routing via tenantCommRouter service
 * - ✅ Dynamic tenant lookup via tenantPhoneConfig table
 * - ✅ Supports MessagingServiceSid and phone number resolution
 * - ✅ Per-tenant SIP configuration from database
 * - ✅ IVR mode branching (simple/ivr/ai-voice)
 * - ✅ Caller ID passthrough enabled
 * - ✅ Fallback to 'root' tenant if phone number not found
 * 
 * FUTURE (Phase 4+):
 * - AI-powered voice agent mode (ai-voice)
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
import { resolveTenantFromInbound } from './services/tenantCommRouter';
import { tenantConfig } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { buildMainMenuTwiml, getIvrConfigForTenant } from './services/ivrHelper';
import { handleAiVoiceRequest } from './services/aiVoiceSession';

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Tenant Resolver Middleware for Twilio Voice Webhooks
 * 
 * Phase 3: Uses centralized tenant communication router
 * 
 * How it works:
 * 1. Call resolveTenantFromInbound() service
 * 2. Service tries MessagingServiceSid match, then phone number, then fallback
 * 3. Attach tenant context to request for downstream handlers
 */
async function tenantResolverForTwilio(req: Request, res: Response, next: NextFunction) {
  try {
    // ✅ Phase 3: Use centralized tenant router
    const resolution = await resolveTenantFromInbound(req, db);
    
    req.tenant = { id: resolution.tenantId };
    req.tenantDb = wrapTenantDb(db, resolution.tenantId);
    
    // Store phone config and resolution metadata on request
    (req as any).phoneConfig = resolution.phoneConfig;
    (req as any).tenantResolution = resolution;
    
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
    
    // ✅ Phase 2.3/Phase 4: Branch on IVR mode
    if (ivrMode === 'ivr') {
      return handleIvrMode(req, res, tenantId, phoneConfig);
    } else if (ivrMode === 'ai-voice') {
      // ✅ Phase 4: AI Voice mode - delegate to AI voice handler
      return handleAiVoiceMode(req, res, tenantId, phoneConfig);
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
 * 
 * Supports retry logic via ?attempt= query parameter
 */
async function handleIvrMode(
  req: Request,
  res: Response,
  tenantId: string,
  phoneConfig: any
) {
  // Get attempt number from query string (for retry after no-input or invalid digit)
  const attempt = parseInt(req.query.attempt as string) || parseInt(req.body.attempt as string) || 1;
  
  console.log(`[CANONICAL VOICE] mode=ivr, tenant=${tenantId}, action=main-menu, attempt=${attempt}`);
  
  // Get tenant business name from config
  const tenantConfigData = await db
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);
  
  const businessName = tenantConfigData[0]?.businessName;
  
  // Build IVR config
  const ivrConfig = getIvrConfigForTenant(tenantId, phoneConfig, businessName);
  
  // Get callback base URL from request host header (works in both dev and production)
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'] || req.headers['x-forwarded-host'] || process.env.REPLIT_DEV_DOMAIN;
  const callbackBaseUrl = `${protocol}://${host}`;
  
  console.log(`[CANONICAL VOICE] IVR callback base URL: ${callbackBaseUrl}`);
  
  // Generate main menu TwiML with current attempt number
  const twiml = buildMainMenuTwiml(ivrConfig, callbackBaseUrl, attempt);
  
  res.type('text/xml');
  res.send(twiml);
}

/**
 * Handle AI Voice mode: Provider-agnostic AI voice agent (Phase 4)
 */
async function handleAiVoiceMode(
  req: Request,
  res: Response,
  tenantId: string,
  phoneConfig: any
) {
  console.log(`[CANONICAL VOICE] mode=ai-voice, tenant=${tenantId}`);
  
  try {
    // Get tenant data for personalized greeting
    const tenantConfigData = await db
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    
    const tenant = {
      id: tenantId,
      name: tenantConfigData[0]?.businessName || 'Our Business',
      subdomain: null,
      isRoot: tenantId === 'root',
      businessName: tenantConfigData[0]?.businessName,
      tier: tenantConfigData[0]?.tier,
      logoUrl: tenantConfigData[0]?.logoUrl,
      primaryColor: tenantConfigData[0]?.primaryColor,
    };
    
    // Call AI voice handler
    const result = await handleAiVoiceRequest({
      tenant,
      phoneConfig,
      body: req.body,
    });
    
    res.type('text/xml');
    res.send(result.twiml);
  } catch (error) {
    console.error('[CANONICAL VOICE] Error in AI voice mode:', error);
    const response = new VoiceResponse();
    response.say({ voice: 'alice' }, 'We encountered an error with our AI receptionist. Please try again later.');
    response.hangup();
    res.type('text/xml');
    res.send(response.toString());
  }
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
    async (req, res, next) => {
      try {
        await handleIncomingVoice(req, res);
      } catch (error: any) {
        console.error('[CANONICAL VOICE] CRITICAL ERROR:', error?.message || error);
        console.error('[CANONICAL VOICE] Stack:', error?.stack);
        const VoiceResp = new VoiceResponse();
        VoiceResp.say({ voice: 'alice' }, 'We are experiencing technical difficulties. Please try again later.');
        res.type('text/xml');
        res.send(VoiceResp.toString());
      }
    }
  );
  
  console.log('[CANONICAL VOICE] Routes registered: POST /twilio/voice/incoming');
}
