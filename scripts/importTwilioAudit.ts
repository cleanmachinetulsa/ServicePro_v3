#!/usr/bin/env tsx
/**
 * Twilio Audit Import — STOP-list ingestion + missed-comm backfill.
 *
 * Standalone, one-off importer. It is NOT wired into any request path and must
 * never be imported by the running server. It reuses the same persistence
 * primitives the live writers use (findOrCreateCustomer, findOrCreateThread,
 * sms_inbound_dedup, call_events) but writes rows DIRECTLY and QUIETLY — it does
 * not call addMessage / getOrCreateConversation, because those broadcast
 * websocket events that would flood the live Clean Machine inbox with hundreds
 * of fake "new message" / "new conversation" popups.
 *
 * What it does, for tenant 'root' (Clean Machine), over the audit window:
 *   1. Run ledger: refuses to silently double-import (import_runs.run_key).
 *   2. STOP opt-out: mirrors the live STOP handler for every number that texted
 *      a STOP keyword — customers.sms_consent=false, conversations.sms_opt_out
 *      =true, sms_suppression_list upsert (reason='opt_out'). Unknown numbers
 *      get a lightweight customer row tagged import_source='twilio_audit'.
 *   3. Inbound SMS backfill: every inbound message, deduped on
 *      sms_inbound_dedup.message_sid, with a secondary content+timestamp guard
 *      (because the dedup table predates older traffic and `messages` stores no
 *      Twilio SID, so dedup alone cannot catch pre-dedup rows).
 *   4. Calls + voicemails backfill: every inbound call as a call_events row
 *      (call_sid UNIQUE → idempotent). Calls with a recording are counted as
 *      voicemails; recording URL + (best-effort) transcription are attached.
 *
 * Usage:
 *   tsx scripts/importTwilioAudit.ts --dry-run     # report only, zero writes
 *   tsx scripts/importTwilioAudit.ts               # real run
 *   tsx scripts/importTwilioAudit.ts --force       # re-run despite ledger
 *
 * Per-row try/catch: a single bad row is logged, tallied, and skipped — it can
 * never throw into payment/booking/auth (this script shares no code with them).
 */

import { mkdirSync, writeFileSync } from 'fs';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../server/db';
import { wrapTenantDb } from '../server/tenantDb';
import { getTwilioClient, assertTwilioReady } from '../server/twilioClient';
import { checkConsentKeyword } from '../server/smsConsentService';
import { findOrCreateCustomer } from '../server/services/customerIdentityService';
import { findOrCreateThread, attachConversationToThread } from '../server/services/customerThreadService';
import {
  customers,
  conversations,
  messages,
  callEvents,
  smsInboundDedup,
  smsSuppressionList,
  importRuns,
  phoneLines,
} from '@shared/schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_ID = 'root';
const RUN_KEY = 'twilio_audit_2025-05-30_2026-05-30_run1';
const WINDOW_START = new Date('2025-05-30T00:00:00.000Z');
const WINDOW_END = new Date('2026-05-31T00:00:00.000Z'); // exclusive upper bound
const UNKNOWN_NAME = 'Unknown (opted out — twilio_audit import)';
const IMPORT_SOURCE = 'twilio_audit';
const DUP_WINDOW_MS = 120_000; // ±2 min content/timestamp match for SMS dup guard

// The business's own Twilio lines (from phone_lines). Inbound traffic whose
// `from` is one of these is an internal/inter-line leg or an alert — NOT a real
// customer. Importing it would create bogus "customer" rows for the business's
// own numbers, so it is skipped and tallied separately.
const BUSINESS_NUMBERS = new Set<string>([
  '+19188565304', // Main Business Line
  '+19188565711', // Jody's Business Line
  '+19182820103', // Urgent Alerts
]);

// Automated-noise handling. Verification codes, OTPs, and shortcode senders are
// services, never people: their messages are still imported (audit trail) into a
// single labeled bucket conversation and tagged, but they NEVER create a
// per-sender customer and NEVER touch the suppression list.
const NOISE_BUCKET_NAME = 'Automated Noise (twilio_audit) — DO NOT CONTACT';
const NOISE_IMPORT_FLAG = 'automated_noise';

// A real customer phone must be E.164: '+' then 10–15 digits. Anything else —
// 5-digit shortcodes (22395, 89887), 6-digit (622-XX), alphanumeric sender IDs —
// is a service, not a person.
function isShortcodeOrNonE164(from: string): boolean {
  return !/^\+\d{10,15}$/.test((from || '').trim());
}

// STRONG, phrase-based OTP/verification patterns. These are extremely unlikely
// to appear in a genuine customer message, so a SINGLE match is safe enough to
// bucket that one message even when the sender is otherwise a real E.164 number
// (the customer is still created from their other, real messages).
const NOISE_BODY_STRONG: RegExp[] = [
  /verification code/i,
  /verify your account/i,
  /your code is/i,
  /is your.{0,20}code/i,
  /your.{0,20}code is/i,
  /google verification/i,
  /google voice/i,
  /\bG-\d{4,8}\b/, // Google-style G-123456
  /\b\d{4,8}\s+is your\b/i,
];

// WEAK signal: a bare 4–8 digit body. Real customers legitimately send gate/door
// codes as bare digits, so this NEVER buckets a single message from a real
// E.164 number on its own — it only contributes to the whole-number "every
// message this number ever sent was noise" aggregation in buildNoiseClassifier.
const NOISE_BODY_WEAK: RegExp[] = [/^\s*\d{4,8}\s*$/];

function isNoiseBodyStrong(body: string): boolean {
  const b = (body || '').trim();
  if (!b) return false;
  return NOISE_BODY_STRONG.some((re) => re.test(b));
}

// Full match (strong OR weak). Used ONLY for per-number aggregation, never for
// single-message bucketing of an E.164 sender.
function isNoiseBody(body: string): boolean {
  const b = (body || '').trim();
  if (!b) return false;
  return isNoiseBodyStrong(b) || NOISE_BODY_WEAK.some((re) => re.test(b));
}

