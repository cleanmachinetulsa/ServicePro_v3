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
export const SYSTEM_PROMPT_TEMPLATE = `You are an AI assistant for {businessName}, a {industryType} business.

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
