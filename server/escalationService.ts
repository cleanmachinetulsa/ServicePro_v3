import { db } from './db';
import { 
  conversations, 
  humanEscalationRequests,
  users,
  type HumanEscalationRequest,
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { sendSMS } from './notifications';
import { sendPushNotification } from './pushNotificationService';
import { buildCustomerContext } from './gptPersonalizationService';

/**
 * COMPREHENSIVE TEST COVERAGE
 * 
 * TIER A - OWNER/JODY ESCALATIONS (should trigger):
 * ✅ "I want to talk to Jody"
 * ✅ "Can I speak with the owner?"
 * ✅ "Talk to a manager"
 * ✅ "Talk to the business owner" ← NEW
 * ✅ "Speak with the general manager" ← NEW
 * ✅ "Get the owner"
 * ✅ "Reach Jody"
 * ✅ "Have the owner call me"
 * ✅ "Let Jody know"
 * ✅ "Jody can call me back"
 * ✅ "I'd like Jody to call me" ← NEW
 * ✅ "Have the business owner call" ← NEW
 * 
 * TIER B - HUMAN ESCALATIONS (should trigger):
 * ✅ "I need to talk to a human"
 * ✅ "Can I speak with someone there?"
 * ✅ "I want to talk to a real person"
 * ✅ "Transfer me to a live agent"
 * ✅ "Speak with someone on your team"
 * ✅ "Talk to a live representative" ← NEW
 * ✅ "not a bot please"
 * ✅ "human please"
 * 
 * FALSE POSITIVES - SHOULD NOT TRIGGER:
 * ❌ "I want to talk about pricing"
 * ❌ "I need to speak to my wife first"
 * ❌ "I'll talk to you later"
 * ❌ "Can we discuss the ceramic coating"
 * ❌ "I want to talk to someone at Honda"
 * ❌ "Let me talk to my manager" (blocked by "my manager" exclusion)
 */

// ========== ESCALATION DETECTION KEYWORD SETS ==========

// Action verbs indicating request for contact
const ACTION_VERBS = [
  'talk',
  'speak',
  'call',
  'connect',
  'transfer',
  'get',
  'reach',
  'contact',
];

// Direct owner/name references
const OWNER_TARGETS = [
  'jody',
  'jodie',
  'owner',
  'boss',
  'manager',
  'supervisor',
];

// Human/agent references
const HUMAN_TARGETS = [
  'real person',
  'live agent',
  'representative',
  'human',
  'actual person',
  'someone there',
  'someone on your team',
  'someone from your team',
  'person there',
  'person on your end',
];

// Soft targets that need qualifiers
const SOFT_TARGETS = ['someone', 'person'];

// Qualifiers that make soft targets valid
const SOFT_TARGET_QUALIFIERS = [
  'there',
  'on your team',
  'from your team',
  'on your end',
  'at your company',
];

// Phrases to exclude (family, pricing, etc.)
const EXCLUDE_PHRASES = [
  'my wife',
  'my husband',
  'my friend',
  'my family',
  'my boss',
  'my manager',
  'talk about',
  'speak about',
  'discuss pricing',
  'talk pricing',
  'chat later',
  'speak later',
  'call you later',
  'call back later',
  'call me later',
  'text later',
  'talk soon',
  'speak soon',
];

// Explicit bot complaints (always trigger)
const BOT_COMPLAINTS = [
  'not a bot',
  'not bot',
  'stop auto',
  'stop automated',
  'human please',
  'real person please',
  'actual person please',
];

/**
 * Preprocess message for detection
 */
function preprocessMessage(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[?!]/g, '.')
    .replace(/[^\w\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized
    .split('.')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Check if sentence matches negative exclusion patterns
 */
function isExcludedPhrase(sentence: string): boolean {
  return EXCLUDE_PHRASES.some(phrase => sentence.includes(phrase));
}

/**
 * Check if sentence contains a soft target with proper qualifier
 */
function hasSoftTargetWithQualifier(sentence: string): boolean {
  const hasSoftTarget = SOFT_TARGETS.some(target => sentence.includes(target));
  if (!hasSoftTarget) return false;

  return SOFT_TARGET_QUALIFIERS.some(qualifier => sentence.includes(qualifier));
}

/**
 * Check for owner/Jody reference with action verb (Tier A)
 * Uses flexible regex allowing optional adjectives/modifiers
 */
function detectTierA(sentence: string): boolean {
  // Build regex patterns for each owner target
  for (const owner of OWNER_TARGETS) {
    // Pattern 1: (action verb) + optional "to/with/for" + optional modifiers + (owner)
    // Allows 0-2 words between preposition and owner target
    // Matches: "talk to owner", "talk to the owner", "talk to the business owner"
    const actionToOwner = new RegExp(
      `\\b(${ACTION_VERBS.join('|')})\\s+(to|with|for)?\\s+([\\w]+\\s+){0,2}${owner}\\b`,
      'i'
    );
    
    // Pattern 2: "get/reach/contact" + optional modifiers + (owner)
    // Allows 0-2 words between action and owner
    // Matches: "get owner", "get the owner", "contact the business owner"
    const directAction = new RegExp(
      `\\b(get|reach|contact)\\s+([\\w]+\\s+){0,2}${owner}\\b`,
      'i'
    );
    
    // Pattern 3: Owner name + optional modifiers + action
    // Allows 0-3 words between owner and action verb
    // Matches: "jody call me", "jody can call me", "jody to call me"
    const ownerAction = new RegExp(
      `\\b${owner}\\s+([\\w]+\\s+){0,3}(call|reach|contact|speak|talk)`,
      'i'
    );
    
    // Pattern 4: "have/let/get" + optional modifiers + owner + action
    // Matches: "have owner call", "let the owner call", "get jody to call me"
    const haveOwnerAction = new RegExp(
      `\\b(have|let|get)\\s+([\\w]+\\s+){0,2}${owner}\\s+([\\w]+\\s+){0,2}(call|contact|reach|speak|talk)`,
      'i'
    );

    if (
      actionToOwner.test(sentence) ||
      directAction.test(sentence) ||
      ownerAction.test(sentence) ||
      haveOwnerAction.test(sentence)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check for human hand-off request (Tier B)
 * Uses flexible regex allowing optional modifiers
 */
function detectTierB(sentence: string): boolean {
  // Bot complaints always trigger
  if (BOT_COMPLAINTS.some(phrase => sentence.includes(phrase))) {
    return true;
  }

  // Build regex patterns for human targets (multi-word targets need special handling)
  const singleWordHumanTargets = ['human', 'representative'];
  
  for (const target of singleWordHumanTargets) {
    // Pattern: (action verb) + optional "to/with" + optional modifiers + (human target)
    // Allows 0-2 words between preposition and target
    // Matches: "talk to human", "talk to a human", "speak with live representative"
    const actionToHuman = new RegExp(
      `\\b(${ACTION_VERBS.join('|')})\\s+(to|with)?\\s+([\\w]+\\s+){0,2}${target}\\b`,
      'i'
    );

    if (actionToHuman.test(sentence)) {
      return true;
    }
  }
  
  // Multi-word human targets (e.g., "real person", "live agent")
  const multiWordTargets = [
    'real person',
    'live agent',
    'actual person',
  ];
  
  for (const target of multiWordTargets) {
    // Pattern for multi-word targets
    // Matches: "talk to a real person", "speak with the live agent"
    const multiWordPattern = new RegExp(
      `\\b(${ACTION_VERBS.join('|')})\\s+(to|with)?\\s+(a|the)?\\s*${target}\\b`,
      'i'
    );

    if (multiWordPattern.test(sentence)) {
      return true;
    }
  }

  // Check soft targets with qualifiers (someone/person)
  for (const softTarget of SOFT_TARGETS) {
    for (const qualifier of SOFT_TARGET_QUALIFIERS) {
      // Pattern: (action) + optional "to/with" + optional article + (soft target) + (qualifier)
      // Allows flexible spacing
      // Matches: "talk to someone there", "speak with person on your team"
      const softTargetPattern = new RegExp(
        `\\b(${ACTION_VERBS.join('|')})\\s+(to|with)?\\s*(a|the)?\\s*${softTarget}\\s+.*${qualifier}\\b`,
        'i'
      );

      if (softTargetPattern.test(sentence)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check for strong human-only phrases without action verbs (Tier C - optional fallback)
 */
function detectTierC(sentence: string): boolean {
  const strongPhrases = [
    'human please',
    'real person please',
    'actual person please',
    'not a bot',
    'not bot',
  ];

  return strongPhrases.some(phrase => sentence.includes(phrase));
}

/**
 * Detect escalation trigger using multi-tier rule-based detection
 * 
 * @returns {object|null} - { match: string, tier: string, sentence: string } if triggered, null otherwise
 */
export function detectEscalationTrigger(messageText: string): { match: string; tier: string; sentence: string } | null {
  const sentences = preprocessMessage(messageText);

  for (const sentence of sentences) {
    if (isExcludedPhrase(sentence)) {
      console.log('[ESCALATION] Excluded phrase detected, skipping:', sentence);
      continue;
    }

    if (detectTierA(sentence)) {
      console.log('[ESCALATION] Tier A match (owner/Jody):', sentence);
      return {
        match: sentence,
        tier: 'A (Owner/Jody)',
        sentence,
      };
    }

    if (detectTierB(sentence)) {
      console.log('[ESCALATION] Tier B match (human hand-off):', sentence);
      return {
        match: sentence,
        tier: 'B (Human)',
        sentence,
      };
    }

    if (detectTierC(sentence)) {
      console.log('[ESCALATION] Tier C match (bot complaint):', sentence);
      return {
        match: sentence,
        tier: 'C (Bot Complaint)',
        sentence,
      };
    }
  }

  return null;
}

export async function createEscalationRequest(params: {
  conversationId: number;
  customerId: number;
  customerPhone: string;
  triggerPhrase: string;
  triggerMessageId?: number;
  recentMessages?: Array<{ role: string; content: string }>;
}): Promise<HumanEscalationRequest | null> {
  try {
    const { 
      conversationId, 
      customerId, 
      customerPhone, 
      triggerPhrase, 
      triggerMessageId,
      recentMessages = []
    } = params;

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId)
    });

    if (conversation?.humanEscalationActive) {
      console.log('[ESCALATION] Escalation already active for conversation', conversationId);
      return null;
    }

    const customerContext = await buildCustomerContext(customerPhone);
    
    const messageSummary = recentMessages
      .slice(-5)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const [escalation] = await db.insert(humanEscalationRequests).values({
      conversationId,
      customerId,
      customerPhone,
      customerName: customerContext?.name,
      triggerPhrase,
      triggerMessageId,
      status: 'pending',
      recentMessageSummary: messageSummary,
      customerVehicle: customerContext?.primaryVehicle 
        ? `${customerContext.primaryVehicle.year} ${customerContext.primaryVehicle.make} ${customerContext.primaryVehicle.model}`.trim()
        : undefined,
      lastServiceDate: customerContext?.recentServices[0]?.serviceDate,
      expiresAt,
      smsNotificationSent: false,
      pushNotificationSent: false,
    }).returning();

    await db.update(conversations)
      .set({
        humanEscalationActive: true,
        humanEscalationRequestedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    await sendOwnerNotifications(escalation, customerContext);

    console.log('[ESCALATION] Created escalation request', escalation.id);
    return escalation;

  } catch (error) {
    console.error('[ESCALATION] Error creating escalation:', error);
    return null;
  }
}

async function sendOwnerNotifications(
  escalation: HumanEscalationRequest,
  customerContext: any
) {
  try {
    const ownerPhone = process.env.BUSINESS_OWNER_PHONE;
    if (!ownerPhone) {
      console.error('[ESCALATION] BUSINESS_OWNER_PHONE not configured');
      return;
    }

    let message = `🔔 Customer Escalation Request\n\n`;
    message += `Customer: ${escalation.customerName || escalation.customerPhone}\n`;
    message += `Phone: ${escalation.customerPhone}\n`;
    
    if (escalation.customerVehicle) {
      message += `Vehicle: ${escalation.customerVehicle}\n`;
    }
    
    if (customerContext?.stats.totalAppointments > 0) {
      message += `History: ${customerContext.stats.totalAppointments} visits, $${customerContext.stats.lifetimeValue} lifetime\n`;
    }
    
    message += `\nTrigger: "${escalation.triggerPhrase}"\n\n`;
    message += `Reply to this customer via the Messages dashboard.`;

    const smsResult = await sendSMS(ownerPhone, message);
    const smsSent = smsResult.success;

    const adminUsers = await db.query.users.findMany({
      where: eq(users.role, 'admin')
    });

    let pushSent = false;
    for (const user of adminUsers) {
      const result = await sendPushNotification(user.id, {
        title: 'Customer Wants to Talk to You',
        body: `${escalation.customerName || escalation.customerPhone} requested to speak with you`,
        tag: `escalation-${escalation.id}`,
        requireInteraction: true,
        data: {
          type: 'escalation',
          escalationId: escalation.id.toString(),
          conversationId: escalation.conversationId.toString(),
          customerPhone: escalation.customerPhone,
        }
      });
      if (result.success > 0) {
        pushSent = true;
      }
    }

    await db.update(humanEscalationRequests)
      .set({
        smsNotificationSent: smsSent,
        pushNotificationSent: pushSent,
      })
      .where(eq(humanEscalationRequests.id, escalation.id));

  } catch (error) {
    console.error('[ESCALATION] Error sending owner notifications:', error);
  }
}

export async function acknowledgeEscalation(escalationId: number, userId: number) {
  try {
    await db.update(humanEscalationRequests)
      .set({
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      })
      .where(eq(humanEscalationRequests.id, escalationId));

    console.log('[ESCALATION] Acknowledged escalation', escalationId);
  } catch (error) {
    console.error('[ESCALATION] Error acknowledging escalation:', error);
  }
}

export async function resolveEscalation(escalationId: number, userId: number) {
  try {
    const escalation = await db.query.humanEscalationRequests.findFirst({
      where: eq(humanEscalationRequests.id, escalationId)
    });

    if (!escalation) return;

    await db.update(humanEscalationRequests)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
      })
      .where(eq(humanEscalationRequests.id, escalationId));

    await db.update(conversations)
      .set({
        humanEscalationActive: false,
        humanHandledAt: new Date(),
        humanHandledBy: userId,
      })
      .where(eq(conversations.id, escalation.conversationId));

    console.log('[ESCALATION] Resolved escalation', escalationId);
  } catch (error) {
    console.error('[ESCALATION] Error resolving escalation:', error);
  }
}

export async function expireOldEscalations() {
  try {
    const now = new Date();
    
    // Expire both pending AND acknowledged escalations past their expiry time
    const expired = await db.update(humanEscalationRequests)
      .set({ status: 'expired' })
      .where(
        and(
          // Include both pending and acknowledged status
          sql`${humanEscalationRequests.status} IN ('pending', 'acknowledged')`,
          sql`${humanEscalationRequests.expiresAt} < ${now}`
        )
      )
      .returning();

    // Resume AI for expired conversations
    if (expired.length > 0) {
      for (const escalation of expired) {
        await db.update(conversations)
          .set({ humanEscalationActive: false })
          .where(eq(conversations.id, escalation.conversationId));
      }
      
      console.log('[ESCALATION] Expired and resumed AI for', expired.length, 'old escalations');
    } else {
      console.log('[ESCALATION] No escalations to expire');
    }
    
    return expired.length;
  } catch (error) {
    console.error('[ESCALATION] Error expiring escalations:', error);
    return 0;
  }
}
