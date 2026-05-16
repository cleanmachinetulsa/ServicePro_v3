import type { TenantDb } from './tenantDb';
import { conversations, messages, customers } from '@shared/schema';
import { eq, desc, and, sql, or, inArray } from 'drizzle-orm';
import {
  broadcastNewMessage,
  broadcastConversationUpdate,
  broadcastNewConversation,
  broadcastControlModeChange,
  broadcastBehaviorUpdate,
} from './websocketService';
import { getBookingStatusFromState, BookingStatus } from '@shared/ai/smsAgentConfig';
import { conversationState } from './conversationState';
import { findOrCreateCustomer, normalizePhone, normalizeEmail } from './services/customerIdentityService';

/**
 * CM-MESSAGE-PERF: Optimized conversation list with pagination and eliminated N+1 queries
 * 
 * Performance improvements:
 * 1. Default pagination (limit 50) - prevents loading 1000s of conversations
 * 2. Single batch query for message counts using GROUP BY
 * 3. Single batch query for latest messages using window function
 * 4. Performance logging for slow queries (>1500ms)
 */
export async function getAllConversations(
  tenantDb: TenantDb, 
  status?: string, 
  phoneLineId?: number,
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  const startTime = Date.now();
  const tenantId = (tenantDb as any).tenantId || 'unknown';
  
  try {
    const statusFilter = status || 'all';
    // CM-MESSAGE-PERF: High default limit to avoid breaking existing UI
    // Frontend doesn't support pagination yet, so use 500 as a safe cap
    // This still prevents loading 10K+ conversations while preserving current behavior
    const limit = options?.limit || 500;
    const offset = options?.offset || 0;
    
    // Build the where clause based on filter
    const conditions = [];
    
    if (statusFilter === 'all') {
      conditions.push(eq(conversations.status, 'active'));
    } else if (statusFilter === 'manual') {
      conditions.push(eq(conversations.status, 'active'));
      conditions.push(eq(conversations.controlMode, 'manual'));
    } else if (statusFilter === 'closed') {
      conditions.push(eq(conversations.status, 'closed'));
    } else {
      conditions.push(eq(conversations.status, 'active'));
    }
    
    // Add phone line filter if provided
    // CRITICAL FIX: Treat NULL phoneLineId as Main Line (ID 1) for legacy conversations
    if (phoneLineId !== undefined && phoneLineId !== null) {
      if (phoneLineId === 1) {
        // Main Line - include both phoneLineId = 1 AND NULL (legacy conversations)
        conditions.push(or(eq(conversations.phoneLineId, 1), sql`${conversations.phoneLineId} IS NULL`));
      } else {
        // Other lines - only match the specific line ID
        conditions.push(eq(conversations.phoneLineId, phoneLineId));
      }
    }
    
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
    const finalWhereClause = whereClause ? tenantDb.withTenantFilter(conversations, whereClause) : tenantDb.withTenantFilter(conversations);
    
    // CM-MESSAGE-PERF: Paginated conversation list
    const conversationList = await tenantDb
      .select({
        id: conversations.id,
        customerId: conversations.customerId,
        customerPhone: conversations.customerPhone,
        customerName: conversations.customerName,
        category: conversations.category,
        intent: conversations.intent,
        needsHumanAttention: conversations.needsHumanAttention,
        resolved: conversations.resolved,
        lastMessageTime: conversations.lastMessageTime,
        platform: conversations.platform,
        controlMode: conversations.controlMode,
        assignedAgent: conversations.assignedAgent,
        behaviorSettings: conversations.behaviorSettings,
        status: conversations.status,
        createdAt: conversations.createdAt,
        unreadCount: conversations.unreadCount,
        phoneLineId: conversations.phoneLineId,
      })
      .from(conversations)
      .where(finalWhereClause)
      .orderBy(desc(conversations.lastMessageTime))
      .limit(limit)
      .offset(offset);

    // CM-MESSAGE-PERF: If no conversations, return early
    if (conversationList.length === 0) {
      return [];
    }

    // CM-MESSAGE-PERF: Get message counts in a single batch query (eliminates N+1)
    const conversationIds = conversationList.map(c => c.id);
    
    const messageCounts = await tenantDb
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .groupBy(messages.conversationId);
    
    const countMap = new Map(messageCounts.map(mc => [mc.conversationId, mc.count]));

    // CM-MESSAGE-PERF: Get latest messages in a single batch query using ROW_NUMBER
    // This is more efficient than N separate queries
    const latestMessagesRaw = await tenantDb
      .select()
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(desc(messages.timestamp));
    
    // Group by conversationId and take the first (most recent) one
    const latestMessageMap = new Map<number, typeof messages.$inferSelect>();
    for (const msg of latestMessagesRaw) {
      if (!latestMessageMap.has(msg.conversationId)) {
        latestMessageMap.set(msg.conversationId, msg);
      }
    }

    // Combine results
    const conversationsWithCounts = conversationList.map((conv) => ({
      ...conv,
      messageCount: countMap.get(conv.id) || 0,
      latestMessage: latestMessageMap.get(conv.id) || null,
    }));

    // CM-MESSAGE-PERF: Log slow queries for monitoring
    const durationMs = Date.now() - startTime;
    if (durationMs > 1500) {
      console.warn(`[PERF] getAllConversations slow: tenant=${tenantId}, duration=${durationMs}ms, count=${conversationsWithCounts.length}, status=${statusFilter}`);
    }

    return conversationsWithCounts;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[PERF] getAllConversations error: tenant=${tenantId}, duration=${durationMs}ms`, error);
    throw error;
  }
}

/**
 * Get conversation by ID with paginated message history
 */
export async function getConversationById(
  tenantDb: TenantDb,
  conversationId: number,
  options?: {
    before?: Date;
    limit?: number;
  }
) {
  try {
    const conversation = await tenantDb
      .select()
      .from(conversations)
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .limit(1);

    if (!conversation || conversation.length === 0) {
      return null;
    }

    // Build message query with pagination
    const limit = options?.limit || 50;
    const beforeDate = options?.before;

    // Build where clause conditionally
    const baseConditions = beforeDate
      ? and(
          eq(messages.conversationId, conversationId),
          sql`${messages.timestamp} < ${beforeDate.toISOString()}`
        )
      : eq(messages.conversationId, conversationId);

    // Fetch limit + 1 to determine if there are more messages
    const messageHistory = await tenantDb
      .select()
      .from(messages)
      .where(tenantDb.withTenantFilter(messages, baseConditions))
      .orderBy(desc(messages.timestamp))
      .limit(limit + 1);

    // Check if there are more messages beyond the limit
    const hasMore = messageHistory.length > limit;
    const messagesForResponse = hasMore ? messageHistory.slice(0, limit) : messageHistory;

    // Reverse to chronological order (oldest first)
    messagesForResponse.reverse();

    // Compute booking status from conversation state (if phone number available)
    let bookingStatus: BookingStatus = 'not_ready';
    const conv = conversation[0];
    
    // Also check behaviorSettings for manual approval flags (set when booking with service area override)
    const behaviorSettings = (conv.behaviorSettings as Record<string, any>) || {};
    const bookingFlags = behaviorSettings.booking || {};
    
    if (conv.customerPhone) {
      try {
        const state = conversationState.getState(conv.customerPhone);
        // Map conversation state to booking status helper format
        // Merge behaviorSettings.booking flags with conversation state
        bookingStatus = getBookingStatusFromState({
          customerName: state.customerName,
          service: state.service,
          serviceId: null,
          address: state.address,
          selectedTimeSlot: state.selectedTimeSlot,
          preferredDate: null,
          preferredTimeWindow: null,
          requiresManualApproval: state.damageAssessmentRequested || bookingFlags.requiresManualApproval || false,
          inServiceArea: bookingFlags.inServiceArea !== undefined ? bookingFlags.inServiceArea : (state.isInServiceArea !== false),
        });
      } catch (stateError) {
        console.error('[BOOKING STATUS] Error computing booking status:', stateError);
      }
    } else if (bookingFlags.requiresManualApproval) {
      // No phone but we have booking flags from service area override
      bookingStatus = 'ready_for_human_review';
    }

    return {
      ...conv,
      messages: messagesForResponse,
      hasMore,
      bookingStatus, // Include booking readiness status
    };
  } catch (error) {
    console.error('Error getting conversation by ID:', error);
    throw error;
  }
}

/**
 * Create or get conversation for a customer
 */
export async function getOrCreateConversation(
  tenantDb: TenantDb,
  customerPhone: string,
  customerName: string | null,
  platform: 'web' | 'sms' | 'facebook' | 'instagram' | 'email',
  facebookSenderId?: string,
  facebookPageId?: string,
  emailAddress?: string,
  emailThreadId?: string,
  emailSubject?: string,
  phoneLineId?: number
) {
  try {
    // For Facebook/Instagram, look up by sender ID instead of phone
    const isFacebookPlatform = platform === 'facebook' || platform === 'instagram';
    const isEmail = platform === 'email';
    
    let existingConversation;
    if (isFacebookPlatform && facebookSenderId) {
      // Check for active Facebook conversation with this sender
      existingConversation = await tenantDb
        .select()
        .from(conversations)
        .where(
          tenantDb.withTenantFilter(conversations,
            and(
              eq(conversations.facebookSenderId, facebookSenderId),
              eq(conversations.status, 'active')
            )
          )
        )
        .limit(1);
    } else if (isEmail && emailThreadId) {
      // Check for active email conversation with this thread ID
      existingConversation = await tenantDb
        .select()
        .from(conversations)
        .where(
          tenantDb.withTenantFilter(conversations,
            and(
              eq(conversations.emailThreadId, emailThreadId),
              eq(conversations.status, 'active')
            )
          )
        )
        .limit(1);
    } else if (isEmail && emailAddress) {
      // Check for active email conversation with this email address (no thread ID yet)
      existingConversation = await tenantDb
        .select()
        .from(conversations)
        .where(
          tenantDb.withTenantFilter(conversations,
            and(
              eq(conversations.emailAddress, emailAddress),
              eq(conversations.status, 'active')
            )
          )
        )
        .limit(1);
    } else {
      // Audit T1 (Task #17): For phone-based channels (SMS, web), look up the
      // active conversation per (phone, platform) so SMS and web get their own
      // conversation rows. Cross-channel state is unified at the THREAD level
      // (customer_threads), not by collapsing rows. Without this, SMS+web for
      // the same phone collide into one conversation and there is no sibling
      // conversation to hydrate cross-channel context from.
      existingConversation = await tenantDb
        .select()
        .from(conversations)
        .where(
          tenantDb.withTenantFilter(conversations,
            and(
              eq(conversations.customerPhone, customerPhone),
              eq(conversations.platform, platform),
              eq(conversations.status, 'active')
            )
          )
        )
        .limit(1);
    }

    if (existingConversation && existingConversation.length > 0) {
      const conv = existingConversation[0];
      // Audit T1 (Task #17): Late attach. If this conversation was created
      // before identity was known (or before threads existed), try to resolve
      // the customer now (by phone/email) and then link it to that customer's
      // thread, so subsequent reads of escalation / pause / booking-offer
      // state become cross-channel. All wrapped in non-fatal try/catch — a
      // linkage failure must never block messaging.
      const tenantIdForLate = (tenantDb as any).tenantId || 'root';
      let lateCustomerId: number | null = conv.customerId ?? null;

      // Audit T2 Task #20: same defer rule applies on late-attach. An
      // anonymous web-chat conversation should NOT spawn a customers row on
      // every subsequent message; it must wait for real identity.
      const isAnonWebLate = platform === 'web'
        && typeof customerPhone === 'string'
        && customerPhone.startsWith('web-chat-')
        && !emailAddress;
      if (!lateCustomerId && !isAnonWebLate && (customerPhone || emailAddress)) {
        try {
          const platformSource = platform === 'sms' ? 'sms'
            : platform === 'email' ? 'email'
            : platform === 'facebook' || platform === 'instagram' ? 'social'
            : 'web';
          const ident = await findOrCreateCustomer(tenantDb, {
            tenantId: tenantIdForLate,
            phone: customerPhone || null,
            email: emailAddress || null,
            fullName: customerName || null,
            source: platformSource,
          });
          lateCustomerId = ident.customer.id;
          await tenantDb
            .update(conversations)
            .set({ customerId: lateCustomerId })
            .where(eq(conversations.id, conv.id));
          conv.customerId = lateCustomerId;
        } catch (idErr) {
          console.warn('[CONVERSATION] late identity resolve failed (continuing):', idErr);
        }
      }

      if (!conv.threadId && lateCustomerId) {
        try {
          const { findOrCreateThread, attachConversationToThread } =
            await import('./services/customerThreadService');
          const thread = await findOrCreateThread(tenantDb, tenantIdForLate, lateCustomerId);
          await attachConversationToThread(tenantDb, conv.id, thread.id);
          conv.threadId = thread.id;
        } catch (threadErr) {
          console.error('[CONVERSATION] late thread attach failed:', threadErr);
        }
      }
      return { conversation: conv, isNew: false };
    }

    // Use unified Customer Identity Service to find or create customer
    // This ensures proper deduplication and data enrichment
    let customerId: number | null = null;
    const tenantId = (tenantDb as any).tenantId || 'root';
    
    // Audit T2 Task #20: defer customers-row creation for anonymous web
    // visitors. The widget seeds the conversation with a synthetic
    // `web-chat-<webId>` "phone", which is just a cookie handle — not a real
    // identifier — so creating a customers row at this point pollutes the
    // CRM with thousands of stub rows that never resolve. We hold the
    // identifier on conversations.customer_phone only, and create / link the
    // real customer + thread the moment the visitor supplies a phone, email,
    // or schedules an appointment (see linkWebChatIdentity below).
    const isAnonymousWebHandle = platform === 'web'
      && typeof customerPhone === 'string'
      && customerPhone.startsWith('web-chat-')
      && !emailAddress;

    if (!isAnonymousWebHandle && (customerPhone || emailAddress)) {
      try {
        const platformSource = platform === 'sms' ? 'sms' 
          : platform === 'email' ? 'email'
          : platform === 'facebook' || platform === 'instagram' ? 'social'
          : 'web';
        
        const result = await findOrCreateCustomer(tenantDb, {
          tenantId,
          phone: customerPhone || null,
          email: emailAddress || null,
          fullName: customerName || null,
          source: platformSource,
        });
        
        customerId = result.customer.id;
        
        if (result.createdNew) {
          console.log(`[CONVERSATION] Created new customer via identity service: ${customerPhone || emailAddress} (ID: ${customerId})`);
        }
      } catch (identityError) {
        console.error('[CONVERSATION] Error with customer identity service:', identityError);
        // Fallback to existing lookup if identity service fails
        if (customerPhone) {
          const customer = await tenantDb
            .select()
            .from(customers)
            .where(tenantDb.withTenantFilter(customers, eq(customers.phone, customerPhone)))
            .limit(1);
          if (customer && customer.length > 0) {
            customerId = customer[0].id;
          }
        }
      }
    }

    // Create new conversation
    // Default to Main Line (ID 1) for SMS if phoneLineId not provided
    const effectivePhoneLineId = platform === 'sms' ? (phoneLineId || 1) : null;

    // Audit T1 (Task #17): If we resolved a customerId, find/create the
    // cross-channel thread row BEFORE inserting the conversation so we can
    // store thread_id atomically. Anonymous conversations (no customerId)
    // keep thread_id = NULL and read state from the conversation row.
    let threadId: number | null = null;
    if (customerId) {
      try {
        const { findOrCreateThread } = await import('./services/customerThreadService');
        const thread = await findOrCreateThread(tenantDb, tenantId, customerId);
        threadId = thread.id;
      } catch (threadErr) {
        // Non-fatal: missing thread degrades to per-conversation behavior.
        console.error('[CONVERSATION] thread create failed (continuing without thread):', threadErr);
      }
    }

    const newConversation = await tenantDb
      .insert(conversations)
      .values({
        customerId,
        customerPhone: customerPhone || null,
        customerName,
        platform,
        facebookSenderId: facebookSenderId || null,
        facebookPageId: facebookPageId || null,
        emailAddress: emailAddress || null,
        emailThreadId: emailThreadId || null,
        emailSubject: emailSubject || null,
        phoneLineId: effectivePhoneLineId,
        controlMode: 'auto',
        status: 'active',
        category: 'Other',
        intent: 'Information Gathering',
        needsHumanAttention: false,
        resolved: false,
        threadId,
      })
      .returning();

    // Broadcast new conversation to monitoring dashboard
    broadcastNewConversation(newConversation[0]);

    return { conversation: newConversation[0], isNew: true };
  } catch (error) {
    console.error('Error getting or creating conversation:', error);
    throw error;
  }
}

/**
 * Audit T2 Task #20 — promote an anonymous web-chat conversation to a real
 * customer the first time the visitor supplies a phone, email, or schedules
 * an appointment. Idempotent: safe to call on every web-chat POST that
 * carries an identity hint; bails fast if the conversation is already linked.
 *
 * Returns the resolved customerId (or null if no usable identity was supplied
 * and the conversation is still anonymous).
 */
/**
 * Audit T2 #20 (round 3): resolve the canonical web conversation for a given
 * sp_chat cookie. Once a visitor has supplied phone/email on ANY device, every
 * subsequent web POST from a cookie that maps to that same customer must write
 * to the same conversation row — otherwise per-device cookies create parallel
 * threads and history splits. Returns null if the cookie is anonymous or no
 * canonical conversation exists yet.
 */
/**
 * Audit T2 #20 (round 4): resolve canonical web conversation by an identity
 * hint (phone/email). Used for the cross-device first-touch case: a brand-new
 * cookie that has never been mapped, but the very first POST already carries
 * the customer's phone/email. We must route that message into the customer's
 * existing canonical web conversation BEFORE creating a new one — otherwise
 * device B's first message forks history.
 */
export async function resolveCanonicalWebConversationByIdentity(
  tenantDb: TenantDb,
  identity: { phone?: string | null; email?: string | null },
): Promise<{ conversation: typeof conversations.$inferSelect; customerId: number } | null> {
  try {
    // Normalize the same way findOrCreateCustomer does so lookups match
    // stored customer rows (E.164 phone, lowercased email). Without this,
    // device B's "(918) 555-1212" would miss a customer stored as
    // "+19185551212" and fork conversation history.
    const phone = normalizePhone(identity.phone || null);
    const email = normalizeEmail(identity.email || null);
    if (!phone && !email) return null;

    const { customers } = await import('@shared/schema');
    const orExprs = [];
    if (phone) orExprs.push(eq(customers.phone, phone));
    if (email) orExprs.push(eq(customers.email, email));
    if (orExprs.length === 0) return null;

    // Tenant scoping comes from withTenantFilter via tenantDb.
    const matched = await tenantDb
      .select()
      .from(customers)
      .where(tenantDb.withTenantFilter(customers, or(...orExprs)!))
      .limit(2);
    if (matched.length === 0) return null;
    // Conflict guard: if phone and email map to different customers, bail
    // out rather than guess. The first POST will fall through to the
    // anonymous path and linkWebChatIdentity will resolve deterministically.
    if (matched.length > 1) {
      console.warn('[CONVERSATION] identity hint matched multiple customers; skipping canonical resolve');
      return null;
    }
    const existingCustomer = matched[0];

    const [conv] = await tenantDb
      .select()
      .from(conversations)
      .where(tenantDb.withTenantFilter(conversations,
        and(eq(conversations.customerId, existingCustomer.id), eq(conversations.platform, 'web'))))
      .orderBy(desc(conversations.lastMessageTime))
      .limit(1);
    if (!conv) return null;
    return { conversation: conv, customerId: existingCustomer.id };
  } catch (err) {
    console.warn('[CONVERSATION] resolveCanonicalWebConversationByIdentity failed:', err);
    return null;
  }
}

export async function resolveCanonicalWebConversation(
  tenantDb: TenantDb,
  webId: string,
): Promise<typeof conversations.$inferSelect | null> {
  try {
    const { webChatIdentities } = await import('@shared/schema');
    const [identity] = await tenantDb
      .select()
      .from(webChatIdentities)
      .where(tenantDb.withTenantFilter(webChatIdentities, eq(webChatIdentities.webId, webId)))
      .limit(1);
    if (!identity?.customerId) return null;
    const [conv] = await tenantDb
      .select()
      .from(conversations)
      .where(tenantDb.withTenantFilter(conversations,
        and(eq(conversations.customerId, identity.customerId), eq(conversations.platform, 'web'))))
      .orderBy(desc(conversations.lastMessageTime))
      .limit(1);
    return conv || null;
  } catch (err) {
    console.warn('[CONVERSATION] resolveCanonicalWebConversation failed:', err);
    return null;
  }
}

export async function linkWebChatIdentity(
  tenantDb: TenantDb,
  conversationId: number,
  identity: { phone?: string | null; email?: string | null; fullName?: string | null },
): Promise<number | null> {
  try {
    const phone = identity.phone?.trim() || null;
    const email = identity.email?.trim() || null;
    if (!phone && !email) return null;

    // Don't link the synthetic web-chat-<webId> handle — that's the anonymous
    // cookie value, not a real phone number.
    if (phone && phone.startsWith('web-chat-')) return null;

    const [conv] = await tenantDb
      .select()
      .from(conversations)
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .limit(1);
    if (!conv) return null;
    if (conv.customerId) return conv.customerId; // already linked

    const tenantId = (tenantDb as any).tenantId || 'root';
    const ident = await findOrCreateCustomer(tenantDb, {
      tenantId,
      phone,
      email,
      fullName: identity.fullName || conv.customerName || null,
      source: 'web',
    });
    const customerId = ident.customer.id;

    // Find/create the cross-channel thread row so escalation / pause /
    // booking-offer state is shared with this customer's SMS conversations.
    let threadId: number | null = null;
    try {
      const { findOrCreateThread, attachConversationToThread } =
        await import('./services/customerThreadService');
      const thread = await findOrCreateThread(tenantDb, tenantId, customerId);
      threadId = thread.id;
      await attachConversationToThread(tenantDb, conversationId, thread.id);
    } catch (threadErr) {
      console.error('[CONVERSATION] linkWebChatIdentity thread attach failed:', threadErr);
    }

    await tenantDb
      .update(conversations)
      .set({
        customerId,
        threadId: threadId ?? conv.threadId ?? null,
        // Keep customerPhone as the web-chat-<webId> handle so the SSE
        // cookie→conversation lookup keeps working. Promote the real phone
        // to a dedicated column only if we add one later.
        customerName: identity.fullName || conv.customerName || null,
      })
      .where(eq(conversations.id, conversationId));

    // Audit T2 #20 (round 2): stamp the cookie→customer mapping in
    // web_chat_identities so a second device with a different webId but the
    // same phone/email can resolve to this conversation on next /resolve.
    // The webId is recoverable from customerPhone (`web-chat-<webId>`).
    try {
      if (conv.customerPhone && conv.customerPhone.startsWith('web-chat-')) {
        const webId = conv.customerPhone.slice('web-chat-'.length);
        const { upsertWebChatIdentity } = await import('./services/webChatCookie');
        await upsertWebChatIdentity(tenantDb, tenantId, webId, {
          customerId,
          lastConversationId: conversationId,
        });
      }
    } catch (idErr) {
      console.warn('[WEB CHAT IDENTITY] post-link upsert failed (non-fatal):', idErr);
    }

    console.log(`[WEB CHAT IDENTITY] conv=${conversationId} linked to customer=${customerId} thread=${threadId}`);
    return customerId;
  } catch (err) {
    console.error('[WEB CHAT IDENTITY] linkWebChatIdentity failed (non-fatal):', err);
    return null;
  }
}

/**
 * Add message to conversation
 */
export async function addMessage(
  tenantDb: TenantDb,
  conversationId: number,
  content: string,
  sender: 'customer' | 'ai' | 'agent',
  channel: 'web' | 'sms' | 'facebook' | 'instagram' | 'email',
  metadata?: Record<string, any> | null,
  phoneLineId?: number
) {
  try {
    // Default to Main Line (ID 1) for SMS if phoneLineId not provided
    const effectivePhoneLineId = channel === 'sms' ? (phoneLineId || 1) : null;
    
    const newMessage = await tenantDb.insert(messages).values({
      conversationId,
      content,
      sender,
      fromCustomer: sender === 'customer',
      channel,
      metadata: metadata || null,
      phoneLineId: effectivePhoneLineId,
    }).returning();

    // Update conversation's last message time and unread count
    if (sender === 'customer') {
      // Customer sent a message - increment unread count
      await tenantDb
        .update(conversations)
        .set({ 
          lastMessageTime: new Date(),
          unreadCount: sql`${conversations.unreadCount} + 1`,
        })
        .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)));
    } else {
      // Agent or AI sent a message - reset unread count (agent has responded)
      await tenantDb
        .update(conversations)
        .set({ 
          lastMessageTime: new Date(),
          unreadCount: 0,
        })
        .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)));
    }

    // Broadcast new message to monitoring dashboard
    broadcastNewMessage(conversationId, newMessage[0]);

    return newMessage[0];
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}

/**
 * Take over conversation (switch to manual mode)
 */
export async function takeoverConversation(
  tenantDb: TenantDb,
  conversationId: number,
  agentUsername: string
) {
  try {
    const updated = await tenantDb
      .update(conversations)
      .set({
        controlMode: 'manual',
        assignedAgent: agentUsername,
      })
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .returning();

    // Broadcast control mode change
    broadcastControlModeChange(conversationId, 'manual', agentUsername);
    broadcastConversationUpdate(updated[0]);

    return updated[0];
  } catch (error) {
    console.error('Error taking over conversation:', error);
    throw error;
  }
}

/**
 * Hand off conversation back to AI
 */
export async function handoffConversation(tenantDb: TenantDb, conversationId: number) {
  try {
    const updated = await tenantDb
      .update(conversations)
      .set({
        controlMode: 'auto',
        assignedAgent: null,
      })
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .returning();

    // Broadcast control mode change
    broadcastControlModeChange(conversationId, 'auto', null);
    broadcastConversationUpdate(updated[0]);

    return updated[0];
  } catch (error) {
    console.error('Error handing off conversation:', error);
    throw error;
  }
}

/**
 * Update conversation behavior settings
 */
export async function updateBehaviorSettings(
  tenantDb: TenantDb,
  conversationId: number,
  behaviorSettings: {
    tone?: string;
    forcedAction?: string;
    formality?: number;
    responseLength?: number;
    proactivity?: number;
  }
) {
  try {
    const updated = await tenantDb
      .update(conversations)
      .set({
        behaviorSettings: behaviorSettings as any,
      })
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .returning();

    // Broadcast behavior update
    broadcastBehaviorUpdate(conversationId, behaviorSettings);
    broadcastConversationUpdate(updated[0]);

    return updated[0];
  } catch (error) {
    console.error('Error updating behavior settings:', error);
    throw error;
  }
}

/**
 * Pause conversation (AI won't respond)
 */
export async function pauseConversation(tenantDb: TenantDb, conversationId: number) {
  try {
    const updated = await tenantDb
      .update(conversations)
      .set({
        controlMode: 'paused',
      })
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .returning();

    // Broadcast control mode change
    broadcastControlModeChange(conversationId, 'paused', null);
    broadcastConversationUpdate(updated[0]);

    return updated[0];
  } catch (error) {
    console.error('Error pausing conversation:', error);
    throw error;
  }
}

/**
 * Resume conversation (switch back to auto)
 */
export async function resumeConversation(tenantDb: TenantDb, conversationId: number) {
  try {
    const updated = await tenantDb
      .update(conversations)
      .set({
        controlMode: 'auto',
      })
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .returning();

    // Broadcast control mode change
    broadcastControlModeChange(conversationId, 'auto', null);
    broadcastConversationUpdate(updated[0]);

    return updated[0];
  } catch (error) {
    console.error('Error resuming conversation:', error);
    throw error;
  }
}

/**
 * Close conversation
 */
export async function closeConversation(tenantDb: TenantDb, conversationId: number) {
  try {
    const updated = await tenantDb
      .update(conversations)
      .set({
        status: 'closed',
        resolved: true,
      })
      .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .returning();

    // Broadcast conversation update
    broadcastConversationUpdate(updated[0]);

    return updated[0];
  } catch (error) {
    console.error('Error closing conversation:', error);
    throw error;
  }
}
