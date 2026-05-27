/**
 * Stage L6-C verification — long idempotency keys now survive after migration
 * 0014 widened loyalty_transactions.promo_key from varchar(50) to varchar(255).
 *
 * Before 0014, a release-reservation refund whose stored promo_key exceeded
 * 50 chars would fail silently — the appointment cancelled and the
 * reservation flipped to cancelled (Phase A), but Phase-B's adjust() insert
 * errored out and points were never returned. This test proves:
 *
 *   1. A deliberately long idempotency key — one that, after
 *      releaseReservation() prepends `release:${reservationId}:`, stores a
 *      promo_key >50 chars — now goes through cleanly. Refund posted, balance
 *      restored, full untruncated key persisted.
 *   2. Idempotency still holds at the new width: a second call with the same
 *      long key is a no-op, no double-refund.
 *
 * Runs against the REAL production DATABASE_URL with synthetic throwaway
 * rows. try/finally cleanup; non-zero exit on assertion fail or residue.
 *
 * Run: npx tsx scripts/testL6KeyOverflow.ts
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { wrapTenantDb } from '../server/tenantDb';
import {
  appointments,
  customers,
  loyaltyPoints,
  loyaltyTransactions,
  pointsTransactions,
  customerAchievements,
  redeemedRewards,
  rewardServices,
  services,
} from '@shared/schema';
import {
  earn,
  reserve as ledgerReserve,
  releaseReservation,
} from '../server/services/loyaltyLedger';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST_L6KEY__';
const SYNTH_PHONE = '+10000000011';
const SYNTH_REWARD_NAME = '__LEDGER_TEST_L6KEY_REWARD__';
const POINT_COST = 300;
const SEED_BALANCE = 1000;

// Deliberately long caller key. After releaseReservation prepends
// `release:${reservationId}:`, the stored promo_key will be:
//   release:<resvId>:release:appointment:999999:reservation:888888:overflow-verification-padding
// For a 2-digit reservationId, that's 75 + 11 = 86 chars stored — well past
// the old 50 cap and well within the new 255.
const LONG_CALLER_KEY =
  'release:appointment:999999:reservation:888888:overflow-verification-padding';

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    passCount++;
    console.log(`  PASS — ${label}`);
  } else {
    failCount++;
    failures.push(label);
    console.log(
      `  FAIL — ${label}`,
      detail !== undefined ? `\n         got: ${JSON.stringify(detail)}` : '',
    );
  }
}

async function balanceOf(customerId: number): Promise<number> {
  const [r] = await db
    .select()
    .from(loyaltyPoints)
    .where(
      and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, customerId)),
    );
  return r?.points ?? 0;
}

async function cleanup(
  custId: number | null,
  rewardId: number | null,
): Promise<boolean> {
  console.log(`\n[cleanup] customer=${custId} reward=${rewardId}`);
  let allClean = true;
  try {
    if (custId != null) {
      const lp = await db
        .select({ id: loyaltyPoints.id })
        .from(loyaltyPoints)
        .where(
          and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, custId)),
        );
      const lpIds = lp.map((r) => r.id);
      let ptDel = 0;
      if (lpIds.length > 0) {
        const d = await db
          .delete(pointsTransactions)
          .where(
            and(
              eq(pointsTransactions.tenantId, TENANT_ID),
              inArray(pointsTransactions.loyaltyPointsId, lpIds),
            ),
          )
          .returning({ id: pointsTransactions.id });
        ptDel = d.length;
      }
      const ltDel = await db
        .delete(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, TENANT_ID),
            eq(loyaltyTransactions.customerId, custId),
          ),
        )
        .returning({ id: loyaltyTransactions.id });
      const rrDel = await db
        .delete(redeemedRewards)
        .where(
          and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)),
        )
        .returning({ id: redeemedRewards.id });
      const caDel = await db
        .delete(customerAchievements)
        .where(
          and(
            eq(customerAchievements.tenantId, TENANT_ID),
            eq(customerAchievements.customerId, custId),
          ),
        )
        .returning({ id: customerAchievements.id });
      const lpDel = await db
        .delete(loyaltyPoints)
        .where(
          and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, custId)),
        )
        .returning({ id: loyaltyPoints.id });
      const apptDel = await db
        .delete(appointments)
        .where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.customerId, custId)))
        .returning({ id: appointments.id });
      const cDel = await db
        .delete(customers)
        .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, custId)))
        .returning({ id: customers.id });
      console.log(
        `  deleted: points_transactions=${ptDel}, loyalty_transactions=${ltDel.length}, ` +
          `redeemed_rewards=${rrDel.length}, customer_achievements=${caDel.length}, ` +
          `loyalty_points=${lpDel.length}, appointments=${apptDel.length}, customers=${cDel.length}`,
      );

      const rem = await Promise.all([
        lpIds.length > 0
          ? db
              .select({ id: pointsTransactions.id })
              .from(pointsTransactions)
              .where(
                and(
                  eq(pointsTransactions.tenantId, TENANT_ID),
                  inArray(pointsTransactions.loyaltyPointsId, lpIds),
                ),
              )
          : Promise.resolve([]),
        db
          .select({ id: loyaltyTransactions.id })
          .from(loyaltyTransactions)
          .where(
            and(
              eq(loyaltyTransactions.tenantId, TENANT_ID),
              eq(loyaltyTransactions.customerId, custId),
            ),
          ),
        db
          .select({ id: redeemedRewards.id })
          .from(redeemedRewards)
          .where(
            and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)),
          ),
        db
          .select({ id: loyaltyPoints.id })
          .from(loyaltyPoints)
          .where(
            and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, custId)),
          ),
        db
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(eq(appointments.tenantId, TENANT_ID), eq(appointments.customerId, custId)),
          ),
        db
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, custId))),
      ]);
      const [rPt, rLt, rRr, rLp, rAppt, rC] = rem.map((x) => x.length);
      console.log(
        `  remaining customer-scoped: points_transactions=${rPt}, loyalty_transactions=${rLt}, redeemed_rewards=${rRr}, loyalty_points=${rLp}, appointments=${rAppt}, customers=${rC}`,
      );
      if (rPt || rLt || rRr || rLp || rAppt || rC) allClean = false;
    }

    if (rewardId != null) {
      const rDel = await db
        .delete(rewardServices)
        .where(and(eq(rewardServices.tenantId, TENANT_ID), eq(rewardServices.id, rewardId)))
        .returning({ id: rewardServices.id });
      console.log(`  deleted: reward_services=${rDel.length}`);
      const rRem = await db
        .select({ id: rewardServices.id })
        .from(rewardServices)
        .where(and(eq(rewardServices.tenantId, TENANT_ID), eq(rewardServices.id, rewardId)));
      console.log(`  remaining reward_services=${rRem.length}`);
      if (rRem.length) allClean = false;
    }

    return allClean;
  } catch (e) {
    console.error('  CLEANUP ERROR:', (e as Error).message);
    return false;
  }
}

async function main() {
  console.log('\n=== L6 promo_key overflow verification (post-migration 0014) ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);

  let custId: number | null = null;
  let rewardId: number | null = null;
  let serviceIdForAppts: number | null = null;
  let cleanupOk = false;

  try {
    // ── SETUP ────────────────────────────────────────────────────────────
    const [svcRow] = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.tenantId, TENANT_ID))
      .limit(1);
    if (!svcRow) throw new Error('No services row exists for tenant root');
    serviceIdForAppts = svcRow.id;
    console.log(`[setup] services.id=${serviceIdForAppts}`);

    const [cust] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME,
        phone: SYNTH_PHONE,
        loyaltyProgramOptIn: true,
        loyaltyProgramJoinDate: new Date(),
      })
      .returning();
    if (!cust) throw new Error('Failed to create synthetic customer');
    custId = cust.id;
    console.log(`[setup] customer.id=${custId}`);

    const [rw] = await db
      .insert(rewardServices)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_REWARD_NAME,
        description: 'Synthetic L6 key-overflow test reward — safe to delete',
        pointCost: POINT_COST,
        tier: 'tier_500',
        active: true,
      })
      .returning();
    if (!rw) throw new Error('Failed to create synthetic reward');
    rewardId = rw.id;
    console.log(`[setup] reward.id=${rewardId}`);

    const [appt] = await db
      .insert(appointments)
      .values({
        tenantId: TENANT_ID,
        customerId: custId,
        serviceId: serviceIdForAppts!,
        scheduledTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        address: '__L6KEY_TEST__ apptOverflow',
        status: 'scheduled',
      })
      .returning();
    if (!appt) throw new Error('Failed to create synthetic appointment');
    const apptId = appt.id;
    console.log(`[setup] appointment.id=${apptId}`);

    const seed = await earn(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      amount: SEED_BALANCE,
      source: 'manual_adjustment',
      idempotencyKey: 'l6key-seed-balance',
      description: 'L6 key-overflow seed balance',
    });
    if (!seed.success) throw new Error(`Seed earn() failed: ${JSON.stringify(seed)}`);
    const seededBal = await balanceOf(custId);
    console.log(`[setup] seeded balance = ${seededBal}`);
    if (seededBal !== SEED_BALANCE) throw new Error('Seed balance mismatch');

    // ── TEST 1: long key survives full release cycle ─────────────────────
    console.log(
      '\n[test 1] Long idempotency key survives release cycle and is stored untruncated',
    );

    const res = await ledgerReserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l6key-reserve',
      appointmentId: apptId,
    });
    assert(res.success === true, '1: reserve() succeeded');
    const resvId = res.reservationId!;
    const balPostReserve = await balanceOf(custId);
    assert(
      balPostReserve === SEED_BALANCE - POINT_COST,
      `1: balance debited to ${SEED_BALANCE - POINT_COST}`,
      balPostReserve,
    );

    const expectedStoredKey = `release:${resvId}:${LONG_CALLER_KEY}`;
    const expectedStoredLen = expectedStoredKey.length;
    console.log(`  caller idempotencyKey len=${LONG_CALLER_KEY.length}`);
    console.log(`  expected stored promo_key len=${expectedStoredLen}`);
    assert(
      expectedStoredLen > 50,
      `1: expected stored key length (${expectedStoredLen}) is >50 (would have overflowed pre-migration)`,
      expectedStoredLen,
    );
    assert(
      expectedStoredLen <= 255,
      `1: expected stored key length (${expectedStoredLen}) is <=255 (fits new column)`,
    );

    const released = await releaseReservation(tenantDb, {
      tenantId: TENANT_ID,
      reservationId: resvId,
      reason: 'l6 key-overflow verification',
      idempotencyKey: LONG_CALLER_KEY,
    });
    assert(released.success === true, '1: releaseReservation() returned success:true', released);
    assert(
      released.alreadyApplied === false,
      '1: first call was real work, not a no-op',
      released.alreadyApplied,
    );
    assert(
      released.pointsReturned === POINT_COST,
      `1: pointsReturned === ${POINT_COST}`,
      released.pointsReturned,
    );

    const balPostRelease = await balanceOf(custId);
    assert(
      balPostRelease === SEED_BALANCE,
      `1: balance refunded to ${SEED_BALANCE}`,
      balPostRelease,
    );

    // Inspect the actual stored refund row
    const refundRows = await db
      .select({
        id: loyaltyTransactions.id,
        promoKey: loyaltyTransactions.promoKey,
        deltaPoints: loyaltyTransactions.deltaPoints,
      })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
          sql`${loyaltyTransactions.metadata} ->> 'reservationId' = ${String(resvId)}`,
          sql`${loyaltyTransactions.deltaPoints} > 0`,
        ),
      );
    assert(refundRows.length === 1, '1: exactly one refund row written', refundRows.length);

    const storedKey = refundRows[0]?.promoKey ?? '';
    const storedLen = storedKey.length;
    console.log(`  actual stored promo_key:    "${storedKey}"`);
    console.log(`  actual stored promo_key len: ${storedLen}`);
    assert(
      storedLen > 50,
      `1: actual stored key length (${storedLen}) is >50 (proves widening worked)`,
      storedLen,
    );
    assert(
      storedKey === expectedStoredKey,
      '1: stored promo_key matches expected (full, untruncated)',
      { stored: storedKey, expected: expectedStoredKey },
    );
    assert(
      refundRows[0]?.deltaPoints === POINT_COST,
      `1: refund deltaPoints === +${POINT_COST}`,
      refundRows[0]?.deltaPoints,
    );

    // ── TEST 2: idempotency still holds at new column width ──────────────
    console.log('\n[test 2] Second call with same long key is a no-op — idempotency intact');

    const released2 = await releaseReservation(tenantDb, {
      tenantId: TENANT_ID,
      reservationId: resvId,
      reason: 'l6 key-overflow verification',
      idempotencyKey: LONG_CALLER_KEY,
    });
    assert(released2.success === true, '2: second call still returns success:true');
    assert(
      released2.alreadyApplied === true,
      '2: alreadyApplied:true on retry',
      released2.alreadyApplied,
    );
    assert(
      released2.pointsReturned === 0,
      '2: pointsReturned === 0 on retry (no double-refund)',
      released2.pointsReturned,
    );

    const bal2 = await balanceOf(custId);
    assert(bal2 === SEED_BALANCE, `2: balance still ${SEED_BALANCE} (no double-refund)`, bal2);

    const refundRows2 = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
          sql`${loyaltyTransactions.metadata} ->> 'reservationId' = ${String(resvId)}`,
          sql`${loyaltyTransactions.deltaPoints} > 0`,
        ),
      );
    assert(
      refundRows2.length === 1,
      '2: still exactly ONE refund row (no duplicate)',
      refundRows2.length,
    );
  } catch (e) {
    failCount++;
    failures.push(`SETUP/RUN ERROR: ${(e as Error).message}`);
    console.error('\n[ERROR] Test run threw:', (e as Error).message);
    console.error((e as Error).stack);
  } finally {
    cleanupOk = await cleanup(custId, rewardId);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`  passes: ${passCount}`);
  console.log(`  fails:  ${failCount}`);
  console.log(`  cleanup: ${cleanupOk ? 'OK (zero residue)' : 'FAILED (residue present)'}`);
  if (failures.length > 0) {
    console.log('\nFailed assertions:');
    for (const f of failures) console.log(`  - ${f}`);
  }

  await pool.end();
  process.exit(failCount === 0 && cleanupOk ? 0 : 1);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