interface NoiseClassifier {
  // Whole numbers treated as automation: structural shortcode OR every message
  // they ever sent (in-window) matched a noise body pattern.
  automationNumbers: Set<string>;
  // Subset that LOOK like real E.164 numbers but were flagged only because all
  // their bodies were noise — these are the uncertain ones a human should review.
  borderlineNumbers: Set<string>;
}

// Build the classifier from the full inbound-SMS set in one pass so we can apply
// the "only ever sent shortcode-style messages → automation" rule per number.
function buildNoiseClassifier(inboundSms: InboundSms[]): NoiseClassifier {
  const bodiesByNumber = new Map<string, string[]>();
  for (const m of inboundSms) {
    if (!m.from || BUSINESS_NUMBERS.has(m.from)) continue;
    const arr = bodiesByNumber.get(m.from);
    if (arr) arr.push(m.body);
    else bodiesByNumber.set(m.from, [m.body]);
  }
  const automationNumbers = new Set<string>();
  const borderlineNumbers = new Set<string>();
  for (const [from, bodies] of bodiesByNumber) {
    const structural = isShortcodeOrNonE164(from);
    const allBodiesNoise = bodies.length > 0 && bodies.every((b) => isNoiseBody(b));
    if (structural || allBodiesNoise) {
      automationNumbers.add(from);
      if (!structural && allBodiesNoise) borderlineNumbers.add(from); // looks human, all-noise
    }
  }
  return { automationNumbers, borderlineNumbers };
}

// Per-message decision. A mixed number (some real, some noise) keeps its real
// messages on the normal path (and creates the customer) while only its
// noise-body messages get bucketed.
function classifySmsNoise(
  nc: NoiseClassifier,
  from: string,
  body: string,
): { noise: boolean; reason: string } {
  if (nc.automationNumbers.has(from)) {
    return { noise: true, reason: isShortcodeOrNonE164(from) ? 'shortcode' : 'all_bodies_noise' };
  }
  // Single-message bucketing on an otherwise-real number uses STRONG phrases
  // only — bare-digit bodies are intentionally NOT enough on their own.
  if (isNoiseBodyStrong(body)) return { noise: true, reason: 'noise_body' };
  return { noise: false, reason: '' };
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
interface Options {
  dryRun: boolean;
  force: boolean;
  fetchTranscriptions: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    fetchTranscriptions: !args.includes('--no-transcriptions'),
  };
}

// ---------------------------------------------------------------------------
// Tally / sample collection
// ---------------------------------------------------------------------------
interface Totals {
  stopsNew: number;
  stopsAlreadySuppressedSkipped: number;
  customersCreated: number;
  callsImported: number;
  voicemailsImported: number;
  smsImported: number;
  smsDedupSkipped: number;
  smsLikelyDuplicateSkipped: number;
  callsAlreadyImportedSkipped: number;
  businessNumberSkipped: number;
  noiseMessagesFiltered: number; // SMS+calls routed to the noise bucket (no customer)
  noiseNumbers: number; // distinct automation senders
  borderlineForReview: number; // distinct E.164 numbers flagged as automation (uncertain)
  // Breakdown of customersCreated by the surface that first introduced the number.
  customersFromStop: number;
  customersFromSms: number;
  customersFromCall: number;
  errors: number;
}

const totals: Totals = {
  stopsNew: 0,
  stopsAlreadySuppressedSkipped: 0,
  customersCreated: 0,
  callsImported: 0,
  voicemailsImported: 0,
  smsImported: 0,
  smsDedupSkipped: 0,
  smsLikelyDuplicateSkipped: 0,
  callsAlreadyImportedSkipped: 0,
  businessNumberSkipped: 0,
  noiseMessagesFiltered: 0,
  noiseNumbers: 0,
  borderlineForReview: 0,
  customersFromStop: 0,
  customersFromSms: 0,
  customersFromCall: 0,
  errors: 0,
};

const SAMPLE_CAP = 10;
const samples: Record<string, string[]> = {
  stopsNew: [],
  stopsAlreadySuppressedSkipped: [],
  customersCreated: [],
  callsImported: [],
  voicemailsImported: [],
  smsImported: [],
  businessNumberSkipped: [],
  noiseFiltered: [],
  borderlineReview: [],
  errors: [],
};

function sample(key: keyof typeof samples, line: string) {
  if (samples[key].length < SAMPLE_CAP) samples[key].push(line);
}

// Mask all but the last 4 digits for console noise; the written report keeps
// full numbers because it is the owner's own data and they must follow up.
function mask(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  return phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4);
}

// ---------------------------------------------------------------------------
// Quiet conversation/thread resolution (no websocket broadcast)
// ---------------------------------------------------------------------------
const tenantDb = wrapTenantDb(db, TENANT_ID);

// In-memory snapshot of existing DB state, loaded once up front so the hot
// loops do NOT make a Neon round-trip per row (631 SMS + 288 calls would
// otherwise be thousands of sequential queries). The DB constraints
// (unique dedup SID, unique call_sid, unique tenant+phone) remain the source
// of truth on writes; these sets are just a fast pre-filter.
interface Preload {
  dedupSids: Set<string>;
  customerPhones: Set<string>;
  activeSmsConvByPhone: Map<string, number>;
  // `${phone}|${content}` -> sorted-ish list of inbound message epoch-ms. Used by
  // the secondary dup guard to match within a true ±DUP_WINDOW_MS window
  // (legacy `messages` rows carry no Twilio SID, so SID dedup can't catch them).
  inboundMsgTimes: Map<string, number[]>;
  callSids: Set<string>;
  phoneLineByNumber: Map<string, number>; // E.164 -> phone_lines.id (mirrors live resolvePhoneLineId)
  // Lazily-resolved id of the single "Automated Noise" bucket conversation.
  // Populated from an existing bucket during preload (re-run safe) or created on
  // first noise message during a live run.
  noiseBucketConvId: number | null;
}

