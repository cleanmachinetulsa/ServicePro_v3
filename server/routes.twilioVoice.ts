import express, { Request, Response } from 'express';
import twilio from 'twilio';
import { db } from './db';
import { phoneLines } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
 */
router.post('/voice/incoming', async (req: Request, res: Response) => {
  const response = new VoiceResponse();

  try {
    // Get phone line from database to check business hours
    const toNumber = (req.body.To as string) || '';
    const phoneLineId = 1; // Main line ID - you can make this dynamic if needed
    
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
 */
router.post('/voice/menu-handler', async (req: Request, res: Response) => {
  const response = new VoiceResponse();
  const digits = (req.body.Digits as string) || '';

  try {
    if (digits === '3') {
      // User pressed 3
      const fromNumber = (req.body.From as string) || '';
      const phoneLineId = 1; // Main line ID
      const businessHours = await isBusinessHours(phoneLineId);

      if (businessHours) {
        // During business hours - attempt to reach Jody via SIP
        // Get all settings from database (nothing hardcoded)
        const line = await db.query.phoneLines.findFirst({
          where: eq(phoneLines.id, phoneLineId),
        });
        
        const sipEndpoint = line?.sipEndpoint;
        const ringDuration = line?.ringDuration || 10;

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
 */
router.post('/voice/voicemail', async (req: Request, res: Response) => {
  const response = new VoiceResponse();

  try {
    // Get voicemail greeting from database for main phone line
    const phoneLineId = 1;
    const line = await db.query.phoneLines.findFirst({
      where: eq(phoneLines.id, phoneLineId),
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

    // Record the voicemail
    response.record({
      action: '/twilio/voice/voicemail-saved',
      method: 'POST',
      maxLength: 120, // Max 2 minutes
      timeout: 5, // End recording after 5 seconds of silence
      trim: 'trim-silence',
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
 */
router.post('/voice/voicemail-saved', async (req: Request, res: Response) => {
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
 * Recording Status Callback
 * Twilio notifies us when recording is complete
 */
router.post('/voice/recording-status', async (req: Request, res: Response) => {
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
