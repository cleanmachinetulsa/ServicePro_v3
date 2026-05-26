/**
 * Stage L4 Step 3B — functional test of redemption application via
 * finalizeInvoicePaid().
 *
 * Proves the redemption block in finalizeInvoicePaid:
 *   1. consumes a pending reservation and stamps redeemed_rewards.invoice_id
 *   2. is idempotent across repeat finalize calls on the same invoice
 *   3. no-ops cleanly when no pending reservation exists
 *   4. prefers an appointmentId-scoped match over the customer-FIFO fallback
 *   5. is failure-isolated — Block A (point award) and Block B (redemption)
 *      run independently and neither can throw out of finalizeInvoicePaid
 *
 * Runs against the REAL production DATABASE_URL with synthetic throwaway
 * customers. Every cleanup query is scoped by tenantId + the synthetic ids;
 * the script NEVER touches real customers/rewards/invoices.
 *
 * Run: npx tsx scripts/testL4Redemption.ts
 */

import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { wrapTenantDb } from '../server/tenantDb';
import {
  appointments,
  customers,
  invoices,
  loyaltyPoints,
  loyaltyTransactions,
  pointsTransactions,
  customerAchievements,
  redeemedRewards,
  rewardServices,
  services,
} from '@shared/schema';
import { earn, reserve } from '../server/services/loyaltyLedger';
import { finalizeInvoicePaid } from '../server/paymentHandler';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST_L4B__';
const SYNTH_PHONE = '+10000000005';
const SYNTH_NAME_2 = '__LEDGER_TEST_L4B_2__';
const SYNTH_PHONE_2 = '+10000000006';
const SYNTH_REWARD_NAME = '__LEDGER_TEST_L4B_REWARD__';

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
    // Invoices reference customers (FK) — delete BEFORE the customer row.
    const invDel = await db
      .delete(invoices)
      .where(and(eq(invoices.tenantId, TENANT_ID), eq(invoices.customerId, testId)))
      .returning({ id: invoices.id });
    // Appointments reference customers — delete BEFORE the customer row.
    const apptDel = await db
      .delete(appointments)
      .where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.customerId, testId)))
      .returning({ id: appointments.id });
    const cDel = await db
      .delete(customers)
      .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, testId)))
      .returning({ id: customers.id });

    console.log(
      `  deleted: points_transactions=${ptDel}, loyalty_transactions=${ltDel.length}, redeemed_rewards=${rrDel.length}, customer_achievements=${caDel.length}, loyalty_points=${lpDel.length}, invoices=${invDel.length}, appointments=${apptDel.length}, customers=${cDel.length}`,
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
        .where(
          and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, testId)),
        ),
      db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.tenantId, TENANT_ID), eq(invoices.customerId, testId))),
      db
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.customerId, testId))),
      db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, testId))),
    ]);
    const [rPt, rLt, rRr, rLp, rInv, rAppt, rC] = remCounts.map((x) => x.length);
    console.log(
      `  remaining: points_transactions=${rPt}, loyalty_transactions=${rLt}, redeemed_rewards=${rRr}, loyalty_points=${rLp}, invoices=${rInv}, appointments=${rAppt}, customers=${rC}`,
    );

    const allClean =
      rPt === 0 && rLt === 0 && rRr === 0 && rLp === 0 && rInv === 0 && rAppt === 0 && rC === 0;
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
  console.log('\n=== finalizeInvoicePaid redemption application test (L4 Step 3B) ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);
  let custId: number | null = null;
  let cust2Id: number | null = null;
  let rewardId: number | null = null;
  let serviceId: number | null = null;
  let cleanupResidue = false;

  try {
    // ── SETUP ───────────────────────────────────────────────────────────────
    console.log('[setup] Locating an existing services row for appointments FK...');
    const [svc] = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.tenantId, TENANT_ID))
      .limit(1);
    if (!svc) throw new Error('No services row exists for tenant root — cannot create test appointment');
    serviceId = svc.id;
    console.log(`[setup] using service id ${serviceId}`);

    console.log('[setup] Creating synthetic reward (pointCost 300)...');
    const [reward] = await db
      .insert(rewardServices)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_REWARD_NAME,
        description: 'Synthetic L4 Step 3B test reward — safe to delete',
        pointCost: 300,
        tier: 'tier_500',
        active: true,
      })
      .returning();
    if (!reward) throw new Error('Failed to create synthetic reward');
    rewardId = reward.id;
    console.log(`[setup] reward id = ${rewardId}`);

    console.log('[setup] Creating synthetic customer (opted in)...');
    const [cust] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME,
        phone: SYNTH_PHONE,
        loyaltyProgramOptIn: true,
        notes: 'Synthetic L4 Step 3B test customer — safe to delete',
      })
      .returning();
    if (!cust) throw new Error('Failed to create synthetic customer');
    custId = cust.id;
    console.log(`[setup] customer id = ${custId}`);

    console.log('[setup] Seeding balance: earn 1000...');
    const seed = await earn(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      amount: 1000,
      source: 'test',
      idempotencyKey: `l4b:seed:${custId}`,
      description: 'L4B seed balance',
    });
    assert(seed.success === true, 'seed earn success');
    assert((await balanceOf(custId)) === 1000, 'balance === 1000 after seed');

    // ── TEST 1: basic redemption application ───────────────────────────────
    console.log('\n[test 1] Basic redemption application');
    const r1 = await reserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l4b-res-1',
    });
    assert(r1.success === true && r1.reservationId !== null, 'reserve() success');
    const res1Id = r1.reservationId!;
    assert((await balanceOf(custId)) === 700, 'balance === 700 after reserve (1000 - 300)');

    const [res1Before] = await db
      .select()
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, res1Id)));
    assert(res1Before?.status === 'pending', 'reservation status pending', res1Before?.status);
    assert(res1Before?.invoiceId === null, 'reservation invoice_id NULL before finalize', res1Before?.invoiceId);

    const [inv1] = await db
      .insert(invoices)
      .values({
        tenantId: TENANT_ID,
        customerId: custId,
        amount: '400',
        subtotal: null,
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
        serviceDescription: 'L4B test invoice 1',
        invoiceType: 'manual',
      })
      .returning();
    if (!inv1) throw new Error('Failed to create test invoice 1');
    console.log(`  invoice 1 id = ${inv1.id}`);

    await finalizeInvoicePaid(tenantDb, {
      id: inv1.id,
      customerId: custId,
      subtotal: null,
      amount: 400,
      appointmentId: null,
    });

    const [res1After] = await db
      .select()
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, res1Id)));
    assert(res1After?.status === 'completed', 'reservation status → completed', res1After?.status);
    assert(res1After?.invoiceId === inv1.id, `reservation.invoice_id === ${inv1.id}`, res1After?.invoiceId);

    const ltRedemption = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
          eq(loyaltyTransactions.source, 'redemption'),
        ),
      );
    const lt1Red = ltRedemption.find(
      (r) => (r.metadata as any)?.reservationId === res1Id,
    );
    assert(lt1Red?.status === 'fulfilled', 'redemption ledger row → fulfilled', lt1Red?.status);

    // Block A still ran — balance should be 700 (reserve debit) + 400 (earn) = 1100
    const bal1 = await balanceOf(custId);
    assert(bal1 === 1100, 'balance === 1100 (700 + 400 earn from invoice)', bal1);

    // ── TEST 2: idempotency — re-finalize same invoice ─────────────────────
    console.log('\n[test 2] Idempotency — re-finalize invoice 1');
    await finalizeInvoicePaid(tenantDb, {
      id: inv1.id,
      customerId: custId,
      subtotal: null,
      amount: 400,
      appointmentId: null,
    });

    const completedRows = await db
      .select({ id: redeemedRewards.id, invoiceId: redeemedRewards.invoiceId })
      .from(redeemedRewards)
      .where(
        and(
          eq(redeemedRewards.tenantId, TENANT_ID),
          eq(redeemedRewards.customerId, custId),
          eq(redeemedRewards.invoiceId, inv1.id),
        ),
      );
    assert(completedRows.length === 1, 'still exactly 1 redeemed_rewards row stamped with inv1.id', completedRows.length);

    const bal2 = await balanceOf(custId);
    assert(bal2 === 1100, 'balance UNCHANGED at 1100 (idempotent earn + idempotent apply)', bal2);

    // ── TEST 3: invoice with no pending reservation → Block B no-ops ──────
    console.log('\n[test 3] No pending reservation — Block A still awards');
    const [inv3] = await db
      .insert(invoices)
      .values({
        tenantId: TENANT_ID,
        customerId: custId,
        amount: '200',
        subtotal: null,
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
        serviceDescription: 'L4B test invoice 3 (no reservation)',
        invoiceType: 'manual',
      })
      .returning();
    if (!inv3) throw new Error('Failed to create invoice 3');

    let threw3 = false;
    try {
      await finalizeInvoicePaid(tenantDb, {
        id: inv3.id,
        customerId: custId,
        subtotal: null,
        amount: 200,
        appointmentId: null,
      });
    } catch (e) {
      threw3 = true;
      console.log(`  THREW: ${(e as Error).message}`);
    }
    assert(threw3 === false, 'finalizeInvoicePaid did NOT throw with no pending reservation');

    // No new completed reservations linked to inv3
    const inv3Reservations = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(
        and(
          eq(redeemedRewards.tenantId, TENANT_ID),
          eq(redeemedRewards.invoiceId, inv3.id),
        ),
      );
    assert(inv3Reservations.length === 0, 'no reservation stamped with inv3.id', inv3Reservations.length);
    const bal3 = await balanceOf(custId);
    assert(bal3 === 1300, 'balance === 1300 (1100 + 200 earn from inv3)', bal3);

    // ── TEST 4: appointment-scoped match preferred over FIFO ──────────────
    console.log('\n[test 4] Hybrid matcher — appointmentId beats FIFO');
    // Create appointment first
    const [appt] = await db
      .insert(appointments)
      .values({
        tenantId: TENANT_ID,
        customerId: custId,
        serviceId: serviceId,
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        address: '__L4B_TEST__',
        status: 'completed',
      })
      .returning();
    if (!appt) throw new Error('Failed to create test appointment');
    console.log(`  appointment id = ${appt.id}`);

    // Create older NULL-appointment reservation FIRST (so it has earlier redeemedDate)
    const rOld = await reserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l4b-res-old-null-appt',
    });
    assert(rOld.success === true && rOld.reservationId !== null, 'older NULL-appointment reserve()');
    const resOldId = rOld.reservationId!;
    // Brief delay to guarantee distinct redeemedDate ordering
    await new Promise((res) => setTimeout(res, 20));

    // Create the appointment-bound reservation SECOND (younger redeemedDate)
    const rAppt = await reserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l4b-res-appt-bound',
    });
    assert(rAppt.success === true && rAppt.reservationId !== null, 'appointment-bound reserve()');
    const resApptId = rAppt.reservationId!;
    // Stamp the appointmentId directly (simulating a future reserve() that passes appointmentId)
    await db
      .update(redeemedRewards)
      .set({ appointmentId: appt.id })
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, resApptId)));

    // Sanity check: two pending rows exist, older one has earlier redeemedDate
    const pendingNow = await db
      .select({ id: redeemedRewards.id, appointmentId: redeemedRewards.appointmentId, redeemedDate: redeemedRewards.redeemedDate })
      .from(redeemedRewards)
      .where(
        and(
          eq(redeemedRewards.tenantId, TENANT_ID),
          eq(redeemedRewards.customerId, custId),
          inArray(redeemedRewards.status, ['pending', 'scheduled']),
        ),
      )
      .orderBy(asc(redeemedRewards.redeemedDate));
    assert(pendingNow.length === 2, 'exactly 2 pending reservations before finalize', pendingNow.length);
    assert(pendingNow[0]?.id === resOldId, 'older reservation is FIFO-first', pendingNow[0]?.id);

    const [inv4] = await db
      .insert(invoices)
      .values({
        tenantId: TENANT_ID,
        customerId: custId,
        appointmentId: appt.id,
        amount: '350',
        subtotal: null,
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
        serviceDescription: 'L4B test invoice 4 (appt-bound)',
        invoiceType: 'appointment',
      })
      .returning();
    if (!inv4) throw new Error('Failed to create invoice 4');

    await finalizeInvoicePaid(tenantDb, {
      id: inv4.id,
      customerId: custId,
      subtotal: null,
      amount: 350,
      appointmentId: appt.id,
    });

    const [resApptAfter] = await db
      .select()
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, resApptId)));
    assert(
      resApptAfter?.status === 'completed',
      'appointment-bound reservation → completed (HYBRID picked appointmentId match)',
      resApptAfter?.status,
    );
    assert(resApptAfter?.invoiceId === inv4.id, `appt-bound reservation.invoice_id === ${inv4.id}`, resApptAfter?.invoiceId);

    const [resOldAfter] = await db
      .select()
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, resOldId)));
    assert(
      resOldAfter?.status === 'pending',
      'older NULL-appointment reservation STILL pending (not consumed)',
      resOldAfter?.status,
    );
    assert(resOldAfter?.invoiceId === null, 'older reservation.invoice_id STILL null', resOldAfter?.invoiceId);

    // ── TEST 5: failure isolation via Proxy fault injection ───────────────
    // Block A reads tenant via `tenantDb.tenantId` (a plain property accessor
    // on the wrapper). Block B reads tenant via `tenantDb.tenant.id` (a
    // getter on the wrapper's `.tenant` object). We wrap tenantDb in a Proxy
    // that lets every property pass through EXCEPT `.tenant`, which throws.
    // → Block A runs fully (point award).
    // → Block B hits the throw at its first statement and is caught by its
    //   outer try/catch. finalizeInvoicePaid still returns cleanly.
    // This is the only practical way to exercise Block B's outer catch
    // without breaking Block A.
    console.log('\n[test 5] Failure isolation — Proxy injects throw inside Block B');
    const [cust2] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME_2,
        phone: SYNTH_PHONE_2,
        loyaltyProgramOptIn: true,
        notes: 'Synthetic L4B test customer 2 — safe to delete',
      })
      .returning();
    if (!cust2) throw new Error('Failed to create second synthetic customer');
    cust2Id = cust2.id;

    await earn(tenantDb, {
      tenantId: TENANT_ID,
      customerId: cust2Id,
      amount: 500,
      source: 'test',
      idempotencyKey: `l4b:seed2:${cust2Id}`,
      description: 'L4B seed balance (c2)',
    });
    const r5 = await reserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: cust2Id,
      rewardServiceId: rewardId,
      idempotencyKey: 'l4b-res-c2',
    });
    assert(r5.success === true, 'cust2 reserve() success');

    // Wrap tenantDb in a Proxy that throws on `.tenant` access only.
    // Block A path uses `tenantDb.tenantId` (untouched). Block B path uses
    // `tenantDb.tenant.id` (will throw → caught by Block B's outer try/catch).
    const faultInjectedTenantDb = new Proxy(tenantDb, {
      get(target, prop, receiver) {
        if (prop === 'tenant') {
          throw new Error('INJECTED_FAULT_BLOCK_B_ONLY');
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const bal5Before = await balanceOf(cust2Id);

    const [inv5] = await db
      .insert(invoices)
      .values({
        tenantId: TENANT_ID,
        customerId: cust2Id,
        amount: '250',
        subtotal: null,
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
        serviceDescription: 'L4B test invoice 5 (Block-B fault injection)',
        invoiceType: 'manual',
      })
      .returning();
    if (!inv5) throw new Error('Failed to create invoice 5');

    let threw5 = false;
    try {
      await finalizeInvoicePaid(faultInjectedTenantDb as typeof tenantDb, {
        id: inv5.id,
        customerId: cust2Id,
        subtotal: null,
        amount: 250,
        appointmentId: null,
      });
    } catch (e) {
      threw5 = true;
      console.log(`  THREW (should NOT happen): ${(e as Error).message}`);
    }
    assert(
      threw5 === false,
      'finalizeInvoicePaid did NOT throw despite Block B throwing an exception',
    );

    const bal5After = await balanceOf(cust2Id);
    assert(
      bal5After === bal5Before + 250,
      `Block A still ran: balance ${bal5Before} → ${bal5After} (+250 earn)`,
      { before: bal5Before, after: bal5After },
    );

    // Reservation must NOT have been consumed (Block B threw before
    // applyReservation could run).
    const inv5Reservations = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(
        and(
          eq(redeemedRewards.tenantId, TENANT_ID),
          eq(redeemedRewards.invoiceId, inv5.id),
        ),
      );
    assert(
      inv5Reservations.length === 0,
      'no reservation stamped with inv5.id (Block B aborted before apply)',
      inv5Reservations.length,
    );
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
    if (rewardId !== null) {
      console.log(`\n[cleanup:reward] Removing synthetic reward ${rewardId}...`);
      try {
        const d = await db
          .delete(rewardServices)
          .where(
            and(
              eq(rewardServices.tenantId, TENANT_ID),
              eq(rewardServices.id, rewardId),
              eq(rewardServices.name, SYNTH_REWARD_NAME),
            ),
          )
          .returning({ id: rewardServices.id });
        const rRew = await db
          .select({ id: rewardServices.id })
          .from(rewardServices)
          .where(and(eq(rewardServices.tenantId, TENANT_ID), eq(rewardServices.id, rewardId)));
        console.log(`  deleted: reward_services=${d.length}, remaining=${rRew.length}`);
        if (rRew.length !== 0) cleanupResidue = true;
        else console.log('  CLEANUP OK — synthetic reward removed');
      } catch (e) {
        cleanupResidue = true;
        console.error('  CLEANUP ERROR for reward:', (e as Error).message);
      }
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
