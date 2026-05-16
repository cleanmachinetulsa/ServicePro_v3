import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * SMS-AUDIT-T1 (S-8): Outbound channel guard - STRICT MODE.
 *
 * Every outbound Twilio SMS MUST flow through `server/smsFailoverService.ts`,
 * which is the single choke-point that owns the `twilio.messages.create`
 * literal. Customer-facing sends should use `sendSMSWithFailover` (which
 * runs `enforceCustomerSmsSender`); admin-only paths may use the thin
 * `sendDirectTwilioSMS` passthrough exported from the same file.
 *
 * This test fails if ANY file other than `server/smsFailoverService.ts`
 * contains the literal `twilio(.|Client).messages.create`. There is no
 * allow-list; if you genuinely need to add a new direct send, route it
 * through `smsFailoverService.ts`.
 */

const SERVER_DIR = join(process.cwd(), 'server');
const PATTERN = /(?:twilio|twilioClient)\.messages\.create/;
const ONLY_ALLOWED_FILE = 'server/services/smsSendGuard.ts';

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

describe('SMS-AUDIT-T1 S-8: outbound SMS channel guard (strict)', () => {
  const allFiles = walk(SERVER_DIR);

  it('discovers .ts files under server/ (sanity)', () => {
    expect(allFiles.length).toBeGreaterThan(50);
  });

  it('the choke-point file itself still owns the twilio.messages.create literal', () => {
    const chokeAbs = join(process.cwd(), ONLY_ALLOWED_FILE);
    const src = readFileSync(chokeAbs, 'utf8');
    expect(
      PATTERN.test(src),
      `${ONLY_ALLOWED_FILE} must own the twilio.messages.create call. ` +
        `If this assertion fails, the choke point has been moved or removed; ` +
        `update ONLY_ALLOWED_FILE in this test to match.`,
    ).toBe(true);
  });

  it('NO file other than the choke-point may call twilio(.client)?.messages.create directly', () => {
    const offenders: string[] = [];
    for (const abs of allFiles) {
      const src = readFileSync(abs, 'utf8');
      if (!PATTERN.test(src)) continue;
      const rel = relative(process.cwd(), abs).split(sep).join('/');
      if (rel === ONLY_ALLOWED_FILE) continue;
      offenders.push(rel);
    }
    expect(
      offenders,
      `Direct twilio.messages.create callsite detected outside the audit-mandated ` +
        `choke-point (${ONLY_ALLOWED_FILE}). Route the send through ` +
        `sendSMSWithFailover() (customer SMS) or sendDirectTwilioSMS() (admin-only) ` +
        `from server/smsFailoverService.ts instead.\n\n` +
        `Offenders:\n  - ${offenders.join('\n  - ')}`,
    ).toEqual([]);
  });
});
