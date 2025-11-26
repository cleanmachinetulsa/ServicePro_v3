/**
 * SMS AI Agent System Prompt Builder
 * 
 * AI BEHAVIOR V2 - CORE BRAIN
 * 
 * Builds tenant-aware, state-aware, SMS-optimized system prompts for the AI assistant.
 * 
 * Key features:
 * - Centralized system prompt configuration
 * - Conversation state awareness (never re-asks known info)
 * - Control mode awareness (handles human handback scenarios)
 * - Campaign awareness (ServicePro v3)
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { tenantConfig, services } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getCampaignContextForCustomer, getCustomerIdFromPhone } from '../services/campaignContextService';
import { 
  SYSTEM_PROMPT_TEMPLATE, 
  BEHAVIOR_CONFIG, 
  REQUIRED_FIELDS, 
  getBookingStatusFromState, 
  BookingStatus 
} from '@shared/ai/smsAgentConfig';

interface ConversationStateInfo {
  customerName?: string;
  customerEmail?: string;
  address?: string;
  addressValidated?: boolean;
  service?: string;
  serviceId?: number;
  selectedTimeSlot?: string;
  preferredDate?: string;
  preferredTimeWindow?: string;
  addOns?: string[];
  vehicles?: Array<{
    year?: string;
    make?: string;
    model?: string;
    color?: string;
  }>;
  // Booking status flags
  requiresManualApproval?: boolean;
  inServiceArea?: boolean;
  // Voicemail context
  lastVoicemailSummary?: string;
}

interface SmsPromptParams {
  tenantId: string;
  phoneNumber: string;
  customerId?: number;
  conversationState?: ConversationStateInfo;  // AI Behavior v2: conversation state for context
  controlMode?: 'auto' | 'manual' | 'paused';  // AI Behavior v2: control mode awareness
  recentHumanMessages?: string[];  // AI Behavior v2: messages from human agent during handback
}

/**
 * Get tenant business configuration
 */
async function getTenantBusinessInfo(tenantId: string): Promise<{
  businessName: string;
  industryType: string;
  subdomain: string | null;
}> {
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    const [config] = await tenantDb
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    if (config) {
      return {
        businessName: config.businessName || 'our team',
        industryType: config.industry || 'service',
        subdomain: config.subdomain || null,
      };
    }
  } catch (error) {
    console.error('[SMS PROMPT] Error loading tenant config:', error);
  }

  // Fallback defaults
  return {
    businessName: 'our team',
    industryType: 'service',
    subdomain: null,
  };
}

/**
 * Get services list for tenant
 */
async function getTenantServices(tenantId: string): Promise<string> {
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    const servicesList = await tenantDb
      .select()
      .from(services)
      .where(tenantDb.withTenantFilter(services))
      .limit(20); // Limit to prevent extremely long prompts

    if (servicesList.length > 0) {
      // Format as concise list with name and price range
      const formatted = servicesList
        .map(s => {
          const priceRange = s.priceRange || s.price?.toString() || 'Custom pricing';
          return `- ${s.name} (${priceRange})`;
        })
        .join('\n');
      
      return `Available services:\n${formatted}`;
    }
  } catch (error) {
    console.error('[SMS PROMPT] Error loading services:', error);
  }

  // Fallback if services can't be loaded
  return 'Services are configured in your dashboard. Visit your account for details.';
}

/**
 * Build booking link for tenant
 */
function buildBookingLink(subdomain: string | null, tenantId: string): string {
  // TODO: Wire to actual booking URL structure when multi-tenant booking pages are ready
  if (subdomain) {
    return `https://${subdomain}.servicepro.com/book`;
  }
  
  // Fallback generic booking link
  return `https://book.servicepro.com/${tenantId}`;
}

/**
 * Helper to determine missing required fields
 */
function getMissingRequiredFields(state: ConversationStateInfo | undefined): string[] {
  if (!state) return [...REQUIRED_FIELDS];
  
  const missing: string[] = [];
  
  if (!state.customerName) missing.push('customerName');
  
  // Check for vehicle info (any of year/make/model)
  const hasVehicle = state.vehicles && state.vehicles.length > 0 && 
    (state.vehicles[0].year || state.vehicles[0].make || state.vehicles[0].model);
  if (!hasVehicle) missing.push('vehicle');
  
  if (!state.service) missing.push('serviceType');
  if (!state.selectedTimeSlot) missing.push('dateTime');
  if (!state.address) missing.push('address');
  
  return missing;
}

/**
 * Build KNOWN_CONTEXT section from conversation state
 */
