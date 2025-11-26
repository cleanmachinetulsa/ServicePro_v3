import { generateAIResponse } from './openai';
import { getOrCreateConversation, addMessage } from './conversationService';
import type { TenantDb } from './tenantDb';
import { conversations, messages as messagesTable, customers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { asc } from 'drizzle-orm';
import { getCampaignContextForCustomer, getCustomerIdFromPhone, getCustomerIdFromEmail } from './services/campaignContextService';

/**
 * SECURITY: Web chat conversation processor with privilege restrictions
 * 
 * Anonymous web chat users can:
 * - Ask questions about services
 * - Get general information
 * - Chat about detailing topics
 * 
 * Anonymous web chat users CANNOT:
 * - Book appointments (redirect to phone/booking page)
 * - Access customer database
 * - Trigger SMS/email sends
 * - Access pricing that requires customer lookup
 */

// List of privileged function names that require customer verification
const PRIVILEGED_FUNCTIONS = [
  'check_customer_database',
  'validate_address',
  'get_available_slots',
  'create_appointment',
  'build_booking_summary',
  'get_upsell_offers',
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
 * RESTRICTED: Web chat processor - information only, no privileged actions
 */
async function processWebChatConversation(
  tenantDb: TenantDb,
  identifier: string,
  message: string
): Promise<{ response: string }> {
  
  // Detect booking intent
  const bookingKeywords = [
    'book', 'schedule', 'appointment', 'available', 'calendar',
    'slot', 'time', 'date', 'when can', 'availability'
  ];
  
  const hasBookingIntent = bookingKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  );
  
  if (hasBookingIntent) {
    // Redirect to proper booking channel
    return {
      response: `I'd be happy to help you book an appointment! 

For the fastest service, you have 3 options:

📱 **Call Us:** (918) 856-5304
📅 **Online Booking:** Visit our booking page for real-time availability
💬 **Text Us:** Send us a text at (918) 856-5304 and we'll get you scheduled right away

Is there anything else I can help you with regarding our services or pricing?`
    };
  }
  
  // Get campaign context for AI awareness (if we can identify the customer)
  let customerId: number | null = null;
  let campaignContext = { hasRecentCampaign: false };
  
  try {
    // Try to identify customer from identifier (could be phone or email)
    if (identifier.includes('@')) {
      customerId = await getCustomerIdFromEmail(tenantDb, identifier);
    } else {
      customerId = await getCustomerIdFromPhone(tenantDb, identifier);
    }
    
    if (customerId) {
      const tenantId = tenantDb.tenantId;
      campaignContext = await getCampaignContextForCustomer({
        tenantDb,
        tenantId,
        customerId,
      });
    }
  } catch (error) {
    console.error('[WEB CHAT] Error loading campaign context:', error);
  }
  
  // For general questions, use AI with restricted system prompt
  try {
    let restrictedPrompt = `You are a helpful assistant for Clean Machine Auto Detail's website.
    
You can answer questions about:
- Services and pricing
- What's included in each package
- General detailing information
- Business hours and service area
- Care tips and recommendations

CRITICAL RESTRICTIONS:
- You CANNOT book appointments through this chat
- You CANNOT access customer information
- You CANNOT provide personalized quotes without photos
- If someone wants to book, direct them to call (918) 856-5304 or use the online booking system
- Keep responses concise and helpful`;

    // Inject campaign awareness if available
    if (campaignContext.hasRecentCampaign && campaignContext.campaignName) {
      restrictedPrompt += `

CAMPAIGN CONTEXT:
- This customer recently received the "${campaignContext.campaignName}" campaign.
- Bonus points from campaign: ${campaignContext.bonusPointsFromCampaign ?? 'N/A'}
- Current total points: ${campaignContext.currentPoints ?? 'unknown'}

If they mention the campaign, your message, or bonus points:
- Acknowledge the campaign offer positively
- Briefly explain how points work
- Direct them to call or text to redeem: (918) 856-5304`;
    }

    restrictedPrompt += `

Customer message: ${message}`;

    // Get conversation history (lookup by phone for web platform)
    const conv = await tenantDb.query.conversations.findFirst({
      where: tenantDb.withTenantFilter(conversations, eq(conversations.customerPhone, identifier)),
      with: {
        messages: {
          orderBy: [asc(messagesTable.timestamp)],
          limit: 10 // Last 10 messages for context
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

    // After 2-3 message exchanges, ask for contact info to enable booking
    const customerMessageCount = conversationHistory.filter((m: { sender: string }) => m.sender === 'customer').length;
    const shouldAskForContact = customerMessageCount >= 2;
    
    // Enhanced prompt with contact collection after rapport building
    const enhancedPrompt = shouldAskForContact ? 
      `${restrictedPrompt}

IMPORTANT: The customer has been chatting with you and seems interested. After answering their current question, NATURALLY ask for their phone number or email so you can help them book an appointment or follow up. Be friendly and conversational about it.

Example: "I'd love to help you get this scheduled! What's the best number to text you at? That way I can send you available times and we can get you booked."

Don't be pushy - make it feel like a natural next step to help them.` 
      : restrictedPrompt;

    // Call AI with NO function calling enabled (information only)
    const response = await generateAIResponse(
      enhancedPrompt,
      identifier,
      'web',
      undefined,
      conversationHistory
    );

    return { response: response || 'I apologize, but I had trouble processing that. Could you rephrase your question?' };
    
  } catch (error) {
    console.error('[WEB CHAT RESTRICTED] Error:', error);
    return {
      response: `I'm here to answer questions about our detailing services! 

What would you like to know about:
- Our service packages and pricing
- What's included in each detail
- Service area and availability
- Detailing tips and recommendations

Or, call us at (918) 856-5304 to book an appointment!`
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
