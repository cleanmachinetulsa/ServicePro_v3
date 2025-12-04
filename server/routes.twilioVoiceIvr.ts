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
import { tenantPhoneConfig, tenantConfig, users, phoneLines } from '../shared/schema';
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
} from './services/ivrHelper';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { TWILIO_TEST_SMS_NUMBER } from './twilioClient';
import { syncVoicemailIntoConversation } from './services/voicemailConversationService';
import { sendPushToAllUsers, sendPushNotification } from './pushNotificationService';

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
 * Handle IVR digit selection
 * Valid digits: 1 (services/SMS), 2 (talk to person), 3 (voicemail), 7 (easter egg)
 */
async function handleIvrSelection(req: Request, res: Response) {
  const { Digits, From, To, CallSid } = req.body;
  const attempt = parseInt(req.query.attempt as string) || parseInt(req.body.attempt as string) || 1;
  const forced = req.query.forced as string || req.body.forced as string;
  
  console.log(`[IVR SELECTION] CallSid=${CallSid}, From=${From}, To=${To}, Digits=${Digits}, attempt=${attempt}, forced=${forced}`);
  
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
  
  // Get tenant business name
  const tenantConfigData = await db
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);
  
  const businessName = tenantConfigData[0]?.businessName;
  
  // Build IVR config
  const ivrConfig = getIvrConfigForTenant(tenantId, phoneConfig[0] || {}, businessName);
  
  // Get callback base URL
  const callbackBaseUrl = getCallbackBaseUrl(req);
  
  let twiml: string;
  
  // Handle forced voicemail (from dial failure)
  if (forced === 'voicemail' || Digits === '3') {
    console.log(`[IVR SELECTION] tenant=${tenantId}, action=voicemail${forced ? ' (forced after dial failure)' : ''}`);
    twiml = buildVoicemailTwiml(callbackBaseUrl);
    res.type('text/xml');
    return res.send(twiml);
  }
  
  switch (Digits) {
    case '1':
      console.log(`[IVR SELECTION] tenant=${tenantId}, action=services-overview`);
      twiml = buildServicesOverviewTwiml(ivrConfig);
      
      // Trigger SMS with booking info (async, don't wait)
      sendBookingInfoSms(From, ivrConfig).catch(err => {
        console.error('[IVR SELECTION] Error sending booking SMS:', err);
      });
      break;
    
    case '2':
      console.log(`[IVR SELECTION] tenant=${tenantId}, action=forward-to-person, SIP=${ivrConfig.sipUsername}@${ivrConfig.sipDomain}`);
      twiml = buildForwardToPersonTwiml(ivrConfig, From, callbackBaseUrl);
      break;
    
    case '7':
      console.log(`[IVR SELECTION] tenant=${tenantId}, action=easter-egg`);
      twiml = buildEasterEggTwiml();
      break;
    
    default:
      // Invalid digit - check if we should retry or hang up
      console.log(`[IVR SELECTION] tenant=${tenantId}, action=invalid-selection, digits=${Digits}, attempt=${attempt}`);
      twiml = buildInvalidSelectionTwiml(callbackBaseUrl, attempt);
      break;
  }
  
  res.type('text/xml');
  res.send(twiml);
}

/**
 * Handle no input from caller (timeout on <Gather>)
 * Replays menu up to 3 times, then politely hangs up
 */
async function handleNoInput(req: Request, res: Response) {
  const { From, To, CallSid } = req.body;
  const attempt = parseInt(req.query.attempt as string) || parseInt(req.body.attempt as string) || 1;
  
  console.log(`[IVR NO-INPUT] CallSid=${CallSid}, From=${From}, To=${To}, attempt=${attempt}`);
  
  const callbackBaseUrl = getCallbackBaseUrl(req);
  const twiml = buildNoInputTwiml(callbackBaseUrl, attempt);
  
  res.type('text/xml');
  res.send(twiml);
}

/**
 * Handle SIP dial status callback
 * Routes to voicemail for no-answer, busy, failed, canceled
 */
async function handleDialStatus(req: Request, res: Response) {
  const { DialCallStatus, DialCallSid, CallSid, From, To } = req.body;
  
  console.log(`[DIAL STATUS] CallSid=${CallSid}, DialCallSid=${DialCallSid}, Status=${DialCallStatus}, From=${From}`);
  
  const callbackBaseUrl = getCallbackBaseUrl(req);
  const twiml = buildDialStatusTwiml(DialCallStatus, callbackBaseUrl);
  
  res.type('text/xml');
  res.send(twiml);
}

async function handleVoicemailComplete(req: Request, res: Response) {
  const { RecordingUrl, RecordingSid, CallSid, From, To } = req.body;
  
  console.log(`[VOICEMAIL COMPLETE] CallSid=${CallSid}, From=${From}, RecordingSid=${RecordingSid}`);
  
  // Send confirmation TwiML
  const twiml = buildVoicemailCompleteTwiml();
  res.type('text/xml');
  res.send(twiml);
}

async function handleRecordingStatus(req: Request, res: Response) {
  const { RecordingUrl, RecordingSid, RecordingStatus, CallSid, From, To, TranscriptionText } = req.body;
  
  console.log(`[RECORDING STATUS] CallSid=${CallSid}, RecordingSid=${RecordingSid}, Status=${RecordingStatus}`);
  
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
  
  if (RecordingStatus === 'completed') {
    console.log(`[RECORDING STATUS] Recording completed: ${RecordingUrl}`);
    
    // Get phone line ID for this number
    const tenantDb = wrapTenantDb(db, tenantId);
    const [phoneLine] = await tenantDb
      .select()
      .from(phoneLines)
      .where(tenantDb.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, normalizedTo || To)))
      .limit(1);
    
    const phoneLineId = phoneLine?.id || 1;
    
    // Sync voicemail into conversation with placeholder text (transcription comes later)
    const initialTranscription = TranscriptionText || '[Voicemail received - transcription pending...]';
    
    try {
      const syncResult = await syncVoicemailIntoConversation(tenantDb, {
        fromPhone: From,
        toPhone: To,
        transcriptionText: initialTranscription,
        recordingUrl: RecordingUrl,
        phoneLineId,
      });
      
      console.log(`[RECORDING STATUS] Voicemail synced to conversation ${syncResult.conversationId}`);
    } catch (syncError) {
      console.error('[RECORDING STATUS] Error syncing voicemail to conversation:', syncError);
    }
    
    // Notify tenant owner about voicemail (SMS + Push)
    notifyVoicemail(tenantId, From, RecordingUrl, RecordingSid, To).catch(err => {
      console.error('[RECORDING STATUS] Error notifying voicemail:', err);
    });
  }
  
  res.sendStatus(200);
}

/**
 * Handle voicemail transcription callback from Twilio
 * This is called after the recording is transcribed
 */
async function handleVoicemailTranscribed(req: Request, res: Response) {
  const { TranscriptionText, TranscriptionSid, RecordingSid, RecordingUrl, CallSid, From, To } = req.body;
  
  console.log(`[VOICEMAIL TRANSCRIBED] CallSid=${CallSid}, RecordingSid=${RecordingSid}, TranscriptionSid=${TranscriptionSid}`);
  console.log(`[VOICEMAIL TRANSCRIBED] Text: ${TranscriptionText?.substring(0, 100)}...`);
  
  if (!TranscriptionText) {
    console.log('[VOICEMAIL TRANSCRIBED] No transcription text received');
    return res.sendStatus(200);
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
  
  // Get phone line ID
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
