/**
 * Phase 2.3: IVR Helper - Multi-tenant IVR menu building
 * 
 * Generates TwiML responses for interactive voice menus based on tenant configuration.
 * Designed to be extended with per-tenant IVR configs in the future.
 */

import type { TenantPhoneConfig } from '../../shared/schema';

export interface IvrConfig {
  tenantId: string;
  businessName: string;
  bookingUrl: string;
  sipDomain: string;
  sipUsername: string;
}

export function buildMainMenuTwiml(config: IvrConfig, callbackBaseUrl: string): string {
  const { businessName } = config;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${callbackBaseUrl}/twilio/voice/ivr-selection" method="POST" timeout="5">
    <Say voice="alice">Thanks for calling ${escapeXml(businessName)}. Press 1 to hear a quick overview of our services and get a text with booking info. Press 2 if you'd like to talk to a person. Press 3 to leave a detailed voicemail and we'll text you back. Press 7 if you'd like to hear something fun.</Say>
  </Gather>
  <Say voice="alice">We didn't receive any input. Please try your call again.</Say>
  <Hangup/>
</Response>`;
}

export function buildServicesOverviewTwiml(config: IvrConfig): string {
  const { businessName, bookingUrl } = config;
  
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

export function buildForwardToPersonTwiml(config: IvrConfig, callerNumber: string): string {
  const { sipDomain, sipUsername } = config;
  const sipUri = `${sipUsername}@${sipDomain}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we connect you.</Say>
  <Dial callerId="${escapeXml(callerNumber)}" timeout="30">
    <Sip>${escapeXml(sipUri)}</Sip>
  </Dial>
  <Say voice="alice">Sorry, we're unable to connect your call right now. Please leave a voicemail and we'll get back to you.</Say>
  <Redirect method="POST">/twilio/voice/ivr-selection?Digits=3</Redirect>
</Response>`;
}

export function buildVoicemailTwiml(callbackBaseUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please leave your name, vehicle, and what you're looking to get done, and we'll text you back. Press any key when you're finished.</Say>
  <Record maxLength="120" playBeep="true" action="${callbackBaseUrl}/twilio/voice/voicemail-complete" method="POST" recordingStatusCallback="${callbackBaseUrl}/twilio/voice/recording-status" recordingStatusCallbackMethod="POST" finishOnKey="any"/>
  <Say voice="alice">We didn't receive your message. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

export function buildVoicemailCompleteTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for your message. We'll text you back shortly. Have a great day!</Say>
  <Hangup/>
</Response>`;
}

export function buildEasterEggTwiml(): string {
  // TODO: Phase 3 - Make this configurable per tenant
  const funMessage = "Here's a fun fact: The world record for fastest car detailing is 3 minutes and 47 seconds! We take a bit longer to make sure your car gets the royal treatment it deserves.";
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${escapeXml(funMessage)}</Say>
  <Pause length="1"/>
  <Say voice="alice">Thanks for calling! Have a wonderful day!</Say>
  <Hangup/>
</Response>`;
}

export function buildInvalidSelectionTwiml(callbackBaseUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, that's not a valid option.</Say>
  <Redirect method="POST">${callbackBaseUrl}/twilio/voice/incoming</Redirect>
</Response>`;
}

export function getIvrConfigForTenant(
  tenantId: string,
  phoneConfig: Partial<TenantPhoneConfig>,
  tenantBusinessName?: string
): IvrConfig {
  // TODO: Phase 3 - Load from tenant_ivr_config table
  // For now, hardcode root tenant values with clear placeholders
  
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

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
