import { Router, Request, Response } from 'express';
import { twiml as TwiML } from 'twilio';
import { generateAIResponse } from '../openai';
import { TWILIO_TEST_SMS_NUMBER } from '../twilioClient';

export const twilioTestSmsRouter = Router();

twilioTestSmsRouter.post('/inbound', async (req: Request, res: Response) => {
  const twimlResponse = new TwiML.MessagingResponse();
  
  try {
    const { Body, From, To } = req.body || {};
    
    console.log('[TWILIO TEST SMS INBOUND]', { 
      From, 
      To, 
      Body: Body?.substring(0, 100) + (Body?.length > 100 ? '...' : '')
    });
    
    if (!Body || !From) {
      console.warn('[TWILIO TEST SMS INBOUND] Missing Body or From');
      twimlResponse.message("Sorry, I couldn't process your message. Please try again.");
      res.type('text/xml').send(twimlResponse.toString());
      return;
    }
    
    const aiReply = await generateAIResponse(
      Body,
      From,
      'sms',
      undefined,
      undefined,
      false,
      'root'
    );
    
    twimlResponse.message(aiReply || "Thanks for your message! We'll follow up shortly.");
    
    console.log('[TWILIO TEST SMS INBOUND] AI reply sent:', aiReply?.substring(0, 100));
    
    res.type('text/xml').send(twimlResponse.toString());
  } catch (err) {
    console.error('[TWILIO TEST SMS INBOUND ERROR]', err);
    twimlResponse.message("Sorry, I'm having trouble right now. A human will take a look and get back to you.");
    res.type('text/xml').send(twimlResponse.toString());
  }
});
