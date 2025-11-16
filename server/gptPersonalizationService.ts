import { db } from './db';
import { customers, customerVehicles, customerServiceHistory } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import OpenAI from 'openai';
import { format, differenceInMonths } from 'date-fns';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface CustomerContext {
  isReturning: boolean;
  name?: string;
  primaryVehicle?: {
    year?: string;
    make?: string;
    model?: string;
    color?: string;
  };
  recentServices: Array<{
    serviceType: string;
    serviceDate: Date;
    amount?: string;
  }>;
  stats: {
    totalAppointments: number;
    lifetimeValue: string;
  };
}

/**
 * Build rich customer context for GPT personalization
 */
export async function buildCustomerContext(
  phone: string
): Promise<CustomerContext | null> {
  try {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.phone, phone)
    });

    if (!customer) {
      return null;
    }

    const primaryVehicle = await db.query.customerVehicles.findFirst({
      where: eq(customerVehicles.customerId, customer.id),
      orderBy: [desc(customerVehicles.isPrimary)]
    });

    const recentServices = await db.query.customerServiceHistory.findMany({
      where: eq(customerServiceHistory.customerId, customer.id),
      orderBy: [desc(customerServiceHistory.serviceDate)],
      limit: 3
    });

    return {
      isReturning: customer.isReturningCustomer || false,
      name: customer.name,
      primaryVehicle: primaryVehicle ? {
        year: primaryVehicle.year || undefined,
        make: primaryVehicle.make || undefined,
        model: primaryVehicle.model || undefined,
        color: primaryVehicle.color || undefined
      } : undefined,
      recentServices: recentServices.map(s => ({
        serviceType: s.serviceType,
        serviceDate: s.serviceDate,
        amount: s.amount || undefined
      })),
      stats: {
        totalAppointments: customer.totalAppointments || 0,
        lifetimeValue: customer.lifetimeValue || '0.00'
      }
    };

  } catch (error) {
    console.error('[GPT PERSONALIZATION] Error building context:', error);
    return null;
  }
}

/**
 * Generate personalized GPT system prompt with customer context
 */
