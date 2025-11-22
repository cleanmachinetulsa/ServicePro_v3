import { db } from './db';
import { conversations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { broadcastControlModeChange } from './websocketService';
import OpenAI from 'openai';

const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;
const openai = OPENAI_ENABLED ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

if (!OPENAI_ENABLED) {
  console.warn('[HANDOFF DETECTION] OpenAI API key not configured - will use fallback keyword detection');
}

interface HandoffDetectionResult {
  shouldHandoff: boolean;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * LLM-BASED INTENT CLASSIFICATION
 * 
 * Uses OpenAI GPT-4o-mini to accurately classify customer intent.
 * This replaces keyword-based detection which had false positive issues.
 * 
 * Handles:
 * - Negations ("I don't need to talk to anyone")
 * - Complex phrasings
 * - Contextual understanding
 * - Frustration patterns
 */

export async function detectHandoffNeed(
  message: string,
  conversationId: number,
  messageHistory?: any[]
): Promise<HandoffDetectionResult> {
  try {
    // If OpenAI is not available, use fallback keyword detection
    if (!openai) {
      console.log('[HANDOFF DETECTION] OpenAI not available, using keyword-based detection');
      const lowerMessage = message.toLowerCase();
      const hasExplicitRequest = 
        lowerMessage.includes('talk to owner') ||
        lowerMessage.includes('speak to owner') ||
        lowerMessage.includes('talk to a person') ||
        lowerMessage.includes('speak to a person') ||
        lowerMessage.includes('get me the owner') ||
        lowerMessage.includes('speak to manager') ||
        lowerMessage.includes('talk to manager');
      
      if (hasExplicitRequest) {
        return {
          shouldHandoff: true,
          reason: 'Explicit escalation request detected via keyword matching',
          confidence: 'medium'
        };
      }
      
      return {
        shouldHandoff: false,
        reason: 'No escalation keywords detected',
        confidence: 'low'
      };
    }

    // Build conversation context for better classification
    let conversationContext = '';
    if (messageHistory && messageHistory.length > 0) {
      const recentMessages = messageHistory.slice(-5); // Last 5 messages
      conversationContext = recentMessages
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');
    }

    // Call OpenAI to classify intent
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier for a customer service chatbot at an auto detailing business.

Your job is to determine if the customer wants to speak with a human/owner, or if the virtual assistant should continue helping them.

Classify as HANDOFF_NEEDED if:
- Customer explicitly asks to speak with a human, person, owner, or manager
- Customer is extremely frustrated (multiple strong negative words)
- Customer has been going in circles for many messages without resolution

Classify as NO_HANDOFF if:
- Customer is asking normal questions about services, pricing, booking
- Customer uses phrases like "Can you help me" or "I need help" (these are normal requests, not escalations)
- Customer mentions the bot/AI in a positive or neutral way
- Customer says they DON'T want to talk to anyone

Respond with ONLY a JSON object:
{
  "handoff_needed": true/false,
  "reason": "brief explanation",
  "confidence": "low"/"medium"/"high"
}`
        },
        {
          role: 'user',
          content: `Recent conversation:
${conversationContext || 'No previous messages'}

Latest customer message: "${message}"

Does this customer need to be handed off to a human?`
        }
      ],
      temperature: 0.3,
      max_tokens: 150
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      // Fallback to no handoff if API fails
      console.error('[HANDOFF DETECTION] Empty response from OpenAI');
      return {
        shouldHandoff: false,
        reason: 'Unable to classify intent',
        confidence: 'low'
      };
    }

    // Parse JSON response
    const classification = JSON.parse(responseText);
    
    return {
      shouldHandoff: classification.handoff_needed,
      reason: classification.reason || 'LLM-based intent classification',
      confidence: classification.confidence || 'medium'
    };

  } catch (error) {
    console.error('[HANDOFF DETECTION] Error calling OpenAI:', error);
    
    // Fallback: Use simple keyword check as backup
    const lowerMessage = message.toLowerCase();
    const hasExplicitRequest = 
      lowerMessage.includes('talk to owner') ||
      lowerMessage.includes('speak to owner') ||
      lowerMessage.includes('talk to a person') ||
      lowerMessage.includes('speak to a person') ||
      lowerMessage.includes('get me the owner');
    
    if (hasExplicitRequest) {
      return {
        shouldHandoff: true,
        reason: 'Explicit escalation request (fallback detection)',
        confidence: 'medium'
      };
    }
    
    return {
      shouldHandoff: false,
      reason: 'Error in classification, defaulting to no handoff',
      confidence: 'low'
    };
  }
}

export async function triggerHandoff(
  conversationId: number,
  reason: string,
  agentName?: string
): Promise<void> {
  try {
    const now = new Date();
    
    await db
      .update(conversations)
      .set({
        controlMode: 'manual',
        needsHumanAttention: true,
        handoffRequestedAt: now,
        manualModeStartedAt: now,
        handoffReason: reason,
        assignedAgent: agentName || null,
        lastAgentActivity: now,
      })
      .where(eq(conversations.id, conversationId));

    // Broadcast the control mode change
    const updatedConversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (updatedConversation.length > 0) {
      broadcastControlModeChange(conversationId, 'manual', agentName || 'system');
    }

    console.log(`[HANDOFF] Conversation ${conversationId} switched to manual mode. Reason: ${reason}`);
  } catch (error) {
    console.error('[HANDOFF ERROR] Failed to trigger handoff:', error);
    throw error;
  }
}

export async function returnToAI(
  conversationId: number,
  agentName?: string,
  notifyCustomer: boolean = true
): Promise<string | null> {
  try {
    await db
      .update(conversations)
      .set({
        controlMode: 'auto',
        needsHumanAttention: false,
        assignedAgent: null,
      })
      .where(eq(conversations.id, conversationId));

    // Broadcast the control mode change
    broadcastControlModeChange(conversationId, 'auto', null);

    console.log(`[HANDOFF] Conversation ${conversationId} returned to AI mode`);

    // Return notification message for customer if needed
    if (notifyCustomer) {
      return "Thanks for chatting! I'm back to help you with anything else you need. Just text anytime!";
    }

    return null;
  } catch (error) {
    console.error('[HANDOFF ERROR] Failed to return to AI:', error);
    throw error;
  }
}
