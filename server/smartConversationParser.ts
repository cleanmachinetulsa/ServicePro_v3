import OpenAI from 'openai';
import type { TenantDb } from './tenantDb';
import { tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;
const openai = OPENAI_ENABLED ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

if (!OPENAI_ENABLED) {
  console.warn('[SMART PARSER] OpenAI API key not configured - smart scheduling from thread disabled');
}

/**
 * PHASE 12: Smart Conversation Parser
 * 
 * LLM-powered extraction of booking/job details from ANY conversation thread.
 * Works across all channels (SMS, web chat, email, Facebook, Instagram).
 * 
 * Intelligently parses messy conversations to extract:
 * - Customer name and contact info
 * - Service type requested
 * - Preferred date/time (relative or absolute)
 * - Location/address
 * - Vehicle/job-specific details
 * - Add-ons or special requests
 * - Price quotes discussed
 * - Any missing information needed
 * 
 * Multi-tenant aware: Uses tenant's industry type for context-specific parsing.
 */

export interface ParsedBookingInfo {
  // Core booking details
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  
  // Service details
  serviceType?: string;
  serviceCategory?: string; // e.g., 'interior', 'exterior', 'full_detail', industry-specific
  
  // Scheduling
  preferredDate?: string; // ISO date string or description like "next Tuesday"
  preferredTime?: string; // Time string or description like "morning", "2pm"
  dateFlexibility?: 'exact' | 'flexible' | 'asap';
  
  // Location
  address?: string;
  city?: string;
  isWithinServiceArea?: boolean;
  
  // Job-specific details (adapt based on industry)
  vehicleInfo?: string; // For auto detailing
  propertySize?: string; // For lawn care, house cleaning
  jobDescription?: string; // General description for any industry
  
  // Add-ons and extras
  addOns?: string[];
  specialRequests?: string[];
  
  // Pricing context
  priceDiscussed?: string;
  budget?: string;
  
  // Extraction metadata
  confidence: 'high' | 'medium' | 'low';
  missingInfo: string[]; // What still needs to be collected
  extractionNotes: string; // LLM's notes about the conversation
  
  // Ready to book?
  readyToBook: boolean; // Has minimum required info (name, service, time, location)
}

export async function parseConversationForBooking(
  tenantDb: TenantDb,
  tenantId: string,
  conversationMessages: Array<{ sender: string; content: string; timestamp?: Date }>,
  customerPhone?: string
): Promise<ParsedBookingInfo> {
  try {
    if (!openai) {
      throw new Error('OpenAI not configured - smart conversation parsing unavailable');
    }
    
    // Get tenant industry for context-specific parsing
    const [config] = await tenantDb
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    
    const industry = config?.industry || 'service-business';
    const businessName = config?.businessName || 'our business';
    
    // Build conversation transcript
    const transcript = conversationMessages
      .map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
    
    // Industry-specific extraction guidance
    const industryGuidance = getIndustryParsingGuidance(industry);
    
    // Call OpenAI to extract structured booking info
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting booking/job information from customer service conversations for ${industry} businesses.

Your job is to analyze the conversation and extract all booking-related details in a structured format.

Business Context:
- Business Name: ${businessName}
- Industry: ${industry}
${industryGuidance}

EXTRACTION RULES:
1. Extract information ONLY if explicitly mentioned in the conversation
2. DO NOT make assumptions or fill in details that weren't discussed
3. For dates/times: preserve the customer's language (e.g., "next Tuesday", "this weekend", "2pm tomorrow")
4. For service types: use industry-appropriate categories
5. Mark confidence based on how clear and complete the information is
6. List missing info needed to complete the booking

Respond with ONLY a JSON object matching this structure:
{
  "customerName": string or null,
  "customerPhone": string or null,
  "customerEmail": string or null,
  "serviceType": string or null,
  "serviceCategory": string or null,
  "preferredDate": string or null,
  "preferredTime": string or null,
  "dateFlexibility": "exact" | "flexible" | "asap" | null,
  "address": string or null,
  "city": string or null,
  "isWithinServiceArea": boolean or null,
  "vehicleInfo": string or null,
  "propertySize": string or null,
  "jobDescription": string or null,
  "addOns": string[] or [],
  "specialRequests": string[] or [],
  "priceDiscussed": string or null,
  "budget": string or null,
  "confidence": "high" | "medium" | "low",
  "missingInfo": string[],
  "extractionNotes": string,
  "readyToBook": boolean
}

Set "readyToBook" to true ONLY if you have:
- Customer name
- Service type
- Preferred date/time
- Address/location`
        },
        {
          role: 'user',
          content: `Analyze this conversation and extract booking information:

CONVERSATION TRANSCRIPT:
${transcript}

${customerPhone ? `ADDITIONAL CONTEXT:\n- Customer phone number: ${customerPhone}` : ''}

Extract all booking details in JSON format.`
        }
      ],
      temperature: 0.2, // Low temperature for consistent extraction
      max_tokens: 1000
    });
    
    const responseText = completion.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }
    
    // Parse JSON response
    const parsed: ParsedBookingInfo = JSON.parse(responseText);
    
    // Log usage for analytics
    try {
      const { logApiUsage } = await import('./usageTracker');
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const totalCost = (inputTokens / 1000000) * 2.50 + (outputTokens / 1000000) * 10.00;
      
      await logApiUsage(
        'openai',
        'tokens',
        inputTokens + outputTokens,
        totalCost,
        {
          model: 'gpt-4o',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          feature: 'smart_conversation_parser',
        }
      );
    } catch (err) {
      console.error('[SMART PARSER USAGE LOG] Error:', err);
    }
    
    console.log(`[SMART PARSER] Extracted booking info with ${parsed.confidence} confidence. Ready to book: ${parsed.readyToBook}`);
    
    return parsed;
    
  } catch (error) {
    console.error('[SMART PARSER] Error parsing conversation:', error);
    
    // Return minimal fallback result
    return {
      confidence: 'low',
      missingInfo: ['Unable to parse conversation due to error'],
      extractionNotes: `Error during parsing: ${(error as Error).message}`,
      readyToBook: false,
    };
  }
}

/**
 * Get industry-specific parsing guidance for better extraction accuracy
 */
function getIndustryParsingGuidance(industry: string): string {
  const guidanceMap: Record<string, string> = {
    'auto-detailing': `
- Services: Interior Detail, Exterior Detail, Full Detail, Ceramic Coating, Paint Correction, etc.
- Vehicle info: Make, model, year, color, condition
- Key add-ons: Headlight restoration, pet hair removal, odor removal, fabric protection
- Location: Mobile service - extract customer address`,
    
    'lawn-care': `
- Services: Mowing, Edging, Trimming, Fertilization, Aeration, Leaf Removal, etc.
- Property info: Lot size, grass type, special features (trees, flower beds)
- Frequency: One-time or recurring (weekly, bi-weekly, monthly)
- Location: Service address with property access notes`,
    
    'house-cleaning': `
- Services: Standard Clean, Deep Clean, Move In/Out, Post-Construction, etc.
- Property info: Square footage, bedrooms, bathrooms
- Frequency: One-time or recurring schedule
- Special needs: Pet-friendly products, eco-friendly, specific areas to focus`,
    
    'pressure-washing': `
- Services: House washing, driveway cleaning, deck/patio, roof cleaning, etc.
- Property info: Surface type, square footage, staining level
- Special concerns: Delicate surfaces, landscaping protection`,
    
    'mobile-pet-grooming': `
- Services: Bath, Haircut, Nail trim, Full groom, etc.
- Pet info: Breed, size, temperament, age
- Special needs: Anxiety, medical conditions, specific styles
- Location: Customer address for mobile service`,
  };
  
  return guidanceMap[industry] || `
- Extract service type in customer's own words
- Note any job-specific details mentioned
- Pay attention to timeline and scheduling preferences`;
}

/**
 * Helper: Validate if extracted info is sufficient for booking
 */
export function validateBookingReadiness(parsed: ParsedBookingInfo): {
  ready: boolean;
  missing: string[];
} {
  const required = ['customerName', 'serviceType', 'preferredDate', 'address'];
  const missing: string[] = [];
  
  for (const field of required) {
    if (!parsed[field as keyof ParsedBookingInfo]) {
      missing.push(field);
    }
  }
  
  return {
    ready: missing.length === 0,
    missing,
  };
}
