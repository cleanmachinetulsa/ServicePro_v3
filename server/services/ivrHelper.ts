/**
 * Phase 2.3: IVR Helper - Multi-tenant IVR menu building
 * 
 * ARCHITECTURE SUMMARY (for future reference):
 * 
 * 1. MAIN MENU: buildMainMenuTwiml()
 *    - Builds <Gather numDigits="1"> with prompt text
 *    - Routes to /twilio/voice/ivr-selection for digit handling
 *    - Supports attempt tracking via ?attempt= query param for retry logic
 * 
 * 2. IVR SELECTION HANDLER: (in routes.twilioVoiceIvr.ts handleIvrSelection)
 *    - Receives DTMF digit from caller
 *    - Routes: 1=services+SMS, 2=SIP dial, 3=voicemail, 7=easter egg
 *    - Invalid/no digits → replay menu (up to 3 attempts)
 * 
 * 3. SIP DIAL (Press 2): buildForwardToPersonTwiml()
 *    - <Dial> to SIP endpoint with callerId passthrough
 *    - Uses action callback to detect no-answer/busy/failed → voicemail
 * 
 * 4. VOICEMAIL: buildVoicemailTwiml()
 *    - <Record> with callbacks:
 *      - recordingStatusCallback: /twilio/voice/recording-status
 *      - transcribeCallback: /twilio/voice/voicemail-transcribed
 *    - Creates conversation, syncs voicemail, sends push notification
 * 
 * TODO: Per-tenant IVR configuration via tenant_ivr_config table:
 *   - Custom prompt text
 *   - Digit → action mappings
 *   - Business hours scheduling
 *   - Voice selection (alice, matthew, etc.)
 */

import type { TenantPhoneConfig } from '../../shared/schema';

export interface IvrConfig {
  tenantId: string;
  businessName: string;
  bookingUrl: string;
  sipDomain: string;
  sipUsername: string;
}

// Valid DTMF digits for the IVR menu (7 is secret easter egg - not mentioned in prompt)
export const VALID_IVR_DIGITS = ['1', '2', '3', '7'];

/**
 * Build the main IVR menu TwiML with retry logic
 * 
 * @param config - Tenant IVR configuration
 * @param callbackBaseUrl - Base URL for callbacks
 * @param attempt - Current attempt number (1-3), defaults to 1
 * @returns TwiML string for the IVR menu
 */
export function buildMainMenuTwiml(config: IvrConfig, callbackBaseUrl: string, attempt: number = 1): string {
  const { businessName } = config;
  const maxAttempts = 3;
  
  // IVR prompt text - intentionally does NOT mention digit 7 (easter egg is secret)
  const promptText = `Thanks for calling ${escapeXml(businessName)}. ` +
    `Press 1 for pricing and information by text message. ` +
    `Press 2 to speak with someone. ` +
    `Press 3 to leave a voicemail.`;
  
  // After max attempts, politely end the call
  if (attempt > maxAttempts) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We didn't receive any input, so we're ending this call. You're always welcome to text this number as well. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }
  
  // Build gather with retry tracking
  const nextAttempt = attempt + 1;
  const noInputRedirect = `${callbackBaseUrl}/twilio/voice/ivr-no-input?attempt=${nextAttempt}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${callbackBaseUrl}/twilio/voice/ivr-selection?attempt=${attempt}" method="POST" timeout="7">
    <Say voice="alice">${promptText}</Say>
  </Gather>
  <Redirect method="POST">${noInputRedirect}</Redirect>
</Response>`;
}

/**
 * Build TwiML for services overview (press 1)
 * Plays service description and triggers SMS with booking link
 */
export function buildServicesOverviewTwiml(config: IvrConfig): string {
  const { businessName } = config;
  
  // TODO: Phase 3 - Load per-tenant service descriptions from database
  const servicesMessage = `At ${escapeXml(businessName)}, we provide professional auto detailing services including full details, ceramic coatings, interior cleaning, and maintenance packages. You'll receive a text message shortly with our booking link and full service list.`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${servicesMessage}</Say>
  <Pause length="1"/>
  <Say voice="alice">Thank you for your interest. Have a great day!</Say>
  <Hangup/>
</Response>`;
}

/**
 * Build TwiML for forwarding to person via SIP (press 2)
 * 
 * Uses action callback to detect dial outcome:
 * - answered: call completed successfully
 * - no-answer/busy/failed: redirect to voicemail
 * 
 * @param config - Tenant IVR configuration
 * @param callerNumber - Caller's phone number (passed as callerId)
 * @param callbackBaseUrl - Base URL for dial status callback
 */
export function buildForwardToPersonTwiml(config: IvrConfig, callerNumber: string, callbackBaseUrl: string): string {
  const { sipDomain, sipUsername } = config;
  const sipUri = `${sipUsername}@${sipDomain}`;
  const dialTimeout = 25; // seconds to ring before no-answer
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we connect you.</Say>
  <Dial callerId="${escapeXml(callerNumber)}" timeout="${dialTimeout}" action="${callbackBaseUrl}/twilio/voice/dial-status" method="POST">
    <Sip>${escapeXml(sipUri)}</Sip>
  </Dial>
</Response>`;
}

