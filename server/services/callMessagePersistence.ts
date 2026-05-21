/**
 * Comms Hub Stage 1: Voice as Message Persistence
 *
 * Persists inbound phone-call lifecycle events into the same `messages` table
 * that SMS already uses, so call activity shows up in the unified conversation
 * thread. This module is a *side effect* of the existing voice webhooks — it
 * MUST NOT throw, MUST NOT change TwiML, and MUST NOT block call routing.
 *
 * Three write points:
 *   1. persistCallArrival()         — inbound call hits /twilio/voice/incoming
 *   2. persistVoicemailComplete()   — recording-status webhook fires with a
 *                                     voicemail recording attached
 *   3. persistMissedCall()          — dial-status webhook fires with
 *                                     no-answer / busy / failed / canceled
 *
 * Thread resolution mirrors the voicemail path
 * (server/services/voicemailConversationService.ts): we use
 * `getOrCreateConversation()` keyed by the caller's `From` phone — the same
 * helper SMS uses — so a call from a phone we already have an SMS thread for
 * lands on that thread rather than spawning a duplicate.
 */

import { and, eq, ne, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { wrapTenantDb, type TenantDb } from '../tenantDb';
import { conversations, messages, tenantPhoneConfig, phoneLines } from '@shared/schema';
import { getOrCreateConversation } from '../conversationService';
import { broadcastNewMessage } from '../websocketService';

interface CallArrivalInput {
  callSid: string;
  from: string; // Caller (customer)
  to: string;   // Tenant's Twilio number
  tenantId: string;
}

interface VoicemailCompleteInput {
  callSid: string;
  from: string;
  to: string;
  recordingUrl?: string;
  recordingDuration?: number;
  recordingSid?: string;
  tenantId?: string; // optional override; otherwise resolved from `to`
}

interface MissedCallInput {
  callSid: string;
  from: string;
  to: string;
  dialCallStatus: string;
  tenantId: string;
}

interface OutboundCallInput {
  callSid: string;
  // The customer's phone number — the party staff dialed. Required to resolve the thread.
  customerPhone: string;
  // The tenant's Twilio number (used to derive phoneLineId and, if needed, tenantId).
  tenantPhone?: string;
  callStatus: string; // 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled'
  duration?: number;
  tenantId?: string; // optional override; otherwise resolved from tenantPhone
}

function isUsable(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.length > 0 && value !== 'Unknown';
}

function normalizeE164(phone: string | undefined | null): string | null {
  if (!phone) return null;
  let cleaned = phone.trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (hasPlus) return `+${cleaned}`;
  if (cleaned.length >= 10) return `+${cleaned}`;
  return null;
}

async function resolveTenantFromTo(to: string): Promise<string> {
  const normalized = normalizeE164(to);
  if (!normalized) return 'root';
  try {
    const [row] = await db
      .select({ tenantId: tenantPhoneConfig.tenantId })
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.phoneNumber, normalized))
      .limit(1);
    return row?.tenantId || 'root';
  } catch (err) {
    console.error('[CALL PERSIST] tenant resolve error:', err);
    return 'root';
  }
}

async function resolvePhoneLineId(tenantDb: TenantDb, to: string): Promise<number> {
  const normalized = normalizeE164(to);
  if (!normalized) return 1;
  try {
    const [line] = await tenantDb
      .select()
      .from(phoneLines)
      .where(
        tenantDb.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, normalized)),
      )
      .limit(1);
    return line?.id || 1;
  } catch {
    return 1;
  }
}

/**
 * Insert a message row directly (bypassing addMessage()) so we can stamp the
 * `messageType` discriminator and a custom metadata payload — addMessage()
 * has a fixed signature and was deliberately not modified to keep the SMS
 * path untouched.
 */
async function insertCallMessage(
  tenantDb: TenantDb,
  params: {
    conversationId: number;
    content: string;
    messageType: 'call_inbound' | 'call_missed' | 'voicemail' | 'call_outbound';
    metadata: Record<string, unknown>;
    phoneLineId: number;
    // Outbound calls are staff-initiated; default behavior keeps inbound semantics.
    fromCustomer?: boolean;
    sender?: 'customer' | 'staff';
  },
) {
  const [row] = await tenantDb
    .insert(messages)
    .values({
      conversationId: params.conversationId,
      content: params.content,
      sender: params.sender ?? 'customer',
      fromCustomer: params.fromCustomer ?? true,
      channel: 'voice',
      phoneLineId: params.phoneLineId,
      metadata: params.metadata,
      messageType: params.messageType,
    })
    .returning();

  // Bump the conversation activity timestamp so call rows surface in the
  // inbox sort order the same way an inbound SMS would.
  try {
    await tenantDb
      .update(conversations)
      .set({ lastMessageTime: new Date() })
      .where(
        tenantDb.withTenantFilter(conversations, eq(conversations.id, params.conversationId)),
      );
  } catch (err) {
    console.warn('[CALL PERSIST] lastMessageTime update failed (non-fatal):', err);
  }

  return row;
}

