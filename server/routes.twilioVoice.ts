import express, { Request, Response } from 'express';
import twilio from 'twilio';
import { phoneLines, customers, conversations, messages, notificationSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { OpenAI } from 'openai';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { logCallEvent, updateCallEvent } from './callLoggingService';
import { getWebSocketServer } from './websocketService';
import { handleConversationalScheduling } from './conversationalScheduling';
import { sendSMS } from './notifications';
import { requireTechnician } from './technicianMiddleware';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

// Clean Machine joke bank for Press 9 easter egg
const cleanMachineJokes = [
  "Why don't dirty cars tell secrets? Because there are too many bugs listening.",
  "Why did the car apply for a job? It wanted to get its headlights on a brighter future.",
  "I asked a Tulsa traffic cone what its plans were this weekend. It said: standing around, probably blocking something important.",
  "Why did the entrepreneur take a ladder to work? Because the business was on another level.",
  "Did you hear the rumor about butter? I'm not going to spread it."
];

function getRandomJoke(): string {
  const i = Math.floor(Math.random() * cleanMachineJokes.length);
  return cleanMachineJokes[i];
}

// Helper function to get voice webhook settings
async function getVoiceSettings(tenantDb: any) {
  try {
    const [settings] = await tenantDb
      .select()
      .from(notificationSettings)
      .where(tenantDb.withTenantFilter(notificationSettings, eq(notificationSettings.settingKey, 'voice_webhook')))
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

// Helper function to get phone line greeting configuration
async function getPhoneLineGreeting(tenantDb: any, phoneNumber: string) {
  try {
    const [line] = await tenantDb
      .select()
      .from(phoneLines)
      .where(tenantDb.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, phoneNumber)))
      .limit(1);

    if (!line) {
      return null;
    }

    return {
      voicemailGreeting: line.voicemailGreeting,
      voicemailGreetingUrl: line.voicemailGreetingUrl,
    };
  } catch (error) {
    console.error('[VOICE] Error fetching phone line greeting:', error);
    return null;
  }
}

// Helper function to add voicemail greeting to TwiML
async function addVoicemailGreeting(tenantDb: any, twiml: any, phoneNumber: string, defaultGreeting: string) {
  const greetingConfig = await getPhoneLineGreeting(tenantDb, phoneNumber);
  
  if (greetingConfig?.voicemailGreetingUrl) {
    // Play audio recording if available
    console.log('[VOICE] Using custom audio greeting for voicemail');
    twiml.play(greetingConfig.voicemailGreetingUrl);
  } else if (greetingConfig?.voicemailGreeting) {
    // Use text-to-speech with custom text
    console.log('[VOICE] Using custom text-to-speech greeting for voicemail');
    twiml.say({
      voice: 'Polly.Matthew',
      language: 'en-US'
    }, greetingConfig.voicemailGreeting);
  } else {
    // Use default greeting
    console.log('[VOICE] Using default greeting for voicemail');
    twiml.say({
      voice: 'Polly.Matthew',
      language: 'en-US'
    }, defaultGreeting);
  }
}

/**
 * Send automatic AI-powered response to caller who got a missed call
 * This initiates an intelligent conversation that checks calendar and books appointments
 */
async function sendMissedCallSMS(toPhone: string) {
  console.log(`[VOICE] Initiating AI conversation for missed call from ${toPhone}`);

  // Note: This function doesn't have access to req.tenantDb, needs refactoring
  // For now, this function should be called with tenantDb parameter
  // const settings = await getVoiceSettings(tenantDb);

  // Check if AI conversation mode is enabled (default to true for intelligent responses)
  // TODO: Fix this after refactoring to accept tenantDb
  const useAIMode = true; // settings?.useAIConversation !== false;

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

    const message = `Hi, it's Jody with Clean Machine Auto Detail, sorry I missed you! How can I help you today?

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
 * Helper: Check if current time is within business hours for a phone line
 * Returns true if during business hours, false if after hours
 */
async function isBusinessHours(tenantDb: any, phoneLineId: number): Promise<boolean> {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM" format

    const line = await tenantDb.query.phoneLines.findFirst({
      where: (phoneLines: any, { eq }: any) => tenantDb.withTenantFilter(phoneLines, eq(phoneLines.id, phoneLineId)),
      with: { 
        schedules: true 
      }
    });

    if (!line?.schedules || line.schedules.length === 0) {
      return true; // No schedule = always open
    }

    // Find a matching schedule for today
    const todaySchedule = line.schedules.find(s => 
      s.dayOfWeek === dayOfWeek && 
      s.action === 'forward' && 
      currentTime >= s.startTime && 
      currentTime <= s.endTime
    );

    return !!todaySchedule; // true if found matching forward schedule
  } catch (error) {
    console.error('[TWILIO VOICE] Error checking business hours:', error);
    return true; // Default to open if error
  }
}

/**
 * Main IVR Menu Handler - Detects business hours and presents appropriate greeting
 * Dynamically detects which phone line was called
 * SECURITY: Twilio signature verification enabled
 */
router.post('/voice/incoming', verifyTwilioSignature, async (req: Request, res: Response) => {
  const response = new VoiceResponse();

  try {
    // Get phone line from database based on the number that was called
    const toNumber = (req.body.To as string) || '';
    const fromNumber = (req.body.From as string) || '';
    const callSid = (req.body.CallSid as string) || '';
    console.log('[TWILIO VOICE] Incoming call to:', toNumber, 'from:', fromNumber);
    
    // Find the phone line in database by the To number
    const line = await req.tenantDb!.query.phoneLines.findFirst({
      where: (phoneLines, { eq }) => req.tenantDb!.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, toNumber)),
    });
    
    if (!line) {
      console.error('[TWILIO VOICE] No phone line found for number:', toNumber);
      response.say({ voice: 'alice' }, 'This number is not configured. Please call back later.');
      response.hangup();
      res.type('text/xml');
      res.send(response.toString());
      return;
    }
    
    const phoneLineId = line.id;
    console.log('[TWILIO VOICE] Matched phone line:', line.label, 'ID:', phoneLineId);
    
    // Log the incoming call
    try {
      await logCallEvent(req.tenantDb!, {
        callSid,
        direction: 'inbound',
        from: fromNumber,
        to: toNumber,
        status: 'ringing',
        startedAt: new Date(),
      });
      console.log('[TWILIO VOICE] Call logged:', callSid);
      
      // Broadcast to WebSocket for real-time monitoring
      const io = getWebSocketServer();
      if (io) {
        io.to('monitoring').emit('call_incoming', {
          callSid,
          from: fromNumber,
          to: toNumber,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[TWILIO VOICE] Failed to log call:', error);
    }
    
    const businessHours = await isBusinessHours(req.tenantDb!, phoneLineId);

    // Gather user input for IVR menu
    const gather = response.gather({
      numDigits: 1,
      timeout: 5,
      action: '/twilio/voice/menu-handler',
      method: 'POST',
    });

    // Different greeting based on business hours
    if (businessHours) {
      // During business hours - offer live option
      gather.say(
        { voice: 'alice', language: 'en-US' },
        'Thank you for calling Clean Machine Auto Detail. Press 3 to speak with the owner Jody, ' +
          'or leave a voicemail to get back with you between jobs.'
      );
    } else {
      // After hours - direct to voicemail only
      gather.say(
        { voice: 'alice', language: 'en-US' },
        'Thank you for calling Clean Machine Auto Detail. Press 3 to leave a voicemail and we will reach out ASAP.'
      );
    }

    // If no input after timeout, go to voicemail
    response.redirect({
      method: 'POST',
    }, '/twilio/voice/voicemail');

    console.log('[TWILIO VOICE] IVR menu presented to caller from', req.body.From, '- Business Hours:', businessHours);
  } catch (error) {
    console.error('[TWILIO VOICE] Error presenting IVR menu:', error);
    response.say({ voice: 'alice' }, 'We encountered an error. Please try again later.');
    response.hangup();
  }

  res.type('text/xml');
  res.send(response.toString());
});

/**
 * IVR Menu Handler
 * Routes based on user input:
 * - Press 3 = dial SIP endpoint to reach Jody (if business hours) or voicemail (if after hours)
 * - Anything else = voicemail
 * SECURITY: Twilio signature verification enabled
 */
router.post('/voice/menu-handler', verifyTwilioSignature, async (req: Request, res: Response) => {
  const response = new VoiceResponse();
  const digits = (req.body.Digits as string) || '';

  try {
    if (digits === '3') {
      // User pressed 3
      const fromNumber = (req.body.From as string) || '';
      const toNumber = (req.body.To as string) || '';
      
      // Find phone line based on the number that was called
      const line = await req.tenantDb!.query.phoneLines.findFirst({
        where: (phoneLines, { eq }) => req.tenantDb!.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, toNumber)),
      });
      
      if (!line) {
        console.error('[TWILIO VOICE] No phone line found for:', toNumber);
        response.say({ voice: 'alice' }, 'Configuration error.');
        response.hangup();
        res.type('text/xml');
        res.send(response.toString());
        return;
      }
      
      const phoneLineId = line.id;
      const businessHours = await isBusinessHours(req.tenantDb!, phoneLineId);

      if (businessHours) {
        // During business hours - attempt to reach via SIP
        const sipEndpoint = line.sipEndpoint;
        const ringDuration = line.ringDuration || 10;

        if (!sipEndpoint) {
          console.log('[TWILIO VOICE] SIP endpoint not configured, going to voicemail');
          response.redirect({
            method: 'POST',
          }, '/twilio/voice/voicemail');
          res.type('text/xml');
          res.send(response.toString());
          return;
        }

        console.log(`[TWILIO VOICE] User pressed 3 during business hours, dialing SIP ${sipEndpoint} for ${ringDuration}s`);

        // Dial with configurable timeout
        const dial = response.dial({
          callerId: fromNumber || undefined,
          answerOnBridge: true,
          timeout: ringDuration,
        });

        dial.sip(`sip:${sipEndpoint}`);

        // If dial times out or is rejected, go to voicemail
        response.redirect({
          method: 'POST',
        }, '/twilio/voice/voicemail');
      } else {
        // After hours - go directly to voicemail
        console.log('[TWILIO VOICE] User pressed 3 after hours, going to voicemail');
        response.redirect({
          method: 'POST',
        }, '/twilio/voice/voicemail');
      }
    } else {
      // Invalid input or no input - go to voicemail
      response.redirect({
        method: 'POST',
      }, '/twilio/voice/voicemail');
    }
  } catch (error) {
    console.error('[TWILIO VOICE] Error handling menu selection:', error);
    response.say({ voice: 'alice' }, 'We encountered an error. Please try again later.');
    response.hangup();
  }

  res.type('text/xml');
  res.send(response.toString());
});

/**
 * Voicemail Handler
 * Records customer voicemail message
 * Uses custom greeting from phone line configuration
 * SECURITY: Twilio signature verification enabled
 */
router.post('/voice/voicemail', verifyTwilioSignature, async (req: Request, res: Response) => {
  const response = new VoiceResponse();

  try {
    // Get voicemail greeting from database based on the number called
    const toNumber = (req.body.To as string) || '';
    console.log('[TWILIO VOICE] Voicemail handler for incoming call to:', toNumber);
    
    const line = await req.tenantDb!.query.phoneLines.findFirst({
      where: (phoneLines, { eq }) => req.tenantDb!.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, toNumber)),
    });

    // Play custom voicemail greeting URL if available
    if (line?.voicemailGreetingUrl) {
      response.play({}, line.voicemailGreetingUrl);
    } else if (line?.voicemailGreeting) {
      // Fall back to text greeting if audio URL not set
      response.say(
        { voice: 'alice', language: 'en-US' },
        line.voicemailGreeting
      );
    } else {
      // Default greeting if nothing configured
      response.say(
        { voice: 'alice', language: 'en-US' },
        'Sorry, Jody is unavailable right now. Please leave a detailed message with your name, ' +
          'phone number, and what service you are interested in. Thank you!'
      );
    }

    // Record the voicemail with transcription callback
    response.record({
      action: '/twilio/voice/voicemail-saved',
      method: 'POST',
      maxLength: 120, // Max 2 minutes
      timeout: 5, // End recording after 5 seconds of silence
      trim: 'trim-silence',
      transcribe: true, // Enable transcription
      transcribeCallback: '/twilio/voice/voicemail-transcribed', // Callback when transcription completes
      recordingStatusCallback: '/twilio/voice/recording-status',
    });

    console.log('[TWILIO VOICE] Presenting voicemail recording prompt');
  } catch (error) {
    console.error('[TWILIO VOICE] Error handling voicemail:', error);
    response.say({ voice: 'alice' }, 'We encountered an error. Please try again later.');
    response.hangup();
  }

  res.type('text/xml');
  res.send(response.toString());
});

/**
 * Voicemail Saved Handler
 * Triggered after voicemail is recorded and stored
 * SECURITY: Twilio signature verification enabled
 */
router.post('/voice/voicemail-saved', verifyTwilioSignature, async (req: Request, res: Response) => {
  const response = new VoiceResponse();

  try {
    // Thank them for leaving a message
    response.say(
      { voice: 'alice', language: 'en-US' },
      'Thank you for your message. We will get back to you as soon as possible. Goodbye!'
    );
    response.hangup();

    // Log the voicemail for transcription/notification
    const recordingUrl = req.body.RecordingUrl as string;
    const callSid = req.body.CallSid as string;
    const fromNumber = req.body.From as string;

    console.log(`[TWILIO VOICE] Voicemail saved:`, {
      fromNumber,
      callSid,
      recordingUrl,
      recordingDuration: req.body.RecordingDuration,
    });

    // TODO: Send notification with voicemail details to admin dashboard
  } catch (error) {
    console.error('[TWILIO VOICE] Error after voicemail saved:', error);
    response.hangup();
  }

  res.type('text/xml');
  res.send(response.toString());
});

/**
 * Voicemail Transcription Callback
 * Twilio calls this when voicemail transcription is complete
 * Analyzes transcription with OpenAI and sends SMS response
 * SECURITY: Twilio signature verification enabled
 */
router.post('/voice/voicemail-transcribed', verifyTwilioSignature, async (req: Request, res: Response) => {
  try {
    const transcriptionText = req.body.TranscriptionText as string;
    const callSid = req.body.CallSid as string;
    const fromNumber = req.body.From as string;

    console.log('[TWILIO VOICE] Voicemail transcribed:', {
      callSid,
      fromNumber,
      transcription: transcriptionText?.substring(0, 100),
    });

    if (!transcriptionText || transcriptionText.length === 0) {
      console.log('[TWILIO VOICE] Transcription empty, skipping AI analysis');
      return res.status(200).send('');
    }

    // Find or create customer record
    let customer = await req.tenantDb!.query.customers.findFirst({
      where: (customers, { eq }) => req.tenantDb!.withTenantFilter(customers, eq(customers.phone, fromNumber)),
    });

    if (!customer) {
      console.log('[TWILIO VOICE] Creating new customer from voicemail:', fromNumber);
      // Extract name from transcription if possible (look for "this is" or "my name is")
      let extractedName = 'Customer';
      const nameMatch = transcriptionText.match(/(?:my name is|this is)\s+([A-Za-z]+)/i);
      if (nameMatch) {
        extractedName = nameMatch[1];
      }

      const [created] = await req.tenantDb!
        .insert(customers)
        .values({
          phone: fromNumber,
          name: extractedName,
          source: 'voicemail',
        })
        .returning();
      customer = created;
    }

    // Analyze voicemail with OpenAI (if available)
    let smsResponse = 'Thanks for calling! We will get back to you shortly.';
    
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const analysisPrompt = `You are an auto-detail business assistant. A customer left this voicemail:

"${transcriptionText}"

Provide a BRIEF (1-2 sentences max) acknowledgment and next step for the customer via SMS. Be friendly and professional. Examples:
- "Thanks for reaching out! We'll check your vehicle's condition and get back to you within 2 hours with a quote."
- "Got it! We have availability tomorrow morning if you'd like to book. Reply YES to confirm."

Respond ONLY with the SMS message text, nothing else.`;

        const aiResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: analysisPrompt,
            },
          ],
          max_tokens: 150,
        });

        smsResponse =
          aiResponse.choices[0]?.message?.content || 'Thanks for calling! We will get back to you shortly.';
      } catch (error) {
        console.error('[TWILIO VOICE] Error analyzing voicemail with AI:', error);
        // smsResponse already set to default fallback above
      }
    } else {
      console.log('[TWILIO VOICE] OpenAI not configured, using default voicemail response');
    }

    // Send SMS response
    const twilio = require('twilio');
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const mainPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+19188565304';

    await twilioClient.messages.create({
      body: smsResponse,
      from: mainPhoneNumber,
      to: fromNumber,
    });

    console.log('[TWILIO VOICE] Auto SMS response sent to', fromNumber, ':', smsResponse);

    // Store voicemail transcript and auto-response in conversation
    let conversation = await req.tenantDb!.query.conversations.findFirst({
      where: (conversations, { and, eq }) => req.tenantDb!.withTenantFilter(conversations,
        and(
          eq(conversations.customerPhone, fromNumber),
          eq(conversations.platform, 'voice')
        )
      ),
      orderBy: (c) => [c.id], // Get latest
    });

    if (!conversation) {
      const [created] = await req.tenantDb!
        .insert(conversations)
        .values({
          customerId: customer.id,
          platform: 'voice',
          channel: 'voice',
          customerPhone: fromNumber,
          isAIActive: false,
          lastMessageTime: new Date(),
        })
        .returning();
      conversation = created;
    }

    // Log voicemail and auto-response
    await req.tenantDb!.insert(messages).values([
      {
        conversationId: conversation.id,
        content: `Voicemail: ${transcriptionText}`,
        sender: 'customer',
        fromCustomer: true,
        timestamp: new Date(),
        isAutomated: false,
      },
      {
        conversationId: conversation.id,
        content: smsResponse,
        sender: 'ai',
        fromCustomer: false,
        timestamp: new Date(),
        isAutomated: true,
      },
    ]);

    res.status(200).send('');
  } catch (error) {
    console.error('[TWILIO VOICE] Error processing voicemail transcription:', error);
    res.status(200).send(''); // Still return 200 to acknowledge Twilio
  }
});

/**
 * Recording Status Callback
 * Twilio notifies us when recording is complete
 * SECURITY: Twilio signature verification enabled
 */
router.post('/voice/recording-status', verifyTwilioSignature, async (req: Request, res: Response) => {
  try {
    console.log('[TWILIO VOICE] Recording status:', {
      recordingStatus: req.body.RecordingStatus,
      recordingSid: req.body.RecordingSid,
      recordingDuration: req.body.RecordingDuration,
    });

    // Respond with empty 200 to acknowledge
    res.status(200).send('');
  } catch (error) {
    console.error('[TWILIO VOICE] Error logging recording status:', error);
    res.status(200).send('');
  }
});

/**
 * Call Status Webhook - Triggered after dial attempt
 * Determines if call was answered, busy, or no-answer
 */
router.post('/voice/call-status', verifyTwilioSignature, async (req: Request, res: Response) => {
  const dialCallStatus = req.body.DialCallStatus;
  const callerPhone = req.body.From;
  const callSid = req.body.CallSid;
  // Use DialCallDuration for <Dial action> callbacks, fallback to CallDuration for status callbacks
  const callDuration = req.body.DialCallDuration ? parseInt(req.body.DialCallDuration) : 
                       req.body.CallDuration ? parseInt(req.body.CallDuration) : undefined;

  console.log(`[VOICE] Call status: ${dialCallStatus} from ${callerPhone}, CallSid: ${callSid}, Duration: ${callDuration}`);

  // Update call event with final status
  try {
    await updateCallEvent(req.tenantDb!, callSid, {
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
    const twilioPhone = req.body.To;
    await addVoicemailGreeting(
      (req as any).tenantDb!,
      twiml,
      twilioPhone,
      'Sorry we missed your call. We\'ve sent you a text message. You can also leave a voicemail after the beep.'
    );

    twiml.record({
      timeout: 10,
      transcribe: true,
      transcribeCallback: '/twilio/voice/voicemail-transcribed',
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
 * Dial Status Callback - Handles forwarding call completion
 * Called after attempting to forward call to business owner
 * Routes to voicemail if call wasn't answered
 */
router.post('/voice/voice-dial-status', verifyTwilioSignature, async (req: Request, res: Response) => {
  const dialCallStatus = req.body.DialCallStatus;
  const callerPhone = req.body.From;
  const twilioPhone = req.body.To;
  const callSid = req.body.CallSid;
  
  console.log(`[VOICE] Dial status for ${callerPhone}: ${dialCallStatus}`);

  const twiml = new VoiceResponse();

  if (dialCallStatus === 'completed') {
    // Call was answered - do nothing, let it end naturally
    console.log(`[VOICE] Call answered successfully`);
  } else {
    // no-answer, busy, failed, canceled - route to voicemail
    console.log(`[VOICE] Call not answered (${dialCallStatus}), routing to voicemail`);
    
    // Get voicemail greeting for this phone line
    try {
      const { getPhoneLineRoutingDecision } = await import('./routes.phoneSettings');
      const routing = await getPhoneLineRoutingDecision(twilioPhone);
      
      await addVoicemailGreeting(
        (req as any).tenantDb!,
        twiml,
        twilioPhone,
        routing.voicemailGreeting || "Thank you for calling Clean Machine Auto Detail. Please leave your name, number, and a brief message after the beep."
      );
    } catch (error) {
      console.error('[VOICE] Error getting voicemail greeting:', error);
      twiml.say({
        voice: 'Polly.Matthew',
        language: 'en-US'
      }, "Thank you for calling Clean Machine Auto Detail. Please leave your name, number, and a brief message after the beep.");
    }

    twiml.record({
      maxLength: 120,
      playBeep: true,
      transcribe: true,
      transcribeCallback: '/twilio/voice/voicemail-transcribed',
      timeout: 10,
    });
    
    twiml.say({
      voice: 'Polly.Matthew',
      language: 'en-US'
    }, "Thank you for your message. Goodbye.");
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Click-to-Call - Initiate an outbound call to connect operator with customer
 * POST /twilio/voice/click-to-call
 * Body: { customerPhone: string }
 */
router.post('/voice/click-to-call', async (req: Request, res: Response) => {
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
    const twimlUrl = `${baseUrl}/twilio/voice/connect-customer?phone=${encodeURIComponent(customerPhone)}`;

    // Initiate call to business phone first (operator)
    const call = await client.calls.create({
      from: twilioPhone,
      to: businessPhone,
      url: twimlUrl,
      statusCallback: `${baseUrl}/twilio/voice/click-to-call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    console.log(`[VOICE] Click-to-call initiated: CallSid ${call.sid}, connecting ${businessPhone} to ${customerPhone}`);

    // Log the outbound call
    try {
      await logCallEvent(req.tenantDb!, {
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
router.post('/voice/connect-customer', verifyTwilioSignature, async (req: Request, res: Response) => {
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
router.post('/voice/click-to-call-status', verifyTwilioSignature, async (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const callDuration = req.body.CallDuration;

  console.log(`[VOICE] Click-to-call status: ${callStatus}, CallSid: ${callSid}, Duration: ${callDuration}`);

  // Update call event
  try {
    await updateCallEvent(req.tenantDb!, callSid, {
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
 * GET /twilio/voice/token
 * 
 * Generates a scoped access token allowing technicians to make outbound calls
 * via Twilio Voice SDK. Token is valid for 1 hour.
 * 
 * SECURITY: Requires technician authentication
 */
router.get('/voice/token', requireTechnician, async (req: Request, res: Response) => {
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

/**
 * Hold Music - Play hold music when call is placed on hold
 * GET /twilio/voice/hold-music
 */
router.get('/voice/hold-music', (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  
  twiml.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Please hold.');
  
  // Play hold music on loop
  twiml.play({ loop: 0 }, 'http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3');
  
  console.log('[VOICE] Playing hold music');
  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Resume Call - Resume call from hold
 * GET /twilio/voice/resume-call
 * 
 * NOTE: This requires the original call context (customer phone) as a query parameter
 * to reconnect the bridge. Called via: /resume-call?phone=+1234567890
 */
router.get('/voice/resume-call', (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const customerPhone = req.query.phone as string;
  
  if (!customerPhone) {
    console.error('[VOICE] Resume call called without phone parameter');
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Unable to resume call. Missing connection information.');
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  
  // Redirect back to the connect-customer endpoint to re-establish bridge
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.PUBLIC_URL || 'https://cleanmachine.app';
  
  twiml.redirect(`${baseUrl}/twilio/voice/connect-customer?phone=${encodeURIComponent(customerPhone)}`);
  
  console.log(`[VOICE] Resuming call from hold - redirecting to connect-customer for ${customerPhone}`);
  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Mute Call - Play silence to mute the call
 * GET /twilio/voice/mute-call
 */
router.get('/voice/mute-call', (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  
  // Play silence (effectively muting the call from admin's perspective)
  // Note: This is a workaround - true bidirectional mute requires conference calls
  twiml.pause({ length: 3600 }); // Pause for up to 1 hour (or until unmuted)
  
  console.log('[VOICE] Call muted (playing silence)');
  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Unmute Call - Resume normal audio
 * GET /twilio/voice/unmute-call
 * 
 * NOTE: This requires the original call context (customer phone) as a query parameter
 * to reconnect the bridge. Called via: /unmute-call?phone=+1234567890
 */
router.get('/voice/unmute-call', (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const customerPhone = req.query.phone as string;
  
  if (!customerPhone) {
    console.error('[VOICE] Unmute call called without phone parameter');
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Unable to unmute call. Missing connection information.');
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  
  // Redirect back to the connect-customer endpoint to re-establish bridge
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.PUBLIC_URL || 'https://cleanmachine.app';
  
  twiml.redirect(`${baseUrl}/twilio/voice/connect-customer?phone=${encodeURIComponent(customerPhone)}`);
  
  console.log(`[VOICE] Unmuting call - redirecting to connect-customer for ${customerPhone}`);
  res.type('text/xml');
  res.send(twiml.toString());
});

export default router;
