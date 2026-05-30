/**
 * CM-1 functional test — port-recovery points award via the canonical ledger.
 *
 * Proves the fix for the Dec-2025 blast bug (DEF-33) AND the L1-4 duplication:
 *   grantPortRecoveryPoints() now routes through loyaltyLedger.earn() with a
 *   STABLE per-customer idempotency key (`port_recovery_apology:${customerId}`),
 *   so the apology award lands exactly once per customer — even when the campaign
 *   is re-run under a DIFFERENT campaign ID.
 *
 * Runs against the REAL production DATABASE_URL using ONE synthetic throwaway
 * customer. Every query is scoped to that customer's id AND tenantId; the script
 * NEVER touches any of the ~2,572 real customers, and always cleans up.
 *
 * Run: npx tsx scripts/testCM1PortRecoveryPoints.ts
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
import { grantPortRecoveryPoints } from '../server/services/portRecoveryService';

const TENANT_ID = 'root';
const SYNTH_NAME = '__CM1_PORTRECOVERY_TEST__';
const SYNTH_PHONE = '+10000000001';

// Two DIFFERENT campaign IDs — the whole point of the test is that the second
// run (a rebuilt campaign with a new ID) does NOT re-award. These are large
// synthetic IDs that will not collide with any real campaign row.
const CAMPAIGN_ID_RUN_1 = 990001;
const CAMPAIGN_ID_RUN_2 = 990002;
const POINTS = 500;

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
  console.log('\n=== CM-1 grantPortRecoveryPoints() functional test ===\n');

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
        notes: 'Synthetic test row for CM-1 port-recovery points — safe to delete',
      })
      .returning();

    if (!created) throw new Error('Failed to create synthetic test customer');
    testId = created.id;
    const expectedKey = `port_recovery_apology:${testId}`;
    console.log(`[setup] Synthetic customer id = ${testId}, expected key = "${expectedKey}"\n`);

    // --- TEST 1: first award (campaign run #1) ------------------------------
    console.log(`[test 1] First award — campaignId=${CAMPAIGN_ID_RUN_1}, points=${POINTS}`);
    const r1 = await grantPortRecoveryPoints(tenantDb, testId, POINTS, CAMPAIGN_ID_RUN_1);
    console.log(`  result: ${JSON.stringify(r1)}`);
    assert(r1.success === true, 'success === true');
    assert(r1.wasSkipped === false, 'wasSkipped === false (fresh award)', r1.wasSkipped);
    assert(r1.currentPoints === POINTS, `currentPoints === ${POINTS}`, r1.currentPoints);

    // balance
    const lp1 = await db.select().from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
    assert(lp1.length === 1, 'exactly 1 loyalty_points row', lp1.length);
    assert(lp1[0]?.points === POINTS, `loyalty_points.points === ${POINTS}`, lp1[0]?.points);
    const lpId = lp1[0]!.id;

    // canonical ledger row
    const lt1 = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)));
    assert(lt1.length === 1, 'exactly 1 loyalty_transactions row', lt1.length);
    assert(lt1[0]?.deltaPoints === POINTS, `loyalty_transactions.deltaPoints === ${POINTS}`, lt1[0]?.deltaPoints);
    assert(lt1[0]?.status === 'fulfilled', "loyalty_transactions.status === 'fulfilled'", lt1[0]?.status);
    assert(lt1[0]?.source === 'port_recovery', "loyalty_transactions.source === 'port_recovery'", lt1[0]?.source);
    assert(lt1[0]?.promoKey === expectedKey, `loyalty_transactions.promoKey === "${expectedKey}"`, lt1[0]?.promoKey);

    // mirror row
    const pt1 = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId)));
    assert(pt1.length === 1, 'exactly 1 points_transactions mirror row', pt1.length);
    assert(pt1[0]?.amount === POINTS, `points_transactions.amount === ${POINTS}`, pt1[0]?.amount);
    assert(pt1[0]?.transactionType === 'earn', "points_transactions.transactionType === 'earn'", pt1[0]?.transactionType);
    assert(pt1[0]?.source === 'port_recovery', "points_transactions.source === 'port_recovery'", pt1[0]?.source);

    // --- TEST 2: re-run under a DIFFERENT campaign ID (the L1-4 bug case) ----
    console.log(`\n[test 2] Re-run — DIFFERENT campaignId=${CAMPAIGN_ID_RUN_2} (must NOT re-award)`);
    const r2 = await grantPortRecoveryPoints(tenantDb, testId, POINTS, CAMPAIGN_ID_RUN_2);
    console.log(`  result: ${JSON.stringify(r2)}`);
    assert(r2.success === true, 'success === true (idempotent no-op is a success)');
    assert(r2.wasSkipped === true, 'wasSkipped === true (already awarded under prior campaign)', r2.wasSkipped);
    assert(r2.currentPoints === POINTS, `currentPoints still === ${POINTS}`, r2.currentPoints);

    const lp2 = await db.select().from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
    assert(lp2[0]?.points === POINTS, `balance UNCHANGED at ${POINTS} (no double award)`, lp2[0]?.points);

    const lt2 = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)));
    assert(lt2.length === 1, 'still exactly 1 loyalty_transactions row', lt2.length);

    const pt2 = await db.select().from(pointsTransactions)
      .where(and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId)));
    assert(pt2.length === 1, 'still exactly 1 points_transactions row', pt2.length);

    // --- TEST 3: invalid points value never throws, never awards ------------
    console.log('\n[test 3] Invalid points (0) — must NOT throw, must NOT award');
    let threw = false;
    let r3: Awaited<ReturnType<typeof grantPortRecoveryPoints>> | null = null;
    try {
      r3 = await grantPortRecoveryPoints(tenantDb, testId, 0, CAMPAIGN_ID_RUN_1);
    } catch (e) {
      threw = true;
      console.log(`  THREW: ${(e as Error).message}`);
    }
    console.log(`  result: ${JSON.stringify(r3)}`);
    assert(threw === false, 'did NOT throw');
    assert(r3?.success === false, 'success === false', r3?.success);
    assert(r3?.wasSkipped === true, 'wasSkipped === true', r3?.wasSkipped);

    const lp3 = await db.select().from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
    assert(lp3[0]?.points === POINTS, `balance UNCHANGED at ${POINTS}`, lp3[0]?.points);
    const lt3 = await db.select().from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, testId)));
    assert(lt3.length === 1, 'still exactly 1 loyalty_transactions row', lt3.length);
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
