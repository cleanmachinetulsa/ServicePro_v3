/**
 * Audit T2 Task #20 — purge stale anonymous web-chat conversations.
 *
 * Even with the new defer-creation rule, anonymous conversations still
 * accumulate: every visitor who opens the widget and sends one message gets a
 * conversations row keyed on customer_phone = "web-chat-<webId>". 30 days
 * later, if the visitor never came back and never gave a phone/email, the row
 * is dead weight in the staff inbox.
 *
 * This script soft-deletes (status='closed', archived=true) those rows. It
 * never touches:
 *   - conversations with a customerId (identity was resolved)
 *   - conversations with a real customerPhone (no `web-chat-` prefix)
 *   - conversations linked to an appointment
 *   - conversations newer than the cutoff
 *
 * It is intentionally idempotent and tenant-aware (rows carry tenant_id).
 *
 * Wire-up: invoke from a daily cron when desired:
 *   import { cleanupStaleWebChatStubs } from './services/webChatCustomerCleanup';
 *   await cleanupStaleWebChatStubs({ olderThanDays: 30 });
 *
 * Can also be triggered as a one-shot from an admin route.
 */

import { db } from '../db';
import { conversations } from '@shared/schema';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';

export interface WebChatCleanupResult {
  scanned: number;
  closed: number;
  cutoff: string;
}

export async function cleanupStaleWebChatStubs(
  opts: { olderThanDays?: number; dryRun?: boolean } = {},
): Promise<WebChatCleanupResult> {
  const olderThanDays = opts.olderThanDays ?? 30;
  const dryRun = !!opts.dryRun;
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  // We deliberately use the raw `db` (not a tenantDb wrapper) so the cron can
  // sweep every tenant in one pass. The WHERE clause is tight enough on its
  // own — only anonymous web-chat handles with no identity, no appointment,
  // and last activity before the cutoff.
  const candidates = await db
    .select({
      id: conversations.id,
      tenantId: conversations.tenantId,
      customerPhone: conversations.customerPhone,
      lastMessageTime: conversations.lastMessageTime,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.platform, 'web'),
        isNull(conversations.customerId),
        isNull(conversations.appointmentId),
        sql`${conversations.customerPhone} LIKE 'web-chat-%'`,
        eq(conversations.status, 'active'),
        lt(conversations.lastMessageTime, cutoff),
      ),
    );

  if (candidates.length === 0 || dryRun) {
    return { scanned: candidates.length, closed: 0, cutoff: cutoff.toISOString() };
  }

  const ids = candidates.map((c) => c.id);
  const closed = await db
    .update(conversations)
    .set({ status: 'closed', archived: true, archivedAt: new Date() })
    .where(sql`${conversations.id} = ANY(${ids})`)
    .returning({ id: conversations.id });

  console.log(`[WEB CHAT CLEANUP] Closed ${closed.length} stub conversations older than ${olderThanDays}d (cutoff=${cutoff.toISOString()})`);
  return { scanned: candidates.length, closed: closed.length, cutoff: cutoff.toISOString() };
}
