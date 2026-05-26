/**
 * Stage L4 Step 3A — functional test of finalizeInvoicePaid()
 *
 * Proves the shared chokepoint awards loyalty points correctly across all
 * invoice-finalization paths, dedupes via the ledger idempotency key, honors
 * the opt-in guard, and never throws on loyalty failure (so payment paths
 * cannot be broken by a loyalty error).
 *
 * Runs against the REAL production DATABASE_URL using TWO synthetic throwaway
 * customers. Every cleanup query is scoped by tenantId + customerId; the
 * script NEVER touches real customers.
 *
 * Run: npx tsx scripts/testL4FinalizeInvoice.ts
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { wrapTenantDb } from '../server/tenantDb';
import {
  customers,
  invoices,
  loyaltyPoints,
  loyaltyTransactions,
  pointsTransactions,
  customerAchievements,
  redeemedRewards,
} from '@shared/schema';
import { finalizeInvoicePaid } from '../server/paymentHandler';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST_L4__';
const SYNTH_PHONE_OPTIN = '+10000000004';
const SYNTH_NAME_OPTOUT = '__LEDGER_TEST_L4_OPTOUT__';
const SYNTH_PHONE_OPTOUT = '+10000000005';

let passCount = 0;
let failCount = 0;

function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    passCount++;
    console.log(`  PASS — ${label}`);
  } else {
    failCount++;
    console.log(
      `  FAIL — ${label}`,
      detail !== undefined ? `\n         got: ${JSON.stringify(detail)}` : '',
    );
  }
}

async function cleanupCustomer(testId: number, label: string): Promise<boolean> {
  console.log(`\n[cleanup:${label}] Removing all rows for customer ${testId}...`);
  try {
    const lp = await db
      .select({ id: loyaltyPoints.id })
      .from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)));
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
          eq(loyaltyTransactions.customerId, testId),
        ),
      )
      .returning({ id: loyaltyTransactions.id });
    const rrDel = await db
      .delete(redeemedRewards)
      .where(
        and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, testId)),
      )
      .returning({ id: redeemedRewards.id });
    const caDel = await db
      .delete(customerAchievements)
      .where(
        and(
          eq(customerAchievements.tenantId, TENANT_ID),
          eq(customerAchievements.customerId, testId),
        ),
      )
      .returning({ id: customerAchievements.id });
    const lpDel = await db
      .delete(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)))
      .returning({ id: loyaltyPoints.id });
    // Invoices reference customers (FK) — delete BEFORE the customer row.
    const invDel = await db
      .delete(invoices)
      .where(and(eq(invoices.tenantId, TENANT_ID), eq(invoices.customerId, testId)))
      .returning({ id: invoices.id });
    const cDel = await db
      .delete(customers)
      .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, testId)))
      .returning({ id: customers.id });

    console.log(
      `  deleted: points_transactions=${ptDel}, loyalty_transactions=${ltDel.length}, redeemed_rewards=${rrDel.length}, customer_achievements=${caDel.length}, loyalty_points=${lpDel.length}, invoices=${invDel.length}, customers=${cDel.length}`,
    );

    const rPt =
      lpIds.length > 0
        ? (
            await db
              .select({ id: pointsTransactions.id })
              .from(pointsTransactions)
              .where(
                and(
                  eq(pointsTransactions.tenantId, TENANT_ID),
                  inArray(pointsTransactions.loyaltyPointsId, lpIds),
                ),
              )
          ).length
        : 0;
    const rLt = (
      await db
        .select({ id: loyaltyTransactions.id })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, TENANT_ID),
            eq(loyaltyTransactions.customerId, testId),
          ),
        )
    ).length;
    const rLp = (
      await db
        .select({ id: loyaltyPoints.id })
        .from(loyaltyPoints)
        .where(
          and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)),
        )
    ).length;
    const rRr = (
      await db
        .select({ id: redeemedRewards.id })
        .from(redeemedRewards)
        .where(
          and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, testId)),
        )
    ).length;
    const rCa = (
      await db
        .select({ id: customerAchievements.id })
        .from(customerAchievements)
        .where(
          and(
            eq(customerAchievements.tenantId, TENANT_ID),
            eq(customerAchievements.customerId, testId),
          ),
        )
    ).length;
    const rInv = (
      await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.tenantId, TENANT_ID), eq(invoices.customerId, testId)))
    ).length;
    const rC = (
      await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, testId)))
    ).length;

    console.log(
      `  remaining: points_transactions=${rPt}, loyalty_transactions=${rLt}, loyalty_points=${rLp}, redeemed_rewards=${rRr}, customer_achievements=${rCa}, invoices=${rInv}, customers=${rC}`,
    );

    const allClean =
      rPt === 0 && rLt === 0 && rLp === 0 && rRr === 0 && rCa === 0 && rInv === 0 && rC === 0;
    if (allClean) {
      console.log(`  CLEANUP OK — zero test rows remain for customer ${testId}`);
      return true;
    }
    console.log(`  CLEANUP WARNING — residue remains for customer ${testId}`);
    return false;
  } catch (e) {
    console.error(`  CLEANUP ERROR for customer ${testId}:`, (e as Error).message);
    return false;
  }
}

async function main() {
  console.log('\n=== finalizeInvoicePaid() functional test (L4 Step 3A) ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);
  let optInId: number | null = null;
  let optOutId: number | null = null;
  let cleanupResidue = false;

  try {
    // ── SETUP: opted-in synthetic customer ─────────────────────────────────
    console.log('[setup] Creating opted-in synthetic customer...');
    const [optIn] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME,
        phone: SYNTH_PHONE_OPTIN,
        loyaltyProgramOptIn: true,
        notes: 'Synthetic test row for finalizeInvoicePaid() — safe to delete',
      })
      .returning();
    if (!optIn) throw new Error('Failed to create opted-in synthetic customer');
    optInId = optIn.id;
    console.log(`[setup] opted-in customer id = ${optInId}\n`);

    // ── TEST 1: finalizeInvoicePaid awards points (basis = amount, no subtotal)
    console.log('[test 1] Award via finalizeInvoicePaid (amount=400, subtotal=null)');
    const [inv1] = await db
      .insert(invoices)
      .values({
        tenantId: TENANT_ID,
        customerId: optInId,
        amount: '400',
        subtotal: null,
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
        serviceDescription: 'L4 test invoice 1',
        invoiceType: 'manual',
      })
      .returning();
    if (!inv1) throw new Error('Failed to create test invoice 1');
    const inv1Id = inv1.id;
    console.log(`  invoice 1 id = ${inv1Id}`);

    await finalizeInvoicePaid(tenantDb, {
      id: inv1Id,
      customerId: optInId,
      subtotal: null,
      amount: 400,
    });

    const lp1 = await db
      .select()
      .from(loyaltyPoints)
      .where(
        and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, optInId)),
      );
    assert(lp1.length === 1, 'exactly 1 loyalty_points row', lp1.length);
    assert(lp1[0]?.points === 400, 'balance === 400', lp1[0]?.points);

    const lt1 = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, optInId),
        ),
      );
    assert(lt1.length === 1, 'exactly 1 loyalty_transactions row', lt1.length);
    assert(lt1[0]?.source === 'invoice', "source === 'invoice'", lt1[0]?.source);
    assert(
      lt1[0]?.promoKey === `invoice:${inv1Id}:${optInId}`,
      `promoKey === invoice:${inv1Id}:${optInId}`,
      lt1[0]?.promoKey,
    );

    const lpId = lp1[0]!.id;
    const pt1 = await db
      .select()
      .from(pointsTransactions)
      .where(
        and(
          eq(pointsTransactions.tenantId, TENANT_ID),
          eq(pointsTransactions.loyaltyPointsId, lpId),
        ),
      );
    assert(pt1.length === 1, 'exactly 1 points_transactions mirror row', pt1.length);
    assert(pt1[0]?.amount === 400, 'mirror.amount === 400', pt1[0]?.amount);

    // ── TEST 2: earn basis uses subtotal when present (pre-tax) ────────────
    console.log('\n[test 2] Earn basis uses subtotal (subtotal=300, amount=350 → +300)');
    const [inv2] = await db
      .insert(invoices)
      .values({
        tenantId: TENANT_ID,
        customerId: optInId,
        amount: '350',
        subtotal: '300',
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
        serviceDescription: 'L4 test invoice 2',
        invoiceType: 'manual',
      })
      .returning();
    if (!inv2) throw new Error('Failed to create test invoice 2');
    const inv2Id = inv2.id;
    console.log(`  invoice 2 id = ${inv2Id}`);

    await finalizeInvoicePaid(tenantDb, {
      id: inv2Id,
      customerId: optInId,
      subtotal: '300',
      amount: '350',
    });

    const lp2 = await db
      .select()
      .from(loyaltyPoints)
      .where(
        and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, optInId)),
      );
    assert(lp2[0]?.points === 700, 'balance === 700 (400 + 300)', lp2[0]?.points);
    const lt2 = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, optInId),
        ),
      );
    assert(lt2.length === 2, 'exactly 2 loyalty_transactions rows', lt2.length);
    const lt2New = lt2.find((r) => r.promoKey === `invoice:${inv2Id}:${optInId}`);
    assert(lt2New?.deltaPoints === 300, 'inv2 deltaPoints === 300 (pre-tax)', lt2New?.deltaPoints);

    // ── TEST 3: idempotency — calling again on inv1 must not double-award ──
    console.log('\n[test 3] Idempotency — replay finalizeInvoicePaid for invoice 1');
    await finalizeInvoicePaid(tenantDb, {
      id: inv1Id,
      customerId: optInId,
      subtotal: null,
      amount: 400,
    });

    const lp3 = await db
      .select()
      .from(loyaltyPoints)
      .where(
        and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, optInId)),
      );
    assert(lp3[0]?.points === 700, 'balance UNCHANGED at 700', lp3[0]?.points);
    const lt3 = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, optInId),
        ),
      );
    assert(lt3.length === 2, 'still exactly 2 loyalty_transactions rows', lt3.length);
    const pt3 = await db
      .select()
      .from(pointsTransactions)
      .where(
        and(
          eq(pointsTransactions.tenantId, TENANT_ID),
          eq(pointsTransactions.loyaltyPointsId, lpId),
        ),
      );
    assert(pt3.length === 2, 'still exactly 2 points_transactions rows', pt3.length);

    // ── TEST 4: failure isolation — finalizeInvoicePaid MUST NOT throw ────
    // Pass a null tenantDb so the inner addLoyaltyPointsFromInvoice select
    // throws synchronously. The outer try/catch in finalizeInvoicePaid must
    // swallow it and return cleanly. This is the contract that protects
    // payment finalization from loyalty failures.
    console.log('\n[test 4] Failure isolation — bad tenantDb must NOT throw');
    let threw = false;
    let retVal: unknown = 'sentinel';
    try {
      retVal = await finalizeInvoicePaid(null as any, {
        id: inv1Id,
        customerId: optInId,
        subtotal: null,
        amount: 400,
      });
    } catch (e) {
      threw = true;
      console.log(`  THREW: ${(e as Error).message}`);
    }
    assert(threw === false, 'finalizeInvoicePaid did NOT throw on inner failure');
    assert(retVal === undefined, 'finalizeInvoicePaid returned undefined (Promise<void>)', retVal);

    // Balance unchanged
    const lp4 = await db
      .select()
      .from(loyaltyPoints)
      .where(
        and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, optInId)),
      );
    assert(lp4[0]?.points === 700, 'balance still 700 after failure isolation test', lp4[0]?.points);

    // ── TEST 5: opt-in guard ──────────────────────────────────────────────
    console.log('\n[test 5] Opt-in guard — opted-out customer must NOT earn points');
    const [optOut] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME_OPTOUT,
        phone: SYNTH_PHONE_OPTOUT,
        loyaltyProgramOptIn: false,
        notes: 'Synthetic opt-out test row for finalizeInvoicePaid() — safe to delete',
      })
      .returning();
    if (!optOut) throw new Error('Failed to create opted-out synthetic customer');
    optOutId = optOut.id;
    console.log(`  opted-out customer id = ${optOutId}`);

    const [inv5] = await db
      .insert(invoices)
      .values({
        tenantId: TENANT_ID,
        customerId: optOutId,
        amount: '150',
        subtotal: null,
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
        serviceDescription: 'L4 test invoice 5 (opt-out)',
        invoiceType: 'manual',
      })
      .returning();
    if (!inv5) throw new Error('Failed to create test invoice 5');

    let threw5 = false;
    try {
      await finalizeInvoicePaid(tenantDb, {
        id: inv5.id,
        customerId: optOutId,
        subtotal: null,
        amount: 150,
      });
    } catch (e) {
      threw5 = true;
      console.log(`  THREW: ${(e as Error).message}`);
    }
    assert(threw5 === false, 'finalizeInvoicePaid did NOT throw for opted-out customer');

    const lp5 = await db
      .select()
      .from(loyaltyPoints)
      .where(
        and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, optOutId)),
      );
    assert(lp5.length === 0, 'opted-out: zero loyalty_points rows', lp5.length);
    const lt5 = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, optOutId),
        ),
      );
    assert(lt5.length === 0, 'opted-out: zero loyalty_transactions rows', lt5.length);
  } finally {
    if (optInId !== null) {
      const ok = await cleanupCustomer(optInId, 'opt-in');
      if (!ok) cleanupResidue = true;
    } else {
      console.log('\n[cleanup:opt-in] nothing to clean — customer never created');
    }
    if (optOutId !== null) {
      const ok = await cleanupCustomer(optOutId, 'opt-out');
      if (!ok) cleanupResidue = true;
    } else {
      console.log('\n[cleanup:opt-out] nothing to clean — customer never created');
    }
  }

  console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed ===\n`);
  await pool.end();
  process.exit(failCount === 0 && !cleanupResidue ? 0 : 1);
}

main().catch(async (e) => {
  console.error('UNCAUGHT:', e);
  try {
    await pool.end();
  } catch {}
  process.exit(2);
});
