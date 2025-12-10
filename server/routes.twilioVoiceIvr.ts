/**
 * Phase 2.3: IVR Callback Routes
 * 
 * Handles DTMF selections from the IVR menu and generates appropriate TwiML responses.
 * 
 * ROUTE SUMMARY:
 * - POST /twilio/voice/ivr-selection - Handle digit pressed (1/2/3/7)
 * - POST /twilio/voice/ivr-no-input - Handle no input (replay menu)
 * - POST /twilio/voice/dial-status - Handle SIP dial outcome (answered/no-answer/busy/failed)
 * - POST /twilio/voice/voicemail-complete - Voicemail recording finished
 * - POST /twilio/voice/recording-status - Recording status callback (sync to conversation)
 * - POST /twilio/voice/voicemail-transcribed - Transcription callback (update conversation)
 * 
 * Phase 3: Enhanced with:
 * - Voicemail sync to conversations
 * - Push notifications for voicemails
 * - Proper owner notification from env vars
 */

import type { Express, Request, Response } from 'express';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { tenantPhoneConfig, tenantConfig, users, phoneLines, ivrMenus, tenantTelephonySettings, callSmsState } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import {
  buildServicesOverviewTwiml,
  buildForwardToPersonTwiml,
  buildVoicemailTwiml,
  buildVoicemailCompleteTwiml,
  buildEasterEggTwiml,
  buildInvalidSelectionTwiml,
  buildDialStatusTwiml,
  buildNoInputTwiml,
  getIvrConfigForTenant,
  VALID_IVR_DIGITS,
  findMenuItemByDigit,
  buildActionTwiml,
  buildConfigDrivenInvalidTwiml,
  buildConfigDrivenNoInputTwiml,
} from './services/ivrHelper';
import { getActiveMenuForTenant, getOrCreateDefaultMenuForTenant } from './services/ivrConfigService';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { TWILIO_TEST_SMS_NUMBER } from './twilioClient';
import { syncVoicemailIntoConversation } from './services/voicemailConversationService';
import { sendPushToAllUsers, sendPushNotification } from './pushNotificationService';
import { handleConversationalScheduling } from './conversationalScheduling';
import { sendSMS } from './notifications';

/**
 * CM-VOICEMAIL-MISSED-CALL-SMS-FIX: Per-call SMS deduplication using atomic database claims
 * 
 * Uses claimSmsForCall() for atomic "claim first, then send" pattern.
 * The function atomically INSERTs a row and returns true only if the insert succeeded.
 * This prevents race conditions between simultaneous webhook handlers.
 * 
 * Flow:
 * - recording-status: For short recordings (<3s), claims BEFORE sending missed call SMS
 * - voicemail-transcribed: For empty/valid transcriptions, claims BEFORE sending SMS
 * 
 * Guarantees:
 * - Exactly one SMS per caller (unique constraint on callSid)
 * - Race-condition-free (atomic INSERT with onConflictDoNothing + returning)
 * - Multi-instance safe (works across server restarts and horizontal scaling)
 */

/**
 * Atomically claim the right to send SMS for a call (insert-or-skip pattern)
 * Returns true if this caller "won" the right to send SMS, false if already claimed.
 * 
 * This prevents race conditions by using the database's unique constraint.
 */
async function claimSmsForCall(callSid: string, tenantId: string, smsType: string, recipientPhone: string): Promise<boolean> {
  try {
    // Try to insert - if callSid already exists, this will be a no-op due to unique constraint
    const result = await db.insert(callSmsState).values({
      callSid,
      tenantId,
      smsType,
      recipientPhone,
    }).onConflictDoNothing() // Ignore if already exists
    .returning();
    
    // If we got a row back, we "won" the claim
    const claimed = result.length > 0;
    
    if (claimed) {
      console.log(`[CALL SMS STATE] ✅ Claimed SMS slot for CallSid=${callSid}, type=${smsType}`);
    } else {
      console.log(`[CALL SMS STATE] ❌ SMS slot already claimed for CallSid=${callSid} - skipping`);
    }
    
    return claimed;
  } catch (error) {
    console.error(`[CALL SMS STATE] Error claiming SMS slot for CallSid=${callSid}:`, error);
    // On error, return false to prevent potential duplicates
    return false;
  }
}

