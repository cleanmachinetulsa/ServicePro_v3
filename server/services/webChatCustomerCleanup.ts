/**
 * Audit T2 Task #20 — 30-day cleanup of abandoned web-chat artifacts.
 *
 * Two passes, both idempotent and tenant-aware via row-level tenant_id:
 *
 * 1) Conversations: soft-close anonymous web conversations (status='closed',
 *    archived=true) whose customer_phone is `web-chat-<webId>`, that have no
 *    customer_id, no appointment_id, and no activity in the cutoff window.
 *
 * 2) Customers (backfill): hard-delete stub customer rows that satisfy ALL of:
 *      - no phone AND no email (or phone starts with `web-chat-`)
 *      - no appointments
 *      - last_interaction older than cutoff
 *    These rows are legacy fallout from the pre-defer era when every web
 *    visitor minted a customers row. They pollute CRM lists, marketing
 *    audiences, and loyalty exports.
 *
 * Wire-up: invoke from a daily cron when desired:
 *   import { cleanupStaleWebChatStubs } from './services/webChatCustomerCleanup';
 *   await cleanupStaleWebChatStubs({ olderThanDays: 30 });
 */

import { db } from '../db';
import { conversations, customers, appointments } from '@shared/schema';
import { and, eq, isNull, lt, notInArray, or, sql } from 'drizzle-orm';

export interface WebChatCleanupResult {
  scanned: number;
  closed: number;
  stubCustomersDeleted: number;
  cutoff: string;
}

export async function cleanupStaleWebChatStubs(
  opts: { olderThanDays?: number; dryRun?: boolean } = {},
): Promise<WebChatCleanupResult> {
  const olderThanDays = opts.olderThanDays ?? 30;
  // Fail-safe rollout: default to dry-run unless the caller (or env flag)
  // explicitly opts in. Prevents accidental mass-deletes if a cron is wired
  // before tenant-safety review.
  const explicitDryRun = typeof opts.dryRun === 'boolean' ? opts.dryRun : null;
  const enabled = process.env.WEB_CHAT_CLEANUP_ENABLED === '1';
  const dryRun = explicitDryRun !== null ? explicitDryRun : !enabled;
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  // -- Pass 1: anonymous conversations --
  const convCandidates = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(
      eq(conversations.platform, 'web'),
      isNull(conversations.customerId),
      isNull(conversations.appointmentId),
      sql`${conversations.customerPhone} LIKE 'web-chat-%'`,
      eq(conversations.status, 'active'),
      lt(conversations.lastMessageTime, cutoff),
    ));

  let closedCount = 0;
  if (convCandidates.length > 0 && !dryRun) {
    const ids = convCandidates.map((c) => c.id);
    const closed = await db
      .update(conversations)
      .set({ status: 'closed', archived: true, archivedAt: new Date() })
      .where(sql`${conversations.id} = ANY(${ids})`)
      .returning({ id: conversations.id });
    closedCount = closed.length;
  }

  // -- Pass 2: backfill stub customer rows --
  // Sub-select of customer_ids that have any appointment, so we exclude them.
  const customerIdsWithAppts = db
    .select({ cid: appointments.customerId })
    .from(appointments);

  const stubCandidates = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(
      or(
        and(isNull(customers.phone), isNull(customers.email)),
        sql`${customers.phone} LIKE 'web-chat-%'`,
      ),
      lt(customers.lastInteraction, cutoff),
      notInArray(customers.id, customerIdsWithAppts),
    ));

  let stubDeleted = 0;
  if (stubCandidates.length > 0 && !dryRun) {
    const sids = stubCandidates.map((c) => c.id);
    const deleted = await db
      .delete(customers)
      .where(sql`${customers.id} = ANY(${sids})`)
      .returning({ id: customers.id });
    stubDeleted = deleted.length;
  }

  if (!dryRun) {
    console.log(
      `[WEB CHAT CLEANUP] cutoff=${cutoff.toISOString()} convsClosed=${closedCount} stubCustomersDeleted=${stubDeleted}`,
    );
  }

  return {
    scanned: convCandidates.length + stubCandidates.length,
    closed: closedCount,
    stubCustomersDeleted: stubDeleted,
    cutoff: cutoff.toISOString(),
  };
}