/**
 * WRITE POINT 1: An inbound call has arrived. Record the fact of the call.
 * This row may later be upgraded to 'voicemail' or 'call_missed' by the
 * downstream webhooks. Never throws — failures are logged only.
 */
export async function persistCallArrival(input: CallArrivalInput): Promise<void> {
  try {
    if (!isUsable(input.callSid) || !isUsable(input.from) || !isUsable(input.to)) {
      console.log('[CALL PERSIST] arrival skipped — missing CallSid/From/To', input);
      return;
    }

    const tenantDb = wrapTenantDb(db, input.tenantId);
    const { conversation } = await getOrCreateConversation(
      tenantDb,
      input.from,
      null,
      'sms', // platform stays 'sms' so the existing inbox grouping picks it up
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      await resolvePhoneLineId(tenantDb, input.to),
    );

    const phoneLineId = await resolvePhoneLineId(tenantDb, input.to);
    let row;
    try {
      row = await insertCallMessage(tenantDb, {
        conversationId: conversation.id,
        content: '📞 Inbound call',
        messageType: 'call_inbound',
        phoneLineId,
        metadata: {
          type: 'call_inbound',
          callSid: input.callSid,
          from: input.from,
          to: input.to,
          status: 'ringing',
          source: 'twilio',
        },
      });
    } catch (err: any) {
      // Twilio-retry idempotency: a duplicate call_inbound for the same
      // (tenantId, callSid) is rejected by the unique partial index added in
      // migration 0008. Treat that as a no-op success — the original row is
      // already on the thread and will still be picked up by the voicemail /
      // missed-call upgrade paths below.
      if (err?.code === '23505' || /duplicate key/i.test(String(err?.message))) {
        console.log(
          `[CALL PERSIST] arrival dedup — Twilio retry for CallSid=${input.callSid}, original row already persisted`,
        );
        return;
      }
      throw err;
    }

    try {
      broadcastNewMessage(conversation.id, row);
    } catch (err) {
      console.warn('[CALL PERSIST] broadcastNewMessage(arrival) failed:', err);
    }

    console.log(
      `[CALL PERSIST] arrival recorded — tenant=${input.tenantId} conv=${conversation.id} msg=${row.id} CallSid=${input.callSid}`,
    );
  } catch (err) {
    console.error('[CALL PERSIST] persistCallArrival error (fail-open):', err);
  }
}

/**
 * Look up the call-arrival row for a given CallSid using the GIN-friendly
 * jsonb expression index added in migration 0008. Returns null if not found.
 */
async function findArrivalRowByCallSid(tenantDb: TenantDb, callSid: string) {
  try {
    const rows = await tenantDb
      .select()
      .from(messages)
      .where(
        tenantDb.withTenantFilter(
          messages,
          sql`${messages.metadata}->>'callSid' = ${callSid}`,
        ),
      )
      .orderBy(desc(messages.id))
      .limit(1);
    return rows[0] || null;
  } catch (err) {
    console.error('[CALL PERSIST] findArrivalRowByCallSid error:', err);
    return null;
  }
}

/**
 * WRITE POINT 2: A voicemail recording is complete. Upgrade the arrival row
 * (or insert defensively if the arrival row is missing) to a voicemail
 * message. Never throws.
 */
