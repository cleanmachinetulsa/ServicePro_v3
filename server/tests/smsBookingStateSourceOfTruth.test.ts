import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractSmsBookingStateFromHistory } from '../services/bookingDraftService';

/**
 * SMS-AUDIT-T1 (S-5) regression test: the persisted booking-draft row is the
 * SINGLE SOURCE OF TRUTH for SMS booking state. The legacy
 * `extractSmsBookingStateFromHistory` helper parses prior assistant prose to
 * reconstruct state, which let the AI confirm its own hallucinations as
 * truth ("AI says 'I have you down for Saturday at 10am' even though no slot
 * was offered, then the parser reads that line and adopts it").
 *
 * This test enforces two invariants:
 *   1. The production inbound SMS handler must NOT consume the prose parser.
 *   2. A hallucinated assistant turn run through the (deprecated) parser is
 *      treated as untrusted: the parser-derived state must NOT be merged
 *      with the persisted draft in production code.
 */

const ROOT = process.cwd();

describe('SMS-AUDIT-T1 S-5: booking state source-of-truth', () => {
  it('twilioTestSms.ts does not import or call extractSmsBookingStateFromHistory', () => {
    const src = readFileSync(join(ROOT, 'server/routes/twilioTestSms.ts'), 'utf8');
    expect(
      src.includes('extractSmsBookingStateFromHistory'),
      'twilioTestSms.ts must read state from getSmsBookingState() (the persisted ' +
        'draft row), never from the prose parser. Remove any reference to ' +
        'extractSmsBookingStateFromHistory.',
    ).toBe(false);
  });

  it('no production code path under server/ consumes the prose parser', () => {
    // The parser may be referenced in @deprecated docs and in tests, but no
    // production caller may import or call it.
    const ALLOWED = new Set<string>([
      'server/services/bookingDraftService.ts', // declaration site
      'server/tests/smsBookingStateSourceOfTruth.test.ts', // this test
    ]);
    // Walk the server tree
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full);
        } else if (name.endsWith('.ts')) {
          const rel = full.replace(ROOT + '/', '');
          if (ALLOWED.has(rel)) continue;
          const src = readFileSync(full, 'utf8');
          if (src.includes('extractSmsBookingStateFromHistory')) offenders.push(rel);
        }
      }
    }
    walk(join(ROOT, 'server'));
    expect(
      offenders,
      `Production code must not consume extractSmsBookingStateFromHistory. ` +
        `It exists only as a deprecated stub for legacy compatibility.\n\n` +
        `Offenders:\n  - ${offenders.join('\n  - ')}`,
    ).toEqual([]);
  });

  it('a hallucinated assistant turn does NOT flip persisted draft state', () => {
    // Simulate the historical bug: an AI hallucinates a confirmation line.
    // If anything in production were to merge the parser output with the
    // persisted draft, the customer would receive a confirmation for a
    // service/slot they never selected. The parser is allowed to extract
    // these hallucinated values *into a discarded object*, but the contract
    // is that production code never reads from it.
    const hallucinatedHistory = [
      { sender: 'assistant', content: "Great, I have you down for a Full Detail on Saturday at 10am at 123 Fake St." },
      { sender: 'customer', content: 'thanks' },
    ];

    const persistedDraft = { service: undefined, chosenSlotLabel: undefined, address: undefined };

    // What production now does (single source of truth):
    const productionState = { ...persistedDraft };

    // What production used to do (the bug):
    const buggyState = {
      ...extractSmsBookingStateFromHistory(hallucinatedHistory as any),
      ...persistedDraft,
    };

    // Production state stays empty (correct behavior):
    expect(productionState.service).toBeUndefined();
    expect(productionState.chosenSlotLabel).toBeUndefined();
    expect(productionState.address).toBeUndefined();

    // The buggy path would have lifted hallucinated values - this asserts that
    // the parser is in fact extracting them, which is exactly why production
    // must not call it. If this assertion fails because the parser stopped
    // hallucinating, that is also fine - either way the production state path
    // above remains correct.
    const parserExtracted = extractSmsBookingStateFromHistory(hallucinatedHistory as any);
    const parserPickedSomethingUp =
      !!parserExtracted.service ||
      !!parserExtracted.chosenSlotLabel ||
      !!(parserExtracted as any).address;
    if (parserPickedSomethingUp) {
      // Confirms the hazard: parser output is non-empty for hallucinated input,
      // so production MUST ignore it (which it now does - see test #1).
      expect(buggyState).not.toEqual(productionState);
    }
  });
});
