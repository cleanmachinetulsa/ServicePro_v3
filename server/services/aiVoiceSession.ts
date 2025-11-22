import type { TenantPhoneConfig } from '@shared/schema';

/**
 * AI Voice Session Service (Phase 4)
 * 
 * Provider-agnostic entry point for AI voice calls.
 * Currently returns static TwiML placeholder.
 * Future: Will integrate streaming AI (OpenAI Realtime API, ElevenLabs, etc.)
 */

export interface TenantRow {
  id: string;
  name: string;
  subdomain: string | null;
  isRoot: boolean;
  businessName?: string | null;
  tier?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface AiVoiceRequestContext {
  tenant: TenantRow;
  phoneConfig: TenantPhoneConfig;
  body: Record<string, any>; // Twilio webhook body
}

export interface AiVoiceResult {
  twiml: string; // XML string to send back to Twilio
}

/**
 * Build TwiML response using safe XML construction
 */
function buildTwiML(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${content}
</Response>`;
}

/**
 * Escape XML special characters for safe TwiML generation
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Handle AI voice request
 * 
 * Phase 4: Returns static TwiML placeholder
 * Future: Will initiate streaming AI conversation
 */
export async function handleAiVoiceRequest(
  ctx: AiVoiceRequestContext
): Promise<AiVoiceResult> {
  const { tenant, phoneConfig, body } = ctx;
  const callSid = body.CallSid || 'unknown';

  // Log the incoming AI voice call
  console.log(`[AI VOICE] Incoming call for tenant '${tenant.id}' (${tenant.name}), CallSid: ${callSid}`);

  // Get business name for personalized greeting
  const businessName = tenant.businessName || tenant.name || 'our business';
  const safeBusinessName = escapeXml(businessName);

  // Build placeholder TwiML greeting
  const greeting = `
    <Say voice="Polly.Joanna">
      Hello! You've reached ${safeBusinessName}.
      You're speaking with our A I receptionist, currently in beta.
      Please tell me briefly what you need help with, and I'll do my best to assist you.
    </Say>
    <Pause length="2"/>
    <Say voice="Polly.Joanna">
      I'm sorry, our A I voice system is still being configured.
      Please send us a text message or try calling back later.
      Thank you!
    </Say>
    <Hangup/>
  `.trim();

  const twiml = buildTwiML(greeting);

  console.log(`[AI VOICE] Generated placeholder TwiML for tenant '${tenant.id}'`);

  return { twiml };
}

/**
 * Build error TwiML for misconfigured AI voice calls
 */
export function buildAiVoiceErrorTwiML(message: string): string {
  const safeMessage = escapeXml(message);
  const content = `
    <Say voice="Polly.Joanna">
      ${safeMessage}
    </Say>
    <Hangup/>
  `.trim();
  
  return buildTwiML(content);
}