export function buildPersonalizedSystemPrompt(
  basePrompt: string,
  customerContext: CustomerContext | null
): string {
  if (!customerContext || !customerContext.isReturning) {
    return basePrompt;
  }

  let personalizedSection = '\n\n## Customer Context (Use this to personalize your responses):\n';

  if (customerContext.name) {
    personalizedSection += `- Customer Name: ${customerContext.name}\n`;
    personalizedSection += `  * Address them warmly by name in your greeting and conversation\n`;
  }

  if (customerContext.primaryVehicle) {
    const { year, make, model, color } = customerContext.primaryVehicle;
    const vehicleDesc = [year, color, make, model].filter(Boolean).join(' ');
    personalizedSection += `- Primary Vehicle: ${vehicleDesc}\n`;
    personalizedSection += `  * Reference their vehicle naturally when relevant\n`;
  }

  if (customerContext.recentServices.length > 0) {
    personalizedSection += `- Recent Services:\n`;
    customerContext.recentServices.forEach(service => {
      const daysAgo = Math.floor(
        (Date.now() - new Date(service.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      personalizedSection += `  * ${service.serviceType} (${daysAgo} days ago)\n`;
    });
    personalizedSection += `  * Acknowledge their history naturally: "It's great to have you back!" or "Thanks for trusting us again!"\n`;
    personalizedSection += `  * Suggest services that complement what they've had before\n`;
  }

  personalizedSection += `\n## Personalization Guidelines:\n`;
  personalizedSection += `- Be warm and genuine, not robotic\n`;
  personalizedSection += `- Reference their history naturally in conversation, don't just list facts\n`;
  personalizedSection += `- Show appreciation for their continued business\n`;
  personalizedSection += `- Make suggestions based on their service history\n`;
  personalizedSection += `- Keep it professional but friendly\n`;

  return basePrompt + personalizedSection;
}

/**
 * Interface for reminder message generation
 */
interface ReminderCustomer {
  id: number;
  name: string;
  phone: string;
  loyaltyTier: string;
  lifetimeValue: string;
}

interface ReminderContext {
  lastServiceDate: Date;
  lastServiceName: string;
  daysSinceService: number;
  recommendedService: string;
  recommendedServicePrice: string;
  weatherToday: string;
}

/**
 * Fallback templates for when GPT fails or is unavailable
 */
const FALLBACK_TEMPLATES: Record<string, (data: any) => string> = {
  maintenance: (data) => 
    `Hi ${data.name}, it's been ${data.days} days since your last detail. Time for a maintenance refresh! Book online: ${data.link}`,
  
  full_detail: (data) => 
    `Hi ${data.name}, your vehicle is due for its annual full detail. Ready to restore that shine? Book: ${data.link}`,
  
  ceramic_coating: (data) => 
    `Hi ${data.name}, your ceramic coating could use a check-up after ${data.months} months. Keep it protected! ${data.link}`,
  
  generic: (data) => 
    `Hi ${data.name}, we'd love to detail your vehicle again! It's been ${data.days} days since your last visit. Book: ${data.link}`,
};

/**
 * Determine appropriate fallback template based on service type
 */
function selectFallbackTemplate(serviceName: string): keyof typeof FALLBACK_TEMPLATES {
  const lowerService = serviceName.toLowerCase();
  
  if (lowerService.includes('maintenance')) {
    return 'maintenance';
  }
  if (lowerService.includes('full') || lowerService.includes('complete')) {
    return 'full_detail';
  }
  if (lowerService.includes('ceramic') || lowerService.includes('coating')) {
    return 'ceramic_coating';
  }
  
  return 'generic';
}

/**
 * Generate fallback reminder message using templates
 */
function generateFallbackMessage(
  customer: ReminderCustomer,
  context: ReminderContext
): string {
  const templateKey = selectFallbackTemplate(context.lastServiceName);
  const template = FALLBACK_TEMPLATES[templateKey];
  
  const bookingLink = 'cleanmachinedetail.com/book';
  const months = differenceInMonths(new Date(), context.lastServiceDate);
  
  const message = template({
    name: customer.name,
    days: context.daysSinceService,
    months: months,
    vehicle: 'your vehicle',
    link: bookingLink,
  });
  
  console.log(`[GPT PERSONALIZATION] Using fallback template: ${templateKey}`);
  return message;
}

/**
 * Generate personalized reminder message using GPT-4o
 * Falls back to templates if GPT fails
 */
export async function generateReminderMessage(
  customer: ReminderCustomer,
  context: ReminderContext
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[REMINDER GPT] OPENAI_API_KEY not configured, using fallback template');
    return generateFallbackMessage(customer, context);
  }

  try {
    console.log(`[GPT PERSONALIZATION] Generating reminder for customer ${customer.id} (${customer.name})`);
    
    const prompt = `You are writing a friendly SMS reminder for Clean Machine Auto Detail, a premium auto detailing business in Tulsa, Oklahoma.

Customer: ${customer.name}
Loyalty Tier: ${customer.loyaltyTier}
Lifetime Value: $${customer.lifetimeValue}
Last Service: ${context.lastServiceName} on ${format(context.lastServiceDate, 'MMM d, yyyy')} (${context.daysSinceService} days ago)
Recommended Service: ${context.recommendedService} (${context.recommendedServicePrice})
Weather Today: ${context.weatherToday}

Write a personalized 160-character SMS reminder that:
1. References their last service naturally
2. Recommends the next service appropriate for their vehicle
3. Includes loyalty tier recognition if gold/platinum (otherwise skip tier mention)
4. Has a friendly, professional tone matching Clean Machine's brand
5. Ends with a call-to-action (book online or call)
6. Keeps it under 160 characters for single SMS

DO NOT include:
- Salesy language or pressure tactics
- Multiple exclamation points
- Emojis
- Hashtags

Return ONLY the SMS text, nothing else.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional copywriter specializing in personalized customer communications for service businesses. Write concise, friendly SMS messages.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const generatedMessage = completion.choices[0]?.message?.content?.trim();
    
    if (!generatedMessage) {
      throw new Error('GPT returned empty message');
    }
    
    if (generatedMessage.length > 160) {
      console.warn(`[GPT PERSONALIZATION] Generated message too long (${generatedMessage.length} chars), truncating`);
      const truncated = generatedMessage.substring(0, 157) + '...';
      console.log(`[GPT PERSONALIZATION] Generated reminder: ${truncated}`);
      return truncated;
    }
    
    console.log(`[GPT PERSONALIZATION] ✅ Generated reminder (${generatedMessage.length} chars): ${generatedMessage}`);
    return generatedMessage;
    
  } catch (error) {
    console.error('[GPT PERSONALIZATION] Error generating reminder with GPT, falling back to template:', error);
    return generateFallbackMessage(customer, context);
  }
}
