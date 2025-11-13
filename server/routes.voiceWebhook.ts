import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { db } from './db';
import { notificationSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { handleConversationalScheduling } from './conversationalScheduling';
import { sendSMS } from './notifications';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { getWebSocketServer } from './websocketService';
import { requireTechnician } from './technicianMiddleware';

const router = Router();
const VoiceResponse = twilio.twiml.VoiceResponse;
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

// Helper function to get voice webhook settings
async function getVoiceSettings() {
  try {
    const [settings] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.settingKey, 'voice_webhook'))
      .limit(1);

    if (!settings || !settings.enabled) {
      return null; // Feature disabled
    }

    return settings.config as any;
  } catch (error) {
    console.error('[VOICE] Error fetching settings:', error);
    return null;
  }
}

/**
 * Twilio Voice Webhook - Handles incoming calls with business hours routing
 * 
 * Flow:
 * 1. Check business hours for the called number
 * 2. During business hours: Direct forward to business owner
 * 3. After hours: Show IVR menu
 * 
 * IVR Menu:
 * Press 1: Receive booking SMS with link to web app
 * Press 2: Transfer call to business owner
 * 
 * SECURITY: Twilio signature verification enabled
 */
router.post('/voice', verifyTwilioSignature, async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const callerPhone = req.body.From;
  const twilioPhone = req.body.To;
  const callSid = req.body.CallSid;

  console.log(`[VOICE] Incoming call from ${callerPhone} to ${twilioPhone}, CallSid: ${callSid}`);

  // Log the incoming call
  try {
    const { logCallEvent } = await import('./callLoggingService');
    await logCallEvent({
      callSid,
      direction: 'inbound',
      from: callerPhone,
      to: twilioPhone,
      status: 'ringing',
    });
  } catch (error) {
    console.error('[VOICE] Failed to log call event:', error);
  }

  // Check business hours routing for this phone line
  let routing = { shouldForward: false, forwardingNumber: null, voicemailGreeting: null };
  try {
    const { getPhoneLineRoutingDecision } = await import('./routes.phoneSettings');
    routing = await getPhoneLineRoutingDecision(twilioPhone);
    console.log(`[VOICE] Routing decision for ${twilioPhone}:`, routing);
  } catch (error) {
    console.error('[VOICE] Error checking business hours, defaulting to IVR:', error);
    // Fail-safe: If business hours check fails, fall back to IVR menu
  }

  // If during business hours and forwarding enabled, skip IVR and forward directly
  if (routing.shouldForward && routing.forwardingNumber) {
    console.log(`[VOICE] Business hours active - forwarding ${callerPhone} to ${routing.forwardingNumber}`);

    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Please hold while we connect you.');

    // Get ring duration from notification settings
    const [voiceSettings] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.settingKey, 'voice_webhook'))
      .limit(1);

    const ringDuration = voiceSettings?.config?.ringDuration || 20; // Default to 20 seconds

    console.log(`[VOICE] Forwarding call to ${routing.forwardingNumber} for ${twilioPhone} (ring duration: ${ringDuration}s)`);

    const dial = twiml.dial({
      timeout: ringDuration,
      action: '/api/voice/call-status',
      method: 'POST',
      // Show business line number to owner so they know it's a business call
      callerId: twilioPhone,
    });

    dial.number(routing.forwardingNumber);
  } else {
    // After hours or forwarding disabled - show IVR menu
    console.log(`[VOICE] After hours or forwarding disabled - showing IVR menu`);

    const gather = twiml.gather({
      numDigits: 1,
      action: '/api/voice/menu-selection',
      method: 'POST',
      timeout: 8,
    });

    // Use custom voicemail greeting if available, otherwise default IVR message
    const greeting = routing.voicemailGreeting || 
      'Thank you for calling Clean Machine Auto Detail. Press 1 to receive a text message with booking information and a link to our web app. Press 2 to speak with someone.';

    gather.say({
      voice: 'alice',
      language: 'en-US'
    }, greeting);

    // If no input, repeat the menu
    twiml.redirect('/api/voice/voice');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * IVR Menu Selection Handler
 * Handles customer's menu choice (1 or 2)
 */
router.post('/menu-selection', verifyTwilioSignature, async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const choice = req.body.Digits;
  const callerPhone = req.body.From;
  const callSid = req.body.CallSid;

  console.log(`[VOICE] Menu selection: ${choice} from ${callerPhone}`);

  if (choice === '1') {
    // Press 1: Send booking SMS with link
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Perfect! I\'m sending you a text message right now with booking information and a link to our web app. Have a great day!');

    // Send SMS with booking link
    try {
      const bookingMessage = `Thanks for calling Clean Machine Auto Detail! 📱\n\nBook online: https://cleanmachinetulsa.com\n\nNeed help? Just reply to this message and I'll assist you with scheduling, pricing, or any questions!\n\n- Clean Machine Auto Detail`;
      await sendSMS(callerPhone, bookingMessage);
      console.log(`[VOICE] Sent booking SMS to ${callerPhone}`);
    } catch (error) {
      console.error('[VOICE] Failed to send booking SMS:', error);
    }

    twiml.hangup();
  } else if (choice === '2') {
    // Press 2: Transfer to business owner
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Connecting you now. Please hold.');

    const businessPhone = process.env.BUSINESS_OWNER_PHONE;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (businessPhone) {
      const dial = twiml.dial({
        timeout: 20,
        action: '/api/voice/call-status',
        method: 'POST',
        // Show YOUR business number as caller ID instead of customer's number
        // This way you know it's a business call and not spam
        callerId: twilioPhone || callerPhone
      });

      dial.number(businessPhone);
    } else {
      twiml.say({
        voice: 'alice',
        language: 'en-US'
      }, 'Sorry, I\'m unable to transfer your call right now. Please leave a voicemail after the beep.');

      twiml.record({
        timeout: 10,
        transcribe: true,
        transcribeCallback: '/api/voice/transcription',
        maxLength: 120,
      });
    }
  } else {
    // Invalid choice - redirect back to menu
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Sorry, that wasn\'t a valid option.');
    twiml.redirect('/api/voice/voice');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Call Status Webhook - Triggered after dial attempt
 * Determines if call was answered, busy, or no-answer
 */
router.post('/call-status', verifyTwilioSignature, async (req: Request, res: Response) => {
  const dialCallStatus = req.body.DialCallStatus;
  const callerPhone = req.body.From;
  const callSid = req.body.CallSid;
  // Use DialCallDuration for <Dial action> callbacks, fallback to CallDuration for status callbacks
  const callDuration = req.body.DialCallDuration ? parseInt(req.body.DialCallDuration) : 
                       req.body.CallDuration ? parseInt(req.body.CallDuration) : undefined;

  console.log(`[VOICE] Call status: ${dialCallStatus} from ${callerPhone}, CallSid: ${callSid}, Duration: ${callDuration}`);

  // Update call event with final status
  try {
    const { updateCallEvent } = await import('./callLoggingService');
    await updateCallEvent(callSid, {
      status: dialCallStatus,
      duration: callDuration,
      endedAt: new Date(),
    });
  } catch (error) {
    console.error('[VOICE] Failed to update call event:', error);
  }

  // 🔴 REAL-TIME: Broadcast call status to connected clients
  const io = getWebSocketServer();
  if (io) {
    io.to('monitoring').emit('call_status_update', {
      callSid,
      status: dialCallStatus,
      from: callerPhone,
      duration: callDuration,
      timestamp: new Date().toISOString(),
    });
    console.log('[WEBSOCKET] Call status update broadcast:', callSid, dialCallStatus);
  }

  const twiml = new VoiceResponse();

  // Handle missed calls - send automatic SMS
  if (dialCallStatus === 'no-answer' || dialCallStatus === 'busy' || dialCallStatus === 'failed') {
    console.log(`[VOICE] Missed call from ${callerPhone} - sending automatic SMS`);

    // Send automatic SMS response
    try {
      await sendMissedCallSMS(callerPhone);
    } catch (error) {
      console.error('[VOICE] Failed to send missed call SMS:', error);
    }

    // Offer voicemail
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Sorry we missed your call. We\'ve sent you a text message. You can also leave a voicemail after the beep.');

    twiml.record({
      timeout: 10,
      transcribe: true,
      transcribeCallback: '/api/voice/transcription',
      maxLength: 120,
    });
  } else if (dialCallStatus === 'completed') {
    // Call was answered successfully
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Thank you for calling. Goodbye.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Voicemail Transcription Webhook
 * Receives transcribed voicemail text and sends through AI agent for intelligent response
 */
router.post('/transcription', verifyTwilioSignature, async (req: Request, res: Response) => {
  const transcriptionText = req.body.TranscriptionText;
  const callerPhone = req.body.From;
  const recordingUrl = req.body.RecordingUrl;
  const callSid = req.body.CallSid;
  const recordingSid = req.body.RecordingSid;
  const transcriptionStatus = req.body.TranscriptionStatus;

  console.log(`[VOICE] Voicemail transcription from ${callerPhone}: ${transcriptionText}`);

  // Update call event with transcription and recording
  try {
    const { updateCallEvent } = await import('./callLoggingService');
    await updateCallEvent(callSid, {
      transcriptionText,
      transcriptionStatus,
      recordingUrl,
      recordingSid,
    });
  } catch (error) {
    console.error('[VOICE] Failed to update call event with transcription:', error);
  }

  // Send transcription to business phone for record-keeping
  try {
    const businessPhone = process.env.BUSINESS_OWNER_PHONE;
    if (businessPhone) {
      await sendVoicemailNotification(businessPhone, callerPhone, transcriptionText, recordingUrl);
    }
  } catch (error) {
    console.error('[VOICE] Failed to send voicemail notification:', error);
  }

  // AI AUTO-REPLY: Send transcription through GPT agent for intelligent, contextual response
  if (transcriptionText && transcriptionText.trim().length > 0) {
    console.log(`[VOICE] Sending voicemail through AI agent for intelligent response to ${callerPhone}`);

    try {
      const aiResponse = await handleConversationalScheduling(
        transcriptionText,
        callerPhone,
        'sms'
      );

      // Send AI-generated contextual response back to customer
      await sendSMS(callerPhone, aiResponse.response);

      console.log(`[VOICE] ✅ Sent AI-powered response to customer: ${callerPhone}`);
    } catch (error) {
      console.error('[VOICE] Failed to send AI response to voicemail:', error);
      // Fallback: Send acknowledgment even if AI fails
      await sendSMS(
        callerPhone,
        "Thank you for your voicemail! I received your message and will get back to you shortly."
      );
    }
  }

  res.status(200).send('OK');
});

/**
 * Send automatic AI-powered response to caller who got a missed call
 * This initiates an intelligent conversation that checks calendar and books appointments
 */
async function sendMissedCallSMS(toPhone: string) {
  console.log(`[VOICE] Initiating AI conversation for missed call from ${toPhone}`);

  // Get dynamic settings to check if AI mode is enabled
  const settings = await getVoiceSettings();

  // Check if AI conversation mode is enabled (default to true for intelligent responses)
  const useAIMode = settings?.useAIConversation !== false;

  if (useAIMode) {
    // INTELLIGENT MODE: AI checks calendar and provides real available times
    console.log(`[VOICE] Using AI conversation mode for ${toPhone}`);

    try {
      // Trigger AI conversation with context that customer called
      const initialMessage = "I'm calling about getting my vehicle detailed and would like to know your available times.";

      const result = await handleConversationalScheduling(
        initialMessage,
        toPhone,
        'sms'
      );

      // Send the AI-generated response with real calendar availability
      await sendSMS(toPhone, result.response);

      console.log(`[VOICE] Sent intelligent AI response to ${toPhone}`);
    } catch (error) {
      console.error('[VOICE] Error in AI conversation mode:', error);
      // Fallback to simple greeting if AI fails
      await sendSMS(
        toPhone,
        "Hi! This is Clean Machine Auto Detail. Sorry we missed your call! I can help you book an appointment. What service are you interested in?"
      );
    }
  } else {
    // STATIC MODE: Send pre-configured template message
    console.log(`[VOICE] Using static message mode for ${toPhone}`);

    const message = settings?.autoReplyMessage || `Hi, it's Jody with Clean Machine Auto Detail, sorry I missed you! How can I help you today?

Here are some of our most popular services. You can also see all of our available services, book online, read reviews and more by visiting cleanmachinetulsa.com

FULL DETAIL | $225-300 

Including Deep Interior Cleaning and Complete Exterior Wash & Wax, we aim make your vehicle look and feel like new!


•DEEP INTERIOR CLEANING | $150-250

Includes upholstery & carpet shampoo, steam cleaning of all surfaces, windows, leather conditioning and more.


•COMPLETE EXTERIOR DETAIL | $150-175

Including our Hand Wash & Wax PLUS 1-step Polish, removing light swirls and oxidation, restoring brilliant paint luster and shine!


•MINI DETAIL | $150-175 

Our routine service includes a premium Hand Wash & Wax PLUS a Basic Interior Cleaning; vacuum/wipedown/glass cleaning. 


*Add-on services -

•Leather / Upholstery protector | $50-60

•Paint polishing | $75-100

•Headlight Restoration | $25ea


May I answer any questions or get your vehicle scheduled?`;

    await sendSMS(toPhone, message);
    console.log(`[VOICE] Sent static template SMS to ${toPhone}`);
  }
}

/**
 * Send voicemail notification to business phone
 */
async function sendVoicemailNotification(toPhone: string, fromPhone: string, transcription: string, recordingUrl: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhone) {
    throw new Error('Twilio credentials not configured');
  }

  const client = twilio(accountSid, authToken);

  const message = `New voicemail from ${fromPhone}:\n\n"${transcription}"\n\nListen: ${recordingUrl}`;

  await client.messages.create({
    body: message,
    from: twilioPhone,
    to: toPhone,
  });

  console.log(`[VOICE] Sent voicemail notification to ${toPhone}`);
}

/**
 * Click-to-Call - Initiate an outbound call to connect operator with customer
 * POST /api/voice/click-to-call
 * Body: { customerPhone: string }
 */
router.post('/click-to-call', async (req: Request, res: Response) => {
  try {
    const { customerPhone } = req.body;

    if (!customerPhone) {
      return res.status(400).json({ error: 'Customer phone number is required' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    const businessPhone = process.env.BUSINESS_OWNER_PHONE;

    if (!accountSid || !authToken || !twilioPhone || !businessPhone) {
      return res.status(500).json({ error: 'Twilio or business phone not configured' });
    }

    // Get public base URL (works in both dev and production)
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.PUBLIC_URL || 'https://cleanmachine.app';

    if (!baseUrl) {
      return res.status(500).json({ error: 'Public URL not configured' });
    }

    const client = twilio(accountSid, authToken);

    // Create TwiML for the call
    const twimlUrl = `${baseUrl}/api/voice/connect-customer?phone=${encodeURIComponent(customerPhone)}`;

    // Initiate call to business phone first (operator)
    const call = await client.calls.create({
      from: twilioPhone,
      to: businessPhone,
      url: twimlUrl,
      statusCallback: `${baseUrl}/api/voice/click-to-call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    console.log(`[VOICE] Click-to-call initiated: CallSid ${call.sid}, connecting ${businessPhone} to ${customerPhone}`);

    // Log the outbound call
    try {
      const { logCallEvent } = await import('./callLoggingService');
      await logCallEvent({
        callSid: call.sid,
        direction: 'outbound',
        from: twilioPhone,
        to: customerPhone,
        status: 'initiated',
      });
    } catch (error) {
      console.error('[VOICE] Failed to log click-to-call event:', error);
    }

    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    console.error('[VOICE] Click-to-call error:', error);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
});

/**
 * Connect Customer TwiML - Called when operator answers
 */
router.post('/connect-customer', verifyTwilioSignature, async (req: Request, res: Response) => {
  const customerPhone = req.query.phone as string;
  const twiml = new VoiceResponse();

  if (!customerPhone) {
    twiml.say({ voice: 'alice' }, 'Error: Customer phone number not provided.');
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  // Say who's calling
  twiml.say(
    { voice: 'alice', language: 'en-US' },
    `Connecting you to customer at ${customerPhone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}`
  );

  // Dial the customer
  const dial = twiml.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,
    timeout: 30,
  });
  dial.number(customerPhone);

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Click-to-Call Status Callback
 */
router.post('/click-to-call-status', verifyTwilioSignature, async (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const callDuration = req.body.CallDuration;

  console.log(`[VOICE] Click-to-call status: ${callStatus}, CallSid: ${callSid}, Duration: ${callDuration}`);

  // Update call event
  try {
    const { updateCallEvent } = await import('./callLoggingService');
    await updateCallEvent(callSid, {
      status: callStatus,
      duration: callDuration ? parseInt(callDuration) : undefined,
      endedAt: callStatus === 'completed' ? new Date() : undefined,
    });
  } catch (error) {
    console.error('[VOICE] Failed to update click-to-call event:', error);
  }

  // 🔴 REAL-TIME: Broadcast click-to-call status to connected clients
  const io = getWebSocketServer();
  if (io) {
    io.to('monitoring').emit('call_status_update', {
      callSid,
      status: callStatus,
      duration: callDuration ? parseInt(callDuration) : undefined,
      type: 'click-to-call',
      timestamp: new Date().toISOString(),
    });
    console.log('[WEBSOCKET] Click-to-call status broadcast:', callSid, callStatus);
  }

  res.sendStatus(200);
});

/**
 * Technician Voice Token - Generate Twilio access token for WebRTC calling
 * GET /api/voice/token
 * 
 * Generates a scoped access token allowing technicians to make outbound calls
 * via Twilio Voice SDK. Token is valid for 1 hour.
 * 
 * SECURITY: Requires technician authentication
 */
router.get('/token', requireTechnician, async (req: Request, res: Response) => {
  try {
    const technician = (req as any).technician;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_VOICE_API_KEY_SID;
    const apiSecret = process.env.TWILIO_VOICE_API_KEY_SECRET;
    const twimlAppSid = process.env.TWILIO_VOICE_TWIML_APP_SID;

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      console.error('[VOICE] Missing Twilio credentials for token generation');
      return res.status(500).json({ 
        error: 'Voice calling not configured. Please contact support.' 
      });
    }

    // Create access token
    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: `tech:${technician.id}`,
      ttl: 3600, // 1 hour
    });

    // Create voice grant (outbound only)
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false, // Technicians don't receive inbound calls
    });

    token.addGrant(voiceGrant);

    console.log(`[VOICE] Generated token for technician ${technician.id} (${technician.preferredName})`);

    res.json({
      token: token.toJwt(),
      identity: `tech:${technician.id}`,
      technicianId: technician.id,
      technicianName: technician.preferredName,
    });
  } catch (error) {
    console.error('[VOICE] Error generating technician token:', error);
    res.status(500).json({ error: 'Failed to generate calling token' });
  }
});

export default router;