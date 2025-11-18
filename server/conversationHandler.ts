import { generateAIResponse } from './openai';
import { getOrCreateConversation, addMessage } from './conversationService';
import { db } from './db';
import { conversations } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
    const restrictedPrompt = `You are a helpful assistant for Clean Machine Auto Detail's website.
    
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

Customer message: ${message}`;

    // Get conversation history
    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.identifier, identifier),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.timestamp)],
          limit: 10 // Last 10 messages for context
        }
      }
    });

    const conversationHistory = conv?.messages?.map(msg => ({
      content: msg.message,
      role: msg.sender === 'customer' ? 'user' : 'assistant',
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

    return { response: response.text || response.content || 'I apologize, but I had trouble processing that. Could you rephrase your question?' };
    
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
    // Get conversation history
    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.identifier, identifier),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.timestamp)],
          limit: 20 // More history for authenticated users
        }
      }
    });

    const conversationHistory = conv?.messages?.map(msg => ({
      content: msg.message,
      role: msg.sender === 'customer' ? 'user' : 'assistant',
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
      response: response.text || response.content || 'I apologize, but I had trouble processing that. Could you try again?',
      functionsCalled: response.functionsCalled || []
    };
    
  } catch (error) {
    console.error('[AUTHENTICATED CHAT] Error:', error);
    throw error;
  }
}
