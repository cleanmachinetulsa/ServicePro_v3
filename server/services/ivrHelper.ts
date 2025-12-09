/**
 * IVR Helper - Config-Driven Multi-Tenant IVR Menu Building
 * 
 * ARCHITECTURE SUMMARY:
 * 
 * 1. CONFIG-DRIVEN IVR (New):
 *    - buildConfigDrivenMenuTwiml() - Builds TwiML from IvrMenuWithItems
 *    - processConfigDrivenAction() - Handles menu item actions
 *    - Uses database-stored menu configurations per tenant
 * 
 * 2. LEGACY FALLBACK (Preserved):
 *    - buildMainMenuTwiml() - Original hard-coded menu
 *    - buildServicesOverviewTwiml() - Press 1 action
 *    - buildForwardToPersonTwiml() - Press 2 action
 *    - buildVoicemailTwiml() - Press 3 action
 *    - buildEasterEggTwiml() - Press 7 action
 *    These are kept as fallbacks if config loading fails
 * 
 * MULTI-TENANT SAFETY:
 * - Each tenant uses their own menu from ivr_menus table
 * - No cross-tenant leaking or fallback to Clean Machine for other tenants
 * - Safe generic fallback when config is broken
 * 
 * EXTENDING:
 * - Add new action types to IvrActionType enum in schema
 * - Add handler in processConfigDrivenAction()
 * - Support for multiple menus (after-hours) via menu key
 */

import type { TenantPhoneConfig, IvrMenuWithItems, IvrMenuItem, IvrActionType } from '../../shared/schema';

export interface IvrConfig {
  tenantId: string;
  businessName: string;
  bookingUrl: string;
  sipDomain: string;
  sipUsername: string;
}

// Valid DTMF digits for the IVR menu (7 is secret easter egg - not mentioned in prompt)
export const VALID_IVR_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'];

// ============================================================
// CONFIG-DRIVEN IVR FUNCTIONS (New)
// ============================================================

/**
 * Build IVR menu TwiML from database configuration
 * 
 * This is the primary function for config-driven IVR
 * Uses menu's greetingText, items, and settings
 * 
 * @param menu - IVR menu configuration from database
 * @param callbackBaseUrl - Base URL for callbacks
 * @param attempt - Current attempt number (1-N)
 * @param isNoInputRetry - Whether this is a no-input retry (use noInputMessage)
 * @param isInvalidRetry - Whether this is an invalid digit retry (use invalidInputMessage)
 */
export function buildConfigDrivenMenuTwiml(
  menu: IvrMenuWithItems,
  callbackBaseUrl: string,
  attempt: number = 1,
  isNoInputRetry: boolean = false,
  isInvalidRetry: boolean = false
): string {
  const maxAttempts = menu.maxAttempts || 3;
  const voiceName = menu.voiceName || 'alice';
  
  // After max attempts, politely end the call
  if (attempt > maxAttempts) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">We didn't receive any input, so we're ending this call. You're always welcome to text this number as well. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }
  
  // Determine which message to use
  let promptText: string;
  if (isNoInputRetry && attempt > 1) {
    promptText = `${escapeXml(menu.noInputMessage)} ${escapeXml(buildMenuOptionsPrompt(menu))}`;
  } else if (isInvalidRetry && attempt > 1) {
    promptText = `${escapeXml(menu.invalidInputMessage)} ${escapeXml(buildMenuOptionsPrompt(menu))}`;
  } else {
    promptText = escapeXml(menu.greetingText);
  }
  
  // Build gather with retry tracking
  const nextAttempt = attempt + 1;
  const noInputRedirect = `${callbackBaseUrl}/twilio/voice/ivr-no-input?menuId=${menu.id}&amp;attempt=${nextAttempt}`;
  const selectionAction = `${callbackBaseUrl}/twilio/voice/ivr-selection?menuId=${menu.id}&amp;attempt=${attempt}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${selectionAction}" method="POST" timeout="7">
    <Say voice="${voiceName}">${promptText}</Say>
  </Gather>
  <Redirect method="POST">${noInputRedirect}</Redirect>
</Response>`;
}

/**
 * Build the menu options prompt from visible items
 * Used for retry messages (doesn't repeat full greeting)
 */
function buildMenuOptionsPrompt(menu: IvrMenuWithItems): string {
  const visibleItems = menu.items
    .filter(item => !item.isHidden)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  
  if (visibleItems.length === 0) {
    return 'Press any key to continue.';
  }
  
  return visibleItems
    .map(item => `Press ${item.digit} for ${item.label}`)
    .join('. ') + '.';
}

/**
 * Find a menu item by digit
 */
export function findMenuItemByDigit(menu: IvrMenuWithItems, digit: string): IvrMenuItem | undefined {
  return menu.items.find(item => item.digit === digit);
}

