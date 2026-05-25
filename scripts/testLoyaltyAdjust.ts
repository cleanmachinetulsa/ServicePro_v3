/**
 * Stage L2 Part 2 — functional test of loyaltyLedger.adjust()
 *
 * Runs against the REAL production DATABASE_URL using ONE synthetic throwaway
 * customer. Every read/write/delete is scoped to that customer's id AND
 * tenantId='root'; the script NEVER touches any of the ~2,572 real customers.
 *
 * Run: npx tsx scripts/testLoyaltyAdjust.ts
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { wrapTenantDb } from '../server/tenantDb';
import {
  customers,
  loyaltyPoints,
  loyaltyTransactions,
  pointsTransactions,
  customerAchievements,
} from '@shared/schema';
import { earn, adjust } from '../server/services/loyaltyLedger';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST_ADJUST__';
const SYNTH_PHONE = '+10000000001';

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

async function countLt(customerId: number): Promise<number> {
  return (await db.select({ id: loyaltyTransactions.id }).from(loyaltyTransactions)
    .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, customerId)))).length;
}
async function countPt(lpId: number): Promise<number> {
  return (await db.select({ id: pointsTransactions.id }).from(pointsTransactions)
    .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId)))).length;
}
async function balance(customerId: number): Promise<number> {
  const [row] = await db.select({ p: loyaltyPoints.points }).from(loyaltyPoints)
    .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, customerId)));
  return row?.p ?? 0;
}

async function main() {
  console.log('\n=== loyaltyLedger.adjust() functional test ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);
  let testId: number | null = null;
  let cleanupResidue = false;

  try {
    // --- SETUP -------------------------------------------------------------
    console.log('[setup] Creating synthetic customer...');
    const [created] = await db.insert(customers).values({
      tenantId: TENANT_ID,
      name: SYNTH_NAME,
      phone: SYNTH_PHONE,
      notes: 'Synthetic test row for loyaltyLedger.adjust() — safe to delete',
    }).returning();
    if (!created) throw new Error('Failed to create synthetic customer');
    testId = created.id;
    console.log(`[setup] Synthetic customer id = ${testId}`);

    console.log('[setup] Seeding balance via earn(amount=1000, key="adjust-test-seed")...');
    const seed = await earn(tenantDb, {
      tenantId: TENANT_ID,
      customerId: testId,
      amount: 1000,
      source: 'test',
      idempotencyKey: 'adjust-test-seed',
      description: 'seed for adjust test',
    });
    console.log(`  seed result: ${JSON.stringify(seed)}`);
    assert(seed.success && seed.newBalance === 1000, 'seed balance = 1000', seed.newBalance);

    const lpRow = await db.select({ id: loyaltyPoints.id }).from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
    const lpId = lpRow[0]!.id;
    console.log(`  loyalty_points.id = ${lpId}\n`);

    // --- TEST 1: positive adjustment (grant) -------------------------------
    console.log('[test 1] Positive adjustment (delta=+300, key="adj-A")');
    const r1 = await adjust(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      delta: 300, reason: 'test grant', actorId: 1, idempotencyKey: 'adj-A',
    });
    console.log(`  result: ${JSON.stringify(r1)}`);
    assert(r1.success === true, 'success === true');
    assert(r1.alreadyApplied === false, 'alreadyApplied === false');
    assert(r1.newBalance === 1300, 'newBalance === 1300', r1.newBalance);
    assert(r1.clamped === false, 'clamped === false');
    assert((await balance(testId)) === 1300, 'DB balance === 1300');

    const ltA = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId), eq(loyaltyTransactions.promoKey, 'adj-A')));
    assert(ltA.length === 1, '1 loyalty_transactions row for adj-A', ltA.length);
    assert(ltA[0]?.deltaPoints === 300, 'loyalty_transactions.deltaPoints === 300', ltA[0]?.deltaPoints);
    assert(ltA[0]?.source === 'adjustment', "source === 'adjustment'", ltA[0]?.source);
    assert(ltA[0]?.status === 'fulfilled', "status === 'fulfilled'", ltA[0]?.status);
    const metaA = (ltA[0]?.metadata ?? {}) as Record<string, unknown>;
    assert(metaA.reason === 'test grant', "metadata.reason === 'test grant'", metaA.reason);
    assert(metaA.actorId === 1, 'metadata.actorId === 1', metaA.actorId);

    const ptA = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId), eq(pointsTransactions.amount, 300)));
    assert(ptA.length === 1, '1 points_transactions mirror row (amount=300)', ptA.length);
    assert(ptA[0]?.transactionType === 'adjustment', "mirror.transactionType === 'adjustment'", ptA[0]?.transactionType);
    assert(ptA[0]?.transactionDate != null, 'mirror.transactionDate is not null');

    // --- TEST 2: negative adjustment (no clamp) ----------------------------
    console.log('\n[test 2] Negative adjustment (delta=-500, key="adj-B")');
    const r2 = await adjust(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      delta: -500, reason: 'test removal', actorId: 1, idempotencyKey: 'adj-B',
    });
    console.log(`  result: ${JSON.stringify(r2)}`);
    assert(r2.success === true && r2.alreadyApplied === false && r2.newBalance === 800 && r2.clamped === false, 'return {success:true, alreadyApplied:false, newBalance:800, clamped:false}', r2);
    assert((await balance(testId)) === 800, 'DB balance === 800');
    const ltB = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId), eq(loyaltyTransactions.promoKey, 'adj-B')));
    assert(ltB.length === 1 && ltB[0]?.deltaPoints === -500, '1 ledger row with deltaPoints === -500', { len: ltB.length, dp: ltB[0]?.deltaPoints });
    const ptB = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId), eq(pointsTransactions.amount, -500)));
    assert(ptB.length === 1, '1 mirror row with amount === -500', ptB.length);

    // --- TEST 3: idempotency replay (same key as Test 1) -------------------
    console.log('\n[test 3] Idempotency replay (key="adj-A" again)');
    const ltBefore3 = await countLt(testId);
    const ptBefore3 = await countPt(lpId);
    const r3 = await adjust(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      delta: 300, reason: 'test grant', actorId: 1, idempotencyKey: 'adj-A',
    });
    console.log(`  result: ${JSON.stringify(r3)}`);
    assert(r3.success === true && r3.alreadyApplied === true && r3.newBalance === 800 && r3.clamped === false, 'return {success:true, alreadyApplied:true, newBalance:800, clamped:false}', r3);
    assert((await balance(testId)) === 800, 'DB balance UNCHANGED at 800');
    assert((await countLt(testId)) === ltBefore3, `loyalty_transactions count unchanged (${ltBefore3})`);
    assert((await countPt(lpId)) === ptBefore3, `points_transactions count unchanged (${ptBefore3})`);

    // --- TEST 4: clamp on overdraw -----------------------------------------
    console.log('\n[test 4] Overdraw clamp (delta=-5000, balance=800, key="adj-C")');
    const r4 = await adjust(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      delta: -5000, reason: 'overdraw test', actorId: 1, idempotencyKey: 'adj-C',
    });
    console.log(`  result: ${JSON.stringify(r4)}`);
    assert(r4.success === true && r4.alreadyApplied === false && r4.newBalance === 0 && r4.clamped === true, 'return {success:true, alreadyApplied:false, newBalance:0, clamped:true}', r4);
    assert((await balance(testId)) === 0, 'DB balance === 0 (exactly, never negative)');
    const ltC = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId), eq(loyaltyTransactions.promoKey, 'adj-C')));
    assert(ltC.length === 1, '1 ledger row for adj-C', ltC.length);
    assert(ltC[0]?.deltaPoints === -800, 'ledger.deltaPoints === -800 (clamped, NOT -5000)', ltC[0]?.deltaPoints);
    const metaC = (ltC[0]?.metadata ?? {}) as Record<string, unknown>;
    assert(metaC.clamped === true, 'metadata.clamped === true', metaC.clamped);
    assert(metaC.requestedDelta === -5000, 'metadata.requestedDelta === -5000', metaC.requestedDelta);
    const ptC = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId), eq(pointsTransactions.amount, -800)));
    assert(ptC.length === 1, '1 mirror row with amount === -800', ptC.length);

    // --- TEST 5: zero-balance clamp short-circuit (no row) ------------------
    console.log('\n[test 5] Zero-balance short-circuit (delta=-200, balance=0, key="adj-D")');
    const ltBefore5 = await countLt(testId);
    const ptBefore5 = await countPt(lpId);
    console.log(`  before: loyalty_transactions=${ltBefore5}, points_transactions=${ptBefore5}`);
    const r5 = await adjust(tenantDb, {
      tenantId: TENANT_ID, customerId: testId,
      delta: -200, reason: 'already zero', actorId: 1, idempotencyKey: 'adj-D',
    });
    console.log(`  result: ${JSON.stringify(r5)}`);
    assert(r5.success === true && r5.alreadyApplied === false && r5.newBalance === 0 && r5.clamped === true, 'return {success:true, alreadyApplied:false, newBalance:0, clamped:true}', r5);
    const ltAfter5 = await countLt(testId);
    const ptAfter5 = await countPt(lpId);
    console.log(`  after:  loyalty_transactions=${ltAfter5}, points_transactions=${ptAfter5}`);
    assert(ltAfter5 === ltBefore5, 'NO new loyalty_transactions row written (short-circuit)');
    assert(ptAfter5 === ptBefore5, 'NO new points_transactions row written (short-circuit)');
    assert((await balance(testId)) === 0, 'DB balance still 0');

    // --- TEST 6: invalid input never throws --------------------------------
    console.log('\n[test 6a] delta=0 (key="adj-E-zero")');
    const ltBefore6a = await countLt(testId);
    const ptBefore6a = await countPt(lpId);
    let threw6a = false;
    let r6a: Awaited<ReturnType<typeof adjust>> | null = null;
    try {
      r6a = await adjust(tenantDb, {
        tenantId: TENANT_ID, customerId: testId,
        delta: 0, reason: 'zero delta', actorId: 1, idempotencyKey: 'adj-E-zero',
      });
    } catch (e) { threw6a = true; console.log(`  THREW: ${(e as Error).message}`); }
    console.log(`  result: ${JSON.stringify(r6a)}`);
    assert(threw6a === false, 'did NOT throw');
    assert(r6a?.success === false, 'success === false', r6a?.success);
    assert((await countLt(testId)) === ltBefore6a, 'no new ledger row');
    assert((await countPt(lpId)) === ptBefore6a, 'no new mirror row');

    console.log('\n[test 6b] reason="" (key="adj-F-emptyreason")');
    const ltBefore6b = await countLt(testId);
    const ptBefore6b = await countPt(lpId);
    let threw6b = false;
    let r6b: Awaited<ReturnType<typeof adjust>> | null = null;
    try {
      r6b = await adjust(tenantDb, {
        tenantId: TENANT_ID, customerId: testId,
        delta: -100, reason: '', actorId: 1, idempotencyKey: 'adj-F-emptyreason',
      });
    } catch (e) { threw6b = true; console.log(`  THREW: ${(e as Error).message}`); }
    console.log(`  result: ${JSON.stringify(r6b)}`);
    assert(threw6b === false, 'did NOT throw');
    assert(r6b?.success === false, 'success === false', r6b?.success);
    assert((await countLt(testId)) === ltBefore6b, 'no new ledger row');
    assert((await countPt(lpId)) === ptBefore6b, 'no new mirror row');
  } finally {
    // --- CLEANUP -----------------------------------------------------------
    if (testId !== null) {
      console.log('\n[cleanup] Removing all rows for synthetic customer...');
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

        console.log(`  deleted: points_transactions=${ptDel}, loyalty_transactions=${ltDel.length}, customer_achievements=${caDel.length}, loyalty_points=${lpDel.length}, customers=${cDel.length}`);

        const rPt = lpIds.length > 0
          ? (await db.select({ id: pointsTransactions.id }).from(pointsTransactions)
              .where(and(eq(pointsTransactions.tenantId, TENANT_ID), inArray(pointsTransactions.loyaltyPointsId, lpIds)))).length
          : 0;
        const rLt = (await db.select({ id: loyaltyTransactions.id }).from(loyaltyTransactions)
          .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)))).length;
        const rLp = (await db.select({ id: loyaltyPoints.id }).from(loyaltyPoints)
          .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)))).length;
        const rCa = (await db.select({ id: customerAchievements.id }).from(customerAchievements)
          .where(and(eq(customerAchievements.tenantId, TENANT_ID), eq(customerAchievements.customerId, testId)))).length;
        const rC = (await db.select({ id: customers.id }).from(customers)
          .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, testId)))).length;
        console.log(`  remaining: points_transactions=${rPt}, loyalty_transactions=${rLt}, loyalty_points=${rLp}, customer_achievements=${rCa}, customers=${rC}`);

        const allClean = rPt === 0 && rLt === 0 && rLp === 0 && rCa === 0 && rC === 0;
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
