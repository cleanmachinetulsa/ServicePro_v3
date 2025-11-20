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
router.post('/voice/incoming', async (req: Request, res: Response) => {
  const response = new VoiceResponse();

  try {
    // Twilio sends the caller's number in req.body.From (e.g., "+19185551234")
    const fromNumber = (req.body.From as string) || '';

    // SIP configuration (set via environment variables)
    const sipUser = process.env.SIP_USER || 'jody';
    const sipDomain = process.env.SIP_DOMAIN || 'cleanmachinetulsa.sip.twilio.com';

    console.log(`[TWILIO VOICE] Incoming call from ${fromNumber}, routing to SIP: ${sipUser}@${sipDomain}`);

    // Build <Dial> which preserves the original caller's number as caller ID
    const dial = response.dial({
      callerId: fromNumber || undefined,
      answerOnBridge: true,
    });

    // Target SIP URI: sip:jody@cleanmachinetulsa.sip.twilio.com
    const sipUri = `sip:${sipUser}@${sipDomain}`;
    dial.sip(sipUri);

    console.log(`[TWILIO VOICE] TwiML generated: Dialing ${sipUri} with caller ID ${fromNumber}`);
  } catch (error) {
    console.error('[TWILIO VOICE] Error handling incoming voice call:', error);
    response.say({ voice: 'alice' }, 'We encountered an error. Please try again later.');
    response.hangup();
  }

  res.type('text/xml');
  res.send(response.toString());
});

export default router;