/**
 * Normalize phone number to E.164 format for consistent lookups
 */
function normalizePhoneNumber(phone: string | undefined): string | null {
  if (!phone) return null;
  
  let cleaned = phone.trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\D/g, '');
  
  if (!cleaned) return null;
  
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  if (hasPlus) {
    return `+${cleaned}`;
  }
  
  if (cleaned.length >= 10) {
    return `+${cleaned}`;
  }
  
  return null;
}

/**
 * Get callback base URL from request headers
 * Works correctly in both development and production
 */
function getCallbackBaseUrl(req: Request): string {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'] || req.headers['x-forwarded-host'] || process.env.REPLIT_DEV_DOMAIN;
  return `${protocol}://${host}`;
}

export function registerIvrRoutes(app: Express) {
  app.post('/twilio/voice/ivr-selection', verifyTwilioSignature, handleIvrSelection);
  app.post('/twilio/voice/ivr-no-input', verifyTwilioSignature, handleNoInput);
  app.post('/twilio/voice/dial-status', verifyTwilioSignature, handleDialStatus);
  app.post('/twilio/voice/voicemail-complete', verifyTwilioSignature, handleVoicemailComplete);
  app.post('/twilio/voice/recording-status', verifyTwilioSignature, handleRecordingStatus);
  app.post('/twilio/voice/voicemail-transcribed', verifyTwilioSignature, handleVoicemailTranscribed);
  
  console.log('[IVR ROUTES] Routes registered: POST /twilio/voice/ivr-selection, /ivr-no-input, /dial-status, /voicemail-complete, /recording-status, /voicemail-transcribed');
}

/**
 * Handle IVR digit selection (Config-Driven)
 * 
 * Phase 3: Now uses database-driven IVR configuration per tenant
 * Looks up menu item by digit and processes the action
 * Falls back to legacy hard-coded handlers if config loading fails
 */
