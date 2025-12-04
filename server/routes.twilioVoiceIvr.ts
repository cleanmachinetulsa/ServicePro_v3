/**
 * Phase 2.3: IVR Callback Routes
 * 
 * Handles DTMF selections from the IVR menu and generates appropriate TwiML responses.
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
  getIvrConfigForTenant,
} from './services/ivrHelper';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { TWILIO_TEST_SMS_NUMBER } from './twilioClient';
import { syncVoicemailIntoConversation } from './services/voicemailConversationService';
import { sendPushToAllUsers, sendPushNotification } from './pushNotificationService';

export function registerIvrRoutes(app: Express) {
  app.post('/twilio/voice/ivr-selection', verifyTwilioSignature, handleIvrSelection);
  app.post('/twilio/voice/voicemail-complete', verifyTwilioSignature, handleVoicemailComplete);
  app.post('/twilio/voice/recording-status', verifyTwilioSignature, handleRecordingStatus);
  app.post('/twilio/voice/voicemail-transcribed', verifyTwilioSignature, handleVoicemailTranscribed);
  
  console.log('[IVR ROUTES] Routes registered: POST /twilio/voice/ivr-selection, /voicemail-complete, /recording-status, /voicemail-transcribed');
}

async function handleIvrSelection(req: Request, res: Response) {
  const { Digits, From, To, CallSid } = req.body;
  
  console.log(`[IVR SELECTION] CallSid=${CallSid}, From=${From}, To=${To}, Digits=${Digits}`);
  
  // Look up tenant by phone number
  const phoneConfig = await db
    .select()
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.phoneNumber, To))
    .limit(1);
  
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
  
  // Get callback base URL from request host header (works in both dev and production)
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'] || req.headers['x-forwarded-host'] || process.env.REPLIT_DEV_DOMAIN;
  const callbackBaseUrl = `${protocol}://${host}`;
  
  let twiml: string;
  
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
      console.log(`[IVR SELECTION] tenant=${tenantId}, action=forward-to-person`);
      twiml = buildForwardToPersonTwiml(ivrConfig, From);
      break;
    
    case '3':
      console.log(`[IVR SELECTION] tenant=${tenantId}, action=voicemail`);
      twiml = buildVoicemailTwiml(callbackBaseUrl);
      break;
    
    case '7':
      console.log(`[IVR SELECTION] tenant=${tenantId}, action=easter-egg`);
      twiml = buildEasterEggTwiml();
      break;
    
    default:
      console.log(`[IVR SELECTION] tenant=${tenantId}, action=invalid-selection, digits=${Digits}`);
      twiml = buildInvalidSelectionTwiml(callbackBaseUrl);
      break;
  }
  
  res.type('text/xml');
  res.send(twiml);
}

async function handleVoicemailComplete(req: Request, res: Response) {
  const { RecordingUrl, RecordingSid, CallSid, From, To } = req.body;
  
  console.log(`[VOICEMAIL COMPLETE] CallSid=${CallSid}, From=${From}, RecordingSid=${RecordingSid}`);
  
  // Note: Push notification is handled by recording-status callback (handleRecordingStatus)
  // when RecordingStatus=completed. This avoids duplicate notifications and ensures
  // proper tenant scoping through notifyVoicemail().
  
  // Send confirmation TwiML
  const twiml = buildVoicemailCompleteTwiml();
  res.type('text/xml');
  res.send(twiml);
}

async function handleRecordingStatus(req: Request, res: Response) {
  const { RecordingUrl, RecordingSid, RecordingStatus, CallSid, From, To, TranscriptionText } = req.body;
  
  console.log(`[RECORDING STATUS] CallSid=${CallSid}, RecordingSid=${RecordingSid}, Status=${RecordingStatus}`);
  
  // Look up tenant
  const phoneConfig = await db
    .select()
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.phoneNumber, To))
    .limit(1);
  
  const tenantId = phoneConfig[0]?.tenantId || 'root';
  
  if (RecordingStatus === 'completed') {
    console.log(`[RECORDING STATUS] Recording completed: ${RecordingUrl}`);
    
    // Get phone line ID for this number
    const tenantDb = wrapTenantDb(db, tenantId);
    const [phoneLine] = await tenantDb
      .select()
      .from(phoneLines)
      .where(tenantDb.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, To)))
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
  
  // Look up tenant
  const phoneConfig = await db
    .select()
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.phoneNumber, To))
    .limit(1);
  
  const tenantId = phoneConfig[0]?.tenantId || 'root';
  const tenantDb = wrapTenantDb(db, tenantId);
  
  // Get phone line ID
  const [phoneLine] = await tenantDb
    .select()
    .from(phoneLines)
    .where(tenantDb.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, To)))
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
