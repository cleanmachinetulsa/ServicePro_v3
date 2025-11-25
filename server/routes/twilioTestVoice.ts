import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { getTwilioClient, TWILIO_TEST_SMS_NUMBER } from '../twilioClient';

export const twilioTestVoiceRouter = Router();

const VoiceResponse = twilio.twiml.VoiceResponse;

twilioTestVoiceRouter.post('/inbound', (req: Request, res: Response) => {
  const { From } = req.body || {};
  console.log('[TWILIO TEST VOICE INBOUND]', { From });

  const response = new VoiceResponse();
  
  const gather = response.gather({
    numDigits: 1,
    action: '/api/twilio/voice/menu',
    method: 'POST',
  });

  gather.say(
    {
      voice: 'Polly.Joanna',
      language: 'en-US',
    },
    "Thanks for calling Clean Machine Auto Detail. " +
    "Press 1 for general info and pricing. " +
    "Press 2 if you'd like us to text you booking details. " +
    "Press 3 to leave a voicemail."
  );

  response.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    "We didn't receive any input. Goodbye."
  );

  res.type('text/xml').send(response.toString());
});

twilioTestVoiceRouter.post('/menu', async (req: Request, res: Response) => {
  const { Digits, From } = req.body || {};
  console.log('[TWILIO TEST VOICE MENU]', { From, Digits });

  const response = new VoiceResponse();

  switch (Digits) {
    case '1':
      response.say(
        { voice: 'Polly.Joanna', language: 'en-US' },
        "We offer full interior and exterior detailing, with pricing based on vehicle size and condition. " +
        "For specific quotes, please text us pictures of your vehicle or visit our website. Goodbye."
      );
      response.hangup();
      break;
      
    case '2':
      if (TWILIO_TEST_SMS_NUMBER && From) {
        try {
          const twilioClient = getTwilioClient();
          if (twilioClient) {
            await twilioClient.messages.create({
              from: TWILIO_TEST_SMS_NUMBER,
              to: From,
              body: "Thanks for calling Clean Machine Auto Detail. You can text us here to book or ask questions anytime.",
            });
            console.log('[TWILIO TEST VOICE] SMS sent to', From);
          } else {
            console.warn('[TWILIO TEST VOICE] Twilio client not configured for SMS');
          }
        } catch (err) {
          console.error('[TWILIO TEST VOICE MENU SMS ERROR]', err);
        }
      }
      response.say(
        { voice: 'Polly.Joanna', language: 'en-US' },
        "Perfect. We've sent you a text message so you can book or ask questions there. Goodbye."
      );
      response.hangup();
      break;
      
    case '3':
      response.redirect('/api/twilio/voice/voicemail');
      break;
      
    default:
      response.say(
        { voice: 'Polly.Joanna', language: 'en-US' },
        "Sorry, I didn't understand that. Goodbye."
      );
      response.hangup();
      break;
  }

  res.type('text/xml').send(response.toString());
});

twilioTestVoiceRouter.post('/voicemail', (req: Request, res: Response) => {
  console.log('[TWILIO TEST VOICE VOICEMAIL] Starting recording for', req.body?.From);
  
  const response = new VoiceResponse();

  response.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    "Please leave your name, number, and a brief description of your vehicle and what you need. " +
    "When you're finished, you can simply hang up."
  );
  
  response.record({
    maxLength: 120,
    transcribe: false,
    playBeep: true,
    action: '/api/twilio/voice/voicemail-complete',
    method: 'POST',
  });

  res.type('text/xml').send(response.toString());
});

twilioTestVoiceRouter.post('/voicemail-complete', (req: Request, res: Response) => {
  const { From, RecordingUrl, RecordingDuration } = req.body || {};
  console.log('[TWILIO TEST VOICEMAIL COMPLETE]', { 
    From, 
    RecordingUrl, 
    RecordingDuration 
  });

  const response = new VoiceResponse();
  response.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    "Thanks for the details. We'll review your message and get back to you as soon as we can. Goodbye."
  );
  response.hangup();
  
  res.type('text/xml').send(response.toString());
});
