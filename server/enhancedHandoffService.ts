import OpenAI from 'openai';
import type { TenantDb } from './tenantDb';
import { conversations, messages } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { broadcastControlModeChange, broadcastConversationUpdate } from './websocketService';

const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;
const openai = OPENAI_ENABLED ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

if (!OPENAI_ENABLED) {
  console.warn('[ENHANCED HANDOFF] OpenAI API key not configured - smart handback summaries disabled');
}

/**
 * PHASE 12: Enhanced Handoff Service
 * 
 * Intelligent human-to-AI handoff management with context preservation.
 * 
 * Features:
 * - Smart handback detection: Analyze if conversation is ready to return to AI
 * - Context summaries: Generate what-happened summaries for smooth AI transition
 * - Customer notifications: Optional professional handback messages
 * - Multi-tenant support: Respects tenant isolation and plan tiers
 */

export interface HandbackContext {
  wasIssueResolved?: boolean;
  issueDescription?: string;
  actionsTaken?: string[];
  outstandingItems?: string[];
  customerSentiment?: 'satisfied' | 'neutral' | 'frustrated';
  nextSteps?: string[];
  recommendedAIBehavior?: string; // Guidance for AI on how to continue
}

export interface SmartHandbackResult {
  shouldHandback: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  contextSummary?: HandbackContext;
  suggestedCustomerMessage?: string; // Optional message to send to customer
}

/**
 * Analyze conversation to determine if it's ready to hand back to AI
 * 
 * Uses LLM to detect:
 * - Issue resolution signals
 * - Natural conversation endings
 * - Customer satisfaction indicators
 * - Whether AI can continue from here
 */
