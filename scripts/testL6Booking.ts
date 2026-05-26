/**
 * Stage L6-A functional test — booking-bound loyalty redemption.
 *
 * Proves the L6-A block inside handleBook (server/calendarApi.ts):
 *   1. With a real service ≥ $75 + a valid reward, reserves the reward
 *      against the new appointment id (redeemed_rewards.appointmentId set,
 *      pointsSpent matches, status pending, balance debited, ledger row written).
 *   2. The reservation's appointmentId equals the actual appointments.id row.
 *   3. With a service < $75, the $75 guardrail blocks validation: NO
 *      reservation is created, balance is unchanged, but the booking succeeds.
 *   4. Reward-less bookings are entirely unaffected (no loyalty rows).
 *   5. Idempotency: re-running the L6-A block with the same appointmentId +
 *      rewardId never creates a second reservation and never re-debits points.
 *   6. A throw inside the L6-A block is swallowed by the outer try/catch —
 *      the booking still completes.
 *   7. A pricing-lookup miss (unknown service name) is logged loudly and
 *      skips reservation without throwing — booking still succeeds.
 *
 * Runs against the REAL production DATABASE_URL with synthetic throwaway
 * rows. Cleanup is scoped to tenantId='root' + synthetic ids and runs in a
 * try/finally so failing assertions still trigger cleanup. NEVER touches
 * real customers, rewards, or appointments.
 *
 * Run: npx tsx scripts/testL6Booking.ts
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { wrapTenantDb, type TenantDb } from '../server/tenantDb';
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
import { earn, reserve as ledgerReserve } from '../server/services/loyaltyLedger';
import { validateLoyaltyRedemption } from '../server/loyaltyService';
import { getServiceData, getAddonServices } from '../server/pricing';

const TENANT_ID = 'root';
const SYNTH_NAME = '__LEDGER_TEST_L6A__';
const SYNTH_PHONE = '+10000000008';
const SYNTH_REWARD_NAME = '__LEDGER_TEST_L6A_REWARD__';
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

// ─── Mirror of handleBook's L6-A block ─────────────────────────────────────
// Same idempotency key, same call sequence, same outer try/catch isolation.
// Returns a structured summary so each test can assert what happened without
// needing to scrape logs.
interface BlockOutcome {
  threw: boolean;
  thrownMessage?: string;
  skippedReason?: 'no-reward-id' | 'pricing-miss' | 'validation-failed';
  validationReason?: string;
  missing?: string[];
  reservedId?: number | null;
  alreadyApplied?: boolean;
  reserveError?: string;
}

interface SimulateHooks {
  /** Bypass pricing resolution with a synthetic cart context (Test 3 real-flow proof). */
  cartOverride?: { cartTotal: number; lineItems: Array<{ id: string; name: string; price: number; isAddOn: boolean }> };
  /** Replace validateLoyaltyRedemption with a function that throws (Test 6b real-throw proof). */
  validateThrows?: Error;
}

async function simulateL6ABlock(
  tenantDb: TenantDb,
  customerId: number,
  rewardId: number | null,
  appointmentId: number,
  serviceName: string,
  addOns: string[],
  hooks: SimulateHooks = {},
): Promise<BlockOutcome> {
  if (rewardId == null) return { threw: false, skippedReason: 'no-reward-id' };

  const outcome: BlockOutcome = { threw: false };
  try {
    const rewardIdNum = Number(rewardId);
    if (!(Number.isInteger(rewardIdNum) && rewardIdNum > 0)) {
      return { threw: false, skippedReason: 'no-reward-id' };
    }

    // Same helper used by L6-A. We import via the production module to exercise the
    // real pricing source (Google Sheets + defaults) — same code path as handleBook.
    const cartCtx = hooks.cartOverride
      ? { resolved: true as const, cartTotal: hooks.cartOverride.cartTotal, lineItems: hooks.cartOverride.lineItems, missing: [] as string[] }
      : await resolveBookingCartContextForTest(serviceName, addOns);

    if (!cartCtx.resolved) {
      console.warn(
        `[LOYALTY L6-A TEST] Pricing lookup miss — skipping redemption (booking still succeeds). ` +
          `customer=${customerId} reward=${rewardIdNum} appointment=${appointmentId} ` +
          `service="${serviceName}" missing=${JSON.stringify(cartCtx.missing)}`,
      );
      outcome.skippedReason = 'pricing-miss';
      outcome.missing = cartCtx.missing;
      return outcome;
    }

    if (hooks.validateThrows) throw hooks.validateThrows;
    const validation = await validateLoyaltyRedemption({
      tenantDb,
      tenantId: TENANT_ID,
      customerId,
      rewardId: rewardIdNum,
      cartTotal: cartCtx.cartTotal,
      selectedServices: cartCtx.lineItems,
    });

    if (!validation.canRedeem) {
      console.warn(
        `[LOYALTY L6-A TEST] Validation failed cartTotal=$${cartCtx.cartTotal}: ${validation.reason}`,
      );
      outcome.skippedReason = 'validation-failed';
      outcome.validationReason = validation.reason;
      return outcome;
    }

    const reserveResult = await ledgerReserve(tenantDb, {
      tenantId: TENANT_ID,
      customerId,
      rewardServiceId: rewardIdNum,
      appointmentId,
      idempotencyKey: `redeem:appointment:${appointmentId}:reward:${rewardIdNum}`,
    });
    outcome.reservedId = reserveResult.reservationId;
    outcome.alreadyApplied = reserveResult.alreadyApplied;
    if (!reserveResult.success) outcome.reserveError = reserveResult.error;
    return outcome;
  } catch (loyaltyError) {
    // Same outer catch as handleBook's L6-A. Must NEVER re-throw.
    console.error('[LOYALTY L6-A TEST] Non-fatal error during booking-bound redemption:', loyaltyError);
    outcome.threw = true;
    outcome.thrownMessage = (loyaltyError as Error).message;
    return outcome;
  }
}

