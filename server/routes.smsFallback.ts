import { Router, Request, Response } from 'express';
import * as Twilio from 'twilio';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { businessSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Twilio credentials
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.MAIN_PHONE_NUMBER;

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
    // Query business settings for SMS fallback config
    const [settings] = await req.tenantDb!.select().from(businessSettings).where(req.tenantDb!.withTenantFilter(businessSettings)).limit(1);
    
    // Check if SMS fallback is enabled
    if (!settings || !settings.smsFallbackEnabled) {
      console.log('[SMS FALLBACK] System is disabled in settings');
      res.type('text/xml');
      return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    const fallbackPhone = settings.smsFallbackPhone;
    const autoReplyMessage = settings.smsFallbackAutoReply || "Thanks for your message! Our automated system is currently offline. You'll receive a personal response shortly.";
    
    const { From: customerPhone, Body: messageBody } = req.body;
    
    console.log('[SMS FALLBACK] Main system is down - forwarding message');
    console.log('[SMS FALLBACK] From:', customerPhone);
    console.log('[SMS FALLBACK] Body:', messageBody);

    if (!twilio) {
      console.error('[SMS FALLBACK] Twilio client not initialized');
      res.type('text/xml');
      return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // SELF-HEALING: If enabled but no phone, auto-disable and persist the change
    if (!fallbackPhone || fallbackPhone.trim() === '') {
      console.warn('[SMS FALLBACK] Enabled but no phone configured - AUTO-DISABLING for safety (migration self-heal)');
      
      // Persist the auto-disable to database
      await req.tenantDb!.update(businessSettings)
        .set({ smsFallbackEnabled: false })
        .where(req.tenantDb!.withTenantFilter(businessSettings, eq(businessSettings.id, settings.id)));
      
      console.log('[SMS FALLBACK] Auto-disabled SMS fallback in database - system self-healed');
      
      res.type('text/xml');
      return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // Forward the message to business owner's personal phone
    const forwardedMessage = `🚨 SYSTEM DOWN - Customer Message Forwarded:\n\nFrom: ${customerPhone}\n\n${messageBody}`;
    
    await twilio.messages.create({
      body: forwardedMessage,
      from: twilioPhoneNumber,
      to: fallbackPhone,
    });

    console.log('[SMS FALLBACK] Message forwarded successfully to:', fallbackPhone);

    // Send auto-reply to customer
    await twilio.messages.create({
      body: autoReplyMessage,
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
router.get('/sms-fallback/health', async (req: Request, res: Response) => {
  try {
    const [settings] = await req.tenantDb!.select().from(businessSettings).where(req.tenantDb!.withTenantFilter(businessSettings)).limit(1);
    
    const status = {
      status: 'operational',
      twilioConfigured: !!twilio,
      fallbackEnabled: settings?.smsFallbackEnabled ?? false,
      fallbackPhone: settings?.smsFallbackPhone ? 'configured' : 'not configured',
      timestamp: new Date().toISOString(),
    };
    
    console.log('[SMS FALLBACK] Health check:', status);
    res.json(status);
  } catch (error) {
    console.error('[SMS FALLBACK] Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to check fallback settings',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
