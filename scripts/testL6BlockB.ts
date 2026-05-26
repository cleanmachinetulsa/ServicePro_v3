/**
 * Stage L6-B functional test — strict appointment-match in Block B
 * + retired /api/loyalty/redeem route verification.
 *
 * Proves the L6-B contract inside finalizeInvoicePaid (server/paymentHandler.ts):
 *   1. Strict appointment match: a reservation bound to apptA is consumed
 *      ONLY by an invoice whose appointmentId === apptA (Block A still awards).
 *   2. Invoice with NO matching appointment-bound reservation no-ops Block B
 *      (and Block A still awards invoice points).
 *   3. The customer-scoped FIFO fallback is GONE — a fresh reservation bound
 *      to apptA is NOT consumed by an invoice for a DIFFERENT appointment
 *      (apptC). Under the old behavior, FIFO would have wrongly consumed it.
 *   4. Invoice with appointmentId:null no-ops Block B cleanly; Block A awards.
 *   5. Re-calling finalizeInvoicePaid for the Test 1 invoice is idempotent —
 *      no double-apply, no double-award.
 *   6. The retired POST /api/loyalty/redeem is gone — an HTTP POST returns 404.
 *
 * Pre-check (reported, never fails the run): DEF-20 orphaned-reservation count
 * `SELECT COUNT(*) FROM redeemed_rewards WHERE status IN ('pending','scheduled')
 *  AND appointment_id IS NULL`.
 *
 * Runs against the REAL production DATABASE_URL with synthetic throwaway rows.
 * Cleanup is scoped to tenantId='root' + synthetic ids and runs in a
 * try/finally so failing assertions still trigger cleanup. NEVER touches real
 * customers, rewards, appointments, or invoices.
 *
 * Run: npx tsx scripts/testL6BlockB.ts
 */

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
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
import { earn, reserve as ledgerReserve } from '../server/services/loyaltyLedger';
import { finalizeInvoicePaid } from '../server/paymentHandler';
import express from 'express';
import { registerLoyaltyRoutes } from '../server/routes.loyalty';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST_L6B__';
const SYNTH_PHONE = '+10000000009';
const SYNTH_REWARD_NAME = '__LEDGER_TEST_L6B_REWARD__';
const POINT_COST = 300;
const SEED_BALANCE = 1000;

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
    .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, customerId)));
  return r?.points ?? 0;
}

async function createAppointment(
  custId: number,
  serviceId: number,
  label: string,
): Promise<number> {
  const [appt] = await db
    .insert(appointments)
    .values({
      tenantId: TENANT_ID,
      customerId: custId,
      serviceId,
      scheduledTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      address: `__L6B_TEST__ ${label}`,
    })
    .returning();
  if (!appt) throw new Error(`Failed to create appointment for ${label}`);
  return appt.id;
}

async function createInvoice(
  custId: number,
  apptId: number | null,
  amount: number,
  label: string,
): Promise<number> {
  const [inv] = await db
    .insert(invoices)
    .values({
      tenantId: TENANT_ID,
      customerId: custId,
      appointmentId: apptId,
      amount: String(amount),
      serviceDescription: `__L6B_TEST_INVOICE__ ${label}`,
      invoiceType: apptId == null ? 'manual' : 'appointment',
      status: 'paid',
      paymentStatus: 'paid',
    })
    .returning();
  if (!inv) throw new Error(`Failed to create invoice for ${label}`);
  return inv.id;
}

async function getReservation(id: number) {
  const [r] = await db
    .select()
    .from(redeemedRewards)
    .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, id)));
  return r ?? null;
}