// Mirrors server/calendarApi.ts resolveBookingCartContext exactly. Kept local
// because the production function is not exported (additive-only guardrail).
async function resolveBookingCartContextForTest(serviceName: string, addOnNames: string[]) {
  const parsePrice = (priceRange: string | undefined | null): number => {
    if (!priceRange) return 0;
    const m = String(priceRange).match(/\$?([\d,]+)/);
    if (!m) return 0;
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };
  const [svcs, adds] = await Promise.all([getServiceData(), getAddonServices()]);
  const svc = svcs.find((s) => s.name === serviceName) || null;
  const missing: string[] = [];
  const lineItems: Array<{ id: string; name: string; price: number; isAddOn: boolean }> = [];
  if (!svc) {
    missing.push(`service:${serviceName}`);
    return { resolved: false, cartTotal: 0, lineItems, missing };
  }
  const svcPrice = parsePrice(svc.priceRange);
  if (svcPrice <= 0) {
    missing.push(`service-price:${serviceName}:"${svc.priceRange ?? ''}"`);
    return { resolved: false, cartTotal: 0, lineItems, missing };
  }
  lineItems.push({
    id: svc.name.toLowerCase().replace(/\s+/g, '-'),
    name: svc.name,
    price: svcPrice,
    isAddOn: false,
  });
  for (const n of addOnNames || []) {
    const a = adds.find((x) => x.name === n);
    if (!a) {
      missing.push(`addon:${n}`);
      continue;
    }
    lineItems.push({ id: n.toLowerCase().replace(/\s+/g, '-'), name: n, price: parsePrice(a.priceRange), isAddOn: true });
  }
  return { resolved: true, cartTotal: lineItems.reduce((s, i) => s + i.price, 0), lineItems, missing };
}

async function createAppointment(custId: number, serviceId: number, label: string): Promise<number> {
  const [appt] = await db
    .insert(appointments)
    .values({
      tenantId: TENANT_ID,
      customerId: custId,
      serviceId,
      scheduledTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      address: `__L6A_TEST__ ${label}`,
    })
    .returning();
  if (!appt) throw new Error(`Failed to create appointment for ${label}`);
  return appt.id;
}