/**
 * Build TwiML for a config-driven action
 * 
 * Processes the action_type and action_payload from a menu item
 * Returns TwiML string for the specified action
 * 
 * @param item - Menu item with action configuration
 * @param menu - Full menu configuration
 * @param callerNumber - Caller's phone number
 * @param callbackBaseUrl - Base URL for callbacks
 * @param voicemailGreetingUrl - Optional custom voicemail greeting MP3 URL
 */
export function buildActionTwiml(
  item: IvrMenuItem,
  menu: IvrMenuWithItems,
  callerNumber: string,
  callbackBaseUrl: string,
  voicemailGreetingUrl?: string | null
): string {
  const voiceName = menu.voiceName || 'alice';
  const payload = item.actionPayload || {};
  
  switch (item.actionType) {
    case 'PLAY_MESSAGE':
      return buildPlayMessageTwiml(payload.message || 'Thank you for calling.', voiceName, payload.hangupAfter !== false);
      
    case 'SMS_INFO':
      return buildSmsInfoTwiml(voiceName);
      
    case 'FORWARD_SIP':
      return buildForwardSipTwiml(payload.sipUri || '', callerNumber, callbackBaseUrl, voiceName);
      
    case 'FORWARD_PHONE':
      return buildForwardPhoneTwiml(payload.phoneNumber || '', callerNumber, callbackBaseUrl, voiceName);
      
    case 'VOICEMAIL':
      return buildVoicemailTwiml(callbackBaseUrl, voiceName, voicemailGreetingUrl);
      
    case 'SUBMENU':
      // For submenu, we redirect to the incoming handler with the submenu ID
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/incoming?menuId=${payload.submenuId}&amp;attempt=1</Redirect>
</Response>`;
      
    case 'REPLAY_MENU':
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/incoming?menuId=${menu.id}&amp;attempt=1</Redirect>
</Response>`;
      
    case 'EASTER_EGG':
      return buildEasterEggConfigTwiml(payload.message || "Thanks for finding the hidden option!", voiceName, payload.hangupAfter !== false);
      
    default:
      console.warn(`[IVR HELPER] Unknown action type: ${item.actionType}`);
      return buildVoicemailTwiml(callbackBaseUrl, voiceName, voicemailGreetingUrl);
  }
}

/**
 * Build TwiML for PLAY_MESSAGE action
 */
function buildPlayMessageTwiml(message: string, voiceName: string, hangupAfter: boolean): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">${escapeXml(message)}</Say>
  <Pause length="1"/>
  ${hangupAfter ? '<Hangup/>' : ''}
</Response>`;
}

/**
 * Build TwiML for SMS_INFO action
 * The actual SMS is sent by the route handler, this just provides voice confirmation
 */
function buildSmsInfoTwiml(voiceName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">We just sent you a text message with our information. Thank you for your interest. Have a great day!</Say>
  <Hangup/>
</Response>`;
}

/**
 * Build TwiML for FORWARD_SIP action
 */
function buildForwardSipTwiml(sipUri: string, callerNumber: string, callbackBaseUrl: string, voiceName: string): string {
  if (!sipUri) {
    console.error('[IVR HELPER] FORWARD_SIP missing sipUri');
    return buildVoicemailTwiml(callbackBaseUrl, voiceName);
  }
  
  const dialTimeout = 25;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">Please hold while we connect you.</Say>
  <Dial callerId="${escapeXml(callerNumber)}" timeout="${dialTimeout}" action="${callbackBaseUrl}/twilio/voice/dial-status" method="POST">
    <Sip>${escapeXml(sipUri)}</Sip>
  </Dial>
</Response>`;
}

/**
 * Build TwiML for FORWARD_PHONE action
 */
function buildForwardPhoneTwiml(phoneNumber: string, callerNumber: string, callbackBaseUrl: string, voiceName: string): string {
  if (!phoneNumber) {
    console.error('[IVR HELPER] FORWARD_PHONE missing phoneNumber');
    return buildVoicemailTwiml(callbackBaseUrl, voiceName);
  }
  
  const dialTimeout = 25;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">Please hold while we connect you.</Say>
  <Dial callerId="${escapeXml(callerNumber)}" timeout="${dialTimeout}" action="${callbackBaseUrl}/twilio/voice/dial-status" method="POST">
    <Number>${escapeXml(phoneNumber)}</Number>
  </Dial>
</Response>`;
}

/**
 * Build TwiML for EASTER_EGG action (config-driven)
 */
function buildEasterEggConfigTwiml(message: string, voiceName: string, hangupAfter: boolean): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">${escapeXml(message)}</Say>
  <Pause length="1"/>
  <Say voice="${voiceName}">Thanks for calling! Have a wonderful day!</Say>
  ${hangupAfter ? '<Hangup/>' : ''}
