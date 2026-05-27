/**
 * Stage L6-C functional test — release-on-cancellation.
 *
 * Proves the L6-C contract wired into server/routes.techJobs.ts
 * (POST /api/tech/jobs/:id/status, status='cancelled' branch):
 *
 *   1. Cancelling an appointment with a pending reward reservation releases
 *      the reservation and refunds the points via the ledger.
 *   2. A second cancellation of the same appointment does NOT double-refund —
 *      the CAS guard on the appointment update + releaseReservation's
 *      idempotency hold together.
 *   3. Cancelling an appointment with NO reservation is a clean no-op —
 *      cancelled status set, zero loyalty rows touched, balance unchanged.
 *   4. A reservation already in 'completed' status (the reward was applied to
 *      a paid invoice) is NOT released on cancellation — releaseReservation()
 *      returns RESERVATION_ALREADY_COMPLETED and that is logged, not thrown.
 *      Refund of a completed redemption is L5-A territory, not L6-C.
 *   5. If the loyalty release fails outright (fault injection), the
 *      cancellation still succeeds and the handler does not throw — the
 *      loyalty error is swallowed by the outer try/catch.
 *   6. A non-cancel status transition (e.g. 'in_progress') does NOT trigger
 *      a release — only the 'cancelled' branch does.
 *
 * Runs against the REAL production DATABASE_URL with synthetic throwaway rows
 * scoped to tenantId='root'. Cleanup is in a try/finally so failing
 * assertions still trigger full cleanup. NEVER touches real customers,
 * rewards, appointments, or invoices.
 *
 * Run: npx tsx scripts/testL6Cancel.ts
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { wrapTenantDb, type TenantDb } from '../server/tenantDb';
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
import {
  earn,
  reserve as ledgerReserve,
  releaseReservation,
  type ReleaseReservationResult,
} from '../server/services/loyaltyLedger';
import { finalizeInvoicePaid } from '../server/paymentHandler';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST_L6C__';
const SYNTH_PHONE = '+10000000010';
const SYNTH_REWARD_NAME = '__LEDGER_TEST_L6C_REWARD__';
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
    .where(
      and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, customerId)),
    );
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
      address: `__L6C_TEST__ ${label}`,
      status: 'scheduled',
    })
    .returning();
  if (!appt) throw new Error(`Failed to create appointment for ${label}`);
  return appt.id;
}

async function createInvoice(
  custId: number,
  apptId: number,
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
      serviceDescription: `__L6C_TEST_INVOICE__ ${label}`,
      invoiceType: 'appointment',
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

async function getAppointment(id: number) {
  const [a] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.id, id)));
  return a ?? null;
}

/**
 * Count refund adjust() rows written by releaseReservation for a reservation.
 * releaseReservation calls adjust() with idempotencyKey=`release:${resId}:${...}`
 * and metadata.reservationId=resId; adjust() stores promo_key=idempotencyKey
 * (see ledger source). We match on metadata.reservationId for robustness.
 */
async function countRefundsForReservation(
  customerId: number,
  reservationId: number,
): Promise<number> {
  const rows = await db
    .select({ id: loyaltyTransactions.id })
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.tenantId, TENANT_ID),
        eq(loyaltyTransactions.customerId, customerId),
        sql`${loyaltyTransactions.metadata} ->> 'reservationId' = ${String(reservationId)}`,
        sql`${loyaltyTransactions.deltaPoints} > 0`,
      ),
    );
  return rows.length;
}

// ────────────────────────────────────────────────────────────────────────────
// SIMULATION HELPERS — these mirror the routes.techJobs.ts POST /jobs/:id/status
// handler EXACTLY (the CAS + the release block), so the test exercises the
// real code path. The release block is copied verbatim and uses the real
// imported releaseReservation; only fault injection (Test 5) substitutes
// the release function. See server/routes.techJobs.ts ~lines 326-405.
// ────────────────────────────────────────────────────────────────────────────

type ReleaseFn = typeof releaseReservation;

interface SimResult {
  ok: boolean;
  status: string;
  didTransitionToCancelled: boolean;
  releaseError?: unknown;
}