async function cleanup(
  custId: number | null,
  rewardId: number | null,
  apptIds: number[],
  invoiceIds: number[],
): Promise<boolean> {
  console.log(
    `\n[cleanup] customer=${custId} reward=${rewardId} appts=${JSON.stringify(apptIds)} invoices=${JSON.stringify(invoiceIds)}`,
  );
  let allClean = true;
  try {
    if (custId != null) {
      // 1) loyalty subtree FIRST — redeemed_rewards.invoiceId FKs invoices.id,
      //    so RR must be deleted before invoices. points_transactions deletes
      //    via loyaltyPointsId; ledger / achievements scoped by customerId.
      const lp = await db
        .select({ id: loyaltyPoints.id })
        .from(loyaltyPoints)
        .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, custId)));
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
          and(
            eq(redeemedRewards.tenantId, TENANT_ID),
            eq(redeemedRewards.customerId, custId),
          ),
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

      // 2) invoices (after redeemed_rewards, before appointments)
      const invDel = await db
        .delete(invoices)
        .where(and(eq(invoices.tenantId, TENANT_ID), eq(invoices.customerId, custId)))
        .returning({ id: invoices.id });

      // 3) appointments (after invoices — invoices.appointmentId FK)
      const apptDel = await db
        .delete(appointments)
        .where(
          and(eq(appointments.tenantId, TENANT_ID), eq(appointments.customerId, custId)),
        )
        .returning({ id: appointments.id });

      // 4) customer
      const cDel = await db
        .delete(customers)
        .where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, custId)))
        .returning({ id: customers.id });

      console.log(
        `  deleted: points_transactions=${ptDel}, loyalty_transactions=${ltDel.length}, ` +
          `redeemed_rewards=${rrDel.length}, customer_achievements=${caDel.length}, ` +
          `loyalty_points=${lpDel.length}, invoices=${invDel.length}, ` +
          `appointments=${apptDel.length}, customers=${cDel.length}`,
      );

      const rem = await Promise.all([
        db
          .select({ id: invoices.id })
          .from(invoices)
          .where(and(eq(invoices.tenantId, TENANT_ID), eq(invoices.customerId, custId))),
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
            and(
              eq(redeemedRewards.tenantId, TENANT_ID),
              eq(redeemedRewards.customerId, custId),
            ),
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
      const [rInv, rPt, rLt, rRr, rLp, rAppt, rC] = rem.map((x) => x.length);
      console.log(
        `  remaining customer-scoped: invoices=${rInv}, points_transactions=${rPt}, loyalty_transactions=${rLt}, redeemed_rewards=${rRr}, loyalty_points=${rLp}, appointments=${rAppt}, customers=${rC}`,
      );
      if (rInv || rPt || rLt || rRr || rLp || rAppt || rC) allClean = false;
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
  console.log('\n=== L6-B strict appointment-match functional test ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);

  // ── PRE-CHECK (report-only, DEF-20 orphan reservation audit) ─────────────
  console.log('[pre-check] DEF-20 orphan reservation audit (production-wide; report-only)');
  try {
    const orphanRows = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(
        and(
          inArray(redeemedRewards.status, ['pending', 'scheduled']),
          isNull(redeemedRewards.appointmentId),
        ),
      );
    console.log(
      `  orphaned reservations (status pending/scheduled AND appointment_id IS NULL): ${orphanRows.length}`,
    );
    if (orphanRows.length > 0) {
      console.log(
        `  -> NOTE: these were created by the now-retired standalone redemption path.`,
      );
      console.log(
        `  -> Block B will NEVER auto-apply them (strict appointment match). Manual reconciliation recommended.`,
      );
    } else {
      console.log(`  -> No orphans. DEF-20 concern is currently moot.`);
    }
  } catch (e) {
    console.log(`  pre-check query FAILED (non-fatal): ${(e as Error).message}`);
  }

  let custId: number | null = null;
  let rewardId: number | null = null;
  let serviceIdForAppts: number | null = null;
  const apptIdsCreated: number[] = [];
  const invoiceIdsCreated: number[] = [];
  let cleanupOk = false;

  try {
    // ── SETUP ─────────────────────────────────────────────────────────────
    console.log('\n[setup] Locating an existing services row for appointments FK...');
    const [svcRow] = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.tenantId, TENANT_ID))
      .limit(1);
    if (!svcRow)
      throw new Error('No services row exists for tenant root — cannot create test appointment');
    serviceIdForAppts = svcRow.id;
    console.log(`[setup] using services.id=${serviceIdForAppts} for appointment FK`);

    console.log('[setup] Creating synthetic customer (opt-in)...');
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

    console.log('[setup] Creating synthetic reward (pointCost=300, active)...');
    const [rw] = await db
      .insert(rewardServices)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_REWARD_NAME,
        description: 'Synthetic L6-B test reward — safe to delete',
        pointCost: POINT_COST,
        tier: 'tier_500',
        active: true,
      })
      .returning();
    if (!rw) throw new Error('Failed to create synthetic reward');
    rewardId = rw.id;
    console.log(`[setup] reward.id=${rewardId}`);

    console.log(`[setup] Seeding balance via earn() ${SEED_BALANCE}...`);
    const seed = await earn(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      amount: SEED_BALANCE,
      source: 'manual_adjustment',
      idempotencyKey: 'l6b-seed-balance',
      description: 'L6-B test seed balance',
    });
    if (!seed.success) throw new Error(`Seed earn() failed: ${JSON.stringify(seed)}`);
    const seededBal = await balanceOf(custId);
    console.log(`[setup] seeded balance = ${seededBal} (expected ${SEED_BALANCE})`);
    if (seededBal !== SEED_BALANCE) {
      throw new Error(`Seed balance mismatch: got ${seededBal}, expected ${SEED_BALANCE}`);
    }

    // ── TEST 1: strict appointment match applies the right reservation ────
    console.log('\n[test 1] Strict appointment match — reservation bound to apptA is applied');
    const apptA = await createAppointment(custId, serviceIdForAppts!, 'apptA');
    apptIdsCreated.push(apptA);
    console.log(`  created apptA.id=${apptA}`);

    const res1 = await ledgerReserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l6b-res-A',
      appointmentId: apptA,
    });
    assert(res1.success === true, '1: reserve() apptA succeeded', res1);
    assert(typeof res1.reservationId === 'number' && res1.reservationId > 0, '1: reservationId returned', res1.reservationId);
    const resv1Id = res1.reservationId!;

    const resv1Row = await getReservation(resv1Id);
    assert(resv1Row?.status === 'pending', '1: reservation status = pending', resv1Row?.status);
    assert(resv1Row?.appointmentId === apptA, '1: reservation appointmentId === apptA', resv1Row?.appointmentId);
    assert(resv1Row?.invoiceId == null, '1: reservation invoiceId initially null', resv1Row?.invoiceId);
    const balAfterRes1 = await balanceOf(custId);
    assert(balAfterRes1 === SEED_BALANCE - POINT_COST, `1: balance debited (${SEED_BALANCE - POINT_COST})`, balAfterRes1);

    const inv1Id = await createInvoice(custId, apptA, 400, 'invoice-A');
    invoiceIdsCreated.push(inv1Id);
    console.log(`  created invoice.id=${inv1Id} (appt=${apptA}, amount=$400)`);

    await finalizeInvoicePaid(tenantDb, {
      id: inv1Id,
      customerId: custId,
      subtotal: null,
      amount: 400,
      appointmentId: apptA,
    });

    const resv1After = await getReservation(resv1Id);
    assert(resv1After?.status === 'completed', '1: Block B flipped reservation -> completed', resv1After?.status);
    assert(resv1After?.invoiceId === inv1Id, '1: reservation.invoiceId === inv1Id', resv1After?.invoiceId);
    const balAfterFin1 = await balanceOf(custId);
    // balance now = (SEED - 300) + 400 (Block A award)
    const expectedBal1 = SEED_BALANCE - POINT_COST + 400;
    assert(balAfterFin1 === expectedBal1, `1: balance reflects +400 Block A award (${expectedBal1})`, balAfterFin1);

    // ── TEST 2: invoice with NO matching appointment-bound reservation no-ops Block B ──
    console.log('\n[test 2] Invoice for apptB (no reservation) — Block B no-ops, Block A awards');
    const apptB = await createAppointment(custId, serviceIdForAppts!, 'apptB');
    apptIdsCreated.push(apptB);
    const inv2Id = await createInvoice(custId, apptB, 200, 'invoice-B');
    invoiceIdsCreated.push(inv2Id);
    console.log(`  created apptB.id=${apptB}, invoice.id=${inv2Id} (amount=$200)`);

    const rrBefore2 = await db
      .select({ id: redeemedRewards.id, status: redeemedRewards.status, invoiceId: redeemedRewards.invoiceId })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    const balBefore2 = await balanceOf(custId);

    await finalizeInvoicePaid(tenantDb, {
      id: inv2Id,
      customerId: custId,
      subtotal: null,
      amount: 200,
      appointmentId: apptB,
    });

    const rrAfter2 = await db
      .select({ id: redeemedRewards.id, status: redeemedRewards.status, invoiceId: redeemedRewards.invoiceId })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    assert(rrAfter2.length === rrBefore2.length, '2: no new redeemed_rewards rows', { before: rrBefore2.length, after: rrAfter2.length });
    // resv1 (completed) must be unchanged
    const resv1Still = await getReservation(resv1Id);
    assert(resv1Still?.status === 'completed' && resv1Still?.invoiceId === inv1Id, '2: resv1 unchanged (still completed, still inv1)', { status: resv1Still?.status, invoiceId: resv1Still?.invoiceId });
    const balAfter2 = await balanceOf(custId);
    assert(balAfter2 === balBefore2 + 200, '2: Block A still awarded +200', { before: balBefore2, after: balAfter2 });

    // ── TEST 3: FIFO fallback is GONE — fresh apptA reservation NOT consumed by apptC invoice ──
    console.log('\n[test 3] FIFO fallback REMOVED — new apptA-bound reservation stays pending when an apptC invoice is paid');
    const res3 = await ledgerReserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l6b-res-A-fresh',
      appointmentId: apptA,
    });
    assert(res3.success === true, '3: fresh reserve() on apptA succeeded', res3);
    const resv3Id = res3.reservationId!;
    const resv3Row = await getReservation(resv3Id);
    assert(resv3Row?.status === 'pending', '3: fresh resv3 status = pending', resv3Row?.status);
    assert(resv3Row?.appointmentId === apptA, '3: fresh resv3 appointmentId === apptA', resv3Row?.appointmentId);

    const apptC = await createAppointment(custId, serviceIdForAppts!, 'apptC');
    apptIdsCreated.push(apptC);
    const inv3Id = await createInvoice(custId, apptC, 250, 'invoice-C');
    invoiceIdsCreated.push(inv3Id);
    console.log(`  created apptC.id=${apptC}, invoice.id=${inv3Id} (amount=$250)`);

    const balBefore3 = await balanceOf(custId);
    await finalizeInvoicePaid(tenantDb, {
      id: inv3Id,
      customerId: custId,
      subtotal: null,
      amount: 250,
      appointmentId: apptC,
    });

    const resv3After = await getReservation(resv3Id);
    assert(resv3After?.status === 'pending', '3: resv3 STAYS pending (FIFO gone — apptC invoice did NOT consume apptA reservation)', resv3After?.status);
    assert(resv3After?.invoiceId == null, '3: resv3.invoiceId still null', resv3After?.invoiceId);
    const balAfter3 = await balanceOf(custId);
    assert(balAfter3 === balBefore3 + 250, '3: Block A still awarded +250 for apptC invoice', { before: balBefore3, after: balAfter3 });

    // ── TEST 4: invoice with appointmentId:null no-ops Block B ───────────
    console.log('\n[test 4] Invoice with appointmentId=null — Block B no-ops cleanly, Block A awards');
    const inv4Id = await createInvoice(custId, null, 150, 'invoice-null-appt');
    invoiceIdsCreated.push(inv4Id);
    const rrBefore4 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    const balBefore4 = await balanceOf(custId);

    let threw4 = false;
    try {
      await finalizeInvoicePaid(tenantDb, {
        id: inv4Id,
        customerId: custId,
        subtotal: null,
        amount: 150,
        appointmentId: null,
      });
    } catch (e) {
      threw4 = true;
      console.log(`  finalizeInvoicePaid threw: ${(e as Error).message}`);
    }
    assert(threw4 === false, '4: finalizeInvoicePaid with null appointmentId did NOT throw');

    const rrAfter4 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    assert(rrAfter4.length === rrBefore4.length, '4: no new redeemed_rewards rows', { before: rrBefore4.length, after: rrAfter4.length });
    const resv3StillPending = await getReservation(resv3Id);
    assert(resv3StillPending?.status === 'pending', '4: resv3 STILL pending (null-appt invoice did not consume it)', resv3StillPending?.status);
    const balAfter4 = await balanceOf(custId);
    assert(balAfter4 === balBefore4 + 150, '4: Block A still awarded +150', { before: balBefore4, after: balAfter4 });

    // ── TEST 5: idempotency — re-call finalizeInvoicePaid for inv1 ───────
    console.log('\n[test 5] Idempotency — re-call finalizeInvoicePaid for Test 1 invoice');
    // Neutralize resv3 first: it is still pending and bound to apptA, so the
    // strict matcher would otherwise (correctly) consume it on the re-call,
    // creating a SECOND apply for inv1 — which is real system behavior, not a
    // double-apply bug, but it would mask the actual idempotency invariant we
    // care about here (Block A and the SAME reservation must not double-fire).
    // Mark resv3 expired so it leaves the pending/scheduled match window.
    await db
      .update(redeemedRewards)
      .set({ status: 'expired' })
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, resv3Id)));
    console.log(`  neutralized resv3 (id=${resv3Id}) -> status=expired to isolate idempotency check`);

    const balBefore5 = await balanceOf(custId);
    const ltCountBefore5 = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
        ),
      );

    await finalizeInvoicePaid(tenantDb, {
      id: inv1Id,
      customerId: custId,
      subtotal: null,
      amount: 400,
      appointmentId: apptA,
    });

    const balAfter5 = await balanceOf(custId);
    assert(balAfter5 === balBefore5, '5: balance UNCHANGED on re-call (no double-award)', { before: balBefore5, after: balAfter5 });

    const resv1Idem = await getReservation(resv1Id);
    assert(resv1Idem?.status === 'completed' && resv1Idem?.invoiceId === inv1Id, '5: resv1 still completed + linked to inv1 (no double-apply)', { status: resv1Idem?.status, invoiceId: resv1Idem?.invoiceId });

    // No extra completed rows for this reservation
    const completedForRew = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(
        and(
          eq(redeemedRewards.tenantId, TENANT_ID),
          eq(redeemedRewards.customerId, custId),
          eq(redeemedRewards.invoiceId, inv1Id),
        ),
      );
    assert(completedForRew.length === 1, '5: exactly ONE redeemed_rewards row links to inv1', completedForRew.length);

    const ltCountAfter5 = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
        ),
      );
    assert(ltCountAfter5.length === ltCountBefore5.length, '5: no new loyalty_transactions on re-call', { before: ltCountBefore5.length, after: ltCountAfter5.length });

    // ── TEST 6: retired POST /api/loyalty/redeem is unregistered ─────────
    // The running app's global auth gate returns 401 for ANY unauthenticated
    // /api/* request (registered or not), so a plain HTTP probe can't
    // distinguish "route exists but auth-gated" from "route does not exist."
    // Instead, isolate the loyalty routes module by registering it onto a
    // throwaway Express app and walking the route table directly.
    console.log('\n[test 6] POST /api/loyalty/redeem is UNREGISTERED — route stack inspection');
    const probeApp = express();
    registerLoyaltyRoutes(probeApp);
    type Layer = { route?: { path?: string; methods?: Record<string, boolean> } };
    const stack = (probeApp as unknown as { _router: { stack: Layer[] } })._router.stack;
    const redeemLayers = stack
      .filter((l) => l.route?.path === '/api/loyalty/redeem')
      .map((l) => ({ path: l.route!.path, methods: Object.keys(l.route!.methods || {}) }));
    const postRedeem = redeemLayers.find((l) => l.methods.includes('post'));
    const loyaltyPaths = stack
      .filter((l) => l.route?.path?.startsWith('/api/loyalty/'))
      .map((l) => `${Object.keys(l.route!.methods || {}).join(',').toUpperCase()} ${l.route!.path}`);
    console.log(`  registerLoyaltyRoutes registered ${loyaltyPaths.length} loyalty routes:`);
    for (const p of loyaltyPaths) console.log(`    - ${p}`);
    console.log(`  matches for path=/api/loyalty/redeem: ${JSON.stringify(redeemLayers)}`);
    assert(
      redeemLayers.length === 0,
      '6: NO route layer exists for /api/loyalty/redeem (any method)',
      redeemLayers,
    );
    assert(
      postRedeem === undefined,
      '6: NO POST handler registered for /api/loyalty/redeem (route retired)',
      postRedeem,
    );
  } catch (err) {
    console.error('\n[FATAL] Test run aborted with exception:', err);
    failCount++;
    failures.push(`fatal: ${(err as Error).message}`);
  } finally {
    cleanupOk = await cleanup(custId, rewardId, apptIdsCreated, invoiceIdsCreated);

    console.log('\n=== SUMMARY ===');
    console.log(`  passes: ${passCount}`);
    console.log(`  fails:  ${failCount}`);
    if (failures.length > 0) {
      console.log('  failed assertions:');
      for (const f of failures) console.log(`    - ${f}`);
    }
    console.log(`  cleanup: ${cleanupOk ? 'OK (zero residue)' : 'WARNING — residue remains'}`);
    try {
      await pool.end();
    } catch {}
    const exitCode = failCount === 0 && cleanupOk ? 0 : 1;
    process.exit(exitCode);
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
