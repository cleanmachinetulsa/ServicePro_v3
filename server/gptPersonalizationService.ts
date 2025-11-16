import { db } from './db';
import { customers, customerVehicles, customerServiceHistory } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

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