/**
 * Build TwiML for voicemail recording (press 3 or after failed dial)
 * 
 * Uses proper callbacks for:
 * - Recording status → conversation sync + push notification
 * - Transcription → update conversation with text
 */
export function buildVoicemailTwiml(callbackBaseUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please leave your name, vehicle, and what you're looking to get done, and we'll text you back. Press any key when you're finished.</Say>
  <Record maxLength="120" playBeep="true" transcribe="true" action="${callbackBaseUrl}/twilio/voice/voicemail-complete" method="POST" recordingStatusCallback="${callbackBaseUrl}/twilio/voice/recording-status" recordingStatusCallbackMethod="POST" transcribeCallback="${callbackBaseUrl}/twilio/voice/voicemail-transcribed" finishOnKey="any"/>
  <Say voice="alice">We didn't receive your message. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Build TwiML for voicemail completion confirmation
 */
export function buildVoicemailCompleteTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for your message. We'll text you back shortly. Have a great day!</Say>
  <Hangup/>
</Response>`;
}

/**
 * Build TwiML for easter egg (press 7 - secret, not mentioned in menu)
 */
export function buildEasterEggTwiml(): string {
  // Fun fact that's somewhat auto-detailing related
  const funMessage = "Here's a fun fact: The world record for fastest car detailing is 3 minutes and 47 seconds! We take a bit longer to make sure your car gets the royal treatment it deserves.";
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${escapeXml(funMessage)}</Say>
  <Pause length="1"/>
  <Say voice="alice">Thanks for calling! Have a wonderful day!</Say>
  <Hangup/>
</Response>`;
}

/**
 * Build TwiML for invalid digit selection
 * Redirects back to menu with incremented attempt count
 */
export function buildInvalidSelectionTwiml(callbackBaseUrl: string, attempt: number = 1): string {
  const maxAttempts = 3;
  
  if (attempt >= maxAttempts) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We didn't receive a valid selection. You're always welcome to text this number. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }
  
  const nextAttempt = attempt + 1;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, that's not a valid option.</Say>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/incoming?attempt=${nextAttempt}</Redirect>
</Response>`;
}

/**
 * Build TwiML for handling dial status after SIP call attempt
 * 
 * Dial statuses:
 * - completed: call was answered (do nothing, call ends naturally)
 * - no-answer: nobody picked up within timeout
 * - busy: line was busy
 * - failed: call failed (network issues, invalid SIP, etc.)
 * - canceled: caller hung up before answer
 * 
 * All failure cases → go to voicemail
 */
export function buildDialStatusTwiml(dialStatus: string, callbackBaseUrl: string): string {
  // If the call was answered, just let it end
  if (dialStatus === 'completed' || dialStatus === 'answered') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`;
  }
  
  // For all failure cases, redirect to voicemail
  // This includes: no-answer, busy, failed, canceled
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, we're unable to connect your call right now. Please leave a voicemail and we'll get back to you.</Say>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/ivr-selection?Digits=3&amp;forced=voicemail</Redirect>
</Response>`;
}

/**
 * Build TwiML for no-input scenario
 * Replays the menu with incremented attempt count
 */
export function buildNoInputTwiml(callbackBaseUrl: string, attempt: number = 1): string {
  const maxAttempts = 3;
  
  if (attempt > maxAttempts) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We didn't receive any input, so we're ending this call. You're always welcome to text this number as well. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }
  
  // Get the main menu TwiML with current attempt number
  // Note: We don't call buildMainMenuTwiml here to avoid circular dependency
  // Instead, we redirect to the incoming handler with the attempt count
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We didn't receive any input. Let me repeat the menu.</Say>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/incoming?attempt=${attempt}</Redirect>
</Response>`;
}

/**
 * Get IVR configuration for a tenant
 * 
 * TODO: Phase 3 - Load from tenant_ivr_config table for custom:
 * - Prompt text
 * - Digit mappings
 * - Voice selection
 * - Business hours
 */
export function getIvrConfigForTenant(
  tenantId: string,
  phoneConfig: Partial<TenantPhoneConfig>,
  tenantBusinessName?: string
): IvrConfig {
  if (tenantId === 'root') {
    return {
      tenantId,
      businessName: tenantBusinessName || 'Clean Machine Auto Detail',
      bookingUrl: 'https://cleanmachinetulsa.com/book',
      sipDomain: phoneConfig.sipDomain || 'cleanmachinetulsa.sip.twilio.com',
      sipUsername: phoneConfig.sipUsername || 'jody',
    };
  }
  
  // Future tenants: Load from database
  return {
    tenantId,
    businessName: tenantBusinessName || 'Our Business',
    bookingUrl: `https://app.servicepro.com/book/${tenantId}`,
    sipDomain: phoneConfig.sipDomain || '',
    sipUsername: phoneConfig.sipUsername || '',
  };
}

/**
 * Escape XML special characters for TwiML safety
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
