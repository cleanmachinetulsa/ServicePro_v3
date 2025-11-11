import { db } from './db';
import { conversations } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Standard SMS opt-out compliance keywords
const STOP_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
const START_KEYWORDS = ['START', 'UNSTOP', 'SUBSCRIBE', 'YES'];
const HELP_KEYWORDS = ['HELP', 'INFO', 'INFORMATION'];

export interface ConsentCheckResult {
  isConsentKeyword: boolean;
  keyword: 'STOP' | 'START' | 'HELP' | null;
  autoResponse: string | null;
}

/**
 * Checks if a message contains SMS consent keywords (STOP, START, HELP)
 * Returns the keyword type and appropriate auto-response
 */
export function checkConsentKeyword(messageContent: string): ConsentCheckResult {
  const normalizedMessage = messageContent.trim().toUpperCase();
  
  // Check for STOP keywords
  if (STOP_KEYWORDS.includes(normalizedMessage)) {
    return {
      isConsentKeyword: true,
      keyword: 'STOP',
      autoResponse: "You've been unsubscribed from Clean Machine Auto Detail SMS messages. Reply START to opt back in anytime. For help, reply HELP."
    };
  }
  
  // Check for START keywords
  if (START_KEYWORDS.includes(normalizedMessage)) {
    return {
      isConsentKeyword: true,
      keyword: 'START',
      autoResponse: "You're now subscribed to Clean Machine Auto Detail SMS messages! We're here to help with appointments and questions. Reply STOP to opt out, or HELP for assistance."
    };
  }
  
  // Check for HELP keywords
  if (HELP_KEYWORDS.includes(normalizedMessage)) {
    // Get business phone from environment or use default
    const businessPhone = process.env.OWNER_PHONE || process.env.TWILIO_PHONE_NUMBER || '(contact us)';
    
    return {
      isConsentKeyword: true,
      keyword: 'HELP',
      autoResponse: `Clean Machine Auto Detail - Professional auto detailing service. Text us to book appointments or ask questions. Call ${businessPhone} for immediate assistance. Reply STOP to opt out. Msg&Data rates may apply.`
    };
  }
  
  return {
    isConsentKeyword: false,
    keyword: null,
    autoResponse: null
  };
}

/**
 * Updates the SMS consent status for a conversation
 */
export async function updateConsentStatus(
  conversationId: number,
  optOut: boolean
): Promise<void> {
  await db.update(conversations)
    .set({
      smsOptOut: optOut,
      smsOptOutAt: optOut ? new Date() : null
    })
    .where(eq(conversations.id, conversationId));
}

/**
 * Checks if a conversation has opted out of SMS
 */
export async function isOptedOut(conversationId: number): Promise<boolean> {
  const [conversation] = await db
    .select({ smsOptOut: conversations.smsOptOut })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  
  return conversation?.smsOptOut || false;
}

/**
 * Processes SMS consent keywords and updates database + returns auto-response
 */
export async function processConsentKeyword(
  conversationId: number,
  messageContent: string
): Promise<ConsentCheckResult> {
  const result = checkConsentKeyword(messageContent);
  
  if (result.isConsentKeyword && result.keyword) {
    // Update database based on keyword
    if (result.keyword === 'STOP') {
      await updateConsentStatus(conversationId, true);
      console.log(`📵 Conversation ${conversationId} opted out via STOP keyword`);
    } else if (result.keyword === 'START') {
      await updateConsentStatus(conversationId, false);
      console.log(`✅ Conversation ${conversationId} opted back in via START keyword`);
    }
    // HELP doesn't change opt-out status, just sends info
  }
  
  return result;
}