async function handleIvrSelection(req: Request, res: Response) {
  const { Digits, From, To, CallSid } = req.body;
  const attempt = parseInt(req.query.attempt as string) || parseInt(req.body.attempt as string) || 1;
  const forced = req.query.forced as string || req.body.forced as string;
  const menuId = parseInt(req.query.menuId as string) || parseInt(req.body.menuId as string);
  
  console.log(`[IVR SELECTION] CallSid=${CallSid}, From=${From}, To=${To}, Digits=${Digits}, attempt=${attempt}, forced=${forced}, menuId=${menuId}`);
  
  // Normalize phone number for lookup
  const normalizedTo = normalizePhoneNumber(To);
  
  // Look up tenant by phone number
  let phoneConfig: any[] = [];
  if (normalizedTo) {
    phoneConfig = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.phoneNumber, normalizedTo))
      .limit(1);
  }
  
  const tenantId = phoneConfig[0]?.tenantId || 'root';
  
  // Get callback base URL
  const callbackBaseUrl = getCallbackBaseUrl(req);
  
  // Fetch tenant's voicemail greeting URL (from phone_lines table)
  // NOTE: Query phone_lines directly (not via tenantDb) because phone lines 
  // are shared telephony assets that may be mapped to tenants via tenantPhoneConfig
  let voicemailGreetingUrl: string | null = null;
  try {
    if (normalizedTo) {
      // Query global phone_lines table directly by phone number
      const [phoneLine] = await db
        .select()
        .from(phoneLines)
        .where(eq(phoneLines.phoneNumber, normalizedTo))
        .limit(1);
      
      voicemailGreetingUrl = phoneLine?.voicemailGreetingUrl || null;
      
      if (voicemailGreetingUrl) {
        console.log(`[IVR SELECTION] tenant=${tenantId}, using custom voicemail greeting: ${voicemailGreetingUrl.substring(0, 50)}...`);
      }
    }
  } catch (greetingError) {
    console.error('[IVR SELECTION] Error fetching voicemail greeting URL:', greetingError);
  }
  
  // Handle forced voicemail (from dial failure) - always works same way
  if (forced === 'voicemail') {
    console.log(`[IVR SELECTION] tenant=${tenantId}, action=voicemail (forced after dial failure)`);
    const twiml = buildVoicemailTwiml(callbackBaseUrl, 'alice', voicemailGreetingUrl);
    res.type('text/xml');
    return res.send(twiml);
  }
  
  try {
    // Load IVR menu from database
    const menu = await getOrCreateDefaultMenuForTenant(tenantId);
    
    // Find menu item for the pressed digit
    const menuItem = findMenuItemByDigit(menu, Digits);
    
    if (!menuItem) {
      // Invalid digit - use config-driven invalid response
      console.log(`[IVR SELECTION] tenant=${tenantId}, action=invalid-selection (config), digits=${Digits}, attempt=${attempt}`);
      const twiml = buildConfigDrivenInvalidTwiml(menu, callbackBaseUrl, attempt);
      res.type('text/xml');
      return res.send(twiml);
    }
    
    console.log(`[IVR SELECTION] tenant=${tenantId}, digit=${Digits}, action=${menuItem.actionType}, label="${menuItem.label}"`);
    
    // Handle SMS_INFO action - send SMS before building response
    if (menuItem.actionType === 'SMS_INFO') {
      const payload = menuItem.actionPayload || {};
      const smsText = payload.smsText || `Thanks for calling! Here's our info.`;
      
      sendConfigDrivenSms(From, smsText, tenantId).catch(err => {
        console.error('[IVR SELECTION] Error sending SMS:', err);
      });
    }
    
    // Build TwiML for the action (pass voicemail greeting URL for VOICEMAIL actions)
    const twiml = buildActionTwiml(menuItem, menu, From, callbackBaseUrl, voicemailGreetingUrl);
    res.type('text/xml');
    res.send(twiml);
    
  } catch (error) {
    // Fallback to legacy hard-coded handlers
    console.error(`[IVR SELECTION] Error loading IVR config, using legacy fallback:`, error);
    
    // Get tenant business name for legacy fallback
    const tenantConfigData = await db
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    
    const businessName = tenantConfigData[0]?.businessName;
    const ivrConfig = getIvrConfigForTenant(tenantId, phoneConfig[0] || {}, businessName);
    
    let twiml: string;
    
    switch (Digits) {
      case '1':
        twiml = buildServicesOverviewTwiml(ivrConfig);
        sendBookingInfoSms(From, ivrConfig).catch(err => {
          console.error('[IVR SELECTION] Error sending booking SMS:', err);
        });
        break;
      
      case '2':
        twiml = buildForwardToPersonTwiml(ivrConfig, From, callbackBaseUrl);
        break;
      
      case '3':
        twiml = buildVoicemailTwiml(callbackBaseUrl, 'alice', voicemailGreetingUrl);
        break;
      
      case '7':
        twiml = buildEasterEggTwiml();
        break;
      
      default:
        twiml = buildInvalidSelectionTwiml(callbackBaseUrl, attempt);
        break;
    }
    
    res.type('text/xml');
    res.send(twiml);
  }
}

/**
 * Handle no input from caller (Config-Driven)
 * Replays menu up to max attempts, then politely hangs up
 */
async function handleNoInput(req: Request, res: Response) {
  const { From, To, CallSid } = req.body;
  const attempt = parseInt(req.query.attempt as string) || parseInt(req.body.attempt as string) || 1;
  const menuId = parseInt(req.query.menuId as string) || parseInt(req.body.menuId as string);
  
  console.log(`[IVR NO-INPUT] CallSid=${CallSid}, From=${From}, To=${To}, attempt=${attempt}, menuId=${menuId}`);
  
  const callbackBaseUrl = getCallbackBaseUrl(req);
  
  // Normalize phone number for lookup
  const normalizedTo = normalizePhoneNumber(To);
  
  // Look up tenant by phone number
  let phoneConfig: any[] = [];
  if (normalizedTo) {
    phoneConfig = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.phoneNumber, normalizedTo))
      .limit(1);
  }
  
  const tenantId = phoneConfig[0]?.tenantId || 'root';
  
  try {
    // Load IVR menu from database
    const menu = await getOrCreateDefaultMenuForTenant(tenantId);
    
    // Use config-driven no-input response
    const twiml = buildConfigDrivenNoInputTwiml(menu, callbackBaseUrl, attempt);
    res.type('text/xml');
    res.send(twiml);
    
  } catch (error) {
    // Fallback to legacy handler
    console.error(`[IVR NO-INPUT] Error loading IVR config, using legacy fallback:`, error);
    const twiml = buildNoInputTwiml(callbackBaseUrl, attempt);
    res.type('text/xml');
    res.send(twiml);
  }
}

