import { getConversationById } from './conversationService';
import { db } from './db';
import { appointments, customers } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Available template variables:
 * {{customer_name}} - Customer's name
 * {{phone}} - Customer's phone number
 * {{vehicle}} - Customer's vehicle info
 * {{next_available_slot}} - Next available appointment slot
 * {{business_name}} - Business name
 * {{operator_name}} - Name of the person sending the message
 */

interface TemplateContext {
  conversationId: number;
  operatorName?: string;
  userId?: number; // User ID to fetch operator name from database
}

export async function replaceTemplateVariables(
  message: string,
  context: TemplateContext
): Promise<string> {
  if (!message.includes('{{')) {
    return message; // No template variables to replace
  }

  // Get conversation data
  const conversation = await getConversationById(context.conversationId);
  if (!conversation) {
    return message;
  }

  // Get customer data for vehicle info
  let vehicleInfo = 'your vehicle';
  if (conversation.customerPhone) {
    const customerData = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, conversation.customerPhone))
      .limit(1);

    if (customerData.length > 0 && customerData[0].vehicleInfo) {
      vehicleInfo = customerData[0].vehicleInfo;
    }
  }

  // Get next appointment for this customer
  let nextSlot = 'Contact us to schedule';
  if (conversation.customerPhone) {
    const customerData = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, conversation.customerPhone))
      .limit(1);

    if (customerData.length > 0) {
      const upcomingAppointment = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.customerId, customerData[0].id),
            gte(appointments.scheduledTime, new Date())
          )
        )
        .orderBy(appointments.scheduledTime)
        .limit(1);

      if (upcomingAppointment.length > 0) {
        nextSlot = new Date(upcomingAppointment[0].scheduledTime).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      }
    }
  }

  // Get operator name from user profile if userId provided
  let operatorName = context.operatorName || 'our team';
  if (context.userId) {
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    const userData = await db
      .select()
      .from(users)
      .where(eq(users.id, context.userId))
      .limit(1);
    
    if (userData.length > 0 && userData[0].operatorName) {
      operatorName = userData[0].operatorName;
    }
  }

  // Build replacement map
  const replacements: Record<string, string> = {
    '{{customer_name}}': conversation.customerName || 'there',
    '{{phone}}': conversation.customerPhone || '',
    '{{vehicle}}': vehicleInfo,
    '{{next_available_slot}}': nextSlot,
    '{{business_name}}': 'Clean Machine Auto Detail',
    '{{operator_name}}': operatorName,
  };

  // Replace all variables
  let result = message;
  for (const [variable, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
}

export const AVAILABLE_VARIABLES = [
  {
    variable: '{{customer_name}}',
    description: "Customer's name",
    example: 'John',
  },
  {
    variable: '{{phone}}',
    description: "Customer's phone number",
    example: '+1234567890',
  },
  {
    variable: '{{vehicle}}',
    description: "Customer's vehicle",
    example: '2020 Toyota Camry',
  },
  {
    variable: '{{next_available_slot}}',
    description: 'Next available appointment',
    example: 'Mon, Dec 15 at 2:00 PM',
  },
  {
    variable: '{{business_name}}',
    description: 'Your business name',
    example: 'Clean Machine Auto Detail',
  },
  {
    variable: '{{operator_name}}',
    description: 'Name of person sending message',
    example: 'Sarah',
  },
];
