/**
 * SMS AI Agent System Prompt Builder
 * 
 * Builds tenant-aware, SMS-optimized system prompts for the AI assistant
 * following the OG ServicePro specification.
 * 
 * CAMPAIGN AWARENESS (ServicePro v3):
 * This prompt builder is campaign-aware - it detects when a customer has
 * recently received a campaign (like Welcome Back) and injects context
 * into the system prompt so the AI agent knows about the campaign and
 * can respond intelligently without confusion.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { tenantConfig, services } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getCampaignContextForCustomer, getCustomerIdFromPhone } from '../services/campaignContextService';

interface SmsPromptParams {
  tenantId: string;
  phoneNumber: string;
  customerId?: number;  // Optional: can be provided to skip customer lookup
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
 * Build SMS-optimized system prompt for AI agent
 */
export async function buildSmsSystemPrompt(params: SmsPromptParams): Promise<string> {
  const { tenantId, phoneNumber, customerId } = params;

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

  // Build the system prompt following OG spec
  let systemPrompt = `You are an AI assistant for ${businessName}, a ${industryType} business.

Your role:
- Answer questions about services and pricing
- Help customers book appointments
- Provide helpful, friendly support
- Keep responses under 160 characters when possible (SMS messages)

${servicesList}

Booking link: ${bookingLink}

CRITICAL: The customer's phone number is: ${phoneNumber}
Always use this EXACT phone number when calling any function - never use placeholder text.`;

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