/**
 * Handle SIP dial status callback
 * Routes to voicemail for no-answer, busy, failed, canceled
 * 
 * CM-VOICEMAIL-MISSED-CALL-SMS-FIX: Now sends missed call SMS for unanswered calls
 */
async function handleDialStatus(req: Request, res: Response) {
  const { DialCallStatus, DialCallSid, CallSid, From, To } = req.body;
  
  console.log(`[DIAL STATUS] CallSid=${CallSid}, DialCallSid=${DialCallSid}, Status=${DialCallStatus}, From=${From}`);
  
  const callbackBaseUrl = getCallbackBaseUrl(req);
  
  // Normalize phone number for lookup
  const normalizedTo = normalizePhoneNumber(To);
  
  // Look up tenant
  let phoneConfigResult: any[] = [];
  if (normalizedTo) {
    phoneConfigResult = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.phoneNumber, normalizedTo))
      .limit(1);
  }
  
  const tenantId = phoneConfigResult[0]?.tenantId || 'root';
  const tenantDb = wrapTenantDb(db, tenantId);
  
  // CM-VOICEMAIL-MISSED-CALL-SMS-FIX: Handle missed calls
  // Note: We send push notification here, but NOT SMS - SMS is sent later based on voicemail outcome:
  // - If caller leaves voicemail → AI reply sent at transcription callback
  // - If caller hangs up without voicemail → missed call SMS sent at voicemail-complete callback
  if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy' || DialCallStatus === 'failed' || DialCallStatus === 'canceled') {
    console.log(`[DIAL STATUS] Missed call from ${From} (${DialCallStatus}) - sending push notification, SMS will be sent after voicemail flow`);
    
    // Send push notification for missed call
    try {
      await sendPushToAllUsers({
        title: '📞 Missed Call',
        body: `Missed call from ${From}`,
        tag: `missed-call-${CallSid}`,
        requireInteraction: true,
        data: {
          type: 'missed_call',
          callerPhone: From,
          callSid: CallSid,
          status: DialCallStatus,
          url: '/messages',
        },
        actions: [
          { action: 'view', title: 'View' },
          { action: 'call_back', title: 'Call Back' },
        ],
      });
      console.log(`[DIAL STATUS] Push notification sent for missed call from ${From}`);
    } catch (pushError) {
      console.error('[DIAL STATUS] Failed to send missed call push notification:', pushError);
    }
    
    // SMS is intentionally NOT sent here - it will be sent by:
    // 1. voicemail-complete callback if no/short voicemail is left (send missed call SMS)
    // 2. voicemail-transcribed callback if voicemail is left (send AI reply)
    // This prevents double-texting while ensuring every caller gets exactly one response
  }
  
  const twiml = buildDialStatusTwiml(DialCallStatus, callbackBaseUrl);
  
  res.type('text/xml');
  res.send(twiml);
}

async function handleVoicemailComplete(req: Request, res: Response) {
  const { RecordingUrl, RecordingSid, CallSid, From, To } = req.body;
  
  // CM-VOICEMAIL-HARDEN: Log all fields for debugging
  console.log(`[VOICEMAIL COMPLETE] CallSid=${CallSid}, From=${From}, To=${To}, RecordingSid=${RecordingSid}, RecordingUrl=${RecordingUrl ? 'present' : 'MISSING'}`);
  
  // CM-VOICEMAIL-HARDEN: Validate required fields
  if (!CallSid) {
    console.error('[VOICEMAIL COMPLETE] CRITICAL: Missing CallSid in webhook payload:', JSON.stringify(req.body, null, 2));
  }
  if (!From) {
    console.error(`[VOICEMAIL COMPLETE] WARNING: Missing caller From number. CallSid=${CallSid}, raw payload:`, JSON.stringify(req.body, null, 2));
  }
  
  // Send confirmation TwiML (always respond to Twilio)
  const twiml = buildVoicemailCompleteTwiml();
  res.type('text/xml');
  res.send(twiml);
}

