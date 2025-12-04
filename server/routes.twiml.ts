import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';

const router = Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Get the base URL for Twilio callbacks
 */
function getBaseUrl(req: Request): string {
  // Use REPLIT_DEV_DOMAIN if available (development)
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // Fallback to constructing from request
  const protocol = req.get('x-forwarded-proto') || 'https';
  const host = req.get('host');
  return `${protocol}://${host}`;
}

/**
 * Technician Outbound Call TwiML Handler
 * POST /twiml/voice
 * 
 * Called by Twilio when a technician initiates an outbound call via WebRTC.
 * This is the public-facing endpoint configured in the TwiML App.
 * 
 * SECURITY: Twilio signature verification
 */
router.post('/voice', verifyTwilioSignature, async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  
  try {
    const customerPhone = req.body.To;
    const techIdentity = req.body.Caller; // e.g., "tech:123"
    const callSid = req.body.CallSid;
    const twilioPhone = process.env.MAIN_PHONE_NUMBER;
    const baseUrl = getBaseUrl(req);

    if (!customerPhone) {
      twiml.say({ voice: 'alice' }, 'Error: Customer phone number not provided.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // Extract technician ID from identity (format: "tech:123")
    const techId = techIdentity ? parseInt(techIdentity.split(':')[1]) : null;

    console.log(`[VOICE] Technician ${techId} initiating call to ${customerPhone}, CallSid: ${callSid}`);

    // Log the technician outbound call
    try {
      const { logCallEvent } = await import('./callLoggingService');
      await logCallEvent({
        callSid,
        direction: 'technician_outbound',
        from: twilioPhone || 'technician',
        to: customerPhone,
        status: 'initiated',
        technicianId: techId || undefined,
      });
    } catch (error) {
      console.error('[VOICE] Failed to log technician call event:', error);
    }

    // Dial the customer with business phone as caller ID
    // IMPORTANT: Use absolute URL for action callback to ensure Twilio can reach it
    const dial = twiml.dial({
      callerId: twilioPhone || undefined,
      timeout: 30,
      action: `${baseUrl}/api/voice/call-status`,
      method: 'POST',
    });
    
    dial.number(customerPhone);

    console.log(`[VOICE] TwiML generated for technician call to ${customerPhone}, baseUrl: ${baseUrl}`);
  } catch (error) {
    console.error('[VOICE] Error handling technician outbound call:', error);
    twiml.say({ voice: 'alice' }, 'We encountered an error placing your call. Please try again.');
    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

export default router;
