/**
 * A2P Campaign Service
 * 
 * Manages SMS A2P campaign registration data for tenants.
 * Provides CRUD operations and status transitions for campaign drafts.
 * 
 * NOTE: This service does NOT call Twilio TrustHub APIs yet.
 * It stores campaign data locally for manual submission by the platform owner.
 */

import { db } from '../db';
import type { TenantDb } from '../tenantDb';
import { 
  a2pCampaigns, 
  tenants, 
  tenantConfig, 
  smsTemplates,
  faqEntries,
  type A2pCampaign, 
  type InsertA2pCampaign 
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI();

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  'draft': ['ready_to_submit'],
  'ready_to_submit': ['draft', 'submitted'],
  'submitted': ['approved', 'rejected'],
  'approved': [], // Terminal state
  'rejected': ['draft'], // Can go back to draft for revision
};

/**
 * Get the A2P campaign for a tenant
 * Returns the existing campaign or null if none exists
 */
export async function getCampaignForTenant(
  tenantDb: TenantDb,
  tenantId: string
): Promise<A2pCampaign | null> {
  const [campaign] = await tenantDb
    .select()
    .from(a2pCampaigns)
    .where(eq(a2pCampaigns.tenantId, tenantId))
    .limit(1);
  
  return campaign || null;
}

/**
 * Get default campaign values for a tenant
 * Pre-fills based on tenant config if available
 */
export async function getDefaultCampaignForTenant(
  tenantId: string
): Promise<Partial<InsertA2pCampaign>> {
  // Load tenant info
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  
  // Load tenant config
  const [config] = await db
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  const businessName = config?.businessName || tenant?.displayName || 'My Business';
  const industry = config?.industry || 'general';
  
  // Map industry to default use case
  const industryToUseCase: Record<string, string> = {
    'auto_detailing': 'appointment_reminders',
    'lawn_care': 'appointment_reminders',
    'home_services': 'appointment_reminders',
    'salon': 'appointment_reminders',
    'fitness': 'appointment_reminders',
    'medical': 'appointment_reminders',
    'ecommerce': 'delivery_notifications',
    'marketing': 'marketing',
  };
  
  return {
    tenantId,
    brandName: businessName,
    websiteUrl: config?.websiteUrl || tenant?.subdomain ? `https://${tenant?.subdomain}.serviceproapp.com` : '',
    useCaseCategory: industryToUseCase[industry] || 'mixed',
    status: 'draft',
    optOutInstructions: 'Reply STOP to unsubscribe from all messages.',
    helpInstructions: 'Reply HELP to receive assistance or call us directly.',
    messageFrequency: 'We send 1-5 messages per month, primarily for appointment reminders and confirmations.',
    sampleMessages: [],
    aiGenerated: false,
  };
}

/**
 * Create or update a campaign for a tenant
 * Enforces one campaign per tenant
 */