/**
 * Handle recording status callback from Twilio
 * 
 * CM-VOICEMAIL-MISSED-CALL-SMS-FIX: 
 * - If recording duration < 3s → no meaningful voicemail → send missed call SMS
 * - If recording duration >= 3s → voicemail left → AI reply sent at transcription callback
 * 
 * CM-VOICEMAIL-HARDEN: Added field validation to prevent ghost voicemails
 */
async function handleRecordingStatus(req: Request, res: Response) {
  const { RecordingUrl, RecordingSid, RecordingStatus, RecordingDuration, CallSid, From, To, TranscriptionText } = req.body;
  
  console.log(`[RECORDING STATUS] CallSid=${CallSid}, RecordingSid=${RecordingSid}, Status=${RecordingStatus}, Duration=${RecordingDuration}s`);
  
  // CM-VOICEMAIL-HARDEN: Validate required fields
  if (!CallSid) {
    console.error('[RECORDING STATUS] CRITICAL: Missing CallSid in webhook payload:', JSON.stringify(req.body, null, 2));
    return res.sendStatus(200); // Return early - can't process without CallSid
  }
  
  if (!From) {
    console.error(`[RECORDING STATUS] WARNING: Missing caller From number. CallSid=${CallSid}`);
    // Continue processing - we may still have useful recording data
  }
  
  if (!RecordingUrl && RecordingStatus === 'completed') {
    console.error(`[RECORDING STATUS] WARNING: Recording completed but no RecordingUrl. CallSid=${CallSid}, From=${From || 'UNKNOWN'}`);
    // Continue processing - sync a placeholder record
  }
  
  // Normalize phone number for lookup
  const normalizedTo = normalizePhoneNumber(To);
  
  // Look up tenant
  let phoneConfigResult: any[] = [];
  if (normalizedTo) {
    phoneConfigResult = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.phoneNumber, normalizedTo))
      .limit(1);
  }
  
  const tenantId = phoneConfigResult[0]?.tenantId || 'root';
  const tenantDb = wrapTenantDb(db, tenantId);
  
  if (RecordingStatus === 'completed') {
    console.log(`[RECORDING STATUS] Recording completed: ${RecordingUrl}`);
    
    // Get phone line ID for this number
    const [phoneLine] = await tenantDb
      .select()
      .from(phoneLines)
      .where(tenantDb.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, normalizedTo || To)))
      .limit(1);
    
    const phoneLineId = phoneLine?.id || 1;
    
    // Parse recording duration (Twilio sends as string)
    const durationSeconds = parseInt(RecordingDuration, 10) || 0;
    
    // CM-VOICEMAIL-MISSED-CALL-SMS-FIX: Check if voicemail was actually left
    // If recording is < 3 seconds, caller hung up without leaving a message
    if (durationSeconds < 3) {
      console.log(`[RECORDING STATUS] Short/no voicemail (${durationSeconds}s) - attempting to send missed call SMS to ${From}`);
      
      // Atomically claim the right to send SMS for this call (prevents race conditions)
      const claimed = await claimSmsForCall(CallSid, tenantId, 'missed_call', From);
      
      if (claimed) {
        // Get tenant config for dynamic message
        const [tenantCfg] = await tenantDb
          .select()
          .from(tenantConfig)
          .where(eq(tenantConfig.tenantId, tenantId))
          .limit(1);
        
        const businessName = tenantCfg?.businessName || 'the business';
        const bookingUrl = tenantCfg?.bookingUrl || 'our website';
        
        // Send tenant-branded missed call SMS
        try {
          const missedCallMessage = `Hey! Sorry we missed your call - this is ${businessName}. ` +
            `You can text here anytime and I'll help you out, or book online at ${bookingUrl}. ` +
            `Looking forward to hearing from you!`;
          
          await sendSMS(tenantDb, From, missedCallMessage);
          
          console.log(`[RECORDING STATUS] ✅ Sent missed call SMS to ${From}, CallSid=${CallSid}`);
        } catch (smsError) {
          console.error('[RECORDING STATUS] Failed to send missed call SMS:', smsError);
        }
      } else {
        console.log(`[RECORDING STATUS] SMS already claimed for CallSid=${CallSid}, skipping`);
      }
      
      // Still sync the short/empty recording
      try {
        const syncResult = await syncVoicemailIntoConversation(tenantDb, {
          fromPhone: From,
          toPhone: To,
          transcriptionText: '[Caller hung up without leaving a message]',
          recordingUrl: RecordingUrl,
          phoneLineId,
        });
        console.log(`[RECORDING STATUS] Short recording synced to conversation ${syncResult.conversationId}`);
      } catch (syncError) {
        console.error('[RECORDING STATUS] Error syncing short recording:', syncError);
      }
    } else {
      // Meaningful voicemail was left - sync to conversation
      // AI reply will be sent by voicemail-transcribed callback
      const initialTranscription = TranscriptionText || '[Voicemail received - transcription pending...]';
      
      try {
        const syncResult = await syncVoicemailIntoConversation(tenantDb, {
          fromPhone: From,
          toPhone: To,
          transcriptionText: initialTranscription,
          recordingUrl: RecordingUrl,
          phoneLineId,
        });
        
        console.log(`[RECORDING STATUS] Voicemail (${durationSeconds}s) synced to conversation ${syncResult.conversationId}`);
      } catch (syncError) {
        console.error('[RECORDING STATUS] Error syncing voicemail to conversation:', syncError);
      }
      
      // Notify tenant owner about voicemail (SMS + Push)
      notifyVoicemail(tenantId, From, RecordingUrl, RecordingSid, To).catch(err => {
        console.error('[RECORDING STATUS] Error notifying voicemail:', err);
      });
    }
  }
  
  res.sendStatus(200);
}

