import { generateAIResponse } from './openai';
import { getOrCreateConversation, addMessage } from './conversationService';
import { db } from './db';
import { conversations, messages as messagesTable } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { asc } from 'drizzle-orm';
import { getCampaignContextByPhone } from './campaignContextService';

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
  identifier: string,
  message: string,
  platform: 'sms' | 'web' | 'facebook' | 'instagram' | 'email'
): Promise<{ response: string; functionsCalled?: string[] }> {
  
  // For web platform, use restricted mode
  if (platform === 'web') {
    return await processWebChatConversation(identifier, message);
  }
  
  // For authenticated platforms (SMS, social), use full AI capabilities
  return await processAuthenticatedConversation(identifier, message, platform);
}

/**
 * RESTRICTED: Web chat processor - information only, no privileged actions
 */
async function processWebChatConversation(
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

📱 **Call Us:** (918) 856-5711
📅 **Online Booking:** Visit our booking page for real-time availability
💬 **Text Us:** Send us a text at (918) 856-5711 and we'll get you scheduled right away

Is there anything else I can help you with regarding our services or pricing?`
    };
  }
  
  // For general questions, use AI with restricted system prompt
  try {
    // Get campaign context if we have a phone number (identifier might be phone)
    const campaignContext = identifier ? await getCampaignContextByPhone(identifier) : { hasRecentCampaign: false };
    
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
- If someone wants to book, direct them to call (918) 856-5711 or use the online booking system
- Keep responses concise and helpful

GENERAL CAMPAIGN & PROMO HANDLING RULES:
- If the customer references:
  - a recent text, message, or email from us,
  - or uses language like "points", "bonus", "welcome back", "new system",
  you should:
  1) Assume they may be referring to a recent promotion (such as the Welcome Back campaign).
  2) If specific campaign context is provided above, use that information explicitly.
  3) Briefly restate the offer in plain language and explain how it works.
  4) Offer a concrete next step: direct them to call/text (918) 856-5711 to use their points.
- Do NOT respond with "I have no record of that" as your first answer.
- If needed, ask one simple clarifying question instead of expressing confusion.`;

    // Inject campaign context if customer has recent campaigns
    if (campaignContext.hasRecentCampaign && campaignContext.campaignName) {
      restrictedPrompt += `

CAMPAIGN CONTEXT:
- This customer recently received the "${campaignContext.campaignName}" campaign.
- Campaign key: ${campaignContext.campaignKey}
- Date sent: ${campaignContext.lastSentAt?.toISOString().split('T')[0] || 'recently'}
- Bonus points from this campaign: ${campaignContext.bonusPointsFromCampaign ?? 'N/A'}
- Current total points: ${campaignContext.currentPoints ?? 'unknown'}

BEHAVIOR RULES FOR CAMPAIGN-RELATED MESSAGES:
- If the customer mentions:
  - "your text", "your message", "your email",
  - "500 points", "100 points", "bonus points",
  - "new system", "welcome back",
  assume they are referring to this Welcome Back campaign.
- Do NOT say "I don't know what you're talking about".
- Instead:
  1) Confirm they received the offer in simple language.
  2) Briefly explain how their points work and how many they have (if known).
  3) Offer a clear next step:
     - help them understand the points, or
     - direct them to call/text (918) 856-5711 to book using their points.
- If there's any ambiguity, calmly restate the offer and ask one simple clarifying question instead of acting confused.`;
    }
    
    restrictedPrompt += `

Customer message: ${message}`;

    // Get conversation history (lookup by phone for web platform)
    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.customerPhone, identifier),
      with: {
        messages: {
          orderBy: [asc(messagesTable.timestamp)],
          limit: 10 // Last 10 messages for context
        }
      }
    });

    const conversationHistory = conv?.messages?.map((msg) => ({
      content: msg.content,
      role: msg.sender === 'customer' ? 'user' as const : 'assistant' as const,
      sender: msg.sender
    })) || [];

    // Call AI with NO function calling enabled (information only)
    const response = await generateAIResponse(
      restrictedPrompt,
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

Or, call us at (918) 856-5711 to book an appointment!`
    };
  }
}

/**
 * FULL ACCESS: Authenticated conversation processor with all AI capabilities
 */
async function processAuthenticatedConversation(
  identifier: string,
  message: string,
  platform: 'sms' | 'facebook' | 'instagram' | 'email'
): Promise<{ response: string; functionsCalled?: string[] }> {
  
  try {
    // Get conversation history (lookup by phone for authenticated platforms)
    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.customerPhone, identifier),
      with: {
        messages: {
          orderBy: [asc(messagesTable.timestamp)],
          limit: 20 // More history for authenticated users
        }
      }
    });

    const conversationHistory = conv?.messages?.map((msg) => ({
      content: msg.content,
      role: msg.sender === 'customer' ? 'user' as const : 'assistant' as const,
      sender: msg.sender
    })) || [];

    // Full AI capabilities with function calling
    const response = await generateAIResponse(
      message,
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
