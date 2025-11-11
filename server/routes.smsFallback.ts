import { Router, Request, Response } from 'express';
import * as Twilio from 'twilio';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';

const router = Router();

// Twilio credentials
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Business owner's personal phone (for fallback forwarding)
// TODO: Move to settings panel after cleanup
const FALLBACK_PHONE = process.env.BUSINESS_OWNER_PHONE || process.env.TWILIO_PHONE_NUMBER;

let twilio: any = null;
if (twilioAccountSid && twilioAuthToken) {
  try {
    twilio = Twilio.default(twilioAccountSid, twilioAuthToken);
    console.log('[SMS FALLBACK] Twilio client initialized for fallback service');
  } catch (error) {
    console.error('[SMS FALLBACK] Failed to initialize Twilio client:', error);
  }
}

/**
 * SMS Fallback Webhook
 * This endpoint is called when the main /sms webhook is down or times out
 * It forwards incoming messages to the business owner's personal phone
 * 
 * POST /sms-fallback
 * SECURITY: Twilio signature verification enabled
 */
router.post('/sms-fallback', verifyTwilioSignature, async (req: Request, res: Response) => {
  try {
    const { From: customerPhone, Body: messageBody } = req.body;
    
    console.log('[SMS FALLBACK] Main system is down - forwarding message');
    console.log('[SMS FALLBACK] From:', customerPhone);
    console.log('[SMS FALLBACK] Body:', messageBody);

    if (!twilio) {
      console.error('[SMS FALLBACK] Twilio client not initialized');
      return res.status(500).send('SMS service not configured');
    }

    if (!FALLBACK_PHONE) {
      console.error('[SMS FALLBACK] No fallback phone number configured');
      return res.status(500).send('Fallback phone not configured');
    }

    // Forward the message to business owner's personal phone
    const forwardedMessage = `🚨 SYSTEM DOWN - Customer Message Forwarded:\n\nFrom: ${customerPhone}\n\n${messageBody}`;
    
    await twilio.messages.create({
      body: forwardedMessage,
      from: twilioPhoneNumber,
      to: FALLBACK_PHONE,
    });

    console.log('[SMS FALLBACK] Message forwarded successfully to:', FALLBACK_PHONE);

    // Send auto-reply to customer
    const autoReply = "Thanks for your message! Our automated system is currently offline. You'll receive a personal response shortly.";
    
    await twilio.messages.create({
      body: autoReply,
      from: twilioPhoneNumber,
      to: customerPhone,
    });

    console.log('[SMS FALLBACK] Auto-reply sent to customer:', customerPhone);

    // Respond with empty TwiML (message already sent programmatically)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    
  } catch (error) {
    console.error('[SMS FALLBACK] Error processing fallback:', error);
    
    // Still return valid TwiML to prevent Twilio retries
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

/**
 * SMS Fallback Health Check
 * Simple endpoint to verify the fallback system is running
 * 
 * GET /sms-fallback/health
 */
router.get('/sms-fallback/health', (req: Request, res: Response) => {
  const status = {
    status: 'operational',
    twilioConfigured: !!twilio,
    fallbackPhone: FALLBACK_PHONE ? 'configured' : 'not configured',
    timestamp: new Date().toISOString(),
  };
  
  console.log('[SMS FALLBACK] Health check:', status);
  res.json(status);
});

export default router;