</Response>`;
}

/**
 * Build TwiML for invalid selection (config-driven)
 */
export function buildConfigDrivenInvalidTwiml(
  menu: IvrMenuWithItems,
  callbackBaseUrl: string,
  attempt: number = 1
): string {
  const maxAttempts = menu.maxAttempts || 3;
  const voiceName = menu.voiceName || 'alice';
  
  if (attempt >= maxAttempts) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">We didn't receive a valid selection. You're always welcome to text this number. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }
  
  const nextAttempt = attempt + 1;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">${escapeXml(menu.invalidInputMessage)}</Say>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/incoming?menuId=${menu.id}&amp;attempt=${nextAttempt}&amp;invalidRetry=true</Redirect>
</Response>`;
}

/**
 * Build TwiML for no-input scenario (config-driven)
 */
export function buildConfigDrivenNoInputTwiml(
  menu: IvrMenuWithItems,
  callbackBaseUrl: string,
  attempt: number = 1
): string {
  const maxAttempts = menu.maxAttempts || 3;
  const voiceName = menu.voiceName || 'alice';
  
  if (attempt > maxAttempts) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">We didn't receive any input, so we're ending this call. You're always welcome to text this number as well. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceName}">${escapeXml(menu.noInputMessage)}</Say>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/incoming?menuId=${menu.id}&amp;attempt=${attempt}&amp;noInputRetry=true</Redirect>
</Response>`;
}


// ============================================================
// LEGACY FALLBACK FUNCTIONS (Preserved for backward compatibility)
// ============================================================

/**
 * LEGACY: Build the main IVR menu TwiML with retry logic
 * 
 * DEPRECATED: Use buildConfigDrivenMenuTwiml() instead
 * Kept as fallback if config loading fails
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
 * LEGACY: Build TwiML for services overview (press 1)
 * Plays service description and triggers SMS with booking link
 */
export function buildServicesOverviewTwiml(config: IvrConfig): string {
  const { businessName } = config;
  
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
 * LEGACY: Build TwiML for forwarding to person via SIP (press 2)
 * 
 * Uses action callback to detect dial outcome:
 * - answered: call completed successfully
 * - no-answer/busy/failed: redirect to voicemail
 */
export function buildForwardToPersonTwiml(config: IvrConfig, callerNumber: string, callbackBaseUrl: string): string {
  const { sipDomain, sipUsername } = config;
  const sipUri = `${sipUsername}@${sipDomain}`;
  const dialTimeout = 25;
  
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
 * 
 * @param callbackBaseUrl - Base URL for Twilio callbacks
 * @param voiceName - TTS voice to use (default: 'alice')
 * @param voicemailGreetingUrl - Optional URL to custom MP3 greeting. If provided, plays MP3 instead of TTS.
 */
export function buildVoicemailTwiml(
  callbackBaseUrl: string, 
  voiceName: string = 'alice',
  voicemailGreetingUrl?: string | null
): string {
  // Build greeting: use custom MP3 if available, otherwise TTS
  let greetingTwiml: string;
  if (voicemailGreetingUrl) {
    // Custom MP3 greeting
    greetingTwiml = `<Play>${escapeXml(voicemailGreetingUrl)}</Play>`;
  } else {
    // Default TTS greeting
    greetingTwiml = `<Say voice="${voiceName}">Please leave your name, vehicle, and what you're looking to get done, and we'll text you back. Press any key when you're finished.</Say>`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiml}
  <Record maxLength="120" playBeep="true" transcribe="true" action="${callbackBaseUrl}/twilio/voice/voicemail-complete" method="POST" recordingStatusCallback="${callbackBaseUrl}/twilio/voice/recording-status" recordingStatusCallbackMethod="POST" transcribeCallback="${callbackBaseUrl}/twilio/voice/voicemail-transcribed" finishOnKey="any"/>
  <Say voice="${voiceName}">We didn't receive your message. Goodbye.</Say>
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
 * LEGACY: Build TwiML for easter egg (press 7 - secret, not mentioned in menu)
 */
export function buildEasterEggTwiml(): string {
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
 * LEGACY: Build TwiML for invalid digit selection
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
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, we're unable to connect your call right now. Please leave a voicemail and we'll get back to you.</Say>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/ivr-selection?Digits=3&amp;forced=voicemail</Redirect>
</Response>`;
}

/**
 * LEGACY: Build TwiML for no-input scenario
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
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We didn't receive any input. Let me repeat the menu.</Say>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/incoming?attempt=${attempt}</Redirect>
</Response>`;
}

/**
 * LEGACY: Get IVR configuration for a tenant
 * 
 * DEPRECATED: Use ivrConfigService.getOrCreateDefaultMenuForTenant() instead
 * Kept for backward compatibility with legacy code paths
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
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
