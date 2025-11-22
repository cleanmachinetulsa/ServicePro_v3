import type { TenantDb } from './tenantDb';
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
 * ✅ "Talk to the business owner"
 * ✅ "Transfer me to the owner" ← FIX
 * ✅ "Connect me with your manager" ← FIX
 * ✅ "Get me the owner" ← FIX
 * ✅ "Let me talk to Jody" ← FIX
 * ✅ "Have Jody call me back"
 * ✅ "I'd like Jody to call me"
 * 
 * TIER B - HUMAN ESCALATIONS (should trigger):
 * ✅ "I need to talk to a human"
 * ✅ "Transfer me to a human" ← FIX
 * ✅ "Connect me with a real person" ← FIX
 * ✅ "Can I speak with someone there?"
 * ✅ "Transfer me to a live agent" ← FIX
 * ✅ "Get me a representative" ← FIX
 * ✅ "not a bot please"
 * ✅ "human please"
 * 
 * FALSE POSITIVES - SHOULD NOT TRIGGER:
 * ❌ "I want to talk about pricing"
 * ❌ "I need to speak to my wife first"
 * ❌ "Transfer me $20" (different context)
 * ❌ "Get me a quote" (no owner/human target)
 * ❌ "Connect me to your wifi" (different context)
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
 * Handles pronouns between verb and preposition ("transfer me to owner")
 */
function detectTierA(sentence: string): boolean {
  // Build regex patterns for each owner target
  for (const owner of OWNER_TARGETS) {
    // Pattern 1: (action verb) + optional [pronoun + space] + optional preposition + modifiers + owner
    // (?:\s+(?:me|us))? makes the entire [space + pronoun] block optional
    // Matches: "talk to owner", "transfer me to owner", "connect me with the owner"
    const actionToOwner = new RegExp(
      `\\b(${ACTION_VERBS.join('|')})(?:\\s+(?:me|us))?\\s*(to|with|for)?\\s+([\\w]+\\s+){0,2}${owner}\\b`,
      'i'
    );
    
    // Pattern 2: "get/reach/contact" + optional [pronoun + space] + modifiers + owner
    // Matches: "get owner", "get me the owner", "contact the business owner"
    const directAction = new RegExp(
      `\\b(get|reach|contact)(?:\\s+(?:me|us))?\\s+([\\w]+\\s+){0,2}${owner}\\b`,
      'i'
    );
    
    // Pattern 3: Owner name + optional modifiers + action (no change needed)
    // Matches: "jody call me", "jody can call me", "have jody to call me"
    const ownerAction = new RegExp(
      `\\b${owner}\\s+([\\w]+\\s+){0,3}(call|reach|contact|speak|talk)`,
      'i'
    );
    
    // Pattern 4: "have/let/get" + optional [pronoun + space] + modifiers + owner + action
    // Matches: "have owner call", "let me talk to the owner", "get jody to call me"
    const haveOwnerAction = new RegExp(
      `\\b(have|let|get)(?:\\s+(?:me|us))?\\s+([\\w]+\\s+){0,2}${owner}\\s+([\\w]+\\s+){0,2}(call|contact|reach|speak|talk)`,
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
 * Handles pronouns between verb and preposition
 */
function detectTierB(sentence: string): boolean {
  // Bot complaints always trigger
  if (BOT_COMPLAINTS.some(phrase => sentence.includes(phrase))) {
    return true;
  }

  // Single-word human targets with optional pronoun
  const singleWordHumanTargets = ['human', 'representative'];
  
  for (const target of singleWordHumanTargets) {
    // Pattern: (action) + optional [pronoun + space] + optional preposition + modifiers + target
    // Matches: "talk to human", "transfer me to a human", "connect me with a representative"
    const actionToHuman = new RegExp(
      `\\b(${ACTION_VERBS.join('|')})(?:\\s+(?:me|us))?\\s*(to|with)?\\s+([\\w]+\\s+){0,2}${target}\\b`,
      'i'
    );

    if (actionToHuman.test(sentence)) {
      return true;
    }
  }
  
  // Multi-word targets
  const multiWordTargets = [
    'real person',
    'live agent',
    'actual person',
  ];
  
  for (const target of multiWordTargets) {
    // Pattern with optional pronoun for multi-word targets
    const multiWordPattern = new RegExp(
      `\\b(${ACTION_VERBS.join('|')})(?:\\s+(?:me|us))?\\s*(to|with)?\\s+(a|the)?\\s*${target}\\b`,
      'i'
    );

    if (multiWordPattern.test(sentence)) {
      return true;
    }
  }

  // Soft targets with qualifiers
  for (const softTarget of SOFT_TARGETS) {
    for (const qualifier of SOFT_TARGET_QUALIFIERS) {
      // Pattern with optional pronoun for soft targets
      const softTargetPattern = new RegExp(
        `\\b(${ACTION_VERBS.join('|')})(?:\\s+(?:me|us))?\\s*(to|with)?\\s*(a|the)?\\s*${softTarget}\\s+.*${qualifier}\\b`,
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

export async function createEscalationRequest(tenantDb: TenantDb, params: {
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

    const conversation = await tenantDb.query.conversations.findFirst({
      where: eq(conversations.id, conversationId)
    });

    if (conversation?.humanEscalationActive) {
      console.log('[ESCALATION] Escalation already active for conversation', conversationId);
      return null;
    }

    const customerContext = await buildCustomerContext(tenantDb, customerPhone);
    
    const messageSummary = recentMessages
      .slice(-5)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const [escalation] = await tenantDb.insert(humanEscalationRequests).values({
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

    await tenantDb.update(conversations)
      .set({
        humanEscalationActive: true,
        humanEscalationRequestedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    await sendOwnerNotifications(tenantDb, escalation, customerContext);

    console.log('[ESCALATION] Created escalation request', escalation.id);
    return escalation;

  } catch (error) {
    console.error('[ESCALATION] Error creating escalation:', error);
    return null;
  }
}

async function sendOwnerNotifications(
  tenantDb: TenantDb,
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

    const smsResult = await sendSMS(tenantDb, ownerPhone, message);
    const smsSent = smsResult.success;

    const adminUsers = await tenantDb.query.users.findMany({
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

    await tenantDb.update(humanEscalationRequests)
      .set({
        smsNotificationSent: smsSent,
        pushNotificationSent: pushSent,
      })
      .where(eq(humanEscalationRequests.id, escalation.id));

  } catch (error) {
    console.error('[ESCALATION] Error sending owner notifications:', error);
  }
}

export async function acknowledgeEscalation(tenantDb: TenantDb, escalationId: number, userId: number) {
  try {
    await tenantDb.update(humanEscalationRequests)
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

export async function resolveEscalation(tenantDb: TenantDb, escalationId: number, userId: number) {
  try {
    const escalation = await tenantDb.query.humanEscalationRequests.findFirst({
      where: eq(humanEscalationRequests.id, escalationId)
    });

    if (!escalation) return;

    await tenantDb.update(humanEscalationRequests)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
      })
      .where(eq(humanEscalationRequests.id, escalationId));

    await tenantDb.update(conversations)
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

export async function expireOldEscalations(tenantDb: TenantDb) {
  try {
    const now = new Date();
    
    // Expire both pending AND acknowledged escalations past their expiry time
    const expired = await tenantDb.update(humanEscalationRequests)
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
        await tenantDb.update(conversations)
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
