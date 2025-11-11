import { OpenAI } from 'openai';
import { extractKnowledgeBase } from './knowledge';
import { customerMemory } from './customerMemory';
import { conversationState } from './conversationState';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ReplySuggestion {
  id: string;
  content: string;
  type: 'informational' | 'scheduling' | 'service_related' | 'closing' | 'general';
  confidence: number;
}

export async function generateReplySuggestions(
  conversationId: number,
  customerPhone: string,
  messageHistory: any[],
  platform: 'sms' | 'web' = 'web'
): Promise<ReplySuggestion[]> {
  try {
    // Get knowledge base
    const knowledgeBase = extractKnowledgeBase();
    
    // Get customer context
    const customer = customerMemory.getCustomer(customerPhone);
    const bookingState = conversationState.getState(customerPhone);
    
    // Prepare context for AI
    const recentMessages = messageHistory
      .slice(-6)
      .map(msg => `${msg.sender}: ${msg.content}`)
      .join('\n');

    const contextPrompt = `
You are helping generate quick reply suggestions for a business owner responding to a customer via ${platform === 'sms' ? 'SMS' : 'web chat'}.

Business Knowledge:
${knowledgeBase}

Customer Context:
${customer ? `Name: ${customer.name || 'Unknown'}
Previous visits: ${customer.serviceHistory?.length || 0}
${customer.address ? `Address: ${customer.address}` : ''}
${customer.vehicleInfo ? `Vehicle: ${customer.vehicleInfo}` : ''}` : 'New customer'}

Current Booking State:
${bookingState.stepsCompleted.customerIdentified ? '✓ Customer identified' : ''}
${bookingState.service ? `✓ Service: ${bookingState.service}` : ''}
${bookingState.selectedTimeSlot ? `✓ Time Slot: ${bookingState.selectedTimeSlot}` : ''}

Recent Conversation:
${recentMessages}

Generate 4-5 contextually relevant reply suggestions that the business owner can use to quickly respond.
Suggestions should be:
1. Professional but friendly
2. ${platform === 'sms' ? 'Concise (SMS-friendly)' : 'Can be more detailed'}
3. Actionable (move the conversation forward)
4. Varied in purpose (informational, scheduling, service-related, etc.)

Return ONLY a JSON array of suggestions with this format:
[
  {
    "content": "The reply text",
    "type": "informational|scheduling|service_related|closing|general",
    "confidence": 0.0-1.0
  }
]
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a virtual assistant helping generate quick reply suggestions for customer service. Return only valid JSON.'
        },
        {
          role: 'user',
          content: contextPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const content = response.choices[0].message.content || '[]';
    
    // Parse JSON response
    let suggestions: any[] = [];
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      suggestions = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('[AI SUGGESTIONS] Failed to parse JSON:', parseError);
      console.error('[AI SUGGESTIONS] Raw content:', content);
      
      // Fallback to default suggestions
      suggestions = getDefaultSuggestions(platform);
    }

    // Add IDs and ensure proper structure
    return suggestions.map((suggestion, index) => ({
      id: `suggestion-${Date.now()}-${index}`,
      content: suggestion.content,
      type: suggestion.type || 'general',
      confidence: suggestion.confidence || 0.8,
    }));

  } catch (error) {
    console.error('[AI SUGGESTIONS] Error generating suggestions:', error);
    // Return default suggestions on error
    return getDefaultSuggestions(platform);
  }
}

function getDefaultSuggestions(platform: 'sms' | 'web'): ReplySuggestion[] {
  const suggestions = platform === 'sms' ? [
    {
      id: 'default-1',
      content: "I can help with that! What works best for you?",
      type: 'general' as const,
      confidence: 0.7
    },
    {
      id: 'default-2',
      content: "Let me check our availability. When were you thinking?",
      type: 'scheduling' as const,
      confidence: 0.7
    },
    {
      id: 'default-3',
      content: "Great question! Our Full Detail runs $225-300. Can I book you in?",
      type: 'service_related' as const,
      confidence: 0.7
    },
    {
      id: 'default-4',
      content: "Thanks for reaching out! I'll get back to you ASAP.",
      type: 'general' as const,
      confidence: 0.7
    }
  ] : [
    {
      id: 'default-1',
      content: "I can help you with that! Let me know what you need and I'll get you taken care of.",
      type: 'general' as const,
      confidence: 0.7
    },
    {
      id: 'default-2',
      content: "Let me check our schedule for you. What day were you thinking?",
      type: 'scheduling' as const,
      confidence: 0.7
    },
    {
      id: 'default-3',
      content: "Great question! Our Full Detail typically runs $225-300 depending on vehicle size. Would you like me to check availability?",
      type: 'service_related' as const,
      confidence: 0.7
    },
    {
      id: 'default-4',
      content: "Thanks for your message! I'm here to help with whatever you need.",
      type: 'closing' as const,
      confidence: 0.7
    }
  ];

  return suggestions;
}
