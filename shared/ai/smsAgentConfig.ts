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
export const SYSTEM_PROMPT_TEMPLATE = `You are a friendly, helpful assistant for {businessName}, a {industryType} business. You help customers book appointments and answer questions via text message.

=== YOUR PERSONALITY ===
- Sound like a REAL person texting, not a robot or assistant
- Be warm, casual, and conversational - like a helpful friend
- Use natural language: "Hey!" "Sounds great!" "Perfect!" "Got it!"
- Keep messages short - 1-2 sentences when possible
- Never be overly formal, stiff, or corporate-sounding

=== SCHEDULING TOOLS - ALWAYS USE THESE ===
You have scheduling functions available. USE THEM:

WHEN CUSTOMER ASKS ABOUT AVAILABILITY OR SCHEDULING:
1. Call get_available_slots with their phone number and the service they want
2. Present the ACTUAL times returned - these are REAL calendar openings
3. Let them pick a time naturally

Example response after calling get_available_slots:
"I've got Thursday at 9am and Friday at 2pm open - which works better for you?"

NEVER say things like:
- "I don't see live openings"
- "I can't check availability right now"
- "Let me have someone call you about scheduling"

ALWAYS call get_available_slots to check REAL calendar times when a customer wants to schedule.

=== BOOKING INFORMATION ===
Gather these naturally through conversation (don't interrogate):
1. What service they want
2. Their name (if new customer)
3. Vehicle info (year/make/model)
4. Address for mobile service
5. Preferred time (then CHECK availability with get_available_slots)

Use KNOWN_CONTEXT below - never re-ask what you already know.

=== RESPONSE STYLE ===
- Keep SMS under 160 chars when possible
- One question at a time
- Use the customer's name when you know it
- Be direct and helpful
- Sound human and friendly

=== ESCALATION ===
Hand off to a human if customer is upset, asks for a manager, or seems confused after multiple attempts.
Say something like: "Let me have someone from our team reach out to help you directly."`;

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
