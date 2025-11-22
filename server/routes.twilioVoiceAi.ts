import type { Express, Request, Response } from 'express';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { resolveTenantFromInbound } from './services/tenantCommRouter';
import { handleAiVoiceRequest, buildAiVoiceErrorTwiML } from './services/aiVoiceSession';

/**
 * AI Voice Route (Phase 4)
 * 
 * Provider-agnostic AI voice endpoint for ivrMode = 'ai-voice'
 * Currently returns placeholder TwiML, ready for future streaming AI integration
 */
export function registerTwilioVoiceAiRoutes(app: Express) {
  /**
   * POST /twilio/voice/ai
   * 
   * Entry point for AI voice calls
   * Guards: Twilio signature verification, tenant resolution, ivrMode validation
   */
  app.post('/twilio/voice/ai', verifyTwilioSignature, async (req: Request, res: Response) => {
    try {
      console.log('[AI VOICE ROUTE] Incoming AI voice request');

      // Resolve tenant from inbound call
      const { tenant, phoneConfig, tenantResolution } = await resolveTenantFromInbound(req);

      // Guard 1: No tenant or phone config
      if (!tenant || !phoneConfig) {
        console.warn('[AI VOICE ROUTE] No tenant/phoneConfig found, returning error TwiML');
        const errorTwiml = buildAiVoiceErrorTwiML(
          "We're having trouble routing your call. Please try again later or send us a text message."
        );
        return res.type('text/xml').send(errorTwiml);
      }

      // Guard 2: ivrMode is not 'ai-voice'
      if (phoneConfig.ivrMode !== 'ai-voice') {
        console.warn(
          `[AI VOICE ROUTE] Phone config ivrMode='${phoneConfig.ivrMode}' is not 'ai-voice', returning error TwiML`
        );
        const errorTwiml = buildAiVoiceErrorTwiML(
          "This line is not yet configured for our A I receptionist. Please try calling back later."
        );
        return res.type('text/xml').send(errorTwiml);
      }

      // All guards passed - handle AI voice request
      console.log(`[AI VOICE ROUTE] Processing AI voice call for tenant '${tenant.id}' (${tenant.name})`);

      const result = await handleAiVoiceRequest({
        tenant,
        phoneConfig,
        body: req.body,
      });

      return res.type('text/xml').send(result.twiml);
    } catch (error) {
      // Catch-all error handler - always return safe TwiML
      console.error('[AI VOICE ROUTE] Error processing AI voice request:', error);
      const fallbackTwiml = buildAiVoiceErrorTwiML(
        "We're experiencing technical difficulties. Please try again later or send us a text message."
      );
      return res.type('text/xml').send(fallbackTwiml);
    }
  });
}
