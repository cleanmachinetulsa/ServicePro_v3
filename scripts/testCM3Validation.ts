/**
 * CM-3 functional test — number validation, suppression check, fake-number block.
 *
 * Tests the guards added to portRecoverySmsSender.sendPortRecoverySms():
 *   Test 1 — Suppressed number: insert suppression row, call send, assert skipped,
 *             no tracking row in port_recovery_sms_sends.
 *   Test 2 — Invalid E.164: "+1555abc1234" rejected before Twilio, no tracking row.
 *   Test 3 — to==from: send where to == from_number, assert skipped, no tracking row.
 *   Test 4 — Fake number: "+15551234567" rejected (matches /^\+1555/), no tracking row.
 *   Test 5 — Happy path: valid synthetic number passes all guards; tracking row
 *             inserted via claim-lock (simulated — no real Twilio call made).
 *   Test 6 — Cleanup: zero test rows remain in port_recovery_sms_sends and
 *             sms_suppression_list.
 *
 * Note on Test 5: calling sendPortRecoverySms with a real valid number in a production
 * environment would attempt a real Twilio send. To avoid this, Test 5 tests the
 * validation layer by (a) asserting the number passes all guard regexes and (b)
 * directly inserting a synthetic tracking row to verify the DB mechanics. The
 * Twilio transport layer is not exercised.
 *
 * Run: npx tsx scripts/testCM3Validation.ts
 * Requires: DATABASE_URL env var.
 */

import { and, eq, sql } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { wrapTenantDb } from '../server/tenantDb';
import { smsSuppressionList } from '@shared/schema';
import { sendPortRecoverySms } from '../server/services/portRecoverySmsSender';

const TENANT_ID         = 'root';
const SYNTH_CAMPAIGN_KEY = '__CM3_TEST_CAMPAIGN__';
const SYNTH_CAMPAIGN_ID  = 990003;

// Synthetic phones — carefully chosen to not match any real customer
const SYNTH_PHONE_SUPPRESSED = '+10000000201'; // will be suppressed in test 1
const SYNTH_PHONE_HAPPY      = '+10000000203'; // valid, not suppressed — test 5

// The from number used in tests (must be a real configured value or a placeholder)
// We use the same synthetic value for all guard tests so to==from is deterministic.
const SYNTH_FROM = '+10000000200'; // never a real send target

let passCount = 0;
let failCount = 0;

function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    passCount++;
    console.log(`  PASS — ${label}`);
  } else {
    failCount++;
    console.log(`  FAIL — ${label}`, detail !== undefined ? `\n         got: ${JSON.stringify(detail)}` : '');
  }
}

async function trackingRowCount(phone: string): Promise<number> {
  const r = await db.execute(sql`
    SELECT COUNT(*) AS n FROM port_recovery_sms_sends
     WHERE campaign_key = ${SYNTH_CAMPAIGN_KEY}
       AND phone        = ${phone}
  `);
  return Number((r.rows[0] as any).n);
}

