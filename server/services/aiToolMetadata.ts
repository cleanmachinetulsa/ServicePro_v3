/**
 * Audit T3 Task #23: AI guardrail pill — capture the tool calls invoked
 * during the most recent generateAIResponse call for a given conversation,
 * so the caller can persist them onto messages.metadata when the assistant
 * message is written.
 *
 * Stores {name, args} so the AI replay page can surface arguments too.
 */

export interface CapturedToolCall {
  name: string;
  args?: Record<string, unknown> | null;
}

const MAX_ENTRIES = 500;
const recent: Map<number, { calls: CapturedToolCall[]; at: number }> = new Map();

export function recordToolCallForConversation(
  conversationId: number | undefined,
  toolName: string,
  args?: Record<string, unknown> | null,
): void {
  if (typeof conversationId !== 'number' || !Number.isFinite(conversationId)) return;
  const existing = recent.get(conversationId);
  const call: CapturedToolCall = { name: toolName, args: args ?? null };
  const calls = existing ? [...existing.calls, call] : [call];
  recent.set(conversationId, { calls, at: Date.now() });
  if (recent.size > MAX_ENTRIES) {
    const oldestKey = Array.from(recent.entries()).sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldestKey !== undefined) recent.delete(oldestKey);
  }
}

export function takeToolCallsForConversation(conversationId: number | undefined): CapturedToolCall[] {
  if (typeof conversationId !== 'number' || !Number.isFinite(conversationId)) return [];
  const entry = recent.get(conversationId);
  recent.delete(conversationId);
  return entry ? entry.calls : [];
}

export function peekToolCallsForConversation(conversationId: number | undefined): CapturedToolCall[] {
  if (typeof conversationId !== 'number' || !Number.isFinite(conversationId)) return [];
  return recent.get(conversationId)?.calls ?? [];
}

/** Test helper */
export function _resetToolMetadata(): void {
  recent.clear();
}
