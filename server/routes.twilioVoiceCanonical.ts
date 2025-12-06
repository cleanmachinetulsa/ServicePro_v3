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
import { tenantConfig, type TelephonyMode } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { 
  buildMainMenuTwiml, 
  getIvrConfigForTenant,
  buildConfigDrivenMenuTwiml,
} from './services/ivrHelper';
import { getOrCreateDefaultMenuForTenant } from './services/ivrConfigService';
import { handleAiVoiceRequest } from './services/aiVoiceSession';
import { sendSMS } from './notifications';

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
 * Phase 5: Branches on telephonyMode first, then ivrMode
 * 
 * Telephony Modes (routing strategy):
 * - 'FORWARD_ALL_CALLS': Ring owner's phone directly, voicemail on no answer
 * - 'AI_FIRST': AI/IVR answers first, forwards to human when needed (default)
 * - 'AI_ONLY': AI handles everything, no human forwarding
 * - 'TEXT_ONLY_BUSINESS': Play message, send SMS, no human or AI voice interaction
 * 
 * IVR Modes (within AI_FIRST/AI_ONLY):
 * - 'simple': Direct SIP forward (legacy behavior)
 * - 'ivr': Interactive voice menu
 * - 'ai-voice': AI-powered voice agent
 */
async function handleIncomingVoice(req: Request, res: Response) {
  const response = new VoiceResponse();
  
  try {
    const fromNumber = req.body.From || 'Unknown';
    const toNumber = req.body.To || 'Unknown';
    const callSid = req.body.CallSid || 'Unknown';
    const tenantId = req.tenant?.id || 'root';
    
    console.log(`[CANONICAL VOICE] Incoming call from ${fromNumber} to ${toNumber}, CallSid: ${callSid}, Tenant: ${tenantId}`);
    
    const phoneConfig = (req as any).phoneConfig;
    const telephonyMode = (phoneConfig?.telephonyMode as TelephonyMode) || 'AI_FIRST';
    const ivrMode = phoneConfig?.ivrMode || 'simple';
    
    console.log(`[CANONICAL VOICE] tenant=${tenantId}, telephonyMode=${telephonyMode}, ivrMode=${ivrMode}`);
    
    switch (telephonyMode) {
      case 'FORWARD_ALL_CALLS':
        return handleForwardAllCalls(req, res, tenantId, phoneConfig, fromNumber);
        
      case 'TEXT_ONLY_BUSINESS':
        return handleTextOnlyBusiness(req, res, tenantId, phoneConfig, fromNumber, toNumber);
        
      case 'AI_ONLY':
        return handleAiOnly(req, res, tenantId, phoneConfig, ivrMode);
        
      case 'AI_FIRST':
      default:
        return handleAiFirst(req, res, tenantId, phoneConfig, ivrMode, fromNumber);
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
 * Handle FORWARD_ALL_CALLS mode: Ring owner's phone directly
 * If no answer, falls back to voicemail
 */
async function handleForwardAllCalls(
  req: Request,
  res: Response,
  tenantId: string,
  phoneConfig: any,
  fromNumber: string
) {
  const response = new VoiceResponse();
  const forwardingNumber = phoneConfig?.forwardingNumber;
  const ringDuration = phoneConfig?.ringDuration || 20;
  
  console.log(`[CANONICAL VOICE] mode=FORWARD_ALL_CALLS, tenant=${tenantId}, forwardTo=${forwardingNumber ? '***' : 'none'}`);
  
  if (!forwardingNumber) {
    console.log(`[CANONICAL VOICE] No forwarding number configured, falling back to AI_FIRST`);
    return handleAiFirst(req, res, tenantId, phoneConfig, phoneConfig?.ivrMode || 'simple', fromNumber);
  }
  
  response.say({ voice: 'alice' }, 'Please hold while we connect you.');
  
  const dial = response.dial({
    callerId: fromNumber,
    timeout: ringDuration,
    action: '/twilio/voice/voicemail',
  });
  
  dial.number(forwardingNumber);
  
  res.type('text/xml');
  res.send(response.toString());
}

/**
 * Handle TEXT_ONLY_BUSINESS mode: Play message, send SMS, optionally allow voicemail
 * Callers get a quick message and a text with a booking link
 */
async function handleTextOnlyBusiness(
  req: Request,
  res: Response,
  tenantId: string,
  phoneConfig: any,
  fromNumber: string,
  toNumber: string
) {
  const response = new VoiceResponse();
  const allowVoicemail = phoneConfig?.allowVoicemailInTextOnly || false;
  
  console.log(`[CANONICAL VOICE] mode=TEXT_ONLY_BUSINESS, tenant=${tenantId}, allowVoicemail=${allowVoicemail}`);
  
  const tenantConfigData = await db
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);
  
  const businessName = tenantConfigData[0]?.businessName || 'Our Business';
  const subdomain = tenantConfigData[0]?.subdomain;
  const bookingUrl = subdomain 
    ? `https://${subdomain}.serviceproapp.com/site/${subdomain}` 
    : 'our website';
  
  response.say(
    { voice: 'alice' },
    `Thanks for calling ${businessName}. We handle everything by text message for faster service. We just sent you a link. Please check your messages. Goodbye!`
  );
  
  if (allowVoicemail) {
    response.say({ voice: 'alice' }, 'If you prefer, you can leave a voicemail after the tone.');
    response.record({
      action: '/twilio/voice/voicemail-saved',
      method: 'POST',
      maxLength: 120,
      timeout: 5,
      trim: 'trim-silence',
      transcribe: true,
      transcribeCallback: '/twilio/voice/voicemail-transcribed',
    });
  }
  
  response.hangup();
  
  try {
    const smsContent = `Hey! This is ${businessName}. We handle everything by text for faster service. Reply here or tap this link to book: ${bookingUrl}`;
    
    await sendSMS(req.tenantDb!, fromNumber, smsContent);
    
    console.log(`[CANONICAL VOICE] TEXT_ONLY SMS sent to ${fromNumber}`);
  } catch (smsError) {
    console.error(`[CANONICAL VOICE] Failed to send TEXT_ONLY SMS:`, smsError);
  }
  
  res.type('text/xml');
  res.send(response.toString());
}

/**
 * Handle AI_ONLY mode: AI handles everything, no human forwarding
 * Uses IVR/AI but with transfer options disabled
 */
async function handleAiOnly(
  req: Request,
  res: Response,
  tenantId: string,
  phoneConfig: any,
  ivrMode: string
) {
  console.log(`[CANONICAL VOICE] mode=AI_ONLY, tenant=${tenantId}, ivrMode=${ivrMode}`);
  
  if (ivrMode === 'ai-voice') {
    return handleAiVoiceMode(req, res, tenantId, phoneConfig);
  } else if (ivrMode === 'ivr') {
    return handleIvrMode(req, res, tenantId, phoneConfig, { disableTransfer: true });
  } else {
    return handleIvrMode(req, res, tenantId, phoneConfig, { disableTransfer: true });
  }
}

/**
 * Handle AI_FIRST mode: AI/IVR answers first, then forwards to human
 * This is the default mode and preserves existing Clean Machine behavior
 */
async function handleAiFirst(
  req: Request,
  res: Response,
  tenantId: string,
  phoneConfig: any,
  ivrMode: string,
  fromNumber: string
) {
  console.log(`[CANONICAL VOICE] mode=AI_FIRST, tenant=${tenantId}, ivrMode=${ivrMode}`);
  
  if (ivrMode === 'ivr') {
    return handleIvrMode(req, res, tenantId, phoneConfig, { disableTransfer: false });
  } else if (ivrMode === 'ai-voice') {
    return handleAiVoiceMode(req, res, tenantId, phoneConfig);
  } else {
    return handleSimpleMode(req, res, tenantId, phoneConfig, fromNumber);
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
 * Handle IVR mode: Interactive voice menu (Config-Driven)
 * 
 * Phase 3: Now uses database-driven IVR configuration per tenant
 * Falls back to legacy hard-coded menu if config loading fails
 * 
 * Supports retry logic via ?attempt= query parameter
 * 
 * @param options.disableTransfer - If true, suppresses transfer-to-human options (for AI_ONLY mode)
 */
async function handleIvrMode(
  req: Request,
  res: Response,
  tenantId: string,
  phoneConfig: any,
  options: { disableTransfer?: boolean } = {}
) {
  // Get attempt number and retry flags from query string
  const attempt = parseInt(req.query.attempt as string) || parseInt(req.body.attempt as string) || 1;
  const noInputRetry = req.query.noInputRetry === 'true' || req.body.noInputRetry === 'true';
  const invalidRetry = req.query.invalidRetry === 'true' || req.body.invalidRetry === 'true';
  
  console.log(`[CANONICAL VOICE] mode=ivr, tenant=${tenantId}, action=main-menu, attempt=${attempt}`);
  
  // Get callback base URL from request host header (works in both dev and production)
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'] || req.headers['x-forwarded-host'] || process.env.REPLIT_DEV_DOMAIN;
  const callbackBaseUrl = `${protocol}://${host}`;
  
  console.log(`[CANONICAL VOICE] IVR callback base URL: ${callbackBaseUrl}`);
  
  try {
    // Load IVR menu from database (or seed default if missing)
    const menu = await getOrCreateDefaultMenuForTenant(tenantId);
    
    console.log(`[CANONICAL VOICE] Using config-driven IVR menu: ${menu.name} (id=${menu.id})`);
    
    // Generate menu TwiML from config
    const twiml = buildConfigDrivenMenuTwiml(menu, callbackBaseUrl, attempt, noInputRetry, invalidRetry);
    
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    // Fallback to legacy hard-coded menu if config loading fails
    console.error(`[CANONICAL VOICE] Error loading IVR config, using legacy fallback:`, error);
    
    // Get tenant business name for legacy fallback
    const tenantConfigData = await db
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    
    const businessName = tenantConfigData[0]?.businessName;
    const ivrConfig = getIvrConfigForTenant(tenantId, phoneConfig, businessName);
    
    const twiml = buildMainMenuTwiml(ivrConfig, callbackBaseUrl, attempt);
    
    res.type('text/xml');
    res.send(twiml);
  }
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
      // DEBUG: Log incoming webhook for troubleshooting
      console.log(`[/twilio/voice/incoming] WEBHOOK RECEIVED - Method: ${req.method}`);
      console.log(`[/twilio/voice/incoming] CallSid: ${req.body.CallSid}, From: ${req.body.From}, To: ${req.body.To}`);
      console.log(`[/twilio/voice/incoming] Direction: ${req.body.Direction}, CallStatus: ${req.body.CallStatus}`);
      console.log(`[/twilio/voice/incoming] AccountSid: ${req.body.AccountSid}`);
      
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
