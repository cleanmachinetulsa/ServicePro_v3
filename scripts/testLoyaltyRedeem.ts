/**
 * Stage L3 Part 1 — functional test of the redemption reservation lifecycle:
 * reserve() / applyReservation() / releaseReservation().
 *
 * Runs against the REAL production DATABASE_URL using ONE synthetic throwaway
 * customer and ONE synthetic throwaway reward_services row. Every read, write,
 * and delete is scoped to tenantId='root' AND those two synthetic ids; the
 * script NEVER touches any real customer or real reward.
 *
 * Run: npx tsx scripts/testLoyaltyRedeem.ts
 */

import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { wrapTenantDb } from '../server/tenantDb';
import {
  customers,
  loyaltyPoints,
  loyaltyTransactions,
  pointsTransactions,
  customerAchievements,
  redeemedRewards,
  rewardServices,
} from '@shared/schema';
import {
  earn,
  reserve,
  applyReservation,
  releaseReservation,
} from '../server/services/loyaltyLedger';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST_REDEEM__';
const SYNTH_PHONE = '+10000000002';
const SYNTH_REWARD_NAME = '__LEDGER_TEST_REWARD_300__';
const SYNTH_REWARD_COST = 300;
const INSUFFICIENT_REWARD_ID = 5; // "1 Year Ceramic Coating" pointCost=3000 — existing, NOT modified

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

async function balance(customerId: number): Promise<number> {
  const [row] = await db.select({ p: loyaltyPoints.points }).from(loyaltyPoints)
    .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, customerId)));
  return row?.p ?? 0;
}
async function countLt(customerId: number): Promise<number> {
  return (await db.select({ id: loyaltyTransactions.id }).from(loyaltyTransactions)
    .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, customerId)))).length;
}
async function countPt(lpId: number): Promise<number> {
  return (await db.select({ id: pointsTransactions.id }).from(pointsTransactions)
    .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId)))).length;
}
async function countRr(customerId: number): Promise<number> {
  return (await db.select({ id: redeemedRewards.id }).from(redeemedRewards)
    .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, customerId)))).length;
}
async function getRr(reservationId: number) {
  const [row] = await db.select().from(redeemedRewards)
    .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, reservationId)));
  return row;
}
async function getLedgerByReservation(customerId: number, reservationId: number) {
  // Find the canonical redemption ledger row(s) whose metadata.reservationId matches
  return await db.select().from(loyaltyTransactions)
    .where(and(
      eq(loyaltyTransactions.tenantId, TENANT_ID),
      eq(loyaltyTransactions.customerId, customerId),
      eq(loyaltyTransactions.source, 'redemption'),
      sql`${loyaltyTransactions.metadata} ->> 'reservationId' = ${String(reservationId)}`,
    ));
}

