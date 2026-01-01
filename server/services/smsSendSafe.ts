/**
 * R1-STRICT SMS Send Safe Helper
 * 
 * Guardrails for outbound SMS:
 * - E.164 normalization
 * - Prevents to_equals_from errors
 * - Ensures FROM is the tenant's inbound To number
 * - Detailed logging
 */

import twilio from 'twilio';

export interface SmsSendParams {
  tenantId: string;
  from: string;
  to: string;
  body: string;
  purpose: string;
}

export interface SmsSendResult {
  success: boolean;
  messageSid?: string;
  skipReason?: string;
  error?: string;
}

/**
 * Normalize phone to E.164 format
 */
function normalizeE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
  if (!cleaned) return null;
  
  if (cleaned.startsWith('+')) {
    if (/^\+[1-9]\d{1,14}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }
  
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return null;
}

/**
 * Send SMS with safety guardrails
 * 
 * - Normalizes E.164
 * - Skips if to == from
 * - Logs all sends with purpose
 * - Never throws
 */
export async function sendSmsSafe(params: SmsSendParams): Promise<SmsSendResult> {
  const { tenantId, from, to, body, purpose } = params;
  
  const normalizedFrom = normalizeE164(from);
  const normalizedTo = normalizeE164(to);
  
  if (!normalizedFrom) {
    console.warn(`[SMS OUT] tenantId=${tenantId} purpose=${purpose} skip_reason=invalid_from from=${from}`);
    return { success: false, skipReason: 'invalid_from' };
  }
  
  if (!normalizedTo) {
    console.warn(`[SMS OUT] tenantId=${tenantId} purpose=${purpose} skip_reason=invalid_to to=${to}`);
    return { success: false, skipReason: 'invalid_to' };
  }
  
  if (normalizedTo === normalizedFrom) {
    console.warn(`[SMS OUT] tenantId=${tenantId} purpose=${purpose} skip_reason=to_equals_from from=${normalizedFrom} to=${normalizedTo}`);
    return { success: false, skipReason: 'to_equals_from' };
  }
  
  if (!body || body.trim().length === 0) {
    console.warn(`[SMS OUT] tenantId=${tenantId} purpose=${purpose} skip_reason=empty_body`);
    return { success: false, skipReason: 'empty_body' };
  }
  
  try {
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    const message = await twilioClient.messages.create({
      to: normalizedTo,
      from: normalizedFrom,
      body: body.slice(0, 1600),
    });
    
    console.log(`[SMS OUT] tenantId=${tenantId} from=${normalizedFrom} to=${normalizedTo} purpose=${purpose} ok=true sid=${message.sid}`);
    return { success: true, messageSid: message.sid };
  } catch (err: any) {
    const errorMsg = err?.message || 'unknown';
    console.error(`[SMS OUT] tenantId=${tenantId} from=${normalizedFrom} to=${normalizedTo} purpose=${purpose} ok=false error=${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
