import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * SMS-AUDIT-T1 (S-8): Outbound channel guard.
 *
 * Every customer-facing SMS MUST flow through `enforceCustomerSmsSender`
 * (in `smsSendGuard.ts`), which is in turn enforced by
 * `sendSMSWithFailover` (in `smsFailoverService.ts`). Any other code path
 * that calls `twilio.messages.create` / `twilioClient.messages.create`
 * directly bypasses sender validation and can leak the admin line, the
 * old test number, or an unprovisioned number to real customers.
 *
 * This test fails if a NEW direct-create callsite appears outside the
 * known-allowed list below. If you genuinely need to add one, route the
 * send through `sendSMSWithFailover` or `smsSendGuard` instead. If a
 * narrow exception is unavoidable, document it in `MESSAGING_AUDIT.md`
 * and add it to ALLOWED_FILES with a short justification comment.
 *
 * The baseline below reflects callsites present at the time the audit
 * landed. Migrating these to `sendSMSWithFailover` is tracked under
 * Audit T1 follow-up tasks (#15-#23).
 */

const SERVER_DIR = join(process.cwd(), 'server');

// Pre-existing direct callsites at the time SMS-AUDIT-T1 landed.
// Each is tracked for migration; do NOT add to this list without an audit
// follow-up. New entries here = new admin-line leak risk.
const ALLOWED_FILES = new Set<string>([
  // The choke point itself - this is THE place that calls Twilio for SMS.
  'server/smsFailoverService.ts',

  // Voice/IVR paths that send a single SMS as a side effect of a call event.
  'server/routes.twilioVoice.ts',
  'server/routes.twilioVoiceIvr.ts',
  'server/routes/twilioTestVoice.ts',

  // Manual SMS-fallback path used when web chat goes offline.
  'server/routes.smsFallback.ts',

  // Owner-facing TEST inbound handler - sends owner #TEST acknowledgements.
  'server/routes/twilioTestSms.ts',

  // Owner-only debug route, gated behind admin auth.
  'server/routes/twilioDebugSms.ts',

  // Demo/test routes - non-production surfaces but still in tree.
  'server/routes/demoRoutes.ts',
  'server/routes/campaignSendTest.ts',

  // Direct-send wrappers that themselves enforce sender validation
  // internally; tracked for consolidation with smsFailoverService.
  'server/services/smsSendSafe.ts',
  'server/services/portRecoverySmsSender.ts',

  // Operational sends from background services - tracked for migration.
  'server/services/escalationService.ts',
  'server/services/portRecoveryService.ts',
]);

const PATTERN = /(?:twilio|twilioClient)\.messages\.create/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      // Skip tests dir - tests can mock/reference the API freely.
      if (name === 'tests' || name === 'node_modules' || name.startsWith('.')) continue;
      walk(full, out);
    } else if (st.isFile() && name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('SMS-AUDIT-T1 S-8: outbound SMS channel guard', () => {
  const allFiles = walk(SERVER_DIR);

  it('discovers .ts files under server/ (sanity)', () => {
    expect(allFiles.length).toBeGreaterThan(50);
  });

  it('the allow-list itself is not stale - every entry must still call twilio.messages.create', () => {
    const stillCalls = new Set<string>();
    for (const abs of allFiles) {
      const rel = relative(process.cwd(), abs).split(sep).join('/');
      if (!ALLOWED_FILES.has(rel)) continue;
      const src = readFileSync(abs, 'utf8');
      if (PATTERN.test(src)) stillCalls.add(rel);
    }
    const stale = [...ALLOWED_FILES].filter((f) => !stillCalls.has(f));
    expect(
      stale,
      `ALLOWED_FILES contains entries that no longer call twilio.messages.create. ` +
        `Remove them so the guard stays meaningful.\n\nStale:\n  - ${stale.join('\n  - ')}`,
    ).toEqual([]);
  });

  // Migration target: the boundary the audit wants is "ONLY smsFailoverService
  // can call twilio.messages.create". The current ALLOWED_FILES list is the
  // baseline as of SMS-AUDIT-T1; tasks #15-#23 track migrating each entry off
  // direct sends. When the list shrinks to a single entry this todo can flip
  // to a real test.
  it.todo(
    'MIGRATION TARGET: only server/smsFailoverService.ts may call twilio.messages.create',
  );

  it('no NEW file calls twilio(.client)?.messages.create directly', () => {
    const offenders: string[] = [];
    for (const abs of allFiles) {
      const src = readFileSync(abs, 'utf8');
      if (!PATTERN.test(src)) continue;
      const rel = relative(process.cwd(), abs).split(sep).join('/');
      if (!ALLOWED_FILES.has(rel)) offenders.push(rel);
    }
    expect(
      offenders,
      `New direct twilio.messages.create callsite detected. Route through ` +
        `sendSMSWithFailover() or smsSendGuard.enforceCustomerSmsSender() ` +
        `instead, or add the file to ALLOWED_FILES with justification.\n\n` +
        `Offenders:\n  - ${offenders.join('\n  - ')}`,
    ).toEqual([]);
  });
});
