/**
 * Audit T3 Task #23: AI guardrail pill — capture the tool names invoked
 * during the most recent generateAIResponse call for a given conversation,
 * so the caller can persist them onto messages.metadata.toolCalls when the
 * assistant message is written.
 *
 * Module-level Map keyed by conversationId. Bounded so a runaway test or
 * a never-flushed conversation cannot grow it indefinitely.
 */

const MAX_ENTRIES = 500;
const recent: Map<number, { tools: string[]; at: number }> = new Map();

export function recordToolCallForConversation(conversationId: number | undefined, toolName: string): void {
  if (typeof conversationId !== 'number' || !Number.isFinite(conversationId)) return;
  const existing = recent.get(conversationId);
  const tools = existing ? [...existing.tools, toolName] : [toolName];
  recent.set(conversationId, { tools, at: Date.now() });
  if (recent.size > MAX_ENTRIES) {
    // Drop oldest
    const oldestKey = Array.from(recent.entries()).sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldestKey !== undefined) recent.delete(oldestKey);
  }
}

export function takeToolCallsForConversation(conversationId: number | undefined): string[] {
  if (typeof conversationId !== 'number' || !Number.isFinite(conversationId)) return [];
  const entry = recent.get(conversationId);
  recent.delete(conversationId);
  return entry ? entry.tools : [];
}

export function peekToolCallsForConversation(conversationId: number | undefined): string[] {
  if (typeof conversationId !== 'number' || !Number.isFinite(conversationId)) return [];
  return recent.get(conversationId)?.tools ?? [];
}

/** Test helper */
export function _resetToolMetadata(): void {
  recent.clear();
}
