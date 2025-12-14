/**
 * SMS Consent Keywords Handler
 * 
 * TCPA/CTIA compliance: Handle STOP/START keywords BEFORE any AI routing.
 * This module MUST be called at the TOP of all inbound SMS handlers.
 * 
 * STOP keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT
 *   -> Set sms_consent=false
 *   -> Return EMPTY TwiML (no reply - Twilio handles carrier-level opt-out)
 * 
 * START keywords: START, UNSTOP
 *   -> Set sms_consent=true
 *   -> Return optional confirmation TwiML
 */

import type { TenantDb } from '../tenantDb';
import { customers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// STOP keywords - case insensitive, exact match only
const STOP_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];

// START keywords - case insensitive, exact match only  
const START_KEYWORDS = ['START', 'UNSTOP'];

// Optional: HELP keyword (some carriers require this)
const HELP_KEYWORDS = ['HELP', 'INFO'];

export interface SmsConsentResult {
  handled: boolean;
  action: 'stop' | 'start' | 'help' | null;
  twiml: string;
  keyword?: string;
}

/**
 * Normalize phone to E.164 format for customer lookup
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
 * Generate empty TwiML response (for STOP - no reply)
 */
function emptyTwiml(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}

/**
 * Generate TwiML with a message
 */
function messageTwiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Update customer sms_consent status
 * Creates customer if not found (so we can track opt-out for unknown numbers)
 */
async function updateSmsConsent(
  tenantDb: TenantDb,
  tenantId: string,
  phone: string,
  consent: boolean
): Promise<void> {
  const normalizedPhone = normalizeE164(phone);
  if (!normalizedPhone) {
    console.warn(`[SMS CONSENT] Invalid phone number: ${phone}`);
    return;
  }
  
  try {
    // Try to update existing customer
    const result = await tenantDb
      .update(customers)
      .set({
        smsConsent: consent,
        smsConsentTimestamp: new Date(),
      })
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.phone, normalizedPhone)
        )
      )
      .returning({ id: customers.id });
    
    if (result.length > 0) {
      console.log(`[SMS CONSENT] Updated ${normalizedPhone} sms_consent=${consent}`);
      return;
    }
    
    // Customer not found - create minimal record to track consent
    // This is important for compliance: we need to track opt-outs even for unknown numbers
    await tenantDb
      .insert(customers)
      .values({
        tenantId,
        phone: normalizedPhone,
        name: 'Unknown',
        smsConsent: consent,
        smsConsentTimestamp: new Date(),
      })
      .onConflictDoNothing(); // In case of race condition
    
    console.log(`[SMS CONSENT] Created customer record for ${normalizedPhone} with sms_consent=${consent}`);
  } catch (error: any) {
    console.error(`[SMS CONSENT] Failed to update consent for ${phone}: ${error.message}`);
  }
}

/**
 * Handle SMS consent keywords
 * 
 * MUST be called at the TOP of every inbound SMS handler BEFORE any AI routing.
 * If handled=true, immediately return the twiml and do not continue processing.
 * 
 * @param params - tenantId, fromPhone, body, tenantDb
 * @returns SmsConsentResult with handled flag and twiml to return
 */
export async function handleSmsConsentKeywords(params: {
  tenantId: string;
  fromPhone: string;
  body: string;
  tenantDb: TenantDb;
}): Promise<SmsConsentResult> {
  const { tenantId, fromPhone, body, tenantDb } = params;
  
  // Normalize body for keyword matching (trim, uppercase, single word only)
  const normalized = body.trim().toUpperCase();
  
  // Check STOP keywords
  if (STOP_KEYWORDS.includes(normalized)) {
    console.log(`[SMS CONSENT] STOP keyword detected: "${normalized}" from ${fromPhone}`);
    
    await updateSmsConsent(tenantDb, tenantId, fromPhone, false);
    
    return {
      handled: true,
      action: 'stop',
      twiml: emptyTwiml(), // NO reply for STOP - Twilio/carrier handles it
      keyword: normalized,
    };
  }
  
  // Check START keywords
  if (START_KEYWORDS.includes(normalized)) {
    console.log(`[SMS CONSENT] START keyword detected: "${normalized}" from ${fromPhone}`);
    
    await updateSmsConsent(tenantDb, tenantId, fromPhone, true);
    
    // Optional confirmation message
    const confirmMessage = "You've been re-subscribed to Clean Machine Auto Detail messages. Reply STOP to opt out anytime.";
    
    return {
      handled: true,
      action: 'start',
      twiml: messageTwiml(confirmMessage),
      keyword: normalized,
    };
  }
  
  // Check HELP keywords (optional - provide business info)
  if (HELP_KEYWORDS.includes(normalized)) {
    console.log(`[SMS CONSENT] HELP keyword detected: "${normalized}" from ${fromPhone}`);
    
    const helpMessage = "Clean Machine Auto Detail: For assistance, call (918) 856-5304 or visit cleanmachinetulsa.com. Reply STOP to unsubscribe.";
    
    return {
      handled: true,
      action: 'help',
      twiml: messageTwiml(helpMessage),
      keyword: normalized,
    };
  }
  
  // Not a consent keyword - continue normal processing
  return {
    handled: false,
    action: null,
    twiml: '',
  };
}

/**
 * Check if customer has SMS consent (for pre-send validation)
 */
export async function hasSmsconsent(
  tenantDb: TenantDb,
  tenantId: string,
  phone: string
): Promise<boolean> {
  const normalizedPhone = normalizeE164(phone);
  if (!normalizedPhone) return false;
  
  try {
    const [customer] = await tenantDb
      .select({ smsConsent: customers.smsConsent })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.phone, normalizedPhone)
        )
      )
      .limit(1);
    
    // If customer exists, use their consent status (default false if null)
    if (customer) {
      return customer.smsConsent === true;
    }
    
    // Customer not found - no explicit opt-out, but also no opt-in
    // For campaigns, this should be checked before sending
    return false;
  } catch (error: any) {
    console.error(`[SMS CONSENT] Failed to check consent for ${phone}: ${error.message}`);
    // Fail-closed for compliance: if we can't check, assume no consent
    return false;
  }
}
