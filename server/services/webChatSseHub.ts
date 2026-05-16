/**
 * Audit T2 Task #20 — in-process SSE fan-out for web-chat widgets.
 *
 * The staff messaging center is already wired to Socket.IO. Customers using
 * the public widget can't (and shouldn't) join the authenticated socket bus,
 * so we mirror the three events they care about — agent-sent message, staff
 * takeover, and staff typing — onto a per-conversation SSE channel.
 *
 * Source-of-truth is still websocketService.ts; the broadcast helpers there
 * call pushWebChatEvent(conversationId, ...) after their normal Socket.IO
 * emit. If no widget is listening on that conversation, this is a no-op.
 */

import type { Response } from 'express';

export type WebChatSseEvent =
  | { type: 'taken_over'; agent: string | null; controlMode: 'manual' | 'paused' | 'auto' | string }
  | { type: 'handed_back' }
  | { type: 'typing'; isTyping: boolean; username?: string }
  | { type: 'message'; id: number | string; content: string; sender: 'agent' | 'ai' | string; timestamp: string };

const clients = new Map<number, Set<Response>>();

export function registerWebChatClient(conversationId: number, res: Response): () => void {
  if (!clients.has(conversationId)) clients.set(conversationId, new Set());
  const set = clients.get(conversationId)!;
  set.add(res);
  return () => {
    set.delete(res);
    if (set.size === 0) clients.delete(conversationId);
  };
}

export function pushWebChatEvent(conversationId: number, event: WebChatSseEvent): void {
  const set = clients.get(conversationId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch (err) {
      // Broken pipe — drop the client; the close handler will clean up.
      try { set.delete(res); } catch { /* noop */ }
    }
  }
}

export function webChatClientCount(conversationId?: number): number {
  if (typeof conversationId === 'number') return clients.get(conversationId)?.size ?? 0;
  let n = 0;
  for (const s of clients.values()) n += s.size;
  return n;
}
