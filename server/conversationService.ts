import { db } from './db';
import { conversations, messages, customers } from '@shared/schema';
import { eq, desc, and, sql, or } from 'drizzle-orm';
import {
  broadcastNewMessage,
  broadcastConversationUpdate,
  broadcastNewConversation,
  broadcastControlModeChange,
  broadcastBehaviorUpdate,
} from './websocketService';

/**
 * Get all active conversations with customer info and latest message
 */
export async function getAllConversations(status?: string, phoneLineId?: number) {
  try {
    const statusFilter = status || 'all';
    
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
    
    const conversationList = await db
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
      .where(whereClause)
      .orderBy(desc(conversations.lastMessageTime));

    // Get message counts for each conversation
    const conversationsWithCounts = await Promise.all(
      conversationList.map(async (conv) => {
        const messageCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(eq(messages.conversationId, conv.id));

        const latestMessage = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.timestamp))
          .limit(1);

        return {
          ...conv,
          messageCount: Number(messageCount[0]?.count || 0),
          latestMessage: latestMessage[0] || null,
        };
      })
    );

    return conversationsWithCounts;
  } catch (error) {
    console.error('Error getting conversations:', error);
    throw error;
  }
}

/**
 * Get conversation by ID with paginated message history
 */
export async function getConversationById(
  conversationId: number,
  options?: {
    before?: Date;
    limit?: number;
  }
) {
  try {
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation || conversation.length === 0) {
      return null;
    }

    // Build message query with pagination
    const limit = options?.limit || 50;
    const beforeDate = options?.before;

    // Build where clause conditionally
    const whereConditions = beforeDate
      ? and(
          eq(messages.conversationId, conversationId),
          sql`${messages.timestamp} < ${beforeDate.toISOString()}`
        )
      : eq(messages.conversationId, conversationId);

    // Fetch limit + 1 to determine if there are more messages
    const messageHistory = await db
      .select()
      .from(messages)
      .where(whereConditions)
      .orderBy(desc(messages.timestamp))
      .limit(limit + 1);

    // Check if there are more messages beyond the limit
    const hasMore = messageHistory.length > limit;
    const messagesForResponse = hasMore ? messageHistory.slice(0, limit) : messageHistory;

    // Reverse to chronological order (oldest first)
    messagesForResponse.reverse();

    return {
      ...conversation[0],
      messages: messagesForResponse,
      hasMore,
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
      existingConversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.facebookSenderId, facebookSenderId),
            eq(conversations.status, 'active')
          )
        )
        .limit(1);
    } else if (isEmail && emailThreadId) {
      // Check for active email conversation with this thread ID
      existingConversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.emailThreadId, emailThreadId),
            eq(conversations.status, 'active')
          )
        )
        .limit(1);
    } else if (isEmail && emailAddress) {
      // Check for active email conversation with this email address (no thread ID yet)
      existingConversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.emailAddress, emailAddress),
            eq(conversations.status, 'active')
          )
        )
        .limit(1);
    } else {
      // Check if there's an active conversation for this phone
      existingConversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.customerPhone, customerPhone),
            eq(conversations.status, 'active')
          )
        )
        .limit(1);
    }

    if (existingConversation && existingConversation.length > 0) {
      return existingConversation[0];
    }

    // Try to find customer ID by phone or email (if available)
    let customerId: number | null = null;
    if (customerPhone) {
      const customer = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, customerPhone))
        .limit(1);

      if (customer && customer.length > 0) {
        customerId = customer[0].id;
      }
    } else if (emailAddress) {
      // Try to find customer by email
      const customer = await db
        .select()
        .from(customers)
        .where(eq(customers.email, emailAddress))
        .limit(1);

      if (customer && customer.length > 0) {
        customerId = customer[0].id;
      } else {
        // Auto-create customer record for email-only contacts
        const newCustomer = await db
          .insert(customers)
          .values({
            name: customerName || 'Email Customer',
            email: emailAddress,
            phone: null, // Email-only customer
            smsConsent: false,
          })
          .returning();
        
        customerId = newCustomer[0].id;
        console.log(`Created new email-only customer: ${emailAddress} (ID: ${customerId})`);
      }
    }

    // Create new conversation
    // Default to Main Line (ID 1) for SMS if phoneLineId not provided
    const effectivePhoneLineId = platform === 'sms' ? (phoneLineId || 1) : null;
    
    const newConversation = await db
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
      })
      .returning();

    // Broadcast new conversation to monitoring dashboard
    broadcastNewConversation(newConversation[0]);

    return newConversation[0];
  } catch (error) {
    console.error('Error getting or creating conversation:', error);
    throw error;
  }
}

/**
 * Add message to conversation
 */
export async function addMessage(
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
    
    const newMessage = await db.insert(messages).values({
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
      await db
        .update(conversations)
        .set({ 
          lastMessageTime: new Date(),
          unreadCount: sql`${conversations.unreadCount} + 1`,
        })
        .where(eq(conversations.id, conversationId));
    } else {
      // Agent or AI sent a message - reset unread count (agent has responded)
      await db
        .update(conversations)
        .set({ 
          lastMessageTime: new Date(),
          unreadCount: 0,
        })
        .where(eq(conversations.id, conversationId));
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
  conversationId: number,
  agentUsername: string
) {
  try {
    const updated = await db
      .update(conversations)
      .set({
        controlMode: 'manual',
        assignedAgent: agentUsername,
      })
      .where(eq(conversations.id, conversationId))
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
export async function handoffConversation(conversationId: number) {
  try {
    const updated = await db
      .update(conversations)
      .set({
        controlMode: 'auto',
        assignedAgent: null,
      })
      .where(eq(conversations.id, conversationId))
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
    const updated = await db
      .update(conversations)
      .set({
        behaviorSettings: behaviorSettings as any,
      })
      .where(eq(conversations.id, conversationId))
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
export async function pauseConversation(conversationId: number) {
  try {
    const updated = await db
      .update(conversations)
      .set({
        controlMode: 'paused',
      })
      .where(eq(conversations.id, conversationId))
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
export async function resumeConversation(conversationId: number) {
  try {
    const updated = await db
      .update(conversations)
      .set({
        controlMode: 'auto',
      })
      .where(eq(conversations.id, conversationId))
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
export async function closeConversation(conversationId: number) {
  try {
    const updated = await db
      .update(conversations)
      .set({
        status: 'closed',
        resolved: true,
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    // Broadcast conversation update
    broadcastConversationUpdate(updated[0]);

    return updated[0];
  } catch (error) {
    console.error('Error closing conversation:', error);
    throw error;
  }
}