/**
 * Handle voicemail transcription callback from Twilio
 * This is called after the recording is transcribed
 * 
 * CM-VOICEMAIL-MISSED-CALL-SMS-FIX: 
 * - If transcription exists → send AI-powered contextual reply
 * - If transcription is empty (silent voicemail) → send fallback missed call SMS
 * This ensures every caller gets exactly one response
 * 
 * CM-VOICEMAIL-HARDEN: Added field validation
 */
async function handleVoicemailTranscribed(req: Request, res: Response) {
  const { TranscriptionText, TranscriptionSid, RecordingSid, RecordingUrl, CallSid, From, To } = req.body;
  
  console.log(`[VOICEMAIL TRANSCRIBED] CallSid=${CallSid}, RecordingSid=${RecordingSid}, TranscriptionSid=${TranscriptionSid}`);
  console.log(`[VOICEMAIL TRANSCRIBED] Text: ${TranscriptionText?.substring(0, 100) || '(empty)'}...`);
  
  // CM-VOICEMAIL-HARDEN: Validate required fields
  if (!CallSid) {
    console.error('[VOICEMAIL TRANSCRIBED] CRITICAL: Missing CallSid in webhook payload:', JSON.stringify(req.body, null, 2));
    return res.sendStatus(200); // Return early - can't process without CallSid
  }
  
  if (!From) {
    console.error(`[VOICEMAIL TRANSCRIBED] WARNING: Missing caller From number. CallSid=${CallSid}, TranscriptionSid=${TranscriptionSid}`);
    // Continue - we may still update existing record
  }
  
  // Normalize phone number for lookup first (needed for empty transcription case too)
  const normalizedTo = normalizePhoneNumber(To);
  
  // Look up tenant
  let phoneConfigResult: any[] = [];
  if (normalizedTo) {
    phoneConfigResult = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.phoneNumber, normalizedTo))
      .limit(1);
  }
  
  const tenantId = phoneConfigResult[0]?.tenantId || 'root';
  const tenantDb = wrapTenantDb(db, tenantId);
  
  // CM-VOICEMAIL-MISSED-CALL-SMS-FIX: Handle empty/silent voicemails
  // If transcription is empty, the caller left a silent voicemail - send fallback missed call SMS
  if (!TranscriptionText || TranscriptionText.trim().length === 0) {
    console.log(`[VOICEMAIL TRANSCRIBED] Empty/silent voicemail - attempting to send missed call SMS to ${From}`);
    
    // Atomically claim the right to send SMS for this call
    const claimed = await claimSmsForCall(CallSid, tenantId, 'missed_call_silent_voicemail', From);
    
    if (claimed) {
      // Get tenant config for dynamic message
      const [tenantCfg] = await tenantDb
        .select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);
      
      const businessName = tenantCfg?.businessName || 'the business';
      const bookingUrl = tenantCfg?.bookingUrl || 'our website';
      
      try {
        const missedCallMessage = `Hey! Sorry we missed your call - this is ${businessName}. ` +
          `You can text here anytime and I'll help you out, or book online at ${bookingUrl}. ` +
          `Looking forward to hearing from you!`;
        
        await sendSMS(tenantDb, From, missedCallMessage);
        console.log(`[VOICEMAIL TRANSCRIBED] ✅ Sent missed call SMS (silent voicemail) to ${From}`);
      } catch (smsError) {
        console.error('[VOICEMAIL TRANSCRIBED] Failed to send missed call SMS:', smsError);
      }
    } else {
      console.log(`[VOICEMAIL TRANSCRIBED] SMS already claimed for CallSid=${CallSid}, skipping`);
    }
    
    return res.sendStatus(200);
  }
  
  // Get phone line ID for valid transcription path
  const [phoneLine] = await tenantDb
    .select()
    .from(phoneLines)
    .where(tenantDb.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, normalizedTo || To)))
    .limit(1);
  
  const phoneLineId = phoneLine?.id || 1;
  
  try {
    // Sync the transcribed voicemail (updates existing or creates new)
    const syncResult = await syncVoicemailIntoConversation(tenantDb, {
      fromPhone: From,
      toPhone: To,
      transcriptionText: TranscriptionText,
      recordingUrl: RecordingUrl,
      phoneLineId,
    });
    
    console.log(`[VOICEMAIL TRANSCRIBED] Updated conversation ${syncResult.conversationId} with transcription`);
    
    // Send another push notification with the transcription summary
    sendVoicemailTranscriptionPush(tenantId, From, TranscriptionText).catch(err => {
      console.error('[VOICEMAIL TRANSCRIBED] Error sending transcription push:', err);
    });
    
  } catch (error) {
    console.error('[VOICEMAIL TRANSCRIBED] Error syncing transcription:', error);
  }
  
  // CM-VOICEMAIL-MISSED-CALL-SMS-FIX: Send AI-powered SMS reply to caller
  // This sends a contextual response based on the voicemail content
  if (TranscriptionText && TranscriptionText.trim().length > 0) {
    console.log(`[VOICEMAIL TRANSCRIBED] Attempting AI-powered SMS reply to ${From}`);
    
    // Atomically claim the right to send SMS for this call
    const claimed = await claimSmsForCall(CallSid, tenantId, 'ai_voicemail_reply', From);
    
    if (claimed) {
      try {
        // Use the AI conversational scheduling to generate a contextual response
        const aiResponse = await handleConversationalScheduling(
          TranscriptionText,
          From,
          'sms'
        );
        
        // Send AI-generated contextual response back to customer
        await sendSMS(tenantDb, From, aiResponse.response);
        
        console.log(`[VOICEMAIL TRANSCRIBED] ✅ Sent AI voicemail reply to ${From}: "${aiResponse.response.substring(0, 50)}..."`);
        
      } catch (aiError) {
        console.error('[VOICEMAIL TRANSCRIBED] Error sending AI voicemail reply:', aiError);
        
        // Fallback: Send a polite acknowledgment if AI fails
        // Note: We already claimed the SMS slot, so we can send fallback without re-claiming
        try {
          const fallbackMessage = "Thank you for your voicemail! I received your message and will get back to you shortly. Feel free to text me here if you have any questions.";
          await sendSMS(tenantDb, From, fallbackMessage);
          
          console.log(`[VOICEMAIL TRANSCRIBED] Sent fallback SMS to ${From}`);
        } catch (fallbackError) {
          console.error('[VOICEMAIL TRANSCRIBED] Error sending fallback SMS:', fallbackError);
        }
      }
    } else {
      console.log(`[VOICEMAIL TRANSCRIBED] SMS already claimed for CallSid=${CallSid}, skipping AI reply`);
    }
  }
  
  res.sendStatus(200);
}

