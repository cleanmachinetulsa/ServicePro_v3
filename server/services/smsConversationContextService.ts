/**
 * SMS Conversation Context Builder
 * 
 * CANONICAL function for building LLM context from conversation history.
 * Ensures consistent, deterministic context assembly with deep logging.
 * 
 * Fixes "SMS agent forgetting" by:
 * 1. Loading full conversation history with deduplication
 * 2. Detailed logging of loaded messages and context
 * 3. Detecting suspicious gaps in conversation history
 */

import { messages as messagesTable } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';

export interface SmsConversationContext {
  conversationId: number;
  tenantId: string;
  normalizedPhones: {
    fromPhone: string;
    toPhone: string;
  };
  recentMessages: Array<{
    content: string;
    role: 'user' | 'assistant';
    sender: string;
    timestamp: Date;
  }>;
  messageTranscript: string;
  behaviorSettingsSummary: Record<string, any>;
  loadedMessageCount: number;
  firstMessageTime: Date | null;
  lastMessageTime: Date | null;
}

/**
 * Build comprehensive context for SMS LLM call
 * 
 * @param params.tenantId - Tenant ID
 * @param params.conversationId - Conversation ID
 * @param params.fromPhone - Customer phone (normalized)
 * @param params.toPhone - Business phone
 * @param params.tenantDb - Tenant database connection
 * @param params.behaviorSettings - Conversation behavior settings (optional)
 * @param params.sessionStartedAt - Session start timestamp (only include messages after this)
 * @returns Complete context ready for LLM
 */
export async function buildSmsLlmContext(
  params: {
    tenantId: string;
    conversationId: number;
    fromPhone: string;
    toPhone: string;
    tenantDb: any;
    behaviorSettings?: Record<string, any>;
    sessionStartedAt?: number; // Unix timestamp - filter messages to current session
  }
): Promise<SmsConversationContext> {
  const { tenantId, conversationId, fromPhone, toPhone, tenantDb, behaviorSettings, sessionStartedAt } = params;
  
  // === Load conversation history ===
  const allMessages = await tenantDb
    .select()
    .from(messagesTable)
    .where(tenantDb.withTenantFilter(messagesTable, eq(messagesTable.conversationId, conversationId)))
    .orderBy(asc(messagesTable.timestamp));
  
  // === Deduplicate messages (keep last occurrence) ===
  const seenContentMap = new Map<string, typeof allMessages[0]>();
  for (const msg of allMessages) {
    const key = `${msg.sender}:${msg.content}:${msg.timestamp.getTime()}`;
    seenContentMap.set(key, msg);
  }
  
  const deduplicatedMessages = Array.from(seenContentMap.values())
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // === SESSION BOUNDARY: Enforce strict session windowing ===
  // Only include messages from current session - NO pre-session continuity
  // This prevents old booking info from poisoning new sessions
  let filteredMessages = deduplicatedMessages;
  if (sessionStartedAt && sessionStartedAt > 0) {
    const sessionStart = new Date(sessionStartedAt);
    
    // STRICT: Only messages after session start
    filteredMessages = deduplicatedMessages.filter((m: any) => m.timestamp >= sessionStart);
    
    // If session yields <4 messages, fall back to last 8 messages (still strict - no pre-session)
    if (filteredMessages.length < 4) {
      filteredMessages = deduplicatedMessages.slice(-8);
      console.log(`[SMS SESSION] context_window_start=${sessionStart.toISOString()} insufficient_session_msgs=${filteredMessages.length} fallback_to_last_8`);
    } else {
      console.log(`[SMS SESSION] context_window_start=${sessionStart.toISOString()} session_messages=${filteredMessages.length}`);
    }
  }
  
  // === Format messages for LLM ===
  const recentMessages = filteredMessages.map((msg: typeof messagesTable.$inferSelect) => ({
    content: msg.content,
    role: msg.sender === 'customer' ? ('user' as const) : ('assistant' as const),
    sender: msg.sender,
    timestamp: msg.timestamp,
  }));
  
  // === Build transcript for context ===
  const transcriptLines: string[] = [];
  for (const msg of recentMessages) {
    const senderLabel = msg.role === 'user' ? 'Customer' : 'AI';
    transcriptLines.push(`[${msg.timestamp.toISOString()}] ${senderLabel}: ${msg.content}`);
  }
  const messageTranscript = transcriptLines.join('\n');
  
  // === Gather timestamps ===
  const firstMessageTime = recentMessages.length > 0 ? recentMessages[0].timestamp : null;
  const lastMessageTime = recentMessages.length > 0 ? recentMessages[recentMessages.length - 1].timestamp : null;
  
  // === Log context details at INFO level ===
  console.log(
    `[SMS CONTEXT] tenant=${tenantId} conv=${conversationId} from=${fromPhone} to=${toPhone}`
  );
  console.log(
    `[SMS CONTEXT] loaded_messages=${recentMessages.length} first_ts=${firstMessageTime?.toISOString() || 'N/A'} last_ts=${lastMessageTime?.toISOString() || 'N/A'}`
  );
  
  // === Log last 3 messages preview ===
  if (recentMessages.length > 0) {
    const last3 = recentMessages.slice(-3);
    const previews = last3
      .map((m) => `${m.role}: ${m.content.substring(0, 60).replace(/\n/g, ' ')}`)
      .join(' | ');
    console.log(`[SMS CONTEXT] last_3_messages_preview=${previews}`);
  }
  
  // === Log behavior settings keys ===
  if (behaviorSettings && Object.keys(behaviorSettings).length > 0) {
    const settingsKeys = Object.keys(behaviorSettings);
    console.log(`[SMS CONTEXT] behaviorSettings_keys=${settingsKeys.join(', ')}`);
  }
  
  // === Guardrail: Suspicious history ===
  if (recentMessages.length <= 1 && lastMessageTime) {
    // If we have a recent conversation but almost no history, that's suspicious
    const minutesSinceLastMsg = (Date.now() - lastMessageTime.getTime()) / (1000 * 60);
    if (minutesSinceLastMsg < 30) {
      console.warn(
        `[SMS CONTEXT WARN] suspicious_history tenant=${tenantId} conv=${conversationId} from=${fromPhone} to=${toPhone} messages=${recentMessages.length}`
      );
    }
  }
  
  return {
    conversationId,
    tenantId,
    normalizedPhones: {
      fromPhone,
      toPhone,
    },
    recentMessages,
    messageTranscript,
    behaviorSettingsSummary: behaviorSettings || {},
    loadedMessageCount: recentMessages.length,
    firstMessageTime,
    lastMessageTime,
  };
}

/**
 * Format context for logging/debugging
 */
export function formatContextForLogging(context: SmsConversationContext): string {
  return [
    `Conversation ID: ${context.conversationId}`,
    `Messages loaded: ${context.loadedMessageCount}`,
    `Time range: ${context.firstMessageTime?.toISOString() || 'N/A'} to ${context.lastMessageTime?.toISOString() || 'N/A'}`,
    `Behavior settings: ${Object.keys(context.behaviorSettingsSummary).join(', ') || 'none'}`,
  ].join('\n');
}
