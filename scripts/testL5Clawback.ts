/**
 * Stage L5-A functional test — refund clawback via clawbackInvoiceLoyalty().
 *
 * Proves the clawback path:
 *   1. basic clawback after a real invoice earn — balance returns to 0,
 *      adjustment row written with the expected promoKey + metadata
 *   2. idempotency — repeated calls (webhook replay) do not double-claw
 *   3. clamp — when the customer has already spent some/all of the points,
 *      adjust() lands the balance at exactly 0 (never negative)
 *   4. clean no-op when no earn row exists for the invoice
 *   5. clean no-op when the customer was never enrolled in loyalty
 *   6. failure isolation — clawbackInvoiceLoyalty never throws (Proxy fault
 *      injection inside the try-block, same shape as L4 Step 5)
 *
 * Runs against production DATABASE_URL with throwaway synthetic customers.
 * Every cleanup query is scoped by tenantId='root' + the synthetic ids.
 *
 * Run: npx tsx scripts/testL5Clawback.ts
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
import { adjust } from '../server/services/loyaltyLedger';
import { clawbackInvoiceLoyalty } from '../server/paymentHandler';
import { addLoyaltyPointsFromInvoice } from '../server/loyaltyService';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST_L5A__';
const SYNTH_PHONE = '+10000000006';
const SYNTH_NAME_2 = '__LEDGER_TEST_L5A_2__';
const SYNTH_PHONE_2 = '+10000000007';

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

async function balanceOf(customerId: number): Promise<number> {
  const [r] = await db
    .select()
    .from(loyaltyPoints)
    .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, customerId)));
  return r?.points ?? 0;
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

    const remCounts = await Promise.all([
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
            eq(loyaltyTransactions.customerId, testId),
          ),
        ),
      db
        .select({ id: redeemedRewards.id })
        .from(redeemedRewards)
        .where(
          and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, testId)),
        ),
      db
        .select({ id: loyaltyPoints.id })
        .from(loyaltyPoints)
        .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId))),
      db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.tenantId, TENANT_ID), eq(invoices.customerId, testId))),
      db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, testId))),
    ]);
    const [rPt, rLt, rRr, rLp, rInv, rC] = remCounts.map((x) => x.length);
    console.log(
      `  remaining: points_transactions=${rPt}, loyalty_transactions=${rLt}, redeemed_rewards=${rRr}, loyalty_points=${rLp}, invoices=${rInv}, customers=${rC}`,
    );
    const allClean = rPt === 0 && rLt === 0 && rRr === 0 && rLp === 0 && rInv === 0 && rC === 0;
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

async function makeInvoice(customerId: number, amount: number, label: string): Promise<number> {
  const [inv] = await db
    .insert(invoices)
    .values({
      tenantId: TENANT_ID,
      customerId,
      amount: String(amount),
      subtotal: null,
      status: 'paid',
      paymentStatus: 'paid',
      paidAt: new Date(),
      serviceDescription: `L5A test invoice (${label})`,
      invoiceType: 'manual',
    })
    .returning();
  if (!inv) throw new Error(`Failed to create test invoice (${label})`);
  return inv.id;
}

async function main() {
  console.log('\n=== clawbackInvoiceLoyalty test (L5-A) ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);
  let custId: number | null = null;
  let cust2Id: number | null = null;
  let cleanupResidue = false;

  try {
    // ── SETUP ─────────────────────────────────────────────────────────────
    console.log('[setup] Creating synthetic customer (opted in)...');
    const [cust] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME,
        phone: SYNTH_PHONE,
        loyaltyProgramOptIn: true,
        notes: 'Synthetic L5-A test customer — safe to delete',
      })
      .returning();
    if (!cust) throw new Error('Failed to create synthetic customer');
    custId = cust.id;
    console.log(`[setup] customer id = ${custId}`);

    // ── TEST 1: basic clawback ────────────────────────────────────────────
    console.log('\n[test 1] Basic clawback — award then refund');
    const inv1Id = await makeInvoice(custId, 500, 'test 1');
    console.log(`  invoice 1 id = ${inv1Id}`);

    await addLoyaltyPointsFromInvoice(tenantDb, custId, inv1Id, 500);
    const bal1Awarded = await balanceOf(custId);
    assert(bal1Awarded === 500, 'balance === 500 after award', bal1Awarded);

    const earnRows = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
          eq(loyaltyTransactions.promoKey, `invoice:${inv1Id}:${custId}`),
        ),
      );
    assert(earnRows.length === 1, 'exactly one earn row with promoKey invoice:<id>:<cid>', earnRows.length);
    const originalEarnId = earnRows[0]?.id;

    await clawbackInvoiceLoyalty(tenantDb, { invoiceId: inv1Id, customerId: custId });
    const bal1Clawed = await balanceOf(custId);
    assert(bal1Clawed === 0, 'balance === 0 after clawback', bal1Clawed);

    const clawbackRows = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
          eq(loyaltyTransactions.promoKey, `clawback:invoice:${inv1Id}:${custId}`),
        ),
      );
    assert(clawbackRows.length === 1, 'exactly one clawback adjustment row', clawbackRows.length);
    const cbRow = clawbackRows[0]!;
    assert(cbRow.deltaPoints === -500, 'clawback row deltaPoints === -500', cbRow.deltaPoints);
    assert(cbRow.source === 'adjustment', "clawback row source === 'adjustment'", cbRow.source);
    assert(cbRow.status === 'fulfilled', "clawback row status === 'fulfilled'", cbRow.status);
    const cbMeta = cbRow.metadata as any;
    assert(
      cbMeta?.originalEarnTransactionId === originalEarnId,
      'clawback metadata.originalEarnTransactionId points to original earn',
      cbMeta?.originalEarnTransactionId,
    );
    assert(cbMeta?.invoiceId === inv1Id, 'clawback metadata.invoiceId set', cbMeta?.invoiceId);

    // ── TEST 2: idempotency (webhook replay) ─────────────────────────────
    console.log('\n[test 2] Idempotency — replay same clawback');
    await clawbackInvoiceLoyalty(tenantDb, { invoiceId: inv1Id, customerId: custId });
    const bal2 = await balanceOf(custId);
    assert(bal2 === 0, 'balance still 0 after replay', bal2);
    const clawbackRows2 = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
          eq(loyaltyTransactions.promoKey, `clawback:invoice:${inv1Id}:${custId}`),
        ),
      );
    assert(clawbackRows2.length === 1, 'still exactly 1 clawback row after replay (idempotent)', clawbackRows2.length);

    // ── TEST 3: clamp when points already spent ──────────────────────────
    console.log('\n[test 3] Clamp — clawback after points partially spent');
    const inv2Id = await makeInvoice(custId, 300, 'test 3');
    console.log(`  invoice 2 id = ${inv2Id}`);
    await addLoyaltyPointsFromInvoice(tenantDb, custId, inv2Id, 300);
    const bal3Awarded = await balanceOf(custId);
    assert(bal3Awarded === 300, 'balance === 300 after award', bal3Awarded);

    const spend = await adjust(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      delta: -250,
      reason: 'test spend',
      actorId: null,
      idempotencyKey: `l5a:test-spend:${inv2Id}`,
    });
    assert(spend.success === true, 'test spend success');
    const bal3Spent = await balanceOf(custId);
    assert(bal3Spent === 50, 'balance === 50 after spend (300 - 250)', bal3Spent);

    await clawbackInvoiceLoyalty(tenantDb, { invoiceId: inv2Id, customerId: custId });
    const bal3Clawed = await balanceOf(custId);
    assert(bal3Clawed === 0, 'balance clamps to 0 (not -250)', bal3Clawed);

    const [clawback3] = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
          eq(loyaltyTransactions.promoKey, `clawback:invoice:${inv2Id}:${custId}`),
        ),
      );
    assert(clawback3 !== undefined, 'clawback row exists for invoice 2');
    assert(clawback3?.deltaPoints === -50, 'clawback deltaPoints === -50 (clamped from -300)', clawback3?.deltaPoints);
    const cb3Meta = clawback3?.metadata as any;
    assert(cb3Meta?.clamped === true, 'metadata.clamped === true', cb3Meta?.clamped);
    assert(cb3Meta?.requestedDelta === -300, 'metadata.requestedDelta === -300', cb3Meta?.requestedDelta);

    // ── TEST 4: no earn row (clean no-op) ────────────────────────────────
    console.log('\n[test 4] No earn row — clean no-op');
    const inv3Id = await makeInvoice(custId, 100, 'test 4');
    console.log(`  invoice 3 id = ${inv3Id}`);
    const ltBefore = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
        ),
      );
    const bal4Before = await balanceOf(custId);

    let threw4 = false;
    try {
      await clawbackInvoiceLoyalty(tenantDb, { invoiceId: inv3Id, customerId: custId });
    } catch (e) {
      threw4 = true;
      console.log(`  THREW: ${(e as Error).message}`);
    }
    assert(threw4 === false, 'clawback for invoice with no earn did NOT throw');

    const ltAfter = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
        ),
      );
    assert(
      ltAfter.length === ltBefore.length,
      'no new loyalty_transactions rows written (clean no-op)',
      { before: ltBefore.length, after: ltAfter.length },
    );
    const bal4After = await balanceOf(custId);
    assert(bal4After === bal4Before, 'balance unchanged', { before: bal4Before, after: bal4After });

    // ── TEST 5: non-enrolled customer (clean no-op) ──────────────────────
    console.log('\n[test 5] Non-enrolled customer — clean no-op');
    const [cust2] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME_2,
        phone: SYNTH_PHONE_2,
        loyaltyProgramOptIn: false,
        notes: 'Synthetic L5-A test customer 2 (non-enrolled) — safe to delete',
      })
      .returning();
    if (!cust2) throw new Error('Failed to create non-enrolled synthetic customer');
    cust2Id = cust2.id;
    console.log(`  customer 2 id = ${cust2Id}`);

    const inv4Id = await makeInvoice(cust2Id, 200, 'test 5 non-enrolled');
    console.log(`  invoice 4 id = ${inv4Id}`);

    // Confirm there's no loyalty_points row at all for this customer.
    const lp2Before = await db
      .select({ id: loyaltyPoints.id })
      .from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, cust2Id)));
    assert(lp2Before.length === 0, 'no loyalty_points row pre-clawback', lp2Before.length);

    let threw5 = false;
    try {
      await clawbackInvoiceLoyalty(tenantDb, { invoiceId: inv4Id, customerId: cust2Id });
    } catch (e) {
      threw5 = true;
      console.log(`  THREW: ${(e as Error).message}`);
    }
    assert(threw5 === false, 'clawback for non-enrolled customer did NOT throw');

    const lt5 = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, cust2Id),
        ),
      );
    assert(lt5.length === 0, 'no loyalty_transactions rows written for non-enrolled customer', lt5.length);
    const lp2After = await db
      .select({ id: loyaltyPoints.id })
      .from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, cust2Id)));
    assert(lp2After.length === 0, 'no loyalty_points row created (clean no-op)', lp2After.length);

    // ── TEST 6: failure isolation via Proxy fault injection ──────────────
    // clawbackInvoiceLoyalty reads tenantId via `tenantDb.tenant.id` inside
    // its try-block. Wrap tenantDb in a Proxy that throws on `.tenant` access
    // so the throw lands inside the function and is caught by its outer
    // try/catch. The function must return normally with no propagated throw.
    console.log('\n[test 6] Failure isolation — Proxy fault injection');
    const faultInjectedTenantDb = new Proxy(tenantDb, {
      get(target, prop, receiver) {
        if (prop === 'tenant') {
          throw new Error('INJECTED_FAULT_L5A');
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    let threw6 = false;
    try {
      await clawbackInvoiceLoyalty(faultInjectedTenantDb as typeof tenantDb, {
        invoiceId: inv1Id,
        customerId: custId,
      });
    } catch (e) {
      threw6 = true;
      console.log(`  THREW (should NOT happen): ${(e as Error).message}`);
    }
    assert(threw6 === false, 'clawbackInvoiceLoyalty did NOT throw despite injected fault');

    // Balance must be unchanged from end of test 4 (still 0, idempotent
    // replays + clamps already drove it to 0).
    const bal6 = await balanceOf(custId);
    assert(bal6 === bal4After, 'balance unchanged after fault-injected call', { before: bal4After, after: bal6 });
  } finally {
    if (custId !== null) {
      const ok = await cleanupCustomer(custId, 'cust1');
      if (!ok) cleanupResidue = true;
    } else {
      console.log('\n[cleanup:cust1] nothing to clean');
    }
    if (cust2Id !== null) {
      const ok = await cleanupCustomer(cust2Id, 'cust2');
      if (!ok) cleanupResidue = true;
    } else {
      console.log('\n[cleanup:cust2] nothing to clean');
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
