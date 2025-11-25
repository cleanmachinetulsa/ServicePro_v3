/**
 * AI Behavior v2 — Core Brain Configuration
 * 
 * Centralized configuration for SMS AI agent behavior including:
 * - System prompt template
 * - Required/soft fields for booking
 * - Escalation triggers
 * - Behavioral constants
 */

export interface RequiredBookingFields {
  customerName: string;
  vehicle: string;
  serviceType: string;
  dateTime: string;
  address: string;
}

export const REQUIRED_FIELDS = [
  'customerName',
  'vehicle',
  'serviceType',
  'dateTime',
  'address'
] as const;

export const SOFT_FIELDS = [
  'pets',
  'specialNotes',
  'email',
  'addOns'
] as const;

export const ESCALATION_TRIGGERS = [
  'angry',
  'frustrated',
  'confused',
  'complaint',
  'unsafe',
  'manager',
  'supervisor',
  'refund',
  'lawsuit',
  'sue',
  'lawyer',
  'cancel service',
  'terrible',
  'horrible',
  'worst',
  'incompetent',
  'scam',
  'fraud'
] as const;

export const BEHAVIOR_CONFIG = {
  requiredFields: REQUIRED_FIELDS,
  softFields: SOFT_FIELDS,
  escalationTriggers: ESCALATION_TRIGGERS,
  
  // Response length guidance
  smsTargetLength: 160,
  smsMaxLength: 320,
  
  // Context limits
  maxConversationHistory: 15,
  maxHandbackMessages: 3,
  
  // Escalation settings
  escalationSensitivity: 'medium' as 'low' | 'medium' | 'high',
} as const;

/**
 * Base system prompt template for SMS AI agent
 * This is the core "brain" that guides all AI behavior
 */
export const SYSTEM_PROMPT_TEMPLATE = `# === ULTRA-EFFICIENT EXECUTION MODE ===
# This block removes unnecessary tool calls, reduces latency, and ensures minimal token usage.
# It applies permanently to all future tasks.

You operate in **Direct Action Mode**:

1. **NO SELF-REVIEW**  
   - Do NOT analyze or critique your own output.  
   - Do NOT perform multi-step “evaluate → revise → finalize” cycles unless the user asks.

2. **NO REFLECTION LOOP**  
   - Disable all forms of chain-of-thought, hidden reasoning, self-correction, or second-pass refinement.
   - Produce the final answer directly.

3. **MINIMAL TOOL USE**  
   - Only call a tool **once per user request** unless it explicitly errors or the user requests another call.
   - If one tool call can accomplish multiple goals, consolidate into a single call.

4. **NO REDUNDANT CALLS**  
   - Do NOT call a tool to validate your work.  
   - Do NOT call a tool to re-check or re-confirm something you already know.  
   - Do NOT call a tool to “improve” or “refine” your own output.

5. **NO BACK-AND-FORTH**  
   - Do NOT ask the user for confirmation unless the action is destructive (delete, overwrite, irreversible).
   - Infer and proceed whenever possible.

6. **NO VERBOSE OUTPUT**  
   - Do NOT explain reasoning unless the user explicitly asks.
   - Default to concise, precise, production-ready output.

7. **NO META-COMMENTARY**  
   - Do NOT talk about what you are doing.  
   - Do NOT describe your process.  
   - Only deliver the requested result.

8. **CODE MODE = ZERO SURPLUS**  
   When generating code:
   - Output ONLY the requested files.  
   - No comments unless asked.  
   - No explanations of code unless asked.  
   - No extra scaffolding or suggestions.

9. **STATEFUL MEMORY USE**  
   - Reuse previously given information.  
   - Never ask the user to repeat details unless required.  
   - Prefer inference over clarification.

10. **INTENT PRIORITY**  
    - Detect the user’s primary intent and execute it immediately.
    - Ignore unrelated side-intents.
    - Stay on a single task flow unless the user explicitly switches topics.

# === END OF ULTRA-EFFICIENT EXECUTION PATCH ===
You are an AI assistant for {businessName}, a {industryType} business.

YOUR ROLE:
- Answer questions about services and pricing
- Help customers book appointments by collecting required information
- Provide helpful, friendly support
- Stay concise and conversational (SMS messages)

REQUIRED INFORMATION FOR BOOKING:
You MUST collect these fields before booking can be completed:
1. Customer name
2. Vehicle details (year/make/model or description)
3. Service type/package requested
4. Preferred date/time window
5. Service address/location

CRITICAL RULES:
- ALWAYS check the KNOWN_CONTEXT section below before asking questions
- NEVER ask for information that is already present in KNOWN_CONTEXT
- ONLY ask for MISSING required fields
- If a customer provides new information, acknowledge it and move to the next missing field
- Keep responses under 160 characters when possible (1 SMS message)
- If you need to provide longer info, break it into clear, logical segments

ESCALATION:
Escalate to a human immediately if the customer:
- Expresses frustration, anger, or dissatisfaction
- Asks for a manager or supervisor
- Mentions legal action or complaints
- Appears confused after multiple attempts to help
- Reports safety concerns or unsafe situations

When escalating:
- Keep your response brief and empathetic
- Assure them a human team member will follow up shortly
- Do NOT continue the automated conversation after escalation`;