function buildKnownContext(state: ConversationStateInfo | undefined): string {
  if (!state) {
    return 'KNOWN_CONTEXT: (none - this is a new conversation)';
  }
  
  const knownFields: string[] = [];
  
  if (state.customerName) {
    knownFields.push(`- Customer name: ${state.customerName}`);
  }
  
  if (state.vehicles && state.vehicles.length > 0) {
    const vehicle = state.vehicles[0];
    const vehicleStr = [vehicle.year, vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' ');
    if (vehicleStr) {
      knownFields.push(`- Vehicle: ${vehicleStr}`);
    }
  }
  
  if (state.service) {
    knownFields.push(`- Service selected: ${state.service}`);
  }
  
  if (state.selectedTimeSlot) {
    knownFields.push(`- Preferred date/time: ${state.selectedTimeSlot}`);
  }
  
  if (state.address) {
    const validation = state.addressValidated ? ' (validated)' : ' (not yet validated)';
    knownFields.push(`- Address: ${state.address}${validation}`);
  }
  
  if (state.addOns && state.addOns.length > 0) {
    knownFields.push(`- Add-ons: ${state.addOns.join(', ')}`);
  }
  
  if (state.customerEmail) {
    knownFields.push(`- Email: ${state.customerEmail}`);
  }
  
  if (state.lastVoicemailSummary) {
    const summaryTrimmed = state.lastVoicemailSummary.trim().slice(0, 240);
    knownFields.push(`- Recent voicemail from this customer: ${summaryTrimmed}`);
  }

  if (knownFields.length === 0) {
    return 'KNOWN_CONTEXT: (none - this is a new conversation)';
  }
  
  return `KNOWN_CONTEXT:\n${knownFields.join('\n')}`;
}

/**
 * Build SMS-optimized system prompt for AI agent
 * AI BEHAVIOR V2: Now includes conversation state and control mode awareness
 */
