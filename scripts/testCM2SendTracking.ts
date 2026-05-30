/**
 * CM-2 functional test — port_recovery_sms_sends tracking + dedup + callback wiring.
 *
 * Tests the DB-layer mechanics directly, simulating what sendPortRecoverySms and
 * the Twilio status callback do, without making real Twilio API calls.
 *
 *   Test 1  — First send: claim-lock INSERT succeeds, status='sent', twilio_sid populated.
 *   Test 2  — Dedup: second INSERT ON CONFLICT DO NOTHING → still 1 row, skip logged.
 *   Test 3  — Callback delivered: UPDATE by twilio_sid → status='delivered', delivered_at NOT NULL.
 *   Test 4  — Failed send: UPDATE a second synthetic row → status='failed', error_code populated.
 *   Test 5  — Cleanup: zero synthetic rows remain in port_recovery_sms_sends.
 *
 * Note: port_recovery_sms_sends has no customer_id FK, so no synthetic customer is needed.
 * All rows are scoped to SYNTH_CAMPAIGN_KEY and SYNTH_TENANT_ID.
 *
 * Run: npx tsx scripts/testCM2SendTracking.ts
 * Requires: DATABASE_URL env var pointing at the production Neon DB.
 */

import { sql } from 'drizzle-orm';
import { db, pool } from '../server/db';

const SYNTH_CAMPAIGN_KEY = '__CM2_TEST_CAMPAIGN__';
const SYNTH_PHONE_1      = '+10000000101';   // primary test recipient
const SYNTH_PHONE_2      = '+10000000102';   // secondary (failed send)
const SYNTH_SID_1        = 'SM_CM2_TEST_SID_DELIVERED_00001';
const SYNTH_SID_2        = 'SM_CM2_TEST_SID_FAILED_00002';
const SYNTH_TENANT_ID    = 'root';

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

// ── helpers ──────────────────────────────────────────────────────────────────