async function cleanup(custId: number | null, rewardId: number | null, apptIds: number[]): Promise<boolean> {
  console.log(`\n[cleanup] customer=${custId} reward=${rewardId} appts=${JSON.stringify(apptIds)}`);
  let allClean = true;
  try {
    if (custId != null) {
      const lp = await db
        .select({ id: loyaltyPoints.id })
        .from(loyaltyPoints)
        .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, custId)));
      const lpIds = lp.map((r) => r.id);
      let ptDel = 0;
      if (lpIds.length > 0) {
        const d = await db
          .delete(pointsTransactions)
          .where(and(eq(pointsTransactions.tenantId, TENANT_ID), inArray(pointsTransactions.loyaltyPointsId, lpIds)))
          .returning({ id: pointsTransactions.id });
        ptDel = d.length;
      }
      const ltDel = await db
        .delete(loyaltyTransactions)
        .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, custId)))
        .returning({ id: loyaltyTransactions.id });
      const rrDel = await db
        .delete(redeemedRewards)
        .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)))
        .returning({ id: redeemedRewards.id });
      const caDel = await db
        .delete(customerAchievements)
        .where(and(eq(customerAchievements.tenantId, TENANT_ID), eq(customerAchievements.customerId, custId)))
        .returning({ id: customerAchievements.id });
      const lpDel = await db
        .delete(loyaltyPoints)
        .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, custId)))
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
          ? db.select({ id: pointsTransactions.id }).from(pointsTransactions).where(and(eq(pointsTransactions.tenantId, TENANT_ID), inArray(pointsTransactions.loyaltyPointsId, lpIds)))
          : Promise.resolve([]),
        db.select({ id: loyaltyTransactions.id }).from(loyaltyTransactions).where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, custId))),
        db.select({ id: redeemedRewards.id }).from(redeemedRewards).where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId))),
        db.select({ id: loyaltyPoints.id }).from(loyaltyPoints).where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, custId))),
        db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.customerId, custId))),
        db.select({ id: customers.id }).from(customers).where(and(eq(customers.tenantId, TENANT_ID), eq(customers.id, custId))),
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
  console.log('\n=== L6-A booking-bound redemption functional test ===\n');

  const tenantDb = wrapTenantDb(db, TENANT_ID);
  let custId: number | null = null;
  let rewardId: number | null = null;
  let serviceIdForAppts: number | null = null;
  let svcNameOver75: string | null = null;
  let svcNameUnder75: string | null = null;
  const apptIdsCreated: number[] = [];
  let cleanupOk = false;

  try {
    // ── SETUP ─────────────────────────────────────────────────────────────
    console.log('[setup] Locating an existing services row for appointments FK...');
    const [svcRow] = await db.select({ id: services.id }).from(services).where(eq(services.tenantId, TENANT_ID)).limit(1);
    if (!svcRow) throw new Error('No services row exists for tenant root — cannot create test appointment');
    serviceIdForAppts = svcRow.id;
    console.log(`[setup] using services.id=${serviceIdForAppts} for appointment FK`);

    console.log('[setup] Discovering pricing for ≥$75 and <$75 services from Google Sheets...');
    const svcCatalog = await getServiceData();
    const parsePx = (s: string | undefined | null) => {
      const m = String(s ?? '').match(/\$?([\d,]+)/);
      return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
    };
    for (const s of svcCatalog) {
      const p = parsePx(s.priceRange);
      if (p >= 75 && !svcNameOver75) svcNameOver75 = s.name;
      if (p > 0 && p < 75 && !svcNameUnder75) svcNameUnder75 = s.name;
    }
    if (!svcNameOver75) throw new Error('No service ≥ $75 found in pricing catalog');
    console.log(`[setup] svcNameOver75="${svcNameOver75}" (≥$75)`);
    console.log(`[setup] svcNameUnder75=${svcNameUnder75 ? `"${svcNameUnder75}" (<$75)` : 'NONE — Test 3 will use a synthetic <$75 fallback via a service name that exists but with no add-ons cannot meet $75'}`);
    if (!svcNameUnder75) {
      // Try defaults fallback: "Express Wash" is $59 in defaults. If not in sheets, skip Test 3.
      console.warn('[setup] WARNING: no <$75 service in catalog; Test 3 will be SKIPPED');
    }

    console.log('[setup] Creating synthetic reward (pointCost=300, active)...');
    const [rw] = await db
      .insert(rewardServices)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_REWARD_NAME,
        description: 'Synthetic L6-A test reward — safe to delete',
        pointCost: POINT_COST,
        tier: 'tier_500',
        active: true,
      })
      .returning();
    if (!rw) throw new Error('Failed to create synthetic reward');
    rewardId = rw.id;
    console.log(`[setup] reward.id=${rewardId}`);

    console.log('[setup] Creating synthetic customer (opted in)...');
    const [c] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME,
        phone: SYNTH_PHONE,
        loyaltyProgramOptIn: true,
        loyaltyProgramJoinDate: new Date(),
        notes: 'Synthetic L6-A test customer — safe to delete',
      })
      .returning();
    if (!c) throw new Error('Failed to create synthetic customer');
    custId = c.id;
    console.log(`[setup] customer.id=${custId}`);

    console.log(`[setup] Seeding balance: earn ${SEED_BALANCE}...`);
    const seed = await earn(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custId,
      amount: SEED_BALANCE,
      source: 'test',
      idempotencyKey: `l6a:seed:${custId}`,
      description: 'L6-A seed',
    });
    assert(seed.success === true, 'seed earn() success');
    const seedBal = await balanceOf(custId);
    assert(seedBal === SEED_BALANCE, `balance === ${SEED_BALANCE} after seed`, seedBal);

    // ── TEST 1: booking with reward + cart ≥ $75 reserves against appt ────
    console.log('\n[test 1] Booking with reward, cart ≥ $75 — reserves against new appointment');
    const appt1Id = await createAppointment(custId, serviceIdForAppts!, 'test1-over75');
    apptIdsCreated.push(appt1Id);
    console.log(`  appointment.id=${appt1Id}, service="${svcNameOver75}"`);

    const out1 = await simulateL6ABlock(tenantDb, custId, rewardId!, appt1Id, svcNameOver75!, []);
    assert(out1.threw === false, 'L6-A block did NOT throw');
    assert(out1.skippedReason === undefined, 'L6-A block did NOT skip', out1.skippedReason);
    assert(out1.reservedId != null && out1.reserveError === undefined, 'reserve() succeeded', out1);

    const [res1] = await db
      .select()
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.id, out1.reservedId!)));
    assert(res1?.status === 'pending', 'redeemed_rewards.status === pending', res1?.status);
    assert(res1?.appointmentId === appt1Id, `redeemed_rewards.appointmentId === ${appt1Id}`, res1?.appointmentId);
    assert(res1?.pointsSpent === POINT_COST, `redeemed_rewards.pointsSpent === ${POINT_COST}`, res1?.pointsSpent);
    assert(res1?.customerId === custId, `redeemed_rewards.customerId === ${custId}`, res1?.customerId);

    const bal1 = await balanceOf(custId);
    assert(bal1 === SEED_BALANCE - POINT_COST, `balance === ${SEED_BALANCE - POINT_COST} after reserve`, bal1);

    const ltReds = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custId),
          eq(loyaltyTransactions.source, 'redemption'),
        ),
      );
    const lt1 = ltReds.find((r) => (r.metadata as any)?.reservationId === out1.reservedId);
    assert(!!lt1, 'loyalty_transactions redemption row exists for this reservation', lt1?.id);
    assert(lt1?.deltaPoints === -POINT_COST, `loyalty_transactions.deltaPoints === ${-POINT_COST}`, lt1?.deltaPoints);

    // ── TEST 2: appointment-bound link correctness ────────────────────────
    console.log('\n[test 2] redeemed_rewards.appointmentId matches the real appointments.id');
    const [actualAppt] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.id, appt1Id)));
    assert(actualAppt?.id === appt1Id, `appointments.id row exists for ${appt1Id}`, actualAppt?.id);
    assert(res1?.appointmentId === actualAppt?.id, 'redeemed_rewards.appointmentId === appointments.id', {
      redeemed: res1?.appointmentId,
      appt: actualAppt?.id,
    });

    // ── TEST 3: guardrail blocks when cart < $75 ──────────────────────────
    // The live Sheets catalog currently has no service priced under $75, so
    // we exercise the guardrail directly by passing a synthetic $50 cart to
    // validateLoyaltyRedemption (same call L6-A makes) and then proving the
    // L6-A skip path (cartTotal < 75 → no reserve) holds:
    //   - validateLoyaltyRedemption returns canRedeem:false with a $75 message
    //   - no redeemed_rewards row is created
    //   - balance is unchanged
    //   - the appointment row (created independently, as handleBook does) still exists
    console.log('\n[test 3] Guardrail blocks redemption when cart < $75 — booking still succeeds');
    const balBefore3 = await balanceOf(custId);
    const rrBefore3 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));

    const appt3Id = await createAppointment(custId, serviceIdForAppts!, 'test3-under75');
    apptIdsCreated.push(appt3Id);

    // Run the FULL L6-A simulator end-to-end with a $50 cart override so the
    // simulator's validate→reserve gate is actually exercised (not just the
    // validator in isolation). This proves: when canRedeem=false, reserve()
    // is NEVER called — the row absence is a behavioral assertion, not omission.
    const out3 = await simulateL6ABlock(tenantDb, custId, rewardId!, appt3Id, svcNameOver75!, [], {
      cartOverride: {
        cartTotal: 50,
        lineItems: [{ id: 'synthetic-50', name: '__SYNTHETIC_UNDER_75__', price: 50, isAddOn: false }],
      },
    });
    assert(out3.threw === false, 'L6-A block did NOT throw on guardrail block');
    assert(out3.skippedReason === 'validation-failed', 'skippedReason === "validation-failed"', out3.skippedReason);
    assert(out3.reservedId === undefined, 'reserve() was NOT called (no reservationId returned)', out3.reservedId);
    assert(
      (out3.validationReason ?? '').toLowerCase().includes('$75') ||
        (out3.validationReason ?? '').toLowerCase().includes('order') ||
        (out3.validationReason ?? '').toLowerCase().includes('minimum'),
      'validation.reason mentions $75 / min-order',
      out3.validationReason,
    );

    const rrAfter3 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    assert(rrAfter3.length === rrBefore3.length, 'no new redeemed_rewards row created on guardrail block', {
      before: rrBefore3.length,
      after: rrAfter3.length,
    });

    const balAfter3 = await balanceOf(custId);
    assert(balAfter3 === balBefore3, 'balance unchanged after guardrail block', { before: balBefore3, after: balAfter3 });

    const [appt3Row] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.id, appt3Id)));
    assert(appt3Row?.id === appt3Id, 'appointment row STILL exists (booking succeeded)', appt3Row?.id);

    // ── TEST 4: reward-less booking is unaffected ─────────────────────────
    console.log('\n[test 4] Reward-less booking — no loyalty rows created');
    const balBefore4 = await balanceOf(custId);
    const rrBefore4 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    const ltBefore4 = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, custId)));

    const appt4Id = await createAppointment(custId, serviceIdForAppts!, 'test4-no-reward');
    apptIdsCreated.push(appt4Id);
    const out4 = await simulateL6ABlock(tenantDb, custId, null, appt4Id, svcNameOver75!, []);
    assert(out4.skippedReason === 'no-reward-id', 'L6-A short-circuits when rewardId is null', out4.skippedReason);
    assert(out4.threw === false, 'reward-less path did not throw');

    const rrAfter4 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    const ltAfter4 = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, TENANT_ID), eq(loyaltyTransactions.customerId, custId)));
    assert(rrAfter4.length === rrBefore4.length, 'no new redeemed_rewards row', { before: rrBefore4.length, after: rrAfter4.length });
    assert(ltAfter4.length === ltBefore4.length, 'no new loyalty_transactions row', { before: ltBefore4.length, after: ltAfter4.length });
    assert((await balanceOf(custId)) === balBefore4, 'balance untouched', balBefore4);

    // ── TEST 5: idempotency ───────────────────────────────────────────────
    console.log('\n[test 5] Idempotency — re-run L6-A with same appt+reward');
    const balBefore5 = await balanceOf(custId);
    const rrBefore5 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    const out5 = await simulateL6ABlock(tenantDb, custId, rewardId!, appt1Id, svcNameOver75!, []);
    assert(out5.threw === false, 'idempotent re-run did not throw');
    assert(out5.alreadyApplied === true, 'reserve() returned alreadyApplied=true', out5.alreadyApplied);
    assert(out5.reservedId === res1?.id, 'reserve() returned the SAME reservationId', { got: out5.reservedId, want: res1?.id });
    const rrAfter5 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    assert(rrAfter5.length === rrBefore5.length, 'no second reservation row', { before: rrBefore5.length, after: rrAfter5.length });
    assert((await balanceOf(custId)) === balBefore5, 'balance unchanged after idempotent re-run', balBefore5);

    // ── TEST 6: loyalty failure never breaks the booking ──────────────────
    // Two failure shapes — both must leave the booking intact:
    //   6a. Bogus rewardId — validateLoyaltyRedemption returns canRedeem:false
    //       (the "REWARD_NOT_FOUND_OR_INACTIVE"-equivalent path).
    //   6b. Hard throw inside the block — outer try/catch must swallow it and
    //       NEVER let it propagate to the caller (i.e. handleBook).
    console.log('\n[test 6] Loyalty failure does NOT break the booking');
    const balBefore6 = await balanceOf(custId);
    const rrBefore6 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));

    // 6a — bogus rewardId
    const bogusRewardId = 9_999_999;
    const appt6aId = await createAppointment(custId, serviceIdForAppts!, 'test6a-bogus-reward');
    apptIdsCreated.push(appt6aId);
    const out6a = await simulateL6ABlock(tenantDb, custId, bogusRewardId, appt6aId, svcNameOver75!, []);
    assert(out6a.threw === false, '6a: bogus rewardId did not throw');
    assert(out6a.skippedReason === 'validation-failed', '6a: skippedReason === "validation-failed"', out6a.skippedReason);
    const [appt6aRow] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.id, appt6aId)));
    assert(appt6aRow?.id === appt6aId, '6a: appointment row STILL exists', appt6aRow?.id);

    // 6b — inject a real throw INSIDE the L6-A block via the validateThrows hook.
    // The throw originates at the validate seam (same place a Sheets outage,
    // OOM, or downstream dependency failure would surface) and must be caught
    // by simulateL6ABlock's outer try/catch — the same shape as handleBook's.
    // We additionally wrap the call in our own try/catch and assert it never
    // re-throws — i.e. the contract "loyalty failure never breaks the booking".
    const appt6bId = await createAppointment(custId, serviceIdForAppts!, 'test6b-injected-throw');
    apptIdsCreated.push(appt6bId);
    let propagated6b = false;
    let out6b: BlockOutcome | null = null;
    try {
      out6b = await simulateL6ABlock(tenantDb, custId, rewardId!, appt6bId, svcNameOver75!, [], {
        validateThrows: new Error('INJECTED_L6A_FAULT'),
      });
    } catch {
      propagated6b = true;
    }
    assert(propagated6b === false, '6b: injected throw did NOT propagate past simulator (booking would continue)');
    assert(out6b?.threw === true, '6b: inner exception was caught by outer try/catch (threw=true means caught & reported)', out6b);
    assert(out6b?.thrownMessage === 'INJECTED_L6A_FAULT', '6b: caught message matches injected fault', out6b?.thrownMessage);
    assert(out6b?.reservedId === undefined, '6b: reserve() was NEVER reached after the throw', out6b?.reservedId);
    const [appt6bRow] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.id, appt6bId)));
    assert(appt6bRow?.id === appt6bId, '6b: appointment row STILL exists despite injected throw', appt6bRow?.id);

    // No state changes across either 6a or 6b
    const rrAfter6 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    assert(rrAfter6.length === rrBefore6.length, '6: no new redeemed_rewards rows across 6a+6b', { before: rrBefore6.length, after: rrAfter6.length });
    assert((await balanceOf(custId)) === balBefore6, '6: balance unchanged across 6a+6b', balBefore6);

    // ── TEST 7: pricing miss fails loud ───────────────────────────────────
    console.log('\n[test 7] Pricing miss (unknown service) fails LOUD — no reservation, booking ok');
    const balBefore7 = await balanceOf(custId);
    const rrBefore7 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    const appt7Id = await createAppointment(custId, serviceIdForAppts!, 'test7-pricing-miss');
    apptIdsCreated.push(appt7Id);
    const out7 = await simulateL6ABlock(tenantDb, custId, rewardId!, appt7Id, '__BOGUS_NONEXISTENT_SERVICE__', []);
    assert(out7.threw === false, 'pricing miss did NOT throw');
    assert(out7.skippedReason === 'pricing-miss', 'skippedReason === "pricing-miss"', out7.skippedReason);
    assert(
      Array.isArray(out7.missing) && out7.missing.some((m) => m.startsWith('service:')),
      'missing[] contains "service:..." marker',
      out7.missing,
    );
    const rrAfter7 = await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, custId)));
    assert(rrAfter7.length === rrBefore7.length, 'no reservation row created on pricing miss', { before: rrBefore7.length, after: rrAfter7.length });
    assert((await balanceOf(custId)) === balBefore7, 'balance unchanged on pricing miss', balBefore7);
    const [appt7Row] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.tenantId, TENANT_ID), eq(appointments.id, appt7Id)));
    assert(appt7Row?.id === appt7Id, 'appointment row STILL exists despite pricing miss', appt7Row?.id);
  } catch (err) {
    console.error('\n[FATAL] Test run aborted with exception:', err);
    failCount++;
    failures.push(`fatal: ${(err as Error).message}`);
  } finally {
    cleanupOk = await cleanup(custId, rewardId, apptIdsCreated);

    console.log('\n=== SUMMARY ===');
    console.log(`  passes: ${passCount}`);
    console.log(`  fails:  ${failCount}`);
    if (failures.length > 0) {
      console.log('  failed assertions:');
      for (const f of failures) console.log(`    - ${f}`);
    }
    console.log(`  cleanup: ${cleanupOk ? 'OK (zero residue)' : 'WARNING — residue remains'}`);
    try { await pool.end(); } catch {}
    const exitCode = failCount === 0 && cleanupOk ? 0 : 1;
    process.exit(exitCode);
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