export async function analyzeHandbackReadiness(
  tenantDb: TenantDb,
  conversationId: number,
  agentName?: string
): Promise<SmartHandbackResult> {
  try {
    if (!openai) {
      // Fallback: Always allow handback but with low confidence
      return {
        shouldHandback: true,
        reason: 'Manual handback requested (OpenAI not configured)',
        confidence: 'low',
        suggestedCustomerMessage: "Thanks for chatting! Our automated assistant is back to help with anything else you need."
      };
    }
    
    // Get conversation with recent message history (TENANT-ISOLATED)
    const [conv] = await tenantDb
      .select()
      .from(conversations)
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .limit(1);
    
    if (!conv) {
      throw new Error('Conversation not found or access denied');
    }
    
    // Get last 20 messages for context (TENANT-ISOLATED)
    const recentMessages = await tenantDb
      .select()
      .from(messages)
      .where(tenantDb.withTenantFilter(messages, eq(messages.conversationId, conversationId)))
      .orderBy(desc(messages.timestamp))
      .limit(20);
    
    // Reverse to chronological order
    const messageHistory = recentMessages.reverse();
    
    // Build transcript focusing on human agent's involvement
    const transcript = messageHistory
      .map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
    
    // Get messages from when agent took over
    const agentTakeoverTime = conv.manualModeStartedAt || conv.handoffRequestedAt;
    const agentMessages = messageHistory.filter(msg => 
      msg.sender === 'agent' && 
      (!agentTakeoverTime || msg.timestamp >= agentTakeoverTime)
    );
    
    // Call OpenAI to analyze handback readiness
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are analyzing a customer service conversation to determine if it's ready to hand back from a human agent to an AI assistant.

The conversation was in manual mode (human agent handling it). Your job is to assess:
1. Has the issue been resolved?
2. Is the customer satisfied?
3. Can the AI assistant continue from here?
4. What context does the AI need?

Respond with ONLY a JSON object:
{
  "shouldHandback": true/false,
  "reason": "brief explanation",
  "confidence": "high" | "medium" | "low",
  "contextSummary": {
    "wasIssueResolved": true/false,
    "issueDescription": "what the customer needed",
    "actionsTaken": ["action 1", "action 2"],
    "outstandingItems": ["item 1", "item 2"],
    "customerSentiment": "satisfied" | "neutral" | "frustrated",
    "nextSteps": ["step 1"],
    "recommendedAIBehavior": "guidance for AI"
  },
  "suggestedCustomerMessage": "optional professional handback message"
}

HANDBACK CRITERIA:
- ✓ Issue resolved and customer confirmed satisfaction
- ✓ Natural conversation ending (goodbyes, thanks, etc.)
- ✓ Customer has no more questions
- ✗ Customer is still frustrated or has unresolved questions
- ✗ Agent promised follow-up or further action
- ✗ Complex negotiation in progress`
        },
        {
          role: 'user',
          content: `Analyze this conversation for handback readiness:

CONVERSATION HISTORY:
${transcript}

METADATA:
- Conversation started with AI, then handed to human agent${agentName ? ` (${agentName})` : ''}
- Agent sent ${agentMessages.length} messages during manual mode
- Platform: ${conv.platform}

Should we hand this back to AI? Provide analysis in JSON format.`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });
    
    const responseText = completion.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }
    
    const analysis: SmartHandbackResult = JSON.parse(responseText);
    
    console.log(`[ENHANCED HANDOFF] Handback analysis for conversation ${conversationId}: ${analysis.shouldHandback ? 'READY' : 'NOT READY'} (${analysis.confidence} confidence)`);
    
    return analysis;
    
  } catch (error) {
    console.error('[ENHANCED HANDOFF] Error analyzing handback readiness:', error);
    
    // Fallback: Allow handback with note about analysis failure
    return {
      shouldHandback: true,
      reason: 'Manual handback requested (analysis unavailable)',
      confidence: 'low',
      suggestedCustomerMessage: "Thanks! Our automated assistant will continue helping you."
    };
  }
}

/**
 * Generate context summary for AI to understand what happened during manual mode
 * 
 * This creates a concise summary that can be prepended to AI's system prompt
 * to ensure smooth continuation of the conversation.
 */
export async function generateHandoffContextSummary(
  tenantDb: TenantDb,
  conversationId: number
): Promise<string> {
  try {
    if (!openai) {
      return "Previous conversation handled by human agent (details unavailable).";
    }
    
    const analysis = await analyzeHandbackReadiness(tenantDb, conversationId);
    
    if (!analysis.contextSummary) {
      return "Previous conversation handled by human agent.";
    }
    
    const ctx = analysis.contextSummary;
    
    let summary = "CONTEXT FROM PREVIOUS HUMAN AGENT INTERACTION:\n";
    
    if (ctx.issueDescription) {
      summary += `Issue: ${ctx.issueDescription}\n`;
    }
    
    if (ctx.actionsTaken && ctx.actionsTaken.length > 0) {
      summary += `Actions taken: ${ctx.actionsTaken.join('; ')}\n`;
    }
    
    if (ctx.wasIssueResolved !== undefined) {
      summary += `Resolution status: ${ctx.wasIssueResolved ? 'RESOLVED' : 'PARTIALLY RESOLVED'}\n`;
    }
    
    if (ctx.outstandingItems && ctx.outstandingItems.length > 0) {
      summary += `Outstanding items: ${ctx.outstandingItems.join('; ')}\n`;
    }
    
    if (ctx.nextSteps && ctx.nextSteps.length > 0) {
      summary += `Next steps: ${ctx.nextSteps.join('; ')}\n`;
    }
    
    if (ctx.recommendedAIBehavior) {
      summary += `\nRECOMMENDED APPROACH: ${ctx.recommendedAIBehavior}\n`;
    }
    
    summary += `\nContinue the conversation naturally, acknowledging the previous interaction if relevant.`;
    
    return summary;
    
  } catch (error) {
    console.error('[ENHANCED HANDOFF] Error generating context summary:', error);
    return "Previous conversation handled by human agent. Continue assisting the customer naturally.";
  }
}

/**
 * Smart handback: Return conversation to AI with context preservation
 * 
 * This is an enhanced version of the basic handoffConversation() that:
 * - Analyzes readiness before handing back
 * - Generates context summary for AI
 * - Optionally notifies customer
 * - Updates conversation metadata
 */
export async function smartHandbackToAI(
  tenantDb: TenantDb,
  conversationId: number,
  options: {
    force?: boolean; // Skip readiness check
    notifyCustomer?: boolean; // Send handback message to customer
    customMessage?: string; // Custom notification message
    agentName?: string; // Name of agent performing handback
  } = {}
): Promise<{
  success: boolean;
  message: string;
  analysis?: SmartHandbackResult;
  contextSummary?: string;
}> {
  try {
    // Analyze readiness unless forced
    let analysis: SmartHandbackResult | undefined;
    
    if (!options.force) {
      analysis = await analyzeHandbackReadiness(tenantDb, conversationId, options.agentName);
      
      if (!analysis.shouldHandback && analysis.confidence !== 'low') {
        return {
          success: false,
          message: `Handback not recommended: ${analysis.reason}`,
          analysis,
        };
      }
    }
    
    // Generate context summary for AI
    const contextSummary = await generateHandoffContextSummary(tenantDb, conversationId);
    
    // Update conversation to auto mode (TENANT-ISOLATED)
    const updated = await tenantDb
      .update(conversations)
      .set({
        controlMode: 'auto',
        assignedAgent: null,
        needsHumanAttention: false,
      })
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .returning();
    
    if (!updated || updated.length === 0) {
      throw new Error('Failed to update conversation');
    }
    
    // Broadcast control mode change
    broadcastControlModeChange(conversationId, 'auto', null);
    broadcastConversationUpdate(updated[0]);
    
    // Send customer notification if requested
    if (options.notifyCustomer) {
      const notificationMessage = options.customMessage || 
        analysis?.suggestedCustomerMessage ||
        "Thanks for chatting! Our automated assistant is ready to help with anything else you need.";
      
      const { addMessage } = await import('./conversationService');
      await addMessage(
        tenantDb,
        conversationId,
        notificationMessage,
        'agent', // Still from agent but marking the transition
        updated[0].platform as any,
        null,
        updated[0].phoneLineId || undefined
      );
    }
    
    console.log(`[ENHANCED HANDOFF] Conversation ${conversationId} handed back to AI${options.force ? ' (forced)' : ''}`);
    
    return {
      success: true,
      message: 'Conversation successfully handed back to AI',
      analysis,
      contextSummary,
    };
    
  } catch (error) {
    console.error('[ENHANCED HANDOFF] Error during smart handback:', error);
    throw error;
  }
}

/**
 * Check if conversation has been idle and may need automatic handback
 * 
 * This can be used in a cron job to auto-return conversations to AI
 * after the agent has been inactive for a certain period.
 */
export async function checkIdleHandback(
  tenantDb: TenantDb,
  conversationId: number,
  idleThresholdMinutes: number = 30
): Promise<boolean> {
  try {
    const [conv] = await tenantDb
      .select()
      .from(conversations)
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .limit(1);
    
    if (!conv || conv.controlMode !== 'manual') {
      return false;
    }
    
    const lastActivity = conv.lastAgentActivity || conv.manualModeStartedAt;
    if (!lastActivity) {
      return false;
    }
    
    const minutesIdle = (Date.now() - lastActivity.getTime()) / (1000 * 60);
    
    if (minutesIdle >= idleThresholdMinutes) {
      console.log(`[ENHANCED HANDOFF] Conversation ${conversationId} idle for ${Math.round(minutesIdle)} minutes - eligible for auto-handback`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('[ENHANCED HANDOFF] Error checking idle handback:', error);
    return false;
  }
}
