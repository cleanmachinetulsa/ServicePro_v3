/**
 * Phase 2.3: IVR Callback Routes
 * 
 * Handles DTMF selections from the IVR menu and generates appropriate TwiML responses.
 */

import type { Express, Request, Response } from 'express';
import { db } from './db';
import { tenantPhoneConfig, tenantConfig } from '../shared/schema';
import { eq } from 'drizzle-orm';
import {
  buildServicesOverviewTwiml,
  buildForwardToPersonTwiml,
  buildVoicemailTwiml,
  buildVoicemailCompleteTwiml,
  buildEasterEggTwiml,
  buildInvalidSelectionTwiml,
  getIvrConfigForTenant,
} from './services/ivrHelper';
import { verifyTwilioSignature } from './twilioSecurity';

export function registerIvrRoutes(app: Express) {
  app.post('/twilio/voice/ivr-selection', verifyTwilioSignature, handleIvrSelection);
  app.post('/twilio/voice/voicemail-complete', verifyTwilioSignature, handleVoicemailComplete);
  app.post('/twilio/voice/recording-status', verifyTwilioSignature, handleRecordingStatus);
  
  console.log('[IVR ROUTES] Routes registered: POST /twilio/voice/ivr-selection, /voicemail-complete, /recording-status');
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
  const callbackBaseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'https://your-domain.repl.co';
  
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
  
  // Send confirmation TwiML
  const twiml = buildVoicemailCompleteTwiml();
  res.type('text/xml');
  res.send(twiml);
}

async function handleRecordingStatus(req: Request, res: Response) {
  const { RecordingUrl, RecordingSid, RecordingStatus, CallSid, From, To } = req.body;
  
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
    
    // Notify tenant owner about voicemail (async, don't wait)
    notifyVoicemail(tenantId, From, RecordingUrl, RecordingSid).catch(err => {
      console.error('[RECORDING STATUS] Error notifying voicemail:', err);
    });
  }
  
  res.sendStatus(200);
}

async function sendBookingInfoSms(toNumber: string, ivrConfig: { businessName: string; bookingUrl: string }) {
  try {
    // Use existing SMS infrastructure
    const { sendSms } = await import('./smsService');
    
    const message = `Thanks for calling ${ivrConfig.businessName}! Here's our info & booking link: ${ivrConfig.bookingUrl}`;
    
    await sendSms({
      to: toNumber,
      message,
      tenantId: 'root', // TODO: Use actual tenantId from ivrConfig
    });
    
    console.log(`[IVR SMS] Sent booking info to ${toNumber}`);
  } catch (error) {
    console.error('[IVR SMS] Error sending booking info:', error);
    throw error;
  }
}

async function notifyVoicemail(
  tenantId: string,
  callerNumber: string,
  recordingUrl: string,
  recordingSid: string
) {
  try {
    // Use existing SMS infrastructure to notify business owner
    const { sendSms } = await import('./smsService');
    
    // TODO: Phase 3 - Get owner phone from tenant config
    const ownerPhone = '+19185551234'; // Placeholder - will be loaded from tenant settings
    
    const message = `🎙️ New voicemail from ${callerNumber}. Recording: ${recordingUrl}`;
    
    await sendSms({
      to: ownerPhone,
      message,
      tenantId,
    });
    
    console.log(`[IVR VOICEMAIL] Notified ${ownerPhone} about voicemail from ${callerNumber}`);
  } catch (error) {
    console.error('[IVR VOICEMAIL] Error notifying voicemail:', error);
    throw error;
  }
}
