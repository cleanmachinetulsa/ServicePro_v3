import express, { Request, Response } from 'express';
import twilio from 'twilio';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Twilio Incoming Voice Call Handler
 * POST /twilio/voice/incoming
 * 
 * When a customer calls the Clean Machine business number, Twilio sends the call here.
 * This handler:
 * 1. Extracts the original caller's phone number
 * 2. Generates TwiML that dials the SIP endpoint registered in Groundwire
 * 3. Preserves the original caller ID so you see who's calling
 */
/**
 * Main IVR Menu Handler
 * Presents options: Press 3 to reach Jody live or leave voicemail
 */
router.post('/voice/incoming', async (req: Request, res: Response) => {
  const response = new VoiceResponse();

  try {
    // Gather user input for IVR menu
    const gather = response.gather({
      numDigits: 1,
      timeout: 5,
      action: '/twilio/voice/menu-handler',
      method: 'POST',
    });

    // IVR greeting - tells caller they can reach Jody live or leave voicemail
    gather.say(
      { voice: 'alice', language: 'en-US' },
      'Thank you for calling Clean Machine Auto Detail. ' +
        'Press 3 to speak with Jody, or stay on the line to leave a voicemail message.'
    );

    // If no input after timeout, go to voicemail
    response.redirect({
      method: 'POST',
    }, '/twilio/voice/voicemail');

    console.log('[TWILIO VOICE] IVR menu presented to caller from', req.body.From);
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
 * - Press 3 = dial SIP endpoint to reach Jody
 * - Anything else = voicemail
 */
router.post('/voice/menu-handler', async (req: Request, res: Response) => {
  const response = new VoiceResponse();
  const digits = (req.body.Digits as string) || '';

  try {
    if (digits === '3') {
      // User pressed 3 - attempt to reach Jody via SIP
      const fromNumber = (req.body.From as string) || '';
      const sipUser = process.env.SIP_USER || 'jody';
      const sipDomain = process.env.SIP_DOMAIN || 'cleanmachinetulsa.sip.twilio.com';

      console.log(`[TWILIO VOICE] User pressed 3, dialing SIP: ${sipUser}@${sipDomain}`);

      // Dial with timeout - if no answer, falls back to voicemail
      const dial = response.dial({
        callerId: fromNumber || undefined,
        answerOnBridge: true,
        timeout: 20, // Ring for 20 seconds
      });

      dial.sip(`sip:${sipUser}@${sipDomain}`);

      // If dial times out or is rejected, this redirect happens
      response.redirect({
        method: 'POST',
      }, '/twilio/voice/voicemail');
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
 * Set VOICEMAIL_GREETING_URL environment variable to play custom greeting
 */
router.post('/voice/voicemail', async (req: Request, res: Response) => {
  const response = new VoiceResponse();

  try {
    // Play custom voicemail greeting if available, otherwise use default
    const greetingUrl = process.env.VOICEMAIL_GREETING_URL;
    
    if (greetingUrl) {
      response.play({}, greetingUrl);
    } else {
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
