/**
 * SMS AI Agent System Prompt Builder
 * 
 * Builds tenant-aware, SMS-optimized system prompts for the AI assistant
 * following the OG ServicePro specification.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { tenantConfig, services } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface SmsPromptParams {
  tenantId: string;
  phoneNumber: string;
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
  const { tenantId, phoneNumber } = params;

  // Get tenant configuration
  const { businessName, industryType, subdomain } = await getTenantBusinessInfo(tenantId);
  
  // Get services list
  const servicesList = await getTenantServices(tenantId);
  
  // Build booking link
  const bookingLink = buildBookingLink(subdomain, tenantId);

  // Build the system prompt following OG spec
  const systemPrompt = `You are an AI assistant for ${businessName}, a ${industryType} business.

Your role:
- Answer questions about services and pricing
- Help customers book appointments
- Provide helpful, friendly support
- Keep responses under 160 characters when possible (SMS messages)

${servicesList}

Booking link: ${bookingLink}

CRITICAL: The customer's phone number is: ${phoneNumber}
Always use this EXACT phone number when calling any function - never use placeholder text.

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
- Prioritize clarity over brevity`;

  return systemPrompt;
}
