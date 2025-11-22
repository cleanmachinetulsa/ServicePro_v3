import type { Express, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { resolveTenantFromInbound } from './services/tenantCommRouter';
import { handleAiVoiceRequest, buildAiVoiceErrorTwiML } from './services/aiVoiceSession';
import { db } from './db';
import { tenants, tenantConfig } from '@shared/schema';

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
      const resolution = await resolveTenantFromInbound(req, db);

      // Guard 1: No phone config
      if (!resolution.phoneConfig) {
        console.warn('[AI VOICE ROUTE] No phoneConfig found, returning error TwiML');
        const errorTwiml = buildAiVoiceErrorTwiML(
          "We're having trouble routing your call. Please try again later or send us a text message."
        );
        return res.type('text/xml').send(errorTwiml);
      }

      // Guard 2: ivrMode is not 'ai-voice'
      if (resolution.ivrMode !== 'ai-voice') {
        console.warn(
          `[AI VOICE ROUTE] Phone config ivrMode='${resolution.ivrMode}' is not 'ai-voice', returning error TwiML`
        );
        const errorTwiml = buildAiVoiceErrorTwiML(
          "This line is not yet configured for our A I receptionist. Please try calling back later."
        );
        return res.type('text/xml').send(errorTwiml);
      }

      // Fetch full tenant record with businessName
      const [tenantRecord] = await db.select().from(tenants).where(eq(tenants.id, resolution.tenantId));
      const [configRecord] = await db.select().from(tenantConfig).where(eq(tenantConfig.tenantId, resolution.tenantId));

      if (!tenantRecord) {
        console.warn(`[AI VOICE ROUTE] Tenant record not found for ID '${resolution.tenantId}', returning error TwiML`);
        const errorTwiml = buildAiVoiceErrorTwiML(
          "We're having trouble routing your call. Please try again later or send us a text message."
        );
        return res.type('text/xml').send(errorTwiml);
      }

      // Build enriched tenant object for AI voice handler
      const enrichedTenant = {
        id: tenantRecord.id,
        name: tenantRecord.name,
        businessName: configRecord?.businessName || null,
      };

      // All guards passed - handle AI voice request
      console.log(`[AI VOICE ROUTE] Processing AI voice call for tenant '${enrichedTenant.id}' (${enrichedTenant.name})`);

      const result = await handleAiVoiceRequest({
        tenant: enrichedTenant,
        phoneConfig: resolution.phoneConfig,
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