export async function upsertCampaignForTenant(
  tenantDb: TenantDb,
  tenantId: string,
  payload: Partial<InsertA2pCampaign>
): Promise<A2pCampaign> {
  const existing = await getCampaignForTenant(tenantDb, tenantId);
  
  const now = new Date();
  
  if (existing) {
    // Update existing campaign
    const [updated] = await tenantDb
      .update(a2pCampaigns)
      .set({
        ...payload,
        tenantId, // Ensure tenant scoping
        updatedAt: now,
      })
      .where(eq(a2pCampaigns.id, existing.id))
      .returning();
    
    return updated;
  }
  
  // Create new campaign
  const [created] = await tenantDb
    .insert(a2pCampaigns)
    .values({
      tenantId,
      brandName: payload.brandName || 'My Business',
      status: 'draft',
      ...payload,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  
  return created;
}

/**
 * Update campaign status with validation
 * Enforces valid status transitions
 */
export async function updateCampaignStatus(
  tenantDb: TenantDb,
  tenantId: string,
  newStatus: A2pCampaign['status']
): Promise<A2pCampaign> {
  const existing = await getCampaignForTenant(tenantDb, tenantId);
  
  if (!existing) {
    throw new Error('No campaign found for this tenant');
  }
  
  const currentStatus = existing.status;
  const validNextStatuses = VALID_TRANSITIONS[currentStatus] || [];
  
  if (!validNextStatuses.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}. ` +
      `Valid transitions: ${validNextStatuses.join(', ') || 'none'}`
    );
  }
  
  const now = new Date();
  const updates: Partial<A2pCampaign> = {
    status: newStatus,
    updatedAt: now,
  };
  
  // Track submission time
  if (newStatus === 'submitted') {
    updates.lastSubmittedAt = now;
  }
  
  const [updated] = await tenantDb
    .update(a2pCampaigns)
    .set(updates)
    .where(eq(a2pCampaigns.id, existing.id))
    .returning();
  
  return updated;
}

/**
 * Generate AI suggestions for campaign content
 * Uses tenant context (industry, templates, FAQ) to generate compliant content
 */
export async function generateAISuggestions(
  tenantId: string
): Promise<{
  campaign_description: string;
  sample_messages: string[];
  opt_in_description: string;
  opt_out_instructions: string;
  help_instructions: string;
  message_frequency: string;
}> {
  // Gather tenant context
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  
  const [config] = await db
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  // Get existing SMS templates for this tenant
  const templates = await db
    .select({ body: smsTemplates.body, name: smsTemplates.name })
    .from(smsTemplates)
    .where(eq(smsTemplates.tenantId, tenantId))
    .limit(10);

  // Get FAQ entries for additional context
  const faqs = await db
    .select({ question: faqEntries.question, answer: faqEntries.answer })
    .from(faqEntries)
    .where(eq(faqEntries.tenantId, tenantId))
    .limit(5);

  const businessName = config?.businessName || tenant?.displayName || 'The Business';
  const industry = config?.industry || 'service';
  
  // Build context for AI
  const templateExamples = templates.length > 0
    ? templates.map(t => `- ${t.name}: "${t.body}"`).join('\n')
    : 'No existing templates available.';
  
  const faqContext = faqs.length > 0
    ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : '';

  const systemPrompt = `You are an expert in US A2P 10DLC SMS compliance and registration.
Your task is to generate compliant campaign content for Twilio/carrier approval.

CRITICAL RULES:
1. NO SHAFT content (Sex, Hate, Alcohol, Firearms, Tobacco)
2. ALWAYS include opt-out language: "Reply STOP to unsubscribe"
3. Include HELP keyword support
4. Keep messages professional, clear, and non-spammy
5. Sample messages must be realistic and match actual business use cases
6. Be specific about the types of messages sent and when
7. Opt-in description must clearly explain how customers consent to receive messages

INDUSTRY: ${industry}
BUSINESS NAME: ${businessName}

EXISTING SMS TEMPLATES (for reference):
${templateExamples}

${faqContext ? `BUSINESS FAQ:\n${faqContext}` : ''}`;

  const userPrompt = `Generate A2P campaign registration content for "${businessName}" (${industry} industry).

Return a JSON object with these exact fields:
{
  "campaign_description": "Clear 2-3 sentence description of the SMS campaign purpose",
  "sample_messages": ["Sample message 1...", "Sample message 2...", "Sample message 3..."],
  "opt_in_description": "How customers opt-in to receive messages",
  "opt_out_instructions": "Instructions for opting out (must include STOP)",
  "help_instructions": "What happens when they reply HELP",
  "message_frequency": "Expected message frequency (e.g., '1-5 messages per month')"
}

Requirements:
- campaign_description: Explain the purpose and types of messages
- sample_messages: 3-4 realistic examples that could actually be sent
- Each sample should include opt-out language "Reply STOP to unsubscribe"
- opt_in_description: Be specific about the consent process
- All content must be carrier-compliant`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    
    // Validate required fields
    if (!parsed.campaign_description || !parsed.sample_messages) {
      throw new Error('Missing required fields in AI response');
    }

    return {
      campaign_description: parsed.campaign_description || '',
      sample_messages: Array.isArray(parsed.sample_messages) ? parsed.sample_messages : [],
      opt_in_description: parsed.opt_in_description || 'Customers opt-in by providing their phone number during booking or service signup.',
      opt_out_instructions: parsed.opt_out_instructions || 'Reply STOP to unsubscribe from all messages.',
      help_instructions: parsed.help_instructions || 'Reply HELP to receive assistance or contact us directly.',
      message_frequency: parsed.message_frequency || '1-5 messages per month',
    };
  } catch (error) {
    console.error('[A2P AI] Error generating suggestions:', error);
    throw new Error('Failed to generate AI suggestions. Please try again.');
  }
}

/**
 * Validate campaign completeness for submission
 * Returns list of missing/invalid fields
 */
export function validateCampaignForSubmission(
  campaign: A2pCampaign
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!campaign.brandName?.trim()) {
    errors.push('Brand name is required');
  }
  
  if (!campaign.campaignDescription?.trim()) {
    errors.push('Campaign description is required');
  }
  
  if (!campaign.sampleMessages || campaign.sampleMessages.length < 2) {
    errors.push('At least 2 sample messages are required');
  }
  
  if (!campaign.optInDescription?.trim()) {
    errors.push('Opt-in description is required');
  }
  
  if (!campaign.optOutInstructions?.trim()) {
    errors.push('Opt-out instructions are required');
  } else if (!campaign.optOutInstructions.toLowerCase().includes('stop')) {
    errors.push('Opt-out instructions must include STOP keyword');
  }
  
  if (!campaign.helpInstructions?.trim()) {
    errors.push('HELP instructions are required');
  }
  
  if (!campaign.messageFrequency?.trim()) {
    errors.push('Message frequency is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