function msgContentKey(phone: string, content: string): string {
  return `${phone}|${(content || '').trim()}`;
}

function recordInboundMsg(pre: Preload, phone: string, content: string, t: Date): void {
  const key = msgContentKey(phone, content);
  const arr = pre.inboundMsgTimes.get(key);
  if (arr) arr.push(t.getTime());
  else pre.inboundMsgTimes.set(key, [t.getTime()]);
}

function hasNearbyMsg(pre: Preload, phone: string, content: string, t: Date): boolean {
  const arr = pre.inboundMsgTimes.get(msgContentKey(phone, content));
  if (!arr) return false;
  const ms = t.getTime();
  return arr.some((existing) => Math.abs(existing - ms) <= DUP_WINDOW_MS);
}

// Mirror live resolvePhoneLineId(): map the inbound `to` number to its phone
// line id, defaulting to 1 (Main) when unresolved — never hardcode the line.
function resolveLineId(pre: Preload, to: string | null | undefined): number {
  if (!to) return 1;
  return pre.phoneLineByNumber.get(to) ?? 1;
}

async function preload(): Promise<Preload> {
  const dedupRows = await db.select({ sid: smsInboundDedup.messageSid }).from(smsInboundDedup);
  const custRows = await tenantDb
    .select({ phone: customers.phone })
    .from(customers)
    .where(tenantDb.withTenantFilter(customers, isNotNull(customers.phone)));
  const convRows = await tenantDb
    .select({ id: conversations.id, phone: conversations.customerPhone })
    .from(conversations)
    .where(
      tenantDb.withTenantFilter(conversations, and(eq(conversations.platform, 'sms'), eq(conversations.status, 'active'))),
    );
  const msgRows = await db
    .select({ phone: conversations.customerPhone, content: messages.content, ts: messages.timestamp })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(messages.tenantId, TENANT_ID), eq(messages.channel, 'sms'), eq(messages.fromCustomer, true)));
  const callRows = await db.select({ sid: callEvents.callSid }).from(callEvents);
  const lineRows = await tenantDb
    .select({ id: phoneLines.id, number: phoneLines.phoneNumber })
    .from(phoneLines)
    .where(tenantDb.withTenantFilter(phoneLines, isNotNull(phoneLines.phoneNumber)));
  // Re-run safe: reuse an existing noise bucket if one was created on a prior run.
  const bucketRows = await tenantDb
    .select({ id: conversations.id })
    .from(conversations)
    .where(tenantDb.withTenantFilter(conversations, eq(conversations.customerName, NOISE_BUCKET_NAME)))
    .limit(1);

  const pre: Preload = {
    dedupSids: new Set(dedupRows.map((r) => r.sid)),
    customerPhones: new Set(custRows.map((r) => r.phone!).filter(Boolean)),
    activeSmsConvByPhone: new Map(),
    inboundMsgTimes: new Map(),
    callSids: new Set(callRows.map((r) => r.sid)),
    phoneLineByNumber: new Map(),
    noiseBucketConvId: bucketRows[0]?.id ?? null,
  };
  for (const r of convRows) {
    if (r.phone && !pre.activeSmsConvByPhone.has(r.phone)) pre.activeSmsConvByPhone.set(r.phone, r.id);
  }
  for (const r of msgRows) {
    if (r.phone && r.ts) recordInboundMsg(pre, r.phone, r.content, new Date(r.ts));
  }
  for (const r of lineRows) {
    if (r.number) pre.phoneLineByNumber.set(r.number, r.id);
  }
  return pre;
}

// Resolve (and on a live run, quietly create) the customer + thread +
// active SMS conversation for a phone, using the preloaded conv map to avoid a
// SELECT. Returns the conversation id and whether a customer was created.
async function ensureConvThread(
  phone: string,
  name: string | null,
  to: string | null,
  pre: Preload,
): Promise<{ conversationId: number; createdCustomer: boolean }> {
  const fc = await findOrCreateCustomer(tenantDb, {
    tenantId: TENANT_ID,
    phone,
    email: null,
    fullName: name,
    source: 'sms',
  });
  const customerId = fc.customer.id;
  const createdCustomer = !!fc.createdNew;
  pre.customerPhones.add(phone);

  const thread = await findOrCreateThread(tenantDb, TENANT_ID, customerId);

  const cached = pre.activeSmsConvByPhone.get(phone);
  if (cached) return { conversationId: cached, createdCustomer };

  const inserted = await tenantDb
    .insert(conversations)
    .values({
      customerId,
      customerPhone: phone,
      customerName: name,
      platform: 'sms',
      phoneLineId: resolveLineId(pre, to),
      controlMode: 'auto',
      status: 'active',
      category: 'Other',
      intent: 'Information Gathering',
      needsHumanAttention: false,
      resolved: false,
      threadId: thread.id,
    })
    .returning({ id: conversations.id });
  const conversationId = inserted[0].id;
  pre.activeSmsConvByPhone.set(phone, conversationId);
  return { conversationId, createdCustomer };
}

// Lazily resolve (or create, once) the single bucket conversation that holds all
// automated-noise messages. This is ONE labeled, non-human system row — it is not
// a per-sender customer and must be excluded from the "real customers" count. The
// real sender's number is preserved per-message in metadata.
async function ensureNoiseBucket(pre: Preload): Promise<number> {
  if (pre.noiseBucketConvId != null) return pre.noiseBucketConvId;
  const cust = await tenantDb
    .insert(customers)
    .values({ name: NOISE_BUCKET_NAME, phone: null, importSource: IMPORT_SOURCE })
    .returning({ id: customers.id });
  const customerId = cust[0].id;
  const thread = await findOrCreateThread(tenantDb, TENANT_ID, customerId);
  const inserted = await tenantDb
    .insert(conversations)
    .values({
      customerId,
      customerPhone: null,
      customerName: NOISE_BUCKET_NAME,
      platform: 'sms',
      phoneLineId: resolveLineId(pre, null),
      controlMode: 'auto',
      status: 'archived',
      category: 'Other',
      intent: 'Information Gathering',
      needsHumanAttention: false,
      resolved: true,
      threadId: thread.id,
    })
    .returning({ id: conversations.id });
  pre.noiseBucketConvId = inserted[0].id;
  return pre.noiseBucketConvId;
}