async function main() {
  console.log('\n=== loyaltyLedger redemption lifecycle functional test ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);
  let testId: number | null = null;
  let synthRewardId: number | null = null;
  let cleanupResidue = false;

  try {
    // --- SETUP -------------------------------------------------------------
    console.log('[setup] Creating synthetic customer...');
    const [created] = await db.insert(customers).values({
      tenantId: TENANT_ID,
      name: SYNTH_NAME,
      phone: SYNTH_PHONE,
      notes: 'Synthetic test row for loyaltyLedger redemption test — safe to delete',
    }).returning();
    if (!created) throw new Error('Failed to create synthetic customer');
    testId = created.id;
    console.log(`[setup] Synthetic customer id = ${testId}`);

    console.log('[setup] Creating synthetic reward_services row (pointCost=300)...');
    const [reward] = await db.insert(rewardServices).values({
      tenantId: TENANT_ID,
      name: SYNTH_REWARD_NAME,
      description: 'Synthetic test reward for redemption test — safe to delete',
      pointCost: SYNTH_REWARD_COST,
      tier: 'tier_300',
      active: true,
    }).returning();
    if (!reward) throw new Error('Failed to create synthetic reward');
    synthRewardId = reward.id;
    console.log(`[setup] Synthetic reward id = ${synthRewardId}, pointCost = ${SYNTH_REWARD_COST}`);
    console.log(`[setup] Insufficient-points reward = id ${INSUFFICIENT_REWARD_ID} ("1 Year Ceramic Coating", pointCost=3000) — existing row, NOT modified`);

    console.log('[setup] Seeding balance via earn(amount=1000, key="redeem-test-seed")...');
    const seed = await earn(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      amount: 1000, source: 'test',
      idempotencyKey: 'redeem-test-seed', description: 'seed for redeem test',
    });
    console.log(`  seed result: ${JSON.stringify(seed)}`);
    assert(seed.success && seed.newBalance === 1000, 'seed balance = 1000', seed.newBalance);

    const [lpRow] = await db.select({ id: loyaltyPoints.id }).from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
    const lpId = lpRow!.id;
    console.log(`  loyalty_points.id = ${lpId}\n`);

    // ============================================================
    // TEST 1 — reserve happy path
    // ============================================================
    console.log('[test 1] reserve happy path (key="res-A", cost=300)');
    const r1 = await reserve(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      rewardServiceId: synthRewardId, idempotencyKey: 'res-A',
    });
    console.log(`  result: ${JSON.stringify(r1)}`);
    assert(r1.success === true, 'success === true');
    assert(r1.alreadyApplied === false, 'alreadyApplied === false');
    assert(typeof r1.reservationId === 'number' && r1.reservationId > 0, 'reservationId is a number', r1.reservationId);
    assert(r1.pointsReserved === 300, 'pointsReserved === 300', r1.pointsReserved);
    assert(r1.newBalance === 700, 'newBalance === 700', r1.newBalance);
    assert((await balance(testId)) === 700, 'DB balance === 700 (deducted at reserve)');

    const resv1 = r1.reservationId!;
    const rr1 = await getRr(resv1);
    assert(rr1?.status === 'pending', 'redeemed_rewards.status === pending', rr1?.status);
    assert(rr1?.pointsSpent === 300, 'redeemed_rewards.pointsSpent === 300', rr1?.pointsSpent);
    assert(rr1?.rewardServiceId === synthRewardId, 'redeemed_rewards.rewardServiceId matches synth', rr1?.rewardServiceId);

    const lt1 = await getLedgerByReservation(testId, resv1);
    assert(lt1.length === 1, '1 loyalty_transactions row for reservation', lt1.length);
    assert(lt1[0]?.deltaPoints === -300, 'ledger.deltaPoints === -300', lt1[0]?.deltaPoints);
    assert(lt1[0]?.status === 'pending', 'ledger.status === pending', lt1[0]?.status);
    assert(lt1[0]?.source === 'redemption', "ledger.source === 'redemption'", lt1[0]?.source);
    assert(lt1[0]?.promoKey === 'res-A', 'ledger.promoKey === res-A', lt1[0]?.promoKey);

    const pt1 = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId),
        eq(pointsTransactions.amount, -300), eq(pointsTransactions.sourceId, synthRewardId)));
    assert(pt1.length === 1, '1 points_transactions mirror row (amount=-300)', pt1.length);
    assert(pt1[0]?.transactionType === 'redeem', "mirror.transactionType === 'redeem'", pt1[0]?.transactionType);

    // ============================================================
    // TEST 2 — reserve idempotency replay
    // ============================================================
    console.log('\n[test 2] reserve idempotency replay (key="res-A" again)');
    const ltBefore2 = await countLt(testId);
    const ptBefore2 = await countPt(lpId);
    const rrBefore2 = await countRr(testId);
    const r2 = await reserve(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      rewardServiceId: synthRewardId, idempotencyKey: 'res-A',
    });
    console.log(`  result: ${JSON.stringify(r2)}`);
    assert(r2.success === true, 'success === true');
    assert(r2.alreadyApplied === true, 'alreadyApplied === true');
    assert(r2.reservationId === resv1, 'same reservationId returned', { got: r2.reservationId, expected: resv1 });
    assert((await balance(testId)) === 700, 'balance unchanged at 700');
    assert((await countLt(testId)) === ltBefore2, 'loyalty_transactions count unchanged');
    assert((await countPt(lpId)) === ptBefore2, 'points_transactions count unchanged');
    assert((await countRr(testId)) === rrBefore2, 'redeemed_rewards count unchanged');

    // ============================================================
    // TEST 3 — insufficient points
    // ============================================================
    console.log('\n[test 3] insufficient points (cost=3000, balance=700, key="res-B")');
    const ltBefore3 = await countLt(testId);
    const ptBefore3 = await countPt(lpId);
    const rrBefore3 = await countRr(testId);
    const r3 = await reserve(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      rewardServiceId: INSUFFICIENT_REWARD_ID, idempotencyKey: 'res-B',
    });
    console.log(`  result: ${JSON.stringify(r3)}`);
    assert(r3.success === false, 'success === false');
    assert(r3.error === 'INSUFFICIENT_POINTS', "error === 'INSUFFICIENT_POINTS'", r3.error);
    assert((await balance(testId)) === 700, 'balance unchanged at 700');
    assert((await countLt(testId)) === ltBefore3, 'no new loyalty_transactions row');
    assert((await countPt(lpId)) === ptBefore3, 'no new points_transactions row');
    assert((await countRr(testId)) === rrBefore3, 'no new redeemed_rewards row');

    // ============================================================
    // TEST 4 — applyReservation (invoice consumes pending)
    // ============================================================
    console.log('\n[test 4] applyReservation (invoiceId=9999, key="apply-A")');
    const r4 = await applyReservation(tenantDb, {
      tenantId: TENANT_ID, reservationId: resv1,
      invoiceId: 9999, idempotencyKey: 'apply-A',
    });
    console.log(`  result: ${JSON.stringify(r4)}`);
    assert(r4.success === true && r4.alreadyApplied === false, 'success:true, alreadyApplied:false', r4);
    const rr4 = await getRr(resv1);
    assert(rr4?.status === 'completed', 'redeemed_rewards.status === completed', rr4?.status);
    const lt4 = await getLedgerByReservation(testId, resv1);
    assert(lt4.length === 1 && lt4[0]?.status === 'fulfilled', 'ledger.status === fulfilled', lt4[0]?.status);
    assert(lt4[0]?.fulfilledAt != null, 'ledger.fulfilledAt is set');
    assert((await balance(testId)) === 700, 'balance still 700 (no change on apply)');

    console.log('\n[test 4b] applyReservation idempotency replay (key="apply-A")');
    const ltBefore4b = await countLt(testId);
    const r4b = await applyReservation(tenantDb, {
      tenantId: TENANT_ID, reservationId: resv1,
      invoiceId: 9999, idempotencyKey: 'apply-A',
    });
    console.log(`  result: ${JSON.stringify(r4b)}`);
    assert(r4b.success === true && r4b.alreadyApplied === true, 'success:true, alreadyApplied:true', r4b);
    assert((await balance(testId)) === 700, 'balance still 700');
    assert((await countLt(testId)) === ltBefore4b, 'no new ledger rows');

    // ============================================================
    // TEST 5 — releaseReservation on fresh pending (refund)
    // ============================================================
    console.log('\n[test 5] reserve key="res-C" then releaseReservation key="rel-C"');
    const r5a = await reserve(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      rewardServiceId: synthRewardId, idempotencyKey: 'res-C',
    });
    console.log(`  reserve: ${JSON.stringify(r5a)}`);
    assert(r5a.success === true && r5a.newBalance === 400, 'reserve OK, balance 700 → 400', r5a);
    const resv5 = r5a.reservationId!;

    const r5 = await releaseReservation(tenantDb, {
      tenantId: TENANT_ID, reservationId: resv5,
      reason: 'customer cancelled', idempotencyKey: 'rel-C',
    });
    console.log(`  release: ${JSON.stringify(r5)}`);
    assert(r5.success === true, 'release success');
    assert(r5.alreadyApplied === false, 'alreadyApplied === false');
    assert(r5.pointsReturned === 300, 'pointsReturned === 300', r5.pointsReturned);
    assert(r5.newBalance === 700, 'newBalance === 700 (restored)', r5.newBalance);

    const rr5 = await getRr(resv5);
    assert(rr5?.status === 'cancelled', 'redeemed_rewards.status === cancelled', rr5?.status);
    const lt5 = await getLedgerByReservation(testId, resv5);
    assert(lt5.length === 1 && lt5[0]?.status === 'cancelled', 'pending ledger row → cancelled', lt5[0]?.status);

    // A NEW adjustment row of +300 must exist with the deterministic release key
    const refundKey5 = `release:${resv5}:rel-C`;
    const refundLt5 = await db.select().from(loyaltyTransactions)
      .where(and(
        eq(loyaltyTransactions.tenantId, TENANT_ID),
        eq(loyaltyTransactions.customerId, testId),
        eq(loyaltyTransactions.promoKey, refundKey5),
      ));
    assert(refundLt5.length === 1, '1 refund adjustment ledger row exists', refundLt5.length);
    assert(refundLt5[0]?.deltaPoints === 300, 'refund deltaPoints === +300', refundLt5[0]?.deltaPoints);
    assert(refundLt5[0]?.source === 'adjustment', "refund source === 'adjustment'", refundLt5[0]?.source);
    assert((await balance(testId)) === 700, 'DB balance === 700');

    // ============================================================
    // TEST 6 — crash recovery: Phase A succeeded, Phase B never ran
    // ============================================================
    console.log('\n[test 6] CRASH RECOVERY — Phase A done manually, retry releaseReservation()');
    const r6a = await reserve(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      rewardServiceId: synthRewardId, idempotencyKey: 'res-D',
    });
    console.log(`  reserve: ${JSON.stringify(r6a)}`);
    assert(r6a.success === true && r6a.newBalance === 400, 'reserve OK, balance 700 → 400', r6a);
    const resv6 = r6a.reservationId!;

    // Simulate the crash: directly flip the reservation + ledger row to 'cancelled'
    // WITHOUT issuing the refund adjust(). This mirrors a Phase-A-success /
    // Phase-B-fail scenario where the process died between transactions.
    console.log('  [sim] manually flipping redeemed_rewards + ledger row to cancelled (no refund)...');
    await db.update(redeemedRewards)
      .set({ status: 'cancelled' })
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, resv6)));
    await db.update(loyaltyTransactions)
      .set({ status: 'cancelled' })
      .where(and(
        eq(loyaltyTransactions.tenantId, TENANT_ID),
        eq(loyaltyTransactions.customerId, testId),
        eq(loyaltyTransactions.source, 'redemption'),
        eq(loyaltyTransactions.status, 'pending'),
        sql`${loyaltyTransactions.metadata} ->> 'reservationId' = ${String(resv6)}`,
      ));
    assert((await balance(testId)) === 400, 'after sim crash: balance still 400 (points NOT yet refunded)');
    const rr6sim = await getRr(resv6);
    assert(rr6sim?.status === 'cancelled', 'after sim crash: reservation status === cancelled', rr6sim?.status);
    const refundKey6 = `release:${resv6}:rel-D`;
    const refundBefore6 = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId),
        eq(loyaltyTransactions.promoKey, refundKey6)));
    assert(refundBefore6.length === 0, 'after sim crash: NO refund adjustment row yet', refundBefore6.length);

    // Now the recovery retry — same call a caller would make
    console.log('  [recovery] calling releaseReservation(reservationId=res-D, key="rel-D")...');
    const r6 = await releaseReservation(tenantDb, {
      tenantId: TENANT_ID, reservationId: resv6,
      reason: 'recovery', idempotencyKey: 'rel-D',
    });
    console.log(`  release: ${JSON.stringify(r6)}`);
    assert(r6.success === true, 'recovery: success === true');
    assert(r6.alreadyApplied === false, 'recovery: alreadyApplied === false (real work happened)', r6.alreadyApplied);
    assert(r6.pointsReturned === 300, 'recovery: pointsReturned === 300', r6.pointsReturned);
    assert(r6.newBalance === 700, 'recovery: newBalance === 700 (restored)', r6.newBalance);
    assert((await balance(testId)) === 700, 'recovery: DB balance === 700');
    const refundAfter6 = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId),
        eq(loyaltyTransactions.promoKey, refundKey6)));
    assert(refundAfter6.length === 1, 'recovery: refund adjustment row now exists', refundAfter6.length);
    assert(refundAfter6[0]?.deltaPoints === 300, 'recovery: refund deltaPoints === +300', refundAfter6[0]?.deltaPoints);

    // ============================================================
    // TEST 7 — release idempotency
    // ============================================================
    console.log('\n[test 7] release idempotency (key="rel-D" again)');
    const ltBefore7 = await countLt(testId);
    const ptBefore7 = await countPt(lpId);
    const r7 = await releaseReservation(tenantDb, {
      tenantId: TENANT_ID, reservationId: resv6,
      reason: 'recovery', idempotencyKey: 'rel-D',
    });
    console.log(`  result: ${JSON.stringify(r7)}`);
    assert(r7.success === true, 'success === true');
    assert(r7.alreadyApplied === true, 'alreadyApplied === true (true no-op)', r7.alreadyApplied);
    assert(r7.pointsReturned === 0, 'pointsReturned === 0', r7.pointsReturned);
    assert((await balance(testId)) === 700, 'balance still 700');
    assert((await countLt(testId)) === ltBefore7, 'loyalty_transactions count unchanged');
    assert((await countPt(lpId)) === ptBefore7, 'points_transactions count unchanged');

    // ============================================================
    // TEST 8 — release on a completed reservation fails cleanly
    // ============================================================
    console.log('\n[test 8] release on completed reservation (from Test 1, now completed)');
    const balBefore8 = await balance(testId);
    const ltBefore8 = await countLt(testId);
    const r8 = await releaseReservation(tenantDb, {
      tenantId: TENANT_ID, reservationId: resv1,
      reason: 'should fail', idempotencyKey: 'rel-completed',
    });
    console.log(`  result: ${JSON.stringify(r8)}`);
    assert(r8.success === false, 'success === false');
    assert(r8.error === 'RESERVATION_ALREADY_COMPLETED', "error === 'RESERVATION_ALREADY_COMPLETED'", r8.error);
    assert((await balance(testId)) === balBefore8, 'balance unchanged');
    assert((await countLt(testId)) === ltBefore8, 'no new ledger rows');

    // ============================================================
    // TEST 9 — invalid input never throws
    // ============================================================
    console.log('\n[test 9a] reserve with empty idempotencyKey');
    let threw9a = false; let r9a: Awaited<ReturnType<typeof reserve>> | null = null;
    try {
      r9a = await reserve(tenantDb, {
        tenantId: TENANT_ID, customerId: testId,
        rewardServiceId: synthRewardId, idempotencyKey: '',
      });
    } catch (e) { threw9a = true; console.log(`  THREW: ${(e as Error).message}`); }
    console.log(`  result: ${JSON.stringify(r9a)}`);
    assert(threw9a === false, 'did NOT throw');
    assert(r9a?.success === false, 'success === false');

    console.log('\n[test 9b] applyReservation with reservationId=0');
    let threw9b = false; let r9b: Awaited<ReturnType<typeof applyReservation>> | null = null;
    try {
      r9b = await applyReservation(tenantDb, {
        tenantId: TENANT_ID, reservationId: 0, idempotencyKey: 'apply-bad',
      });
    } catch (e) { threw9b = true; console.log(`  THREW: ${(e as Error).message}`); }
    console.log(`  result: ${JSON.stringify(r9b)}`);
    assert(threw9b === false, 'did NOT throw');
    assert(r9b?.success === false, 'success === false');

    console.log('\n[test 9c] releaseReservation with empty reason');
    let threw9c = false; let r9c: Awaited<ReturnType<typeof releaseReservation>> | null = null;
    try {
      r9c = await releaseReservation(tenantDb, {
        tenantId: TENANT_ID, reservationId: resv6, reason: '', idempotencyKey: 'rel-bad',
      });
    } catch (e) { threw9c = true; console.log(`  THREW: ${(e as Error).message}`); }
    console.log(`  result: ${JSON.stringify(r9c)}`);
    assert(threw9c === false, 'did NOT throw');
    assert(r9c?.success === false, 'success === false');
  } finally {
    // --- CLEANUP -----------------------------------------------------------
    if (testId !== null) {
      console.log('\n[cleanup] Removing all rows for synthetic customer + reward...');
      try {
        const lp = await db.select({ id: loyaltyPoints.id }).from(loyaltyPoints)
          .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
        const lpIds = lp.map(r => r.id);

        let ptDel = 0;
        if (lpIds.length > 0) {
          const d = await db.delete(pointsTransactions)
            .where(and(eq(pointsTransactions.tenantId, TENANT_ID), inArray(pointsTransactions.loyaltyPointsId, lpIds)))
            .returning({ id: pointsTransactions.id });
          ptDel = d.length;
        }
        const rrDel = await db.delete(redeemedRewards)
          .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, testId)))
          .returning({ id: redeemedRewards.id });
        const ltDel = await db.delete(loyaltyTransactions)
          .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)))
          .returning({ id: loyaltyTransactions.id });
        const caDel = await db.delete(customerAchievements)
          .where(and(eq(customerAchievements.tenantId, TENANT_ID), eq(customerAchievements.customerId, testId)))
          .returning({ id: customerAchievements.id });
        const lpDel = await db.delete(loyaltyPoints)
          .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)))
          .returning({ id: loyaltyPoints.id });
        const cDel = await db.delete(customers)
          .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, testId), eq(customers.name, SYNTH_NAME)))
          .returning({ id: customers.id });

        let rwDel = 0;
        if (synthRewardId !== null) {
          const d = await db.delete(rewardServices)
            .where(and(eq(rewardServices.tenantId, TENANT_ID), eq(rewardServices.id, synthRewardId), eq(rewardServices.name, SYNTH_REWARD_NAME)))
            .returning({ id: rewardServices.id });
          rwDel = d.length;
        }

        console.log(`  deleted: points_transactions=${ptDel}, redeemed_rewards=${rrDel.length}, loyalty_transactions=${ltDel.length}, customer_achievements=${caDel.length}, loyalty_points=${lpDel.length}, customers=${cDel.length}, reward_services=${rwDel}`);

        const rPt = lpIds.length > 0
          ? (await db.select({ id: pointsTransactions.id }).from(pointsTransactions)
              .where(and(eq(pointsTransactions.tenantId, TENANT_ID), inArray(pointsTransactions.loyaltyPointsId, lpIds)))).length
          : 0;
        const rRr = (await db.select({ id: redeemedRewards.id }).from(redeemedRewards)
          .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, testId)))).length;
        const rLt = (await db.select({ id: loyaltyTransactions.id }).from(loyaltyTransactions)
          .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)))).length;
        const rLp = (await db.select({ id: loyaltyPoints.id }).from(loyaltyPoints)
          .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)))).length;
        const rCa = (await db.select({ id: customerAchievements.id }).from(customerAchievements)
          .where(and(eq(customerAchievements.tenantId, TENANT_ID), eq(customerAchievements.customerId, testId)))).length;
        const rC = (await db.select({ id: customers.id }).from(customers)
          .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, testId)))).length;
        const rRw = synthRewardId !== null
          ? (await db.select({ id: rewardServices.id }).from(rewardServices)
              .where(and(eq(rewardServices.tenantId, TENANT_ID), eq(rewardServices.id, synthRewardId)))).length
          : 0;
        console.log(`  remaining: points_transactions=${rPt}, redeemed_rewards=${rRr}, loyalty_transactions=${rLt}, loyalty_points=${rLp}, customer_achievements=${rCa}, customers=${rC}, reward_services=${rRw}`);

        const allClean = rPt === 0 && rRr === 0 && rLt === 0 && rLp === 0 && rCa === 0 && rC === 0 && rRw === 0;
        if (allClean) console.log('  CLEANUP OK — zero test rows remain');
        else { cleanupResidue = true; console.log('  CLEANUP WARNING — some rows still present'); }
      } catch (e) {
        cleanupResidue = true;
        console.error('  CLEANUP ERROR:', (e as Error).message);
      }
    } else {
      console.log('\n[cleanup] No synthetic customer was created — nothing to clean up.');
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
