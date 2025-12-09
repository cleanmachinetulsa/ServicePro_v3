import { generateAIResponse } from './openai';
import { getOrCreateConversation, addMessage } from './conversationService';
import type { TenantDb } from './tenantDb';
import { conversations, messages as messagesTable, customers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { asc } from 'drizzle-orm';
import { getCampaignContextForCustomer, getCustomerIdFromPhone, getCustomerIdFromEmail } from './services/campaignContextService';

/**
 * Web chat conversation processor - NOW WITH SCHEDULING SUPPORT
 * 
 * Web chat users CAN:
 * - Ask questions about services
 * - Get general information
 * - Chat about detailing topics
 * - CHECK AVAILABILITY (uses same calendar tools as SMS)
 * - Get real time slots from Google Calendar
 * 
 * Web chat users CANNOT:
 * - Create appointments directly (need phone for confirmation)
 * - Access customer database
 * - Trigger SMS/email sends
 */

// Functions that web chat CAN use (read-only scheduling info)
const WEB_ALLOWED_FUNCTIONS = [
  'get_available_slots',  // Can check availability
  'get_upsell_offers',    // Can see upsell options
];

// Functions that REQUIRE verified identity (phone/SMS)
const PRIVILEGED_FUNCTIONS = [
  'check_customer_database',
  'validate_address',
  'create_appointment',
  'build_booking_summary',
  'request_damage_photos',
  'request_specialty_quote',
  'add_appointment_notes',
  'reschedule_appointment'
];

/**
 * Process conversation with platform-based security restrictions
 */
export async function processConversation(
  tenantDb: TenantDb,
  identifier: string,
  message: string,
  platform: 'sms' | 'web' | 'facebook' | 'instagram' | 'email'
): Promise<{ response: string; functionsCalled?: string[] }> {
  
  // For web platform, use restricted mode
  if (platform === 'web') {
    return await processWebChatConversation(tenantDb, identifier, message);
  }
  
  // For authenticated platforms (SMS, social), use full AI capabilities
  return await processAuthenticatedConversation(tenantDb, identifier, message, platform);
}

/**
 * Web chat processor - NOW WITH SCHEDULING/AVAILABILITY SUPPORT
 * Uses the same AI tools as SMS agent for checking calendar availability
 */
async function processWebChatConversation(
  tenantDb: TenantDb,
  identifier: string,
  message: string
): Promise<{ response: string }> {
  
  const tenantId = tenantDb.tenantId;
  
  // Get campaign context for AI awareness (if we can identify the customer)
  let customerId: number | null = null;
  let campaignContext: any = { hasRecentCampaign: false };
  
  try {
    // Try to identify customer from identifier (could be phone or email)
    if (identifier.includes('@')) {
      customerId = await getCustomerIdFromEmail(tenantDb, identifier);
    } else {
      customerId = await getCustomerIdFromPhone(tenantDb, identifier);
    }
    
    if (customerId) {
      campaignContext = await getCampaignContextForCustomer({
        tenantDb,
        tenantId,
        customerId,
      });
    }
  } catch (error) {
    console.error('[WEB CHAT] Error loading campaign context:', error);
  }
  
  // Get conversation history - simplified query without relations to avoid Drizzle issues
  let conversationHistory: Array<{ content: string; role: 'user' | 'assistant'; sender: string; metadata: Record<string, any> | null }> = [];
  
  try {
    // Try to find existing conversation and get messages
    const conv = await tenantDb
      .select()
      .from(conversations)
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.customerPhone, identifier)))
      .limit(1);
    
    if (conv.length > 0) {
      const msgs = await tenantDb
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conv[0].id))
        .orderBy(asc(messagesTable.timestamp))
        .limit(15);
      
      conversationHistory = msgs.map((msg) => ({
        content: msg.content,
        role: msg.sender === 'customer' ? 'user' as const : 'assistant' as const,
        sender: msg.sender,
        metadata: msg.metadata as Record<string, any> | null
      }));
    }
  } catch (historyError) {
    console.error('[WEB CHAT] Error loading conversation history:', historyError);
    // Continue without history - AI will still work
  }

  try {
    // Use web-enabled AI with READ-ONLY scheduling tools (get_available_slots only)
    // Web chat can check availability but CANNOT create appointments
    console.log('[WEB CHAT] Processing with web-safe scheduling AI for tenant:', tenantId);
    
    const response = await generateAIResponse(
      message,
      identifier,
      'web',  // Use 'web' platform for read-only scheduling tools
      undefined,
      conversationHistory,
      false, // not demo mode
      tenantId, // Pass tenant ID for proper prompt building
      'auto' // control mode
    );

    return { response: response || 'I apologize, but I had trouble processing that. Could you rephrase your question?' };
    
  } catch (error) {
    console.error('[WEB CHAT] Error:', error);
    return {
      response: `I'm here to help with scheduling and questions about our services! What can I help you with today?`
    };
  }
}

/**
 * FULL ACCESS: Authenticated conversation processor with all AI capabilities
 */
async function processAuthenticatedConversation(
  tenantDb: TenantDb,
  identifier: string,
  message: string,
  platform: 'sms' | 'facebook' | 'instagram' | 'email'
): Promise<{ response: string; functionsCalled?: string[] }> {
  
  try {
    // Get campaign context for AI awareness
    let campaignContext = { hasRecentCampaign: false };
    
    try {
      // Get customer ID for campaign lookup
      const customerId = await getCustomerIdFromPhone(tenantDb, identifier);
      
      if (customerId) {
        const tenantId = tenantDb.tenantId;
        campaignContext = await getCampaignContextForCustomer({
          tenantDb,
          tenantId,
          customerId,
        });
      }
    } catch (error) {
      console.error('[AUTHENTICATED CHAT] Error loading campaign context:', error);
    }
    
    // Get conversation history (lookup by phone for authenticated platforms)
    const conv = await tenantDb.query.conversations.findFirst({
      where: tenantDb.withTenantFilter(conversations, eq(conversations.customerPhone, identifier)),
      with: {
        messages: {
          orderBy: [asc(messagesTable.timestamp)],
          limit: 20 // More history for authenticated users
        }
      }
    });

    // Type the messages array explicitly to avoid 'never' inference issue
    const messages = (conv?.messages ?? []) as (typeof messagesTable.$inferSelect)[];
    const conversationHistory = messages.map((msg: typeof messagesTable.$inferSelect) => ({
      content: msg.content,
      role: msg.sender === 'customer' ? 'user' as const : 'assistant' as const,
      sender: msg.sender,
      metadata: msg.metadata as Record<string, any> | null
    }));

    // Build enhanced message with campaign context if available
    let enhancedMessage = message;
    
    if (campaignContext.hasRecentCampaign && campaignContext.campaignName) {
      // Prepend campaign context to the message for AI awareness
      enhancedMessage = `[SYSTEM NOTE: This customer recently received the "${campaignContext.campaignName}" campaign with ${campaignContext.bonusPointsFromCampaign} bonus points. They currently have ${campaignContext.currentPoints ?? 'unknown'} points total. If they mention the campaign, your message, or bonus points, acknowledge it and help them use their rewards.]

Customer message: ${message}`;
    }

    // Full AI capabilities with function calling
    const response = await generateAIResponse(
      enhancedMessage,
      identifier,
      platform === 'sms' ? 'sms' : 'web',
      undefined,
      conversationHistory
    );

    return {
      response: response || 'I apologize, but I had trouble processing that. Could you try again?',
      functionsCalled: []
    };
    
  } catch (error) {
    console.error('[AUTHENTICATED CHAT] Error:', error);
    throw error;
  }
}
