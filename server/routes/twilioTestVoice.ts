import { Router, Request, Response } from 'express';
import twilio from 'twilio';

export const twilioTestVoiceRouter = Router();

const VoiceResponse = twilio.twiml.VoiceResponse;

twilioTestVoiceRouter.post('/inbound', (req: Request, res: Response) => {
  try {
    const { From, To } = req.body || {};
    console.log('[TWILIO TEST VOICE INBOUND]', { From, To });

    const response = new VoiceResponse();

    response.say(
      {
        voice: 'alice',
        language: 'en-US',
      },
      "Thanks for calling Clean Machine Auto Detail. This is the ServicePro v3 test line. " +
        "Your call reached our server successfully. You can hang up now."
    );

    res.type('text/xml').send(response.toString());
  } catch (err) {
    console.error('[TWILIO TEST VOICE ERROR]', err);
    const response = new VoiceResponse();
    response.say(
      { voice: 'alice', language: 'en-US' },
      "Sorry, something went wrong on our end. Please try again later."
    );
    res.type('text/xml').send(response.toString());
  }
});

console.log('[Twilio] Test voice endpoint ready at /api/twilio/voice/inbound');