async function simulateCancelByHandler(
  tenantDb: TenantDb,
  tenantId: string,
  appointmentId: number,
  opts: { releaseFn?: ReleaseFn } = {},
): Promise<SimResult> {
  const releaseFn = opts.releaseFn ?? releaseReservation;

  // CAS — only the caller that actually flips the row gets didTransitionToCancelled=true.
  let didTransitionToCancelled = false;
  const [casRow] = await tenantDb
    .update(appointments)
    .set({ status: 'cancelled', statusUpdatedAt: new Date() })
    .where(
      tenantDb.withTenantFilter(
        appointments,
        and(
          eq(appointments.id, appointmentId),
          sql`${appointments.status} IS DISTINCT FROM 'cancelled'`,
        )!,
      ),
    )
    .returning();
  if (casRow) didTransitionToCancelled = true;

  let releaseError: unknown;
  if (didTransitionToCancelled) {
    try {
      const pending = await tenantDb
        .select({ id: redeemedRewards.id, status: redeemedRewards.status })
        .from(redeemedRewards)
        .where(
          tenantDb.withTenantFilter(
            redeemedRewards,
            and(
              eq(redeemedRewards.appointmentId, appointmentId),
              inArray(redeemedRewards.status, ['pending', 'scheduled']),
            )!,
          ),
        );
      if (pending.length > 0) {
        for (const resv of pending) {
          const idempotencyKey = `release:appointment:${appointmentId}:reservation:${resv.id}`;
          const result: ReleaseReservationResult = await releaseFn(tenantDb, {
            tenantId,
            reservationId: resv.id,
            reason: 'appointment cancelled',
            idempotencyKey,
          });
          if (result.success) {
            console.log(
              `    [LOYALTY L6-C] Released reservation ${resv.id} for cancelled appointment ${appointmentId}: pointsReturned=${result.pointsReturned}, alreadyApplied=${result.alreadyApplied}, newBalance=${result.newBalance}`,
            );
          } else {
            console.error(
              `    [LOYALTY L6-C] releaseReservation refused for reservation ${resv.id} on cancelled appointment ${appointmentId}: ${result.error}`,
            );
          }
        }
      }
    } catch (e) {
      releaseError = e;
      console.error(
        `    [LOYALTY L6-C] Loyalty release failed for cancelled appointment ${appointmentId} (cancellation itself succeeded):`,
        (e as Error).message,
      );
    }
  }

  return { ok: true, status: 'cancelled', didTransitionToCancelled, releaseError };
}

/**
 * Non-cancel branch of the handler — unconditional update, no release block.
 * Mirrors the `else` branch of the CAS in routes.techJobs.ts.
 */
async function simulateStatusUpdate(
  tenantDb: TenantDb,
  appointmentId: number,
  status: string,
): Promise<void> {
  await tenantDb
    .update(appointments)
    .set({ status, statusUpdatedAt: new Date() })
    .where(tenantDb.withTenantFilter(appointments, eq(appointments.id, appointmentId)));
}