export async function buildSmsSystemPrompt(params: SmsPromptParams): Promise<string> {
  const { tenantId, phoneNumber, customerId, conversationState, controlMode, recentHumanMessages } = params;

  // Get tenant configuration
  const { businessName, industryType, subdomain } = await getTenantBusinessInfo(tenantId);
  
  // Get services list
  const servicesList = await getTenantServices(tenantId);
  
  // Build booking link
  const bookingLink = buildBookingLink(subdomain, tenantId);

  // Get campaign context for AI awareness
  const tenantDb = wrapTenantDb(db, tenantId);
  let campaignContext = { hasRecentCampaign: false };
  
  try {
    // Get customer ID if not provided
    const lookupCustomerId = customerId ?? await getCustomerIdFromPhone(tenantDb, phoneNumber);
    
    if (lookupCustomerId) {
      campaignContext = await getCampaignContextForCustomer({
        tenantDb,
        tenantId,
        customerId: lookupCustomerId,
      });
    }
  } catch (error) {
    console.error('[SMS PROMPT] Error loading campaign context:', error);
    // Continue without campaign context - don't break prompt builder
  }

  // AI BEHAVIOR V2: Start with template-based system prompt
  let systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{businessName}', businessName)
    .replace('{industryType}', industryType);
  
  // Add services list
  systemPrompt += `\n\n${servicesList}`;
  
  // Add booking link
  systemPrompt += `\n\nBooking link: ${bookingLink}`;
  
  // Add phone number context
  systemPrompt += `\n\nCRITICAL: The customer's phone number is: ${phoneNumber}\nAlways use this EXACT phone number when calling any function - never use placeholder text.`;
  
  // AI BEHAVIOR V2: Add conversation state context
  const knownContext = buildKnownContext(conversationState);
  const missingFields = getMissingRequiredFields(conversationState);
  
  systemPrompt += `\n\n${knownContext}`;
  
  if (missingFields.length > 0) {
    systemPrompt += `\n\nMISSING INFORMATION (ask for these if relevant to customer's request):\n- ${missingFields.join('\n- ')}`;
  } else {
    systemPrompt += `\n\nALL REQUIRED INFORMATION COLLECTED ✓\nYou can proceed to book the appointment when customer confirms.`;
  }
  
  // AI BEHAVIOR V2: Add control mode awareness
  if (controlMode && controlMode !== 'auto') {
    if (controlMode === 'manual' && recentHumanMessages && recentHumanMessages.length > 0) {
      systemPrompt += `\n\nCONTROL MODE: HANDBACK FROM HUMAN AGENT\nA human team member recently handled this conversation. Their last messages:\n`;
      recentHumanMessages.slice(-BEHAVIOR_CONFIG.maxHandbackMessages).forEach((msg, idx) => {
        systemPrompt += `${idx + 1}. "${msg}"\n`;
      });
      systemPrompt += `\nContinue the conversation naturally, building on what the human agent discussed.`;
    } else if (controlMode === 'paused') {
      systemPrompt += `\n\nCONTROL MODE: PAUSED\nThis conversation is paused. A human will respond when ready.`;
    }
  }

  // AI BEHAVIOR V2: Add booking status and handshake rules
  const bookingStatus: BookingStatus = getBookingStatusFromState(conversationState);
  
  systemPrompt += `

BOOKING_HANDSHAKE_RULES:
- You NEVER send a final confirmation message such as "You are fully booked" or "Your appointment is confirmed" on your own.
- The human staff member must always review and confirm the booking inside the dashboard before a final confirmation is sent.
- You may propose specific times and summarize what will be booked, but you must phrase it as a "draft" or "I'll submit this for review", not as a finalized booking.
- When the system indicates bookingStatus = "ready_for_draft":
  - You should say something like: "I have everything I need to prepare your appointment. I'll submit this as a draft for our team to review. You'll receive a final confirmation message once it's officially booked."
- When bookingStatus = "ready_for_human_review" (e.g. outside service area or manual approval required):
  - You should clearly explain that the request will be sent to a human for manual review and is NOT yet confirmed.
  - Use wording like: "You're just outside our normal service area, but I can submit this to a team member to review. They'll confirm if we can make an exception and you'll get a final confirmation afterward."
- When bookingStatus = "not_ready":
  - Focus on gathering missing details (service type, address, date/time, etc.) before talking about preparing the appointment.
- You MUST avoid phrases that imply a fully confirmed booking such as:
  - "You are booked"
  - "Your appointment is confirmed"
  - "We will definitely see you at [time]"
  - Instead, use language like "I'll prepare this as a draft" or "Our team will review and confirm."

CURRENT_BOOKING_STATUS: ${bookingStatus}
(Use this to decide whether to keep gathering info, prepare a draft, or clearly say a human will review before confirmation.)`;

  // Inject campaign awareness context if available
  if (campaignContext.hasRecentCampaign && campaignContext.campaignName) {
    systemPrompt += `

CAMPAIGN CONTEXT:
- This customer recently received the "${campaignContext.campaignName}" campaign.
- Campaign key: ${campaignContext.campaignKey}
- Date sent: ${campaignContext.lastSentAt?.toISOString().split('T')[0] || 'recently'}
- Bonus points from this campaign: ${campaignContext.bonusPointsFromCampaign ?? 'N/A'}
- Current total points: ${campaignContext.currentPoints ?? 'unknown'}

BEHAVIOR RULES FOR CAMPAIGN-RELATED MESSAGES:
- If the customer mentions:
  - "your text", "your message", "your email",
  - "${campaignContext.bonusPointsFromCampaign} points", "bonus points",
  - "new system", "welcome back",
  assume they are referring to this campaign.
- Do NOT say "I don't know what you're talking about".
- Instead:
  1) Confirm they received the offer in simple language.
  2) Briefly explain how the points work and how many points they have (if known).
  3) Offer a clear next step: for example,
     - help them book an appointment using their points, or
     - help them log in / use the booking link.
- If there is any ambiguity, calmly restate the offer and ask a simple clarifying question instead of expressing confusion.`;
  }

  systemPrompt += `

Guidelines:
- Be conversational and friendly
- Ask clarifying questions if needed
- If you detect damage/specialty job keywords, ask for photos
- If customer wants to book, provide the booking link
- Never make up pricing - only use the services listed above
- Keep SMS responses brief and clear
- Use proper punctuation and grammar
- Don't refer to yourself by name or as a specific person

SMS Optimization:
- Aim for under 160 characters per message when possible
- Use abbreviations sparingly and only when natural
- Break longer information into multiple clear points
- Prioritize clarity over brevity

GENERAL CAMPAIGN & PROMO HANDLING RULES:
- If the customer references:
  - a recent text or email "you" sent,
  - promo language like "points", "bonus", "welcome back", "new system",
  you should:
  1) Check the campaign context provided above (if any).
  2) If there is a recent campaign, assume that is what they mean.
  3) Briefly restate the offer and how it works.
  4) Offer to help them use it (check points, book, log in, etc.).
- Avoid saying "I have no record of that" as a first response.
- Instead, try to interpret based on the latest campaign and the customer's current loyalty status.`;

  return systemPrompt;
}