// ---------------------------------------------------------------------------
// Phase 0 — run ledger
// ---------------------------------------------------------------------------
async function checkRunLedger(opts: Options): Promise<boolean> {
  const existing = await db
    .select({ id: importRuns.id, endedAt: importRuns.endedAt })
    .from(importRuns)
    .where(eq(importRuns.runKey, RUN_KEY))
    .limit(1);

  if (existing.length > 0) {
    if (opts.dryRun) {
      console.log(`⚠️  Ledger: run_key "${RUN_KEY}" ALREADY EXISTS (id=${existing[0].id}). A real run would refuse without --force.`);
      return true;
    }
    if (!opts.force) {
      console.error(`\n🛑 ABORT: run_key "${RUN_KEY}" already exists in import_runs (id=${existing[0].id}).`);
      console.error('   This import has already run. Re-running would risk double-import.');
      console.error('   Pass --force only if you are certain you want to re-run.\n');
      return false;
    }
    console.log(`⚠️  --force: run_key "${RUN_KEY}" exists; proceeding and updating the ledger row.`);
    return true;
  }

  if (opts.dryRun) {
    console.log(`✓ Ledger: run_key "${RUN_KEY}" not present. A real run would create it.`);
  }
  return true;
}

// Atomic claim: the unique run_key insert IS the gate, so two processes that
// both pass checkRunLedger() can never both proceed. Returns true if this
// process won the claim (or --force re-took it), false if it must abort.
async function claimLedger(opts: Options): Promise<boolean> {
  const claimed = await db
    .insert(importRuns)
    .values({ runKey: RUN_KEY, tenantId: TENANT_ID, startedAt: new Date() })
    .onConflictDoNothing({ target: importRuns.runKey })
    .returning({ id: importRuns.id });

  if (claimed.length > 0) return true;

  // Row already exists — only --force may re-take it.
  if (!opts.force) {
    console.error(`\n🛑 ABORT: run_key "${RUN_KEY}" was claimed by another run (race or prior run).`);
    return false;
  }
  await db
    .update(importRuns)
    .set({ startedAt: new Date(), endedAt: null })
    .where(eq(importRuns.runKey, RUN_KEY));
  return true;
}

async function closeLedger(summary: unknown): Promise<void> {
  await db
    .update(importRuns)
    .set({ endedAt: new Date(), summaryJson: summary as any })
    .where(eq(importRuns.runKey, RUN_KEY));
}

// ---------------------------------------------------------------------------
// Twilio fetch helpers
// ---------------------------------------------------------------------------
interface InboundSms {
  sid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  dateSent: Date;
}

async function fetchInboundSms(): Promise<InboundSms[]> {
  const client = getTwilioClient();
  const all = await client.messages.list({
    dateSentAfter: WINDOW_START,
    dateSentBefore: WINDOW_END,
    pageSize: 1000,
  });
  const inbound: InboundSms[] = [];
  for (const m of all) {
    if (m.direction !== 'inbound') continue;
    inbound.push({
      sid: m.sid,
      from: m.from || '',
      to: m.to || '',
      body: m.body || '',
      status: m.status || '',
      dateSent: m.dateSent ? new Date(m.dateSent) : (m.dateCreated ? new Date(m.dateCreated) : new Date()),
    });
  }
  // Oldest first so threads build chronologically.
  inbound.sort((a, b) => a.dateSent.getTime() - b.dateSent.getTime());
  return inbound;
}

interface RecordingInfo {
  recordingSid: string;
  uri: string;
  duration: number;
}

async function fetchRecordingsByCall(): Promise<Map<string, RecordingInfo>> {
  const client = getTwilioClient();
  const recs = await client.recordings.list({
    dateCreatedAfter: WINDOW_START,
    dateCreatedBefore: WINDOW_END,
    pageSize: 1000,
  });
  const map = new Map<string, RecordingInfo>();
  for (const r of recs) {
    if (!r.callSid) continue;
    // Keep the first (or longest) recording per call.
    const dur = parseInt((r.duration as any) || '0', 10) || 0;
    const prev = map.get(r.callSid);
    if (!prev || dur > prev.duration) {
      map.set(r.callSid, { recordingSid: r.sid, uri: r.uri || '', duration: dur });
    }
  }
  return map;
}

interface InboundCall {
  sid: string;
  from: string;
  to: string;
  status: string;
  duration: number;
  startTime: Date | null;
  endTime: Date | null;
  price: string | null;
  priceUnit: string | null;
}

async function fetchInboundCalls(): Promise<InboundCall[]> {
  const client = getTwilioClient();
  const all = await client.calls.list({
    startTimeAfter: WINDOW_START,
    startTimeBefore: WINDOW_END,
    pageSize: 1000,
  });
  const inbound: InboundCall[] = [];
  for (const c of all) {
    if (c.direction !== 'inbound') continue;
    inbound.push({
      sid: c.sid,
      from: c.from || '',
      to: c.to || '',
      status: c.status || '',
      duration: parseInt((c.duration as any) || '0', 10) || 0,
      startTime: c.startTime ? new Date(c.startTime) : null,
      endTime: c.endTime ? new Date(c.endTime) : null,
      price: (c.price as any) ?? null,
      priceUnit: (c.priceUnit as any) ?? null,
    });
  }
  inbound.sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));
  return inbound;
}