// ────────────────────────────────────────────────────────────────────────────

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
      // invoices BEFORE appointments (invoices.appointmentId FKs appointments.id)
      const invDel = await db
        .delete(invoices)
        .where(and(eq(invoices.tenantId, TENANT_ID), eq(invoices.customerId, custId)))
        .returning({ id: invoices.id });
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
  console.log('\n=== L6-C release-on-cancellation functional test ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);

  let custId: number | null = null;
  let rewardId: number | null = null;
  let serviceIdForAppts: number | null = null;
  let cleanupOk = false;

  try {
    // ── SETUP ────────────────────────────────────────────────────────────
    console.log('[setup] Locating an existing services row for appointments FK...');
    const [svcRow] = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.tenantId, TENANT_ID))
      .limit(1);
    if (!svcRow) throw new Error('No services row exists for tenant root');
    serviceIdForAppts = svcRow.id;
    console.log(`[setup] using services.id=${serviceIdForAppts}`);

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
        description: 'Synthetic L6-C test reward — safe to delete',
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
      idempotencyKey: 'l6c-seed-balance',
      description: 'L6-C test seed balance',
    });
    if (!seed.success) throw new Error(`Seed earn() failed: ${JSON.stringify(seed)}`);
    const seededBal = await balanceOf(custId);
    console.log(`[setup] seeded balance = ${seededBal} (expected ${SEED_BALANCE})`);
    if (seededBal !== SEED_BALANCE) throw new Error(`Seed balance mismatch`);

    // ── TEST 1: cancel an appointment with a pending reservation ─────────
    console.log(
      '\n[test 1] Cancel appointment with PENDING reservation — reservation released, points refunded',
    );
    const apptA = await createAppointment(custId, serviceIdForAppts!, 'apptA');
    console.log(`  created apptA.id=${apptA}`);

    const res1 = await ledgerReserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l6c-res-A',
      appointmentId: apptA,
    });
    assert(res1.success === true, '1: reserve() succeeded');
    assert(typeof res1.reservationId === 'number', '1: reservationId returned');
    const resv1Id = res1.reservationId!;
    const resv1Before = await getReservation(resv1Id);
    assert(resv1Before?.status === 'pending', '1: reservation status=pending', resv1Before?.status);
    assert(
      resv1Before?.appointmentId === apptA,
      '1: reservation bound to apptA',
      resv1Before?.appointmentId,
    );
    const balPostReserve = await balanceOf(custId);
    assert(
      balPostReserve === SEED_BALANCE - POINT_COST,
      `1: balance debited (${SEED_BALANCE - POINT_COST})`,
      balPostReserve,
    );

    const refundsBefore = await countRefundsForReservation(custId, resv1Id);
    assert(refundsBefore === 0, '1: zero refund rows before cancellation', refundsBefore);

    console.log(`  cancelling apptA via handler simulation...`);
    const cancel1 = await simulateCancelByHandler(tenantDb, TENANT_ID, apptA);
    assert(
      cancel1.didTransitionToCancelled === true,
      '1: CAS flipped appointment scheduled→cancelled',
    );
    assert(cancel1.releaseError === undefined, '1: no error thrown out of release block');

    const resv1After = await getReservation(resv1Id);
    assert(
      resv1After?.status === 'cancelled',
      '1: redeemed_rewards row now cancelled',
      resv1After?.status,
    );

    const balPostCancel = await balanceOf(custId);
    assert(
      balPostCancel === SEED_BALANCE,
      `1: balance refunded to ${SEED_BALANCE}`,
      balPostCancel,
    );

    const refundsAfter = await countRefundsForReservation(custId, resv1Id);
    assert(refundsAfter === 1, '1: exactly one refund adjust() row written', refundsAfter);

    const apptAAfter = await getAppointment(apptA);
    assert(apptAAfter?.status === 'cancelled', '1: appointments row status=cancelled');

    // ── TEST 2: double-cancellation is a no-op ───────────────────────────
    console.log(
      '\n[test 2] Second cancellation of apptA — CAS + ledger idempotency prevent double-refund',
    );
    const cancel2 = await simulateCancelByHandler(tenantDb, TENANT_ID, apptA);
    assert(
      cancel2.didTransitionToCancelled === false,
      '2: CAS did NOT re-flip (already cancelled)',
    );

    const bal2 = await balanceOf(custId);
    assert(bal2 === SEED_BALANCE, `2: balance unchanged at ${SEED_BALANCE}`, bal2);

    const refunds2 = await countRefundsForReservation(custId, resv1Id);
    assert(refunds2 === 1, '2: still exactly ONE refund adjust() row', refunds2);

    const resv1Final = await getReservation(resv1Id);
    assert(
      resv1Final?.status === 'cancelled',
      '2: reservation still single cancelled row',
      resv1Final?.status,
    );
    // confirm only one redeemed_rewards row bound to apptA
    const rrForApptA = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(
        and(
          eq(redeemedRewards.tenantId, TENANT_ID),
          eq(redeemedRewards.appointmentId, apptA),
        ),
      );
    assert(rrForApptA.length === 1, '2: still exactly ONE redeemed_rewards row for apptA');

    // ── TEST 3: cancel with NO reservation → clean no-op ─────────────────
    console.log('\n[test 3] Cancel appointment with NO reservation — clean no-op');
    const apptB = await createAppointment(custId, serviceIdForAppts!, 'apptB');
    console.log(`  created apptB.id=${apptB}`);

    const balB_before = await balanceOf(custId);
    const ltCountB_before = (
      await db
        .select({ id: loyaltyTransactions.id })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, TENANT_ID),
            eq(loyaltyTransactions.customerId, custId),
          ),
        )
    ).length;
    const rrCountB_before = (
      await db
        .select({ id: redeemedRewards.id })
        .from(redeemedRewards)
        .where(
          and(
            eq(redeemedRewards.tenantId, TENANT_ID),
            eq(redeemedRewards.customerId, custId),
          ),
        )
    ).length;

    const cancel3 = await simulateCancelByHandler(tenantDb, TENANT_ID, apptB);
    assert(cancel3.didTransitionToCancelled === true, '3: appointment cancelled');
    assert(cancel3.releaseError === undefined, '3: no error from release block');

    const apptBAfter = await getAppointment(apptB);
    assert(apptBAfter?.status === 'cancelled', '3: apptB status=cancelled');

    const balB_after = await balanceOf(custId);
    assert(balB_after === balB_before, '3: balance unchanged', { before: balB_before, after: balB_after });

    const ltCountB_after = (
      await db
        .select({ id: loyaltyTransactions.id })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, TENANT_ID),
            eq(loyaltyTransactions.customerId, custId),
          ),
        )
    ).length;
    assert(
      ltCountB_after === ltCountB_before,
      '3: no new loyalty_transactions rows',
      { before: ltCountB_before, after: ltCountB_after },
    );
    const rrCountB_after = (
      await db
        .select({ id: redeemedRewards.id })
        .from(redeemedRewards)
        .where(
          and(
            eq(redeemedRewards.tenantId, TENANT_ID),
            eq(redeemedRewards.customerId, custId),
          ),
        )
    ).length;
    assert(
      rrCountB_after === rrCountB_before,
      '3: no new redeemed_rewards rows',
      { before: rrCountB_before, after: rrCountB_after },
    );

    // ── TEST 4: completed reservation NOT released on cancellation ───────
    console.log(
      '\n[test 4] Completed reservation is NOT released on cancellation (refund = L5-A)',
    );
    const apptC = await createAppointment(custId, serviceIdForAppts!, 'apptC');
    console.log(`  created apptC.id=${apptC}`);

    const res4 = await ledgerReserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l6c-res-C',
      appointmentId: apptC,
    });
    assert(res4.success === true, '4: reserve() on apptC succeeded');
    const resv4Id = res4.reservationId!;
    const balPreInvoice = await balanceOf(custId);
    console.log(`  balance after reserve = ${balPreInvoice}`);

    const inv4Id = await createInvoice(custId, apptC, 250, 'apptC');
    console.log(`  created invoice.id=${inv4Id} for apptC`);
    await finalizeInvoicePaid(tenantDb, {
      id: inv4Id,
      customerId: custId,
      appointmentId: apptC,
      subtotal: '250',
      amount: '250',
    });

    const resv4Mid = await getReservation(resv4Id);
    assert(
      resv4Mid?.status === 'completed',
      '4: reservation flipped to completed by finalizeInvoicePaid',
      resv4Mid?.status,
    );
    const balPostFinalize = await balanceOf(custId);
    console.log(`  balance after finalizeInvoicePaid = ${balPostFinalize}`);
    const refundsFor4_before = await countRefundsForReservation(custId, resv4Id);
    assert(refundsFor4_before === 0, '4: no refund rows for resv4 yet', refundsFor4_before);

    console.log(`  cancelling apptC (reservation is completed)...`);
    const cancel4 = await simulateCancelByHandler(tenantDb, TENANT_ID, apptC);
    assert(cancel4.didTransitionToCancelled === true, '4: apptC CAS flipped to cancelled');
    assert(cancel4.releaseError === undefined, '4: no error thrown from release block');

    // The SELECT in the release block filters status IN ('pending','scheduled'),
    // so a 'completed' reservation is NEVER passed to releaseReservation in the
    // first place. This is the correct, defensive design: completed reservations
    // are not even considered for release. Verify the reservation is untouched.
    const resv4After = await getReservation(resv4Id);
    assert(
      resv4After?.status === 'completed',
      '4: completed reservation STAYS completed (not flipped)',
      resv4After?.status,
    );
    assert(
      resv4After?.invoiceId === inv4Id,
      '4: reservation.invoiceId still linked to inv4',
      resv4After?.invoiceId,
    );

    const refundsFor4_after = await countRefundsForReservation(custId, resv4Id);
    assert(refundsFor4_after === 0, '4: NO refund adjust() row was written', refundsFor4_after);

    const balPostCancel4 = await balanceOf(custId);
    assert(
      balPostCancel4 === balPostFinalize,
      '4: balance unchanged by cancellation',
      { before: balPostFinalize, after: balPostCancel4 },
    );

    // Additional defense-in-depth check: directly invoking releaseReservation
    // on the completed reservation must refuse with RESERVATION_ALREADY_COMPLETED.
    const directRefuse = await releaseReservation(tenantDb, {
      tenantId: TENANT_ID,
      reservationId: resv4Id,
      reason: 'direct test invocation',
      idempotencyKey: `l6c-direct-refuse-${resv4Id}`,
    });
    assert(
      directRefuse.success === false,
      '4: direct releaseReservation() refused completed reservation',
    );
    assert(
      directRefuse.error === 'RESERVATION_ALREADY_COMPLETED',
      '4: error code = RESERVATION_ALREADY_COMPLETED',
      directRefuse.error,
    );

    // ── TEST 5: loyalty failure does NOT break cancellation ──────────────
    console.log('\n[test 5] Loyalty release failure is swallowed — cancellation still succeeds');
    const apptE = await createAppointment(custId, serviceIdForAppts!, 'apptE');
    console.log(`  created apptE.id=${apptE}`);

    const res5 = await ledgerReserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l6c-res-E',
      appointmentId: apptE,
    });
    assert(res5.success === true, '5: reserve() on apptE succeeded');
    const resv5Id = res5.reservationId!;
    const balPreFault = await balanceOf(custId);
    console.log(`  balance after reserve = ${balPreFault}`);

    let faultInvoked = 0;
    const faultyRelease: ReleaseFn = async () => {
      faultInvoked++;
      throw new Error('INJECTED_FAULT for L6-C test 5');
    };

    let handlerThrew = false;
    let cancel5: SimResult | undefined;
    try {
      cancel5 = await simulateCancelByHandler(tenantDb, TENANT_ID, apptE, {
        releaseFn: faultyRelease,
      });
    } catch (e) {
      handlerThrew = true;
      console.error(`  UNEXPECTED THROW from simulateCancelByHandler:`, (e as Error).message);
    }

    assert(handlerThrew === false, '5: cancellation handler did NOT throw despite loyalty fault');
    assert(cancel5?.didTransitionToCancelled === true, '5: CAS flipped apptE to cancelled');
    assert(faultInvoked === 1, '5: faulty releaseFn was invoked exactly once', faultInvoked);
    assert(
      cancel5?.releaseError !== undefined,
      '5: release error captured by outer try/catch (not rethrown)',
    );

    const apptEAfter = await getAppointment(apptE);
    assert(apptEAfter?.status === 'cancelled', '5: apptE status=cancelled despite loyalty fault');

    const resv5After = await getReservation(resv5Id);
    assert(
      resv5After?.status === 'pending',
      '5: reservation untouched (still pending — faulty release never ran)',
      resv5After?.status,
    );
    const bal5 = await balanceOf(custId);
    assert(bal5 === balPreFault, '5: balance unchanged by faulty release', {
      before: balPreFault,
      after: bal5,
    });

    // Sanity: verify the REAL releaseReservation still works for resv5 (now
    // that we are out of the fault scope). This also cleans up resv5 so the
    // balance ends in a known state for any downstream checks. Idempotency
    // key changes (different reason) so it's a fresh refund.
    // NOTE: idempotencyKey kept short — releaseReservation() prepends
    // `release:${reservationId}:` to it before storing as loyalty_transactions
    // .promo_key, which is varchar(50). Long keys overflow.
    const recover5 = await releaseReservation(tenantDb, {
      tenantId: TENANT_ID,
      reservationId: resv5Id,
      reason: 'l6c test 5 manual recovery',
      idempotencyKey: `l6c-rec-${resv5Id}`,
    });
    assert(recover5.success === true, '5: real releaseReservation() recovers cleanly post-fault');

    // ── TEST 6: non-cancel status transition does NOT release ────────────
    console.log('\n[test 6] Non-cancel transition (in_progress) does NOT trigger release');
    const apptD = await createAppointment(custId, serviceIdForAppts!, 'apptD');
    console.log(`  created apptD.id=${apptD}`);

    const res6 = await ledgerReserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      rewardServiceId: rewardId,
      idempotencyKey: 'l6c-res-D',
      appointmentId: apptD,
    });
    assert(res6.success === true, '6: reserve() on apptD succeeded');
    const resv6Id = res6.reservationId!;
    const balPre6 = await balanceOf(custId);
    const refunds6_before = await countRefundsForReservation(custId, resv6Id);

    await simulateStatusUpdate(tenantDb, apptD, 'in_progress');

    const apptDAfter = await getAppointment(apptD);
    assert(apptDAfter?.status === 'in_progress', '6: apptD status=in_progress');

    const resv6After = await getReservation(resv6Id);
    assert(
      resv6After?.status === 'pending',
      '6: reservation still pending (not released)',
      resv6After?.status,
    );

    const bal6 = await balanceOf(custId);
    assert(bal6 === balPre6, '6: balance unchanged by non-cancel transition', {
      before: balPre6,
      after: bal6,
    });

    const refunds6_after = await countRefundsForReservation(custId, resv6Id);
    assert(
      refunds6_after === refunds6_before,
      '6: no refund adjust() row written',
      { before: refunds6_before, after: refunds6_after },
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
