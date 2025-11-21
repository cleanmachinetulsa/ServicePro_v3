import express, { Request, Response } from 'express';
import twilio from 'twilio';
import { db } from './db';
import { phoneLines, customers, conversations, messages } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { OpenAI } from 'openai';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Helper: Check if current time is within business hours for a phone line
 * Returns true if during business hours, false if after hours
 */
async function isBusinessHours(phoneLineId: number): Promise<boolean> {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM" format

    const line = await db.query.phoneLines.findFirst({
      where: eq(phoneLines.id, phoneLineId),
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
    console.log('[TWILIO VOICE] Incoming call to:', toNumber);
    
    // Find the phone line in database by the To number
    const line = await db.query.phoneLines.findFirst({
      where: eq(phoneLines.phoneNumber, toNumber),
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
    
    const businessHours = await isBusinessHours(phoneLineId);

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
      const line = await db.query.phoneLines.findFirst({
        where: eq(phoneLines.phoneNumber, toNumber),
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
      const businessHours = await isBusinessHours(phoneLineId);

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
    
    const line = await db.query.phoneLines.findFirst({
      where: eq(phoneLines.phoneNumber, toNumber),
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
    let customer = await db.query.customers.findFirst({
      where: eq(customers.phone, fromNumber),
    });

    if (!customer) {
      console.log('[TWILIO VOICE] Creating new customer from voicemail:', fromNumber);
      // Extract name from transcription if possible (look for "this is" or "my name is")
      let extractedName = 'Customer';
      const nameMatch = transcriptionText.match(/(?:my name is|this is)\s+([A-Za-z]+)/i);
      if (nameMatch) {
        extractedName = nameMatch[1];
      }

      const [created] = await db
        .insert(customers)
        .values({
          phone: fromNumber,
          name: extractedName,
          source: 'voicemail',
        })
        .returning();
      customer = created;
    }

    // Analyze voicemail with OpenAI
    const openai = new OpenAI();
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

    const smsResponse =
      aiResponse.choices[0]?.message?.content || 'Thanks for calling! We will get back to you shortly.';

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
    let conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.customerPhone, fromNumber),
        eq(conversations.platform, 'voice'),
      ),
      orderBy: (c) => [c.id], // Get latest
    });

    if (!conversation) {
      const [created] = await db
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
    await db.insert(messages).values([
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

export default router;