async function sendBookingInfoSms(toNumber: string, ivrConfig: { businessName: string; bookingUrl: string }) {
  try {
    const twilioClient = await getTwilioClient();
    
    if (!twilioClient) {
      console.warn('[IVR SMS] Twilio client not configured, skipping SMS');
      return;
    }
    
    const message = `Thanks for calling ${ivrConfig.businessName}! Here's our info & booking link: ${ivrConfig.bookingUrl}`;
    const fromNumber = process.env.MAIN_PHONE_NUMBER || TWILIO_TEST_SMS_NUMBER;
    
    if (!fromNumber) {
      console.warn('[IVR SMS] No from number configured, skipping SMS');
      return;
    }
    
    await twilioClient.messages.create({
      to: toNumber,
      from: fromNumber,
      body: message,
    });
    
    console.log(`[IVR SMS] Sent booking info to ${toNumber}`);
  } catch (error) {
    console.error('[IVR SMS] Error sending booking info:', error);
  }
}

/**
 * Send config-driven SMS from IVR action
 * Used by SMS_INFO action type in config-driven IVR
 */
async function sendConfigDrivenSms(toNumber: string, smsText: string, tenantId: string) {
  try {
    const twilioClient = await getTwilioClient();
    
    if (!twilioClient) {
      console.warn('[IVR SMS] Twilio client not configured, skipping SMS');
      return;
    }
    
    // Get tenant's phone number for sending
    const [phoneConfig] = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.tenantId, tenantId))
      .limit(1);
    
    const fromNumber = phoneConfig?.phoneNumber || process.env.MAIN_PHONE_NUMBER || TWILIO_TEST_SMS_NUMBER;
    
    if (!fromNumber) {
      console.warn('[IVR SMS] No from number configured, skipping SMS');
      return;
    }
    
    await twilioClient.messages.create({
      to: toNumber,
      from: fromNumber,
      body: smsText,
    });
    
    console.log(`[IVR SMS] Sent config-driven SMS to ${toNumber} for tenant ${tenantId}`);
  } catch (error) {
    console.error('[IVR SMS] Error sending config-driven SMS:', error);
  }
}

