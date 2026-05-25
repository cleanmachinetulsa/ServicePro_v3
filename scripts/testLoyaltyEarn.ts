/**
 * Stage L2 Part 1 — functional test of loyaltyLedger.earn()
 *
 * Runs against the REAL production DATABASE_URL using ONE synthetic throwaway
 * customer. Every cleanup query is scoped to that customer's id AND tenantId;
 * the script NEVER touches any of the ~2,572 real customers.
 *
 * Run: npx tsx scripts/testLoyaltyEarn.ts
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
import { earn } from '../server/services/loyaltyLedger';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST__';
const SYNTH_PHONE = '+10000000000';

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

async function main() {
  console.log('\n=== loyaltyLedger.earn() functional test ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);
  let testId: number | null = null;
  let cleanupResidue = false;

  try {
    // --- SETUP: create synthetic customer -----------------------------------
    console.log('[setup] Creating synthetic customer...');
    const [created] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME,
        phone: SYNTH_PHONE,
        notes: 'Synthetic test row for loyaltyLedger.earn() — safe to delete',
      })
      .returning();

    if (!created) throw new Error('Failed to create synthetic test customer');
    testId = created.id;
    console.log(`[setup] Synthetic customer id = ${testId}\n`);

    // --- TEST 1: basic earn -------------------------------------------------
    console.log('[test 1] Basic earn (amount=100, key="test-earn-A")');
    const r1 = await earn(tenantDb, {
      tenantId: TENANT_ID,
      customerId: testId,
      amount: 100,
      source: 'test',
      idempotencyKey: 'test-earn-A',
      description: 'test earn A',
    });
    console.log(`  result: ${JSON.stringify(r1)}`);
    assert(r1.success === true, 'success === true');
    assert(r1.alreadyApplied === false, 'alreadyApplied === false');
    assert(r1.newBalance === 100, 'newBalance === 100', r1.newBalance);

    const lp1 = await db.select().from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
    assert(lp1.length === 1, 'exactly 1 loyalty_points row', lp1.length);
    assert(lp1[0]?.points === 100, 'loyalty_points.points === 100', lp1[0]?.points);

    const lt1 = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)));
    assert(lt1.length === 1, 'exactly 1 loyalty_transactions row', lt1.length);
    assert(lt1[0]?.deltaPoints === 100, "loyalty_transactions.deltaPoints === 100", lt1[0]?.deltaPoints);
    assert(lt1[0]?.status === 'fulfilled', "loyalty_transactions.status === 'fulfilled'", lt1[0]?.status);
    assert(lt1[0]?.promoKey === 'test-earn-A', "loyalty_transactions.promoKey === 'test-earn-A'", lt1[0]?.promoKey);

    const lpId = lp1[0]!.id;
    const pt1 = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId)));
    assert(pt1.length === 1, 'exactly 1 points_transactions row', pt1.length);
    assert(pt1[0]?.amount === 100, 'points_transactions.amount === 100', pt1[0]?.amount);
    assert(pt1[0]?.transactionType === 'earn', "points_transactions.transactionType === 'earn'", pt1[0]?.transactionType);
    assert(pt1[0]?.transactionDate !== null && pt1[0]?.transactionDate !== undefined, 'points_transactions.transactionDate is not null');

    // --- TEST 2: idempotency replay (port_recovery-bug proof) --------------
    console.log('\n[test 2] Idempotency replay — identical args, same key');
    const r2 = await earn(tenantDb, {
      tenantId: TENANT_ID,
      customerId: testId,
      amount: 100,
      source: 'test',
      idempotencyKey: 'test-earn-A',
      description: 'test earn A',
    });
    console.log(`  result: ${JSON.stringify(r2)}`);
    assert(r2.success === true, 'success === true');
    assert(r2.alreadyApplied === true, 'alreadyApplied === true (idempotent short-circuit)');

    const lp2 = await db.select().from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
    assert(lp2[0]?.points === 100, 'balance UNCHANGED at 100', lp2[0]?.points);
    const lt2 = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)));
    assert(lt2.length === 1, 'still exactly 1 loyalty_transactions row', lt2.length);
    const pt2 = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId)));
    assert(pt2.length === 1, 'still exactly 1 points_transactions row', pt2.length);

    // --- TEST 3: distinct key accumulates ----------------------------------
    console.log('\n[test 3] Distinct key (amount=250, key="test-earn-B")');
    const r3 = await earn(tenantDb, {
      tenantId: TENANT_ID,
      customerId: testId,
      amount: 250,
      source: 'test',
      idempotencyKey: 'test-earn-B',
      description: 'test earn B',
    });
    console.log(`  result: ${JSON.stringify(r3)}`);
    assert(r3.success === true, 'success === true');
    assert(r3.alreadyApplied === false, 'alreadyApplied === false');
    assert(r3.newBalance === 350, 'newBalance === 350', r3.newBalance);

    const lp3 = await db.select().from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
    assert(lp3[0]?.points === 350, 'loyalty_points.points === 350', lp3[0]?.points);
    const lt3 = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)));
    assert(lt3.length === 2, 'exactly 2 loyalty_transactions rows', lt3.length);
    const pt3 = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId)));
    assert(pt3.length === 2, 'exactly 2 points_transactions rows', pt3.length);

    // --- TEST 4: invalid amount never throws --------------------------------
    console.log('\n[test 4] Invalid amount (0) — must NOT throw');
    let threw = false;
    let r4: Awaited<ReturnType<typeof earn>> | null = null;
    try {
      r4 = await earn(tenantDb, {
        tenantId: TENANT_ID,
        customerId: testId,
        amount: 0,
        source: 'test',
        idempotencyKey: 'test-earn-C-invalid',
        description: 'test earn C invalid',
      });
    } catch (e) {
      threw = true;
      console.log(`  THREW: ${(e as Error).message}`);
    }
    console.log(`  result: ${JSON.stringify(r4)}`);
    assert(threw === false, 'did NOT throw');
    assert(r4?.success === false, 'success === false', r4?.success);
    assert(r4?.alreadyApplied === false, 'alreadyApplied === false', r4?.alreadyApplied);
    assert(r4?.newBalance === 0, 'newBalance === 0', r4?.newBalance);
    assert(r4?.tierName === null, 'tierName === null', r4?.tierName);

    const lp4 = await db.select().from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
    assert(lp4[0]?.points === 350, 'balance UNCHANGED at 350', lp4[0]?.points);
    const lt4 = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)));
    assert(lt4.length === 2, 'still exactly 2 loyalty_transactions rows', lt4.length);
    const pt4 = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId)));
    assert(pt4.length === 2, 'still exactly 2 points_transactions rows', pt4.length);
  } finally {
    // --- CLEANUP: always runs if a customer was created ---------------------
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

        // Strict residual check — across ALL lpIds, all tables
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
        if (allClean) {
          console.log('  CLEANUP OK — zero test rows remain');
        } else {
          cleanupResidue = true;
          console.log('  CLEANUP WARNING — some rows still present');
        }
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