/**
 * Helper to check if a message contains escalation triggers
 */
export function containsEscalationTrigger(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return ESCALATION_TRIGGERS.some(trigger => lowerMessage.includes(trigger));
}

/**
 * Helper to detect sentiment that might need escalation
 * Returns confidence level: 'high' | 'medium' | 'low' | null
 */
export function detectEscalationSentiment(
  message: string,
  conversationHistory?: Array<{ content: string; role: string }>
): { shouldEscalate: boolean; confidence: 'high' | 'medium' | 'low' | null; reason: string | null } {
  // Check for direct triggers
  if (containsEscalationTrigger(message)) {
    return {
      shouldEscalate: true,
      confidence: 'high',
      reason: 'Direct escalation trigger detected'
    };
  }
  
  // Check for repeated customer messages without resolution (indicates confusion/frustration)
  if (conversationHistory && conversationHistory.length >= 4) {
    const recentMessages = conversationHistory.slice(-4);
    const customerMessages = recentMessages.filter(m => m.role === 'user');
    
    // If customer has sent 3+ messages in a row, they might be frustrated
    if (customerMessages.length >= 3) {
      return {
        shouldEscalate: true,
        confidence: 'medium',
        reason: 'Multiple customer messages without resolution'
      };
    }
  }
  
  // Check for negative sentiment indicators
  const negativePhrases = [
    'not working',
    'doesn\'t work',
    'won\'t work',
    'not happy',
    'disappointed',
    'issue',
    'problem',
    'help me',
    'don\'t understand',
    'confused'
  ];
  
  const lowerMessage = message.toLowerCase();
  const hasNegativeSentiment = negativePhrases.some(phrase => lowerMessage.includes(phrase));
  
  if (hasNegativeSentiment) {
    return {
      shouldEscalate: false, // Don't auto-escalate, but flag for monitoring
      confidence: 'low',
      reason: 'Negative sentiment detected'
    };
  }
  
  return {
    shouldEscalate: false,
    confidence: null,
    reason: null
  };
}

/**
 * Safety fallback message when AI fails
 */
export const SAFETY_FALLBACK_MESSAGE = "Sorry, I'm having trouble right now. A human will follow up with you shortly.";

/**
 * Escalation acknowledgment message
 */
export const ESCALATION_MESSAGE = "I understand you need additional help. I'm connecting you with a team member who will assist you shortly.";

/**
 * Booking Status Types for conversation state
 */
export type BookingStatus = 
  | 'not_ready' 
  | 'missing_info' 
  | 'ready_for_draft' 
  | 'ready_for_human_review' 
  | 'ready_to_book' 
  | 'out_of_area' 
  | 'needs_approval';

/**
 * Interface for booking state used in status computation
 */
export interface BookingState {
  customerName?: string | null;
  service?: string | null;
  serviceId?: number | null;
  address?: string | null;
  selectedTimeSlot?: string | null;
  preferredDate?: string | null;
  preferredTimeWindow?: string | null;
  requiresManualApproval?: boolean;
  inServiceArea?: boolean;
}

/**
 * Compute booking status from conversation state
 */
export function getBookingStatusFromState(state: BookingState): BookingStatus {
  const hasName = !!state.customerName;
  const hasService = !!(state.service || state.serviceId);
  const hasAddress = !!state.address;
  const hasTime = !!(state.selectedTimeSlot || state.preferredDate || state.preferredTimeWindow);
  
  // Check if all required fields are present
  const hasAllRequired = hasName && hasService && hasAddress && hasTime;
  
  if (!hasAllRequired) {
    // Determine if we have any info at all
    if (!hasName && !hasService && !hasAddress && !hasTime) {
      return 'not_ready';
    }
    return 'missing_info';
  }
  
  // All required fields present - check for special cases
  if (state.inServiceArea === false) {
    return 'out_of_area';
  }
  
  if (state.requiresManualApproval) {
    return 'ready_for_human_review';
  }
  
  // Ready for booking (but still needs human approval per handshake rules)
  return 'ready_for_draft';
}