async function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    return null;
  }
  
  const twilio = await import('twilio');
  return twilio.default(accountSid, authToken);
}

async function notifyVoicemail(
  tenantId: string,
  callerNumber: string,
  recordingUrl: string,
  recordingSid: string,
  toNumber: string
) {
  try {
    // 1. Send SMS notification to business owner
    const twilioClient = await getTwilioClient();
    
    // Use BUSINESS_OWNER_PERSONAL_PHONE env var or fall back to tenant config
    const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
    const fromNumber = process.env.MAIN_PHONE_NUMBER || TWILIO_TEST_SMS_NUMBER;
    
    if (twilioClient && ownerPhone && fromNumber) {
      const message = `🎙️ New voicemail from ${callerNumber}. Recording: ${recordingUrl}`;
      
      await twilioClient.messages.create({
        to: ownerPhone,
        from: fromNumber,
        body: message,
      });
      
      console.log(`[IVR VOICEMAIL] SMS sent to owner ${ownerPhone}`);
    } else {
      console.warn('[IVR VOICEMAIL] Missing Twilio client, owner phone, or from number for SMS');
    }
    
    // 2. Send push notification to all users (PWA)
    const pushPayload = {
      title: '🎙️ New Voicemail',
      body: `Voicemail from ${callerNumber}`,
      tag: `voicemail-${recordingSid}`,
      requireInteraction: true,
      data: {
        type: 'voicemail',
        callerNumber,
        recordingUrl,
        recordingSid,
        toNumber,
        url: '/messages',
      },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };
    
    await sendPushToAllUsers(pushPayload);
    console.log(`[IVR VOICEMAIL] Push notification sent for voicemail from ${callerNumber}`);
    
  } catch (error) {
    console.error('[IVR VOICEMAIL] Error notifying voicemail:', error);
  }
}

async function sendVoicemailTranscriptionPush(
  tenantId: string,
  callerNumber: string,
  transcription: string
) {
  try {
    // Truncate transcription for push notification
    const shortTranscription = transcription.length > 100 
      ? transcription.substring(0, 100) + '...' 
      : transcription;
    
    const pushPayload = {
      title: '📝 Voicemail Transcribed',
      body: `${callerNumber}: "${shortTranscription}"`,
      tag: `voicemail-transcription-${Date.now()}`,
      data: {
        type: 'voicemail_transcription',
        callerNumber,
        transcription,
        url: '/messages',
      },
    };
    
    await sendPushToAllUsers(pushPayload);
    console.log(`[IVR VOICEMAIL] Transcription push sent for ${callerNumber}`);
  } catch (error) {
    console.error('[IVR VOICEMAIL] Error sending transcription push:', error);
  }
}
