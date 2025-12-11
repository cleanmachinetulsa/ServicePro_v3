import type { TenantDb } from './db';
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
      autoResponse: "You're unsubscribed from Clean Machine Auto Detail texts. You won't receive more messages. Reply START to rejoin."
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
    const businessPhone = process.env.OWNER_PHONE || process.env.MAIN_PHONE_NUMBER || '(contact us)';
    
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
  tenantDb: TenantDb,
  conversationId: number,
  optOut: boolean
): Promise<void> {
  await tenantDb.update(conversations)
    .set({
      smsOptOut: optOut,
      smsOptOutAt: optOut ? new Date() : null
    })
    .where(eq(conversations.id, conversationId));
}

/**
 * Checks if a conversation has opted out of SMS
 */
export async function isOptedOut(tenantDb: TenantDb, conversationId: number): Promise<boolean> {
  const [conversation] = await tenantDb
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
  tenantDb: TenantDb,
  conversationId: number,
  messageContent: string
): Promise<ConsentCheckResult> {
  const result = checkConsentKeyword(messageContent);
  
  if (result.isConsentKeyword && result.keyword) {
    // Update database based on keyword
    if (result.keyword === 'STOP') {
      await updateConsentStatus(tenantDb, conversationId, true);
      console.log(`📵 Conversation ${conversationId} opted out via STOP keyword`);
      
      // PHASE 4D: Also handle reminder opt-outs
      await handleReminderOptOut(tenantDb, conversationId);
    } else if (result.keyword === 'START') {
      await updateConsentStatus(tenantDb, conversationId, false);
      console.log(`✅ Conversation ${conversationId} opted back in via START keyword`);
      
      // PHASE 4D: Remove reminder opt-out if exists
      await handleReminderOptIn(tenantDb, conversationId);
    }
    // HELP doesn't change opt-out status, just sends info
  }
  
  return result;
}

/**
 * PHASE 4D: Handle reminder-specific opt-out when STOP keyword is detected
 * Creates reminder_opt_outs record and cancels pending reminder jobs
 */
async function handleReminderOptOut(tenantDb: TenantDb, conversationId: number): Promise<void> {
  try {
    // Get customer associated with this conversation
    const [conversation] = await tenantDb
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    if (!conversation || !conversation.phoneNumber) {
      console.log(`[REMINDER OPT-OUT] No phone number found for conversation ${conversationId}`);
      return;
    }
    
    // Find customer by phone number
    const { customers, reminderOptOuts, reminderJobs, reminderConsent, reminderEvents } = await import('@shared/schema');
    const { and } = await import('drizzle-orm');
    
    const customer = await tenantDb.query.customers.findFirst({
      where: eq(customers.phone, conversation.phoneNumber),
    });
    
    if (!customer) {
      console.log(`[REMINDER OPT-OUT] No customer found for phone ${conversation.phoneNumber}`);
      return;
    }
    
    // Insert into reminder_opt_outs (idempotent - ignore if exists)
    await tenantDb.insert(reminderOptOuts).values({
      customerId: customer.id,
      optOutMethod: 'sms_stop_keyword',
      reason: 'Customer replied STOP to SMS reminder',
    }).onConflictDoNothing();
    
    // Update reminder_consent to revoke consent
    await tenantDb.update(reminderConsent)
      .set({ consentGiven: false })
      .where(eq(reminderConsent.customerId, customer.id));
    
    // Cancel all pending reminder jobs for this customer
    const cancelledJobs = await tenantDb.update(reminderJobs)
      .set({ 
        status: 'cancelled',
        sentAt: new Date() // Mark as processed
      })
      .where(and(
        eq(reminderJobs.customerId, customer.id),
        eq(reminderJobs.status, 'pending')
      ))
      .returning({ id: reminderJobs.id });
    
    // Log opt-out events for each cancelled job
    if (cancelledJobs.length > 0) {
      for (const job of cancelledJobs) {
        await tenantDb.insert(reminderEvents).values({
          jobId: job.id,
          eventType: 'opted_out',
          eventData: { 
            action: 'sms_stop_keyword',
            conversationId,
            timestamp: new Date().toISOString() 
          },
        });
      }
      
      console.log(`[REMINDER OPT-OUT] ✅ Cancelled ${cancelledJobs.length} pending reminder jobs for customer ${customer.id}`);
    }
    
    console.log(`[REMINDER OPT-OUT] ✅ Customer ${customer.id} opted out of reminders via STOP keyword`);
    
  } catch (error) {
    console.error('[REMINDER OPT-OUT] Error handling reminder opt-out:', error);
  }
}

/**
 * PHASE 4D: Handle reminder opt-in when START keyword is detected
 * Removes reminder_opt_outs record if exists
 */
async function handleReminderOptIn(tenantDb: TenantDb, conversationId: number): Promise<void> {
  try {
    // Get customer associated with this conversation
    const [conversation] = await tenantDb
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    if (!conversation || !conversation.phoneNumber) {
      return;
    }
    
    // Find customer by phone number
    const { customers, reminderOptOuts, reminderConsent } = await import('@shared/schema');
    
    const customer = await tenantDb.query.customers.findFirst({
      where: eq(customers.phone, conversation.phoneNumber),
    });
    
    if (!customer) {
      return;
    }
    
    // Remove from reminder_opt_outs
    await tenantDb.delete(reminderOptOuts)
      .where(eq(reminderOptOuts.customerId, customer.id));
    
    // Update reminder_consent to grant consent
    await tenantDb.update(reminderConsent)
      .set({ consentGiven: true })
      .where(eq(reminderConsent.customerId, customer.id));
    
    console.log(`[REMINDER OPT-IN] ✅ Customer ${customer.id} opted back into reminders via START keyword`);
    
  } catch (error) {
    console.error('[REMINDER OPT-IN] Error handling reminder opt-in:', error);
  }
}