async function fetchTranscription(recordingSid: string): Promise<string | null> {
  try {
    const client = getTwilioClient();
    const ts = await client.recordings(recordingSid).transcriptions.list({ limit: 1 });
    if (ts.length > 0 && ts[0].transcriptionText) return ts[0].transcriptionText;
  } catch {
    /* non-fatal */
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 1 — STOP opt-out (mirror live handler + audit tag)
// ---------------------------------------------------------------------------
async function importStops(stopPhones: string[], pre: Preload, opts: Options): Promise<void> {
  console.log(`\n=== Phase 1: STOP opt-out (${stopPhones.length} numbers) ===`);
  for (const phone of stopPhones) {
    try {
      if (BUSINESS_NUMBERS.has(phone)) {
        totals.businessNumberSkipped++;
        sample('businessNumberSkipped', `STOP ${phone} (business own line — skipped)`);
        continue;
      }
      // Existing customer?
      const existing = await tenantDb
        .select({ id: customers.id, name: customers.name, smsConsent: customers.smsConsent })
        .from(customers)
        .where(tenantDb.withTenantFilter(customers, eq(customers.phone, phone)))
        .limit(1);

      // Existing suppression row? (counts new vs already-suppressed)
      const supExisting = await tenantDb
        .select({ id: smsSuppressionList.id })
        .from(smsSuppressionList)
        .where(
          tenantDb.withTenantFilter(smsSuppressionList, eq(smsSuppressionList.phoneNumber, phone)),
        )
        .limit(1);
      const alreadySuppressed = supExisting.length > 0;

      // After this phase the phone always has a customer row, so register it
      // now to stop the SMS/calls phases from recounting it as a new customer.
      pre.customerPhones.add(phone);

      if (opts.dryRun) {
        if (alreadySuppressed) {
          totals.stopsAlreadySuppressedSkipped++;
          sample('stopsAlreadySuppressedSkipped', `${phone} (already in suppression list)`);
        } else {
          totals.stopsNew++;
          sample('stopsNew', `${phone} ${existing.length ? `(known customer #${existing[0].id})` : '(NEW unknown → lightweight row)'}`);
        }
        if (existing.length === 0) {
          totals.customersCreated++;
          totals.customersFromStop++;
          sample('customersCreated', `${phone} → "${UNKNOWN_NAME}" (STOP unknown)`);
        }
        continue;
      }

      // (1) customers.sms_consent = false  (mirror live handler)
      if (existing.length > 0) {
        await tenantDb
          .update(customers)
          .set({ smsConsent: false, smsConsentTimestamp: new Date() })
          .where(eq(customers.phone, phone));
      } else {
        await tenantDb
          .insert(customers)
          .values({
            phone,
            name: UNKNOWN_NAME,
            smsConsent: false,
            smsConsentTimestamp: new Date(),
            importSource: IMPORT_SOURCE,
          });
        totals.customersCreated++;
        totals.customersFromStop++;
        sample('customersCreated', `${phone} → "${UNKNOWN_NAME}" (STOP unknown)`);
      }

      // (2) conversations.sms_opt_out = true for every conversation on this phone
      await tenantDb
        .update(conversations)
        .set({ smsOptOut: true, smsOptOutAt: new Date() })
        .where(eq(conversations.customerPhone, phone));

      // (3) sms_suppression_list upsert (reason='opt_out')
      const sup = await tenantDb
        .insert(smsSuppressionList)
        .values({ tenantId: TENANT_ID, phoneNumber: phone, reason: 'opt_out' })
        .onConflictDoNothing({ target: [smsSuppressionList.tenantId, smsSuppressionList.phoneNumber] })
        .returning({ id: smsSuppressionList.id });

      if (sup.length > 0) {
        totals.stopsNew++;
        sample('stopsNew', `${phone} ${existing.length ? `(known customer #${existing[0].id})` : '(new lightweight row)'}`);
      } else {
        totals.stopsAlreadySuppressedSkipped++;
        sample('stopsAlreadySuppressedSkipped', `${phone} (already suppressed)`);
      }
    } catch (err: any) {
      totals.errors++;
      sample('errors', `STOP ${phone}: ${err?.message || err}`);
      console.error(`[STOP] error for ${mask(phone)}:`, err?.message || err);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — inbound SMS backfill
// ---------------------------------------------------------------------------
async function importSms(inbound: InboundSms[], pre: Preload, nc: NoiseClassifier, opts: Options): Promise<void> {
  console.log(`\n=== Phase 2: inbound SMS backfill (${inbound.length} messages) ===`);
  let processed = 0;
  for (const m of inbound) {
    processed++;
    if (processed % 100 === 0) console.log(`  ...processed ${processed}/${inbound.length}`);
    if (!m.from || !m.sid) {
      totals.errors++;
      sample('errors', `SMS ${m.sid}: missing from/sid`);
      continue;
    }
    if (BUSINESS_NUMBERS.has(m.from)) {
      totals.businessNumberSkipped++;
      sample('businessNumberSkipped', `SMS ${m.from} @ ${m.dateSent?.toISOString() || '?'} (business own line — skipped)`);
      continue;
    }
    try {
      // Dedup authority #1: sms_inbound_dedup.message_sid (in-memory snapshot).
      if (pre.dedupSids.has(m.sid)) {
        totals.smsDedupSkipped++;
        continue;
      }

      // Automated-noise gate (runs BEFORE any customer creation). Noise messages
      // are still imported for the audit trail, but into the single labeled bucket
      // conversation — never a per-sender customer, never the suppression list.
      const noise = classifySmsNoise(nc, m.from, m.body);
      if (noise.noise) {
        // The legacy content+time guard applies to noise too: a pre-filter copy
        // may already live in `messages` (under the real phone) with no dedup
        // row, so SID dedup alone can't catch it.
        if (hasNearbyMsg(pre, m.from, m.body, m.dateSent)) {
          totals.smsLikelyDuplicateSkipped++;
          pre.dedupSids.add(m.sid);
          continue;
        }
        if (opts.dryRun) {
          totals.noiseMessagesFiltered++;
          pre.dedupSids.add(m.sid);
          recordInboundMsg(pre, m.from, m.body, m.dateSent);
          sample(
            'noiseFiltered',
            `${m.from} [${noise.reason}] @ ${m.dateSent.toISOString()} "${m.body.slice(0, 40).replace(/\n/g, ' ')}"`,
          );
          continue;
        }
        const bucketConvId = await ensureNoiseBucket(pre);
        const res = await db.transaction(async (tx) => {
          const ded = await tx
            .insert(smsInboundDedup)
            .values({ tenantId: TENANT_ID, messageSid: m.sid, fromNumber: m.from, toNumber: m.to, receivedAt: m.dateSent })
            .onConflictDoNothing({ target: smsInboundDedup.messageSid })
            .returning({ id: smsInboundDedup.id });
          if (ded.length === 0) return 'dedup_skip';
          await tx.insert(messages).values({
            tenantId: TENANT_ID,
            conversationId: bucketConvId,
            content: m.body,
            sender: 'customer',
            fromCustomer: true,
            channel: 'sms',
            messageType: 'sms',
            timestamp: m.dateSent,
            deliveryStatus: 'delivered',
            isAutomated: false,
            phoneLineId: resolveLineId(pre, m.to),
            metadata: {
              importedFrom: IMPORT_SOURCE,
              runKey: RUN_KEY,
              twilioSid: m.sid,
              twilioStatus: m.status,
              import_flag: NOISE_IMPORT_FLAG,
              noiseReason: noise.reason,
              noiseFrom: m.from,
            },
          });
          return 'imported';
        });
        pre.dedupSids.add(m.sid);
        if (res === 'imported') {
          recordInboundMsg(pre, m.from, m.body, m.dateSent);
          totals.noiseMessagesFiltered++;
          sample(
            'noiseFiltered',
            `${m.from} [${noise.reason}] @ ${m.dateSent.toISOString()} "${m.body.slice(0, 40).replace(/\n/g, ' ')}"`,
          );
        } else {
          totals.smsDedupSkipped++;
        }
        continue;
      }

      // Dedup authority #2: content+timestamp guard for pre-dedup-table rows
      // (messages has no SID column, so older rows can't be matched by SID).
      if (hasNearbyMsg(pre, m.from, m.body, m.dateSent)) {
        totals.smsLikelyDuplicateSkipped++;
        pre.dedupSids.add(m.sid);
        continue;
      }

      if (opts.dryRun) {
        if (!pre.customerPhones.has(m.from)) {
          pre.customerPhones.add(m.from);
          totals.customersCreated++;
          totals.customersFromSms++;
          sample('customersCreated', `${m.from} (new SMS sender)`);
        }
        totals.smsImported++;
        pre.dedupSids.add(m.sid);
        recordInboundMsg(pre, m.from, m.body, m.dateSent);
        sample('smsImported', `${m.from} @ ${m.dateSent.toISOString()} "${m.body.slice(0, 40).replace(/\n/g, ' ')}"`);
        continue;
      }

      // Real run: resolve conversation/thread quietly, then atomic dedup+message.
      const before = totals.customersCreated;
      const { conversationId, createdCustomer } = await ensureConvThread(m.from, null, m.to, pre);
      if (createdCustomer && totals.customersCreated === before) {
        totals.customersCreated++;
        totals.customersFromSms++;
        sample('customersCreated', `${m.from} (new SMS sender)`);
      }

      const result = await db.transaction(async (tx) => {
        const ded = await tx
          .insert(smsInboundDedup)
          .values({ tenantId: TENANT_ID, messageSid: m.sid, fromNumber: m.from, toNumber: m.to, receivedAt: m.dateSent })
          .onConflictDoNothing({ target: smsInboundDedup.messageSid })
          .returning({ id: smsInboundDedup.id });
        if (ded.length === 0) return 'dedup_skip';

        await tx.insert(messages).values({
          tenantId: TENANT_ID,
          conversationId,
          content: m.body,
          sender: 'customer',
          fromCustomer: true,
          channel: 'sms',
          messageType: 'sms',
          timestamp: m.dateSent,
          deliveryStatus: 'delivered',
          isAutomated: false,
          phoneLineId: resolveLineId(pre, m.to),
          metadata: { importedFrom: IMPORT_SOURCE, runKey: RUN_KEY, twilioSid: m.sid, twilioStatus: m.status },
        });
        return 'imported';
      });

      pre.dedupSids.add(m.sid);
      if (result === 'imported') {
        recordInboundMsg(pre, m.from, m.body, m.dateSent);
        totals.smsImported++;
        sample('smsImported', `${m.from} @ ${m.dateSent.toISOString()} "${m.body.slice(0, 40).replace(/\n/g, ' ')}"`);
      } else {
        totals.smsDedupSkipped++;
      }
    } catch (err: any) {
      totals.errors++;
      sample('errors', `SMS ${m.sid} (${m.from}): ${err?.message || err}`);
      console.error(`[SMS] error for ${m.sid}:`, err?.message || err);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — calls + voicemails backfill
// ---------------------------------------------------------------------------
async function importCalls(
  calls: InboundCall[],
  recordings: Map<string, RecordingInfo>,
  pre: Preload,
  nc: NoiseClassifier,
  opts: Options,
): Promise<void> {
  console.log(`\n=== Phase 3: inbound calls + voicemails (${calls.length} calls) ===`);
  let processed = 0;
  for (const c of calls) {
    processed++;
    if (processed % 50 === 0) console.log(`  ...processed ${processed}/${calls.length}`);
    if (!c.sid || !c.from) {
      totals.errors++;
      sample('errors', `CALL ${c.sid}: missing sid/from`);
      continue;
    }
    if (BUSINESS_NUMBERS.has(c.from)) {
      totals.businessNumberSkipped++;
      sample('businessNumberSkipped', `CALL ${c.from} @ ${c.startTime?.toISOString() || '?'} (business own line — skipped)`);
      continue;
    }
    const rec = recordings.get(c.sid);
    const isVoicemail = !!rec;
    try {
      // Idempotency: call_events.call_sid is globally UNIQUE (in-memory snapshot).
      if (pre.callSids.has(c.sid)) {
        totals.callsAlreadyImportedSkipped++;
        continue;
      }

      // Structural noise gate for calls: a caller that is a shortcode / non-E.164
      // (or a number already classified as automation from its SMS) is never a
      // person. The call event is still recorded for the audit trail, attached to
      // the labeled noise bucket, but no customer is created.
      if (nc.automationNumbers.has(c.from) || isShortcodeOrNonE164(c.from)) {
        if (opts.dryRun) {
          totals.noiseMessagesFiltered++;
          pre.callSids.add(c.sid);
          sample('noiseFiltered', `CALL ${c.from} [shortcode] @ ${c.startTime?.toISOString() || '?'} status=${c.status}`);
          continue;
        }
        const bucketConvId = await ensureNoiseBucket(pre);
        const insertedNoise = await tenantDb
          .insert(callEvents)
          .values({
            conversationId: bucketConvId,
            callSid: c.sid,
            direction: 'inbound',
            from: c.from,
            to: c.to,
            customerPhone: c.from,
            status: c.status,
            duration: c.duration || null,
            price: c.price ?? null,
            priceUnit: c.priceUnit ?? 'USD',
            startedAt: c.startTime ?? undefined,
            endedAt: c.endTime ?? undefined,
          })
          .onConflictDoNothing({ target: callEvents.callSid })
          .returning({ id: callEvents.id });
        if (insertedNoise.length === 0) {
          totals.callsAlreadyImportedSkipped++;
          continue;
        }
        pre.callSids.add(c.sid);
        totals.noiseMessagesFiltered++;
        sample('noiseFiltered', `CALL ${c.from} [shortcode] @ ${c.startTime?.toISOString() || '?'} status=${c.status}`);
        continue;
      }

      if (opts.dryRun) {
        if (!pre.customerPhones.has(c.from)) {
          pre.customerPhones.add(c.from);
          totals.customersCreated++;
          totals.customersFromCall++;
          sample('customersCreated', `${c.from} (new caller)`);
        }
        pre.callSids.add(c.sid);
        if (isVoicemail) {
          totals.voicemailsImported++;
          sample('voicemailsImported', `${c.from} @ ${c.startTime?.toISOString() || '?'} (rec ${rec!.recordingSid}, ${rec!.duration}s)`);
        } else {
          totals.callsImported++;
          sample('callsImported', `${c.from} @ ${c.startTime?.toISOString() || '?'} status=${c.status} ${c.duration}s`);
        }
        continue;
      }

      const before = totals.customersCreated;
      const { conversationId, createdCustomer } = await ensureConvThread(c.from, null, c.to, pre);
      if (createdCustomer && totals.customersCreated === before) {
        totals.customersCreated++;
        totals.customersFromCall++;
        sample('customersCreated', `${c.from} (new caller)`);
      }

      let transcriptionText: string | null = null;
      if (isVoicemail && opts.fetchTranscriptions) {
        transcriptionText = await fetchTranscription(rec!.recordingSid);
      }

      const recordingUrl = rec ? `https://api.twilio.com${rec.uri.replace(/\.json$/, '')}` : null;

      const inserted = await tenantDb
        .insert(callEvents)
        .values({
          conversationId,
          callSid: c.sid,
          direction: 'inbound',
          from: c.from,
          to: c.to,
          customerPhone: c.from,
          status: c.status,
          duration: c.duration || null,
          recordingUrl: recordingUrl,
          recordingSid: rec?.recordingSid ?? null,
          transcriptionText,
          transcriptionStatus: transcriptionText ? 'completed' : null,
          price: c.price ?? null,
          priceUnit: c.priceUnit ?? 'USD',
          startedAt: c.startTime ?? undefined,
          endedAt: c.endTime ?? undefined,
        })
        .onConflictDoNothing({ target: callEvents.callSid })
        .returning({ id: callEvents.id });

      if (inserted.length === 0) {
        totals.callsAlreadyImportedSkipped++;
        continue;
      }
      pre.callSids.add(c.sid);

      if (isVoicemail) {
        totals.voicemailsImported++;
        sample('voicemailsImported', `${c.from} @ ${c.startTime?.toISOString() || '?'} (rec ${rec!.recordingSid}, ${rec!.duration}s)`);
      } else {
        totals.callsImported++;
        sample('callsImported', `${c.from} @ ${c.startTime?.toISOString() || '?'} status=${c.status} ${c.duration}s`);
      }
    } catch (err: any) {
      totals.errors++;
      sample('errors', `CALL ${c.sid} (${c.from}): ${err?.message || err}`);
      console.error(`[CALL] error for ${c.sid}:`, err?.message || err);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function buildReport(opts: Options, startedAt: Date, endedAt: Date): string {
  const lines: string[] = [];
  const mode = opts.dryRun ? 'DRY RUN (no writes)' : 'LIVE RUN';
  lines.push('========================================================');
  lines.push('  TWILIO AUDIT IMPORT REPORT');
  lines.push('========================================================');
  lines.push(`Mode:        ${mode}`);
  lines.push(`Run key:     ${RUN_KEY}`);
  lines.push(`Tenant:      ${TENANT_ID} (Clean Machine Auto Detail)`);
  lines.push(`Window:      ${WINDOW_START.toISOString()} → ${WINDOW_END.toISOString()}`);
  lines.push(`Started:     ${startedAt.toISOString()}`);
  lines.push(`Ended:       ${endedAt.toISOString()}`);
  lines.push(`Duration:    ${Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)}s`);
  lines.push('');
  lines.push('--- TOTALS BY CATEGORY ---');
  lines.push(`STOPs new (suppression rows created):        ${totals.stopsNew}`);
  lines.push(`STOPs already-suppressed (skipped):          ${totals.stopsAlreadySuppressedSkipped}`);
  lines.push(`REAL customers created:                      ${totals.customersCreated}`);
  lines.push(`  ↳ from STOP opt-outs (unknown numbers):    ${totals.customersFromStop}`);
  lines.push(`  ↳ from inbound SMS (new texters):          ${totals.customersFromSms}`);
  lines.push(`  ↳ from inbound calls (new callers):        ${totals.customersFromCall}`);
  lines.push(`Calls imported (no recording):               ${totals.callsImported}`);
  lines.push(`Voicemails imported (with recording):        ${totals.voicemailsImported}`);
  lines.push(`SMS imported:                                ${totals.smsImported}`);
  lines.push(`Automated-noise messages filtered:           ${totals.noiseMessagesFiltered}`);
  lines.push(`  ↳ distinct noise senders:                  ${totals.noiseNumbers}`);
  lines.push(`  ↳ borderline (E.164, needs human review):  ${totals.borderlineForReview}`);
  lines.push(`SMS skipped (already in dedup table):        ${totals.smsDedupSkipped}`);
  lines.push(`SMS skipped (likely duplicate, content+time):${totals.smsLikelyDuplicateSkipped}`);
  lines.push(`Calls skipped (already imported):            ${totals.callsAlreadyImportedSkipped}`);
  lines.push(`Skipped (business own line, not a customer):  ${totals.businessNumberSkipped}`);
  lines.push(`Errors:                                      ${totals.errors}`);
  lines.push('');
  lines.push('NOTE: automated-noise messages are still imported for the audit trail');
  lines.push(`      into ONE labeled bucket conversation ("${NOISE_BUCKET_NAME}");`);
  lines.push('      they create NO per-sender customer and touch NO suppression list.');
  lines.push('      "REAL customers created" therefore excludes all noise senders.');
  lines.push('');
  lines.push('--- SAMPLES (up to 10 per category) ---');
  for (const key of Object.keys(samples)) {
    lines.push(`\n[${key}] (${samples[key].length} shown)`);
    if (samples[key].length === 0) lines.push('  (none)');
    for (const s of samples[key]) lines.push(`  - ${s}`);
  }
  lines.push('');
  lines.push('========================================================');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();
  const startedAt = new Date();

  console.log('🔧 Twilio Audit Import');
  console.log(`   Mode: ${opts.dryRun ? 'DRY RUN' : 'LIVE'}${opts.force ? ' (--force)' : ''}`);
  console.log(`   Run key: ${RUN_KEY}`);

  assertTwilioReady();

  // Phase 0 — ledger gate. checkRunLedger() is an advisory early-exit with a
  // friendly message; claimLedger() is the authoritative atomic gate for real
  // runs (the unique run_key insert wins the race).
  const proceed = await checkRunLedger(opts);
  if (!proceed) process.exit(2);
  if (!opts.dryRun) {
    const claimed = await claimLedger(opts);
    if (!claimed) process.exit(2);
  }

  // Fetch from Twilio (read-only)
  console.log('\n📥 Fetching from Twilio...');
  const inboundSms = await fetchInboundSms();
  console.log(`   Inbound SMS: ${inboundSms.length}`);
  const recordings = await fetchRecordingsByCall();
  console.log(`   Recordings: ${recordings.size}`);
  const inboundCalls = await fetchInboundCalls();
  console.log(`   Inbound calls: ${inboundCalls.length}`);

  // Build the automated-noise classifier in one pass (per-number aggregation so
  // "only ever sent shortcode-style messages → automation" can be applied).
  const nc = buildNoiseClassifier(inboundSms);
  totals.noiseNumbers = nc.automationNumbers.size;
  totals.borderlineForReview = nc.borderlineNumbers.size;
  for (const n of Array.from(nc.borderlineNumbers).sort()) {
    sample('borderlineReview', `${n} (E.164 but every in-window message matched a noise pattern — confirm not a real customer)`);
  }
  console.log(
    `   Noise senders: ${nc.automationNumbers.size} (borderline/needs-review: ${nc.borderlineNumbers.size})`,
  );

  // Derive STOP set from inbound bodies using the live keyword detector. Exclude
  // automation senders — a shortcode/automation "STOP" is not a real opt-out and
  // must never reach the suppression list.
  const stopSet = new Set<string>();
  for (const m of inboundSms) {
    if (!m.from || nc.automationNumbers.has(m.from)) continue;
    const res = checkConsentKeyword(m.body);
    if (res.isConsentKeyword && res.keyword === 'STOP') stopSet.add(m.from);
  }
  const stopPhones = Array.from(stopSet).sort();
  console.log(`   STOP numbers detected: ${stopPhones.length}`);

  // Preload existing DB state into memory (one pass) for O(1) idempotency checks.
  console.log('\n📚 Preloading existing DB state...');
  const pre = await preload();
  console.log(
    `   dedup SIDs: ${pre.dedupSids.size} | customer phones: ${pre.customerPhones.size} | active SMS convs: ${pre.activeSmsConvByPhone.size} | inbound msg keys: ${pre.inboundMsgTimes.size} | call SIDs: ${pre.callSids.size} | phone lines: ${pre.phoneLineByNumber.size}`,
  );

  // Phases
  await importStops(stopPhones, pre, opts);
  await importSms(inboundSms, pre, nc, opts);
  await importCalls(inboundCalls, recordings, pre, nc, opts);

  const endedAt = new Date();
  const summary = {
    runKey: RUN_KEY,
    tenantId: TENANT_ID,
    dryRun: opts.dryRun,
    window: { start: WINDOW_START.toISOString(), end: WINDOW_END.toISOString() },
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    totals,
  };

  if (!opts.dryRun) await closeLedger(summary);

  const report = buildReport(opts, startedAt, endedAt);
  console.log('\n' + report);

  mkdirSync('.local/reports', { recursive: true });
  const stamp = endedAt.toISOString().replace(/[:.]/g, '-');
  const reportPath = `.local/reports/twilio_audit_import_${opts.dryRun ? 'dryrun' : 'live'}_${stamp}.txt`;
  writeFileSync(reportPath, report + '\n\nFULL SUMMARY JSON:\n' + JSON.stringify(summary, null, 2));
  console.log(`\n📝 Report written to ${reportPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