export async function persistVoicemailComplete(input: VoicemailCompleteInput): Promise<void> {
  try {
    if (!isUsable(input.callSid)) {
      console.log('[CALL PERSIST] voicemail-complete skipped — missing CallSid');
      return;
    }

    const tenantId = input.tenantId || (await resolveTenantFromTo(input.to));
    const tenantDb = wrapTenantDb(db, tenantId);

    const existing = await findArrivalRowByCallSid(tenantDb, input.callSid);
    const newMetadata: Record<string, unknown> = {
      ...(existing?.metadata as Record<string, unknown> | null ?? {}),
      type: 'voicemail',
      callSid: input.callSid,
      from: input.from || (existing?.metadata as any)?.from,
      to: input.to || (existing?.metadata as any)?.to,
      status: 'completed',
      recordingUrl: input.recordingUrl ?? null,
      recordingDuration: input.recordingDuration ?? null,
      recordingSid: input.recordingSid ?? null,
      voicemailAt: new Date().toISOString(),
    };

    let row;
    let conversationId: number;
    if (existing) {
      const [updated] = await tenantDb
        .update(messages)
        .set({
          content: '📞 Voicemail left',
          messageType: 'voicemail',
          metadata: newMetadata,
        })
        .where(tenantDb.withTenantFilter(messages, eq(messages.id, existing.id)))
        .returning();
      row = updated;
      conversationId = existing.conversationId;
      console.log(
        `[CALL PERSIST] voicemail upgrade — tenant=${tenantId} conv=${conversationId} msg=${existing.id} CallSid=${input.callSid}`,
      );
    } else {
      // Defensive insert: arrival row went missing (early-arrival webhook lost,
      // server restarted between arrival and voicemail, etc.) Re-resolve thread
      // by caller phone so the voicemail still lands in the right place.
      if (!isUsable(input.from)) {
        console.warn('[CALL PERSIST] voicemail-complete defensive insert skipped — no From');
        return;
      }
      const phoneLineId = await resolvePhoneLineId(tenantDb, input.to);
      const { conversation } = await getOrCreateConversation(
        tenantDb,
        input.from,
        null,
        'sms',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        phoneLineId,
      );
      row = await insertCallMessage(tenantDb, {
        conversationId: conversation.id,
        content: '📞 Voicemail left',
        messageType: 'voicemail',
        metadata: newMetadata,
        phoneLineId,
      });
      conversationId = conversation.id;
      console.log(
        `[CALL PERSIST] voicemail defensive insert — tenant=${tenantId} conv=${conversationId} msg=${row.id} CallSid=${input.callSid}`,
      );
    }

    try {
      broadcastNewMessage(conversationId, row);
    } catch (err) {
      console.warn('[CALL PERSIST] broadcastNewMessage(voicemail) failed:', err);
    }
  } catch (err) {
    console.error('[CALL PERSIST] persistVoicemailComplete error (fail-open):', err);
  }
}

/**
 * WRITE POINT 3 (bonus): Dial-status webhook reports the call ended in
 * no-answer / busy / failed / canceled. Upgrade the arrival row to
 * 'call_missed' UNLESS it has already been upgraded to 'voicemail' (which
 * can happen if the recording-status webhook beat dial-status). Never throws.
 */
export async function persistMissedCall(input: MissedCallInput): Promise<void> {
  try {
    if (!isUsable(input.callSid)) return;

    const tenantDb = wrapTenantDb(db, input.tenantId);
    const existing = await findArrivalRowByCallSid(tenantDb, input.callSid);
    if (!existing) {
      console.log(
        `[CALL PERSIST] missed-call: no arrival row for CallSid=${input.callSid} — skipping`,
      );
      return;
    }
    if (existing.messageType === 'voicemail') {
      console.log(
        `[CALL PERSIST] missed-call: row already voicemail (CallSid=${input.callSid}) — not downgrading`,
      );
      return;
    }

    const mergedMetadata = {
      ...((existing.metadata as Record<string, unknown> | null) ?? {}),
      status: input.dialCallStatus,
      missedAt: new Date().toISOString(),
    };

    // Atomic guard against the TOCTOU race with persistVoicemailComplete():
    // if a voicemail webhook lands between our SELECT above and this UPDATE,
    // the `ne(messageType, 'voicemail')` predicate makes the UPDATE a no-op
    // so we never downgrade a real voicemail to a missed-call marker.
    const updatedRows = await tenantDb
      .update(messages)
      .set({
        content: '📞 Missed call',
        messageType: 'call_missed',
        metadata: mergedMetadata,
      })
      .where(
        tenantDb.withTenantFilter(
          messages,
          and(eq(messages.id, existing.id), ne(messages.messageType, 'voicemail')),
        ),
      )
      .returning();

    if (updatedRows.length === 0) {
      console.log(
        `[CALL PERSIST] missed-call: row was concurrently upgraded to voicemail (CallSid=${input.callSid}) — skipping broadcast`,
      );
      return;
    }
    const updated = updatedRows[0];

    try {
      broadcastNewMessage(existing.conversationId, updated);
    } catch (err) {
      console.warn('[CALL PERSIST] broadcastNewMessage(missed) failed:', err);
    }

    console.log(
      `[CALL PERSIST] missed-call recorded — tenant=${input.tenantId} conv=${existing.conversationId} msg=${existing.id} CallSid=${input.callSid} status=${input.dialCallStatus}`,
    );
  } catch (err) {
    console.error('[CALL PERSIST] persistMissedCall error (fail-open):', err);
  }
}