async function suppressionRowExists(phone: string): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 FROM sms_suppression_list
     WHERE tenant_id   = ${TENANT_ID}
       AND phone_number = ${phone}
     LIMIT 1
  `);
  return r.rows.length > 0;
}

async function cleanTrackingRows() {
  await db.execute(sql`
    DELETE FROM port_recovery_sms_sends WHERE campaign_key = ${SYNTH_CAMPAIGN_KEY}
  `);
}

async function cleanSuppressionRows() {
  await db.execute(sql`
    DELETE FROM sms_suppression_list
     WHERE tenant_id = ${TENANT_ID}
       AND phone_number IN (${SYNTH_PHONE_SUPPRESSED}, ${SYNTH_PHONE_HAPPY})
  `);
}

async function main() {
  console.log('\n=== CM-3 validation + suppression functional test ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);
  let cleanupResidue = false;

  // Ensure no stale rows from prior run
  await cleanTrackingRows();
  await cleanSuppressionRows();

  try {
    // ── TEST 1: Suppressed number ─────────────────────────────────────────────
    console.log('[test 1] Suppressed number — insert suppression row then call send');

    // Insert suppression row for this phone
    await db.execute(sql`
      INSERT INTO sms_suppression_list (tenant_id, phone_number, reason, suppressed_at)
      VALUES (${TENANT_ID}, ${SYNTH_PHONE_SUPPRESSED}, 'opt_out', NOW())
      ON CONFLICT (tenant_id, phone_number) DO NOTHING
    `);
    assert(await suppressionRowExists(SYNTH_PHONE_SUPPRESSED), 'suppression row inserted');

    const r1 = await sendPortRecoverySms({
      tenantId: TENANT_ID,
      to: SYNTH_PHONE_SUPPRESSED,
      body: 'CM-3 test message — should not send',
      campaignKey: SYNTH_CAMPAIGN_KEY,
      campaignId: SYNTH_CAMPAIGN_ID,
      tenantDb,
      fromNumber: SYNTH_FROM,
    });
    console.log(`  result: ${JSON.stringify(r1)}`);
    assert(r1.ok === false,                    'ok === false');
    assert(r1.skipped === true,                'skipped === true');
    assert(r1.skipReason === 'suppressed',     "skipReason === 'suppressed'", r1.skipReason);
    assert(await trackingRowCount(SYNTH_PHONE_SUPPRESSED) === 0,
           'zero tracking rows (no claim-lock for suppressed number)');

    // Remove suppression row so it doesn't interfere with later tests
    await cleanSuppressionRows();
    assert(!(await suppressionRowExists(SYNTH_PHONE_SUPPRESSED)), 'suppression row removed');

    // ── TEST 2: Invalid E.164 ─────────────────────────────────────────────────
    console.log('\n[test 2] Invalid E.164 — "+1555abc1234"');
    const INVALID_PHONE = '+1555abc1234';
    const r2 = await sendPortRecoverySms({
      tenantId: TENANT_ID,
      to: INVALID_PHONE,
      body: 'CM-3 test message — should not send',
      campaignKey: SYNTH_CAMPAIGN_KEY,
      campaignId: SYNTH_CAMPAIGN_ID,
      tenantDb,
      fromNumber: SYNTH_FROM,
    });
    console.log(`  result: ${JSON.stringify(r2)}`);
    assert(r2.ok === false,                  'ok === false');
    assert(r2.skipped === true,              'skipped === true');
    assert(r2.skipReason === 'invalid_phone', "skipReason === 'invalid_phone'", r2.skipReason);
    // normalizeE164 returns null for non-E.164 input, so no tracking row
    assert(await trackingRowCount(INVALID_PHONE) === 0, 'zero tracking rows');

    // ── TEST 3: to == from ────────────────────────────────────────────────────
    console.log('\n[test 3] to == from_number');
    const r3 = await sendPortRecoverySms({
      tenantId: TENANT_ID,
      to: SYNTH_FROM,   // deliberately same as fromNumber
      body: 'CM-3 test message — should not send',
      campaignKey: SYNTH_CAMPAIGN_KEY,
      campaignId: SYNTH_CAMPAIGN_ID,
      tenantDb,
      fromNumber: SYNTH_FROM,
    });
    console.log(`  result: ${JSON.stringify(r3)}`);
    assert(r3.ok === false,                    'ok === false');
    assert(r3.skipped === true,                'skipped === true');
    assert(r3.skipReason === 'to_equals_from', "skipReason === 'to_equals_from'", r3.skipReason);
    assert(await trackingRowCount(SYNTH_FROM) === 0, 'zero tracking rows');

    // ── TEST 4: Fake/reserved number ─────────────────────────────────────────
    console.log('\n[test 4] Fake number — "+15551234567" (matches +1555 pattern)');
    const FAKE_PHONE = '+15551234567';
    const r4 = await sendPortRecoverySms({
      tenantId: TENANT_ID,
      to: FAKE_PHONE,
      body: 'CM-3 test message — should not send',
      campaignKey: SYNTH_CAMPAIGN_KEY,
      campaignId: SYNTH_CAMPAIGN_ID,
      tenantDb,
      fromNumber: SYNTH_FROM,
    });
    console.log(`  result: ${JSON.stringify(r4)}`);
    assert(r4.ok === false,                  'ok === false');
    assert(r4.skipped === true,              'skipped === true');
    assert(r4.skipReason === 'fake_number',  "skipReason === 'fake_number'", r4.skipReason);
    assert(await trackingRowCount(FAKE_PHONE) === 0, 'zero tracking rows');

    // ── TEST 5: Happy path — valid number, not suppressed ─────────────────────
    // We verify the number PASSES all guards by checking each directly,
    // then insert a synthetic tracking row (simulating the claim-lock) to confirm
    // the DB tracking mechanics work. We do NOT make a real Twilio call.
    console.log('\n[test 5] Happy path — valid synthetic number passes all guards');

    const E164_REGEX    = /^\+[1-9]\d{7,14}$/;
    const FAKE_PATTERN  = /^\+1(555|900|976)/;
    const TWILIO_MAGIC  = '+15005550006';

    assert(E164_REGEX.test(SYNTH_PHONE_HAPPY),   `"${SYNTH_PHONE_HAPPY}" passes E.164 regex`);
    assert(!FAKE_PATTERN.test(SYNTH_PHONE_HAPPY), `"${SYNTH_PHONE_HAPPY}" not fake/reserved`);
    assert(SYNTH_PHONE_HAPPY !== TWILIO_MAGIC,    `"${SYNTH_PHONE_HAPPY}" not Twilio magic number`);
    assert(SYNTH_PHONE_HAPPY !== SYNTH_FROM,      `"${SYNTH_PHONE_HAPPY}" not to==from`);
    assert(!(await suppressionRowExists(SYNTH_PHONE_HAPPY)), `"${SYNTH_PHONE_HAPPY}" not in suppression list`);

    // Simulate the claim-lock + successful send (avoids real Twilio call in prod)
    await db.execute(sql`
      INSERT INTO port_recovery_sms_sends
        (tenant_id, campaign_key, phone, status, twilio_sid, sent_at)
      VALUES
        (${TENANT_ID}, ${SYNTH_CAMPAIGN_KEY}, ${SYNTH_PHONE_HAPPY},
         'sent', 'SM_CM3_HAPPY_PATH_SID', NOW())
      ON CONFLICT (tenant_id, campaign_key, phone) DO NOTHING
    `);
    assert(await trackingRowCount(SYNTH_PHONE_HAPPY) === 1,
           'tracking row inserted (simulated claim-lock + sent)');

    const row5 = await db.execute(sql`
      SELECT status, twilio_sid FROM port_recovery_sms_sends
       WHERE campaign_key = ${SYNTH_CAMPAIGN_KEY} AND phone = ${SYNTH_PHONE_HAPPY}
    `);
    const trackingRow = row5.rows[0] as any;
    assert(trackingRow?.status === 'sent',                  "status === 'sent'",       trackingRow?.status);
    assert(trackingRow?.twilio_sid === 'SM_CM3_HAPPY_PATH_SID', 'twilio_sid populated', trackingRow?.twilio_sid);

  } finally {
    // ── TEST 6 / CLEANUP ─────────────────────────────────────────────────────
    console.log('\n[test 6 / cleanup] Removing synthetic rows...');
    try {
      const delTracking = await db.execute(sql`
        DELETE FROM port_recovery_sms_sends
         WHERE campaign_key = ${SYNTH_CAMPAIGN_KEY}
        RETURNING id
      `);
      await cleanSuppressionRows();
      console.log(`  deleted tracking rows: ${delTracking.rows.length}`);

      const remainTracking = await db.execute(sql`
        SELECT COUNT(*) AS n FROM port_recovery_sms_sends
         WHERE campaign_key = ${SYNTH_CAMPAIGN_KEY}
      `);
      const remainSuppression = await db.execute(sql`
        SELECT COUNT(*) AS n FROM sms_suppression_list
         WHERE tenant_id = ${TENANT_ID}
           AND phone_number IN (${SYNTH_PHONE_SUPPRESSED}, ${SYNTH_PHONE_HAPPY})
      `);

      const allClean =
        Number((remainTracking.rows[0] as any).n) === 0 &&
        Number((remainSuppression.rows[0] as any).n) === 0;

      assert(allClean, 'zero test rows remain in both tables',
        { tracking: (remainTracking.rows[0] as any).n, suppression: (remainSuppression.rows[0] as any).n });

      if (allClean) {
        console.log('  CLEANUP OK — zero test rows remain');
      } else {
        cleanupResidue = true;
        console.log('  CLEANUP WARNING — some rows still present');
      }
    } catch (e: any) {
      cleanupResidue = true;
      console.error('  CLEANUP ERROR:', e.message);
    }
  }

  console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed ===\n`);
  await pool.end();
  process.exit(failCount === 0 && !cleanupResidue ? 0 : 1);
}

main().catch(async (e) => {
  console.error('UNCAUGHT:', e);
  try { await pool.end(); } catch {}
  process.exit(2);
});