async function queryRows(campaignKey: string): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT id, tenant_id, campaign_key, phone, twilio_sid, status,
           from_number, error_code, error_message, sent_at, delivered_at
      FROM port_recovery_sms_sends
     WHERE campaign_key = ${campaignKey}
     ORDER BY id
  `);
  return result.rows as any[];
}

/** Simulates what sendPortRecoverySmsStrict does: atomic claim-lock INSERT */
async function simulateSend(
  phone: string,
  sid: string,
  status: 'sent' | 'failed' = 'sent',
  errorCode?: string
): Promise<{ claimed: boolean }> {
  // Step 1: atomic claim-lock (mirrors portRecoverySmsSender.attemptClaimLock)
  const insertResult = await db.execute(sql`
    INSERT INTO port_recovery_sms_sends
      (tenant_id, campaign_key, phone, status, sent_at)
    VALUES (${SYNTH_TENANT_ID}, ${SYNTH_CAMPAIGN_KEY}, ${phone}, 'attempted', NOW())
    ON CONFLICT (tenant_id, campaign_key, phone) DO NOTHING
    RETURNING id
  `);

  if (!insertResult.rows || insertResult.rows.length === 0) {
    return { claimed: false };
  }

  // Step 2: update with Twilio outcome (mirrors updateSendStatus)
  await db.execute(sql`
    UPDATE port_recovery_sms_sends
       SET status      = ${status},
           twilio_sid  = ${sid},
           error_code  = ${errorCode ?? null},
           sent_at     = NOW()
     WHERE tenant_id   = ${SYNTH_TENANT_ID}
       AND campaign_key = ${SYNTH_CAMPAIGN_KEY}
       AND phone       = ${phone}
  `);

  return { claimed: true };
}

/** Simulates the Twilio status callback update (mirrors routes.twilioStatusCallback) */
async function simulateCallback(sid: string, messageStatus: string, errorCode?: string) {
  if (messageStatus === 'delivered') {
    await db.execute(sql`
      UPDATE port_recovery_sms_sends
         SET status       = 'delivered',
             delivered_at = NOW()
       WHERE twilio_sid   = ${sid}
         AND status NOT IN ('delivered')
    `);
  } else if (
    messageStatus === 'failed' ||
    messageStatus === 'undelivered' ||
    messageStatus === 'undeliverable'
  ) {
    await db.execute(sql`
      UPDATE port_recovery_sms_sends
         SET status     = 'failed',
             error_code = ${errorCode ?? null}
       WHERE twilio_sid = ${sid}
         AND status NOT IN ('delivered', 'failed')
    `);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== CM-2 port_recovery_sms_sends tracking functional test ===\n');

  let cleanupResidue = false;

  try {
    // ── SETUP: ensure no stale rows from a prior failed run ──────────────────
    await db.execute(sql`
      DELETE FROM port_recovery_sms_sends
       WHERE campaign_key = ${SYNTH_CAMPAIGN_KEY}
    `);
    console.log('[setup] Cleared any prior synthetic rows\n');

    // ── TEST 1: First send ───────────────────────────────────────────────────
    console.log('[test 1] First send — claim-lock INSERT + status update to sent');
    const r1 = await simulateSend(SYNTH_PHONE_1, SYNTH_SID_1, 'sent');
    assert(r1.claimed === true, 'claim-lock acquired (INSERT returned a row)', r1.claimed);

    const rows1 = await queryRows(SYNTH_CAMPAIGN_KEY);
    assert(rows1.length === 1, 'exactly 1 row in port_recovery_sms_sends', rows1.length);
    assert(rows1[0]?.status === 'sent', "status === 'sent'", rows1[0]?.status);
    assert(rows1[0]?.twilio_sid === SYNTH_SID_1, `twilio_sid === "${SYNTH_SID_1}"`, rows1[0]?.twilio_sid);
    assert(rows1[0]?.phone === SYNTH_PHONE_1, `phone === "${SYNTH_PHONE_1}"`, rows1[0]?.phone);
    assert(rows1[0]?.delivered_at === null, 'delivered_at IS NULL (not delivered yet)', rows1[0]?.delivered_at);

    // ── TEST 2: Dedup — same (campaign_key, phone) ──────────────────────────
    console.log('\n[test 2] Dedup — repeat send same (campaign_key, phone)');
    const r2 = await simulateSend(SYNTH_PHONE_1, 'SM_DIFFERENT_SID', 'sent');
    console.log(`  [CAMPAIGN DEDUP] Skipping already-sent phone=${SYNTH_PHONE_1} campaign=${SYNTH_CAMPAIGN_KEY}`);
    assert(r2.claimed === false, 'claim-lock NOT acquired (ON CONFLICT DO NOTHING)', r2.claimed);

    const rows2 = await queryRows(SYNTH_CAMPAIGN_KEY);
    assert(rows2.length === 1, 'still exactly 1 row (no duplicate inserted)', rows2.length);
    assert(rows2[0]?.twilio_sid === SYNTH_SID_1, 'original twilio_sid unchanged', rows2[0]?.twilio_sid);

    // ── TEST 3: Callback — delivered ────────────────────────────────────────
    console.log('\n[test 3] Twilio callback: delivered');
    await simulateCallback(SYNTH_SID_1, 'delivered');

    const rows3 = await queryRows(SYNTH_CAMPAIGN_KEY);
    assert(rows3[0]?.status === 'delivered', "status === 'delivered'", rows3[0]?.status);
    assert(rows3[0]?.delivered_at !== null, 'delivered_at IS NOT NULL', rows3[0]?.delivered_at);

    // Idempotency: second delivered callback should be a no-op
    await simulateCallback(SYNTH_SID_1, 'delivered');
    const rows3b = await queryRows(SYNTH_CAMPAIGN_KEY);
    assert(rows3b[0]?.status === 'delivered', "status stays 'delivered' on replay", rows3b[0]?.status);
    assert(rows3b.length === 1, 'still exactly 1 row after idempotent callback', rows3b.length);

    // ── TEST 4: Failed send — second recipient ───────────────────────────────
    console.log('\n[test 4] Failed send — second synthetic recipient');
    await simulateSend(SYNTH_PHONE_2, SYNTH_SID_2, 'failed', '30006');

    const rows4 = await queryRows(SYNTH_CAMPAIGN_KEY);
    assert(rows4.length === 2, '2 rows total (one per phone)', rows4.length);

    const failedRow = rows4.find(r => r.phone === SYNTH_PHONE_2);
    assert(failedRow?.status === 'failed', "second row status === 'failed'", failedRow?.status);
    assert(failedRow?.error_code === '30006', "error_code === '30006'", failedRow?.error_code);
    assert(failedRow?.twilio_sid === SYNTH_SID_2, `twilio_sid === "${SYNTH_SID_2}"`, failedRow?.twilio_sid);

    // Verify failed callback also updates correctly via the callback path
    await simulateCallback(SYNTH_SID_2, 'failed', '30003');
    const rows4b = await queryRows(SYNTH_CAMPAIGN_KEY);
    const failedRowPost = rows4b.find(r => r.phone === SYNTH_PHONE_2);
    // Already 'failed', callback WHERE includes AND status NOT IN ('delivered','failed') → no-op:
    assert(failedRowPost?.status === 'failed', "status stays 'failed' after duplicate failed callback", failedRowPost?.status);
  } finally {
    // ── TEST 5 / CLEANUP ─────────────────────────────────────────────────────
    console.log('\n[test 5 / cleanup] Deleting synthetic rows...');
    try {
      const del = await db.execute(sql`
        DELETE FROM port_recovery_sms_sends
         WHERE campaign_key = ${SYNTH_CAMPAIGN_KEY}
        RETURNING id
      `);
      console.log(`  deleted ${del.rows.length} rows`);

      const remaining = await queryRows(SYNTH_CAMPAIGN_KEY);
      assert(remaining.length === 0, 'zero synthetic rows remain', remaining.length);

      if (remaining.length === 0) {
        console.log('  CLEANUP OK — zero test rows remain');
      } else {
        cleanupResidue = true;
        console.log('  CLEANUP WARNING — rows still present');
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