/**
 * WRITE POINT 4 (Comms Hub Stage 4): An outbound call placed by staff has
 * reached terminal status. Record it as a 'call_outbound' row on the
 * customer's thread so two-way call activity is visible in the unified inbox.
 *
 * Triggers from two sources:
 *   - /twilio/voice/outbound-status (configured on the Twilio number for
 *     Groundwire/SIP-originated calls)
 *   - existing click-to-call status callbacks in routes.twilioVoice.ts and
 *     routes.voiceWebhook.ts (parent-leg terminal status)
 *
 * Fail-open: never throws. Skips silently on bad input or duplicate.
 */
export async function persistOutboundCall(input: OutboundCallInput): Promise<void> {
  try {
    if (!isUsable(input.callSid) || !isUsable(input.customerPhone)) {
      console.log('[CALL PERSIST] outbound skipped — missing CallSid/customerPhone', {
        callSid: input.callSid,
      });
      return;
    }

    // Only persist on terminal status — ignore intermediate 'initiated' /
    // 'ringing' / 'answered' callbacks so we write exactly one row per call.
    const terminal = new Set(['completed', 'no-answer', 'busy', 'failed', 'canceled']);
    if (!terminal.has(input.callStatus)) {
      return;
    }

    const tenantId =
      input.tenantId ||
      (input.tenantPhone ? await resolveTenantFromTo(input.tenantPhone) : 'root');
    const tenantDb = wrapTenantDb(db, tenantId);

    // Dedup: if an outbound row already exists for this CallSid, skip.
    const existing = await findArrivalRowByCallSid(tenantDb, input.callSid);
    if (existing && existing.messageType === 'call_outbound') {
      console.log(
        `[CALL PERSIST] outbound dedup — CallSid=${input.callSid} already recorded`,
      );
      return;
    }

    const normalizedCustomer = normalizeE164(input.customerPhone) || input.customerPhone;
    const phoneLineId = input.tenantPhone
      ? await resolvePhoneLineId(tenantDb, input.tenantPhone)
      : 1;

    const { conversation } = await getOrCreateConversation(
      tenantDb,
      normalizedCustomer,
      null,
      'sms',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      phoneLineId,
    );

    const content =
      input.callStatus === 'completed'
        ? '📞 Outbound call'
        : `📞 Outbound call — ${input.callStatus}`;

    let row;
    try {
      row = await insertCallMessage(tenantDb, {
        conversationId: conversation.id,
        content,
        messageType: 'call_outbound',
        phoneLineId,
        sender: 'staff',
        fromCustomer: false,
        metadata: {
          type: 'call_outbound',
          callSid: input.callSid,
          direction: 'outbound',
          from: input.tenantPhone ?? null,
          to: normalizedCustomer,
          status: input.callStatus,
          duration: typeof input.duration === 'number' ? input.duration : null,
          source: 'twilio',
        },
      });
    } catch (err: any) {
      // Twilio-retry idempotency: a duplicate call_outbound for the same
      // (tenantId, callSid) is rejected by the unique partial index added
      // in migration 0010. Treat that as a no-op success — the original
      // row is already on the thread.
      if (err?.code === '23505' || /duplicate key/i.test(String(err?.message))) {
        console.log(
          `[CALL PERSIST] outbound dedup (db) — Twilio retry for CallSid=${input.callSid}, original row already persisted`,
        );
        return;
      }
      throw err;
    }

    try {
      broadcastNewMessage(conversation.id, row);
    } catch (err) {
      console.warn('[CALL PERSIST] broadcastNewMessage(outbound) failed:', err);
    }

    console.log(
      `[CALL PERSIST] outbound recorded — tenant=${tenantId} conv=${conversation.id} msg=${row.id} CallSid=${input.callSid} status=${input.callStatus}`,
    );
  } catch (err) {
    console.error('[CALL PERSIST] persistOutboundCall error (fail-open):', err);
  }
}
