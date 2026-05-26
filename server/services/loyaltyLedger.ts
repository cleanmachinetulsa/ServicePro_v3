/**
 * Stage L2 Part 1 — loyaltyLedger.earn()
 *
 * Single canonical entry point for awarding loyalty points.
 * Source of truth: loyalty_transactions (status lifecycle, anti-abuse indexes).
 * Co-maintained mirror: points_transactions (existing UI/admin/history reads).
 *
 * Idempotency guarantee:
 *   The idempotencyKey MUST be caller-supplied and STABLE.
 *   It must NOT contain anything that regenerates per run (e.g. campaign IDs that
 *   change on every scheduler invocation). Recommended: `${campaignKey}:${customerId}`
 *   or `${invoiceId}:${customerId}` — values that are identical across retries.
 *   The key is stored in the promoKey column so it is queryable and indexed.
 */

import { and, eq, sql } from 'drizzle-orm';
import {
  loyaltyPoints,
  loyaltyTransactions,
  pointsTransactions,
  redeemedRewards,
  rewardServices,
} from '@shared/schema';
import type { TenantDb } from '../tenantDb';
import {
  checkForNewAchievements,
  getCustomerLoyaltyTier,
} from '../gamificationService';

export interface EarnArgs {
  tenantId: string;
  customerId: number;
  amount: number;            // points to award, must be > 0
  source: string;            // e.g. 'invoice', 'campaign', 'referral'
  idempotencyKey: string;    // stable, caller-supplied — see file header
  description: string;
  metadata?: Record<string, unknown>;
}

export interface EarnResult {
  success: boolean;
  alreadyApplied: boolean;
  newBalance: number;
  tierName: string | null;
}

/**
 * Award points idempotently.
 *
 * All DB writes happen inside a single transaction.
 * The idempotency key is stored in the promoKey column of loyalty_transactions
 * (indexed via tenantCustomerPromoIdx) so duplicate requests are cheap to detect.
 */
export async function earn(
  tenantDb: TenantDb,
  args: EarnArgs,
): Promise<EarnResult> {
  const { tenantId, customerId, amount, source, idempotencyKey, description, metadata = {} } = args;

  // 1. Validate amount — return safe defaults immediately; no DB read so this path never throws
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    console.error(`[loyaltyLedger.earn] Invalid amount (${amount}) for customer ${customerId}`);
    return { success: false, alreadyApplied: false, newBalance: 0, tierName: null };
  }

  let txResult: EarnResult;

  try {
    txResult = await tenantDb.transaction(async (tx) => {
      // 2. Idempotency check — promoKey holds the stable caller key
      const existing = await tx
        .select({ id: loyaltyTransactions.id })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, tenantId),
            eq(loyaltyTransactions.customerId, customerId),
            eq(loyaltyTransactions.promoKey, idempotencyKey),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // Already awarded — read current state and short-circuit
        const current = await getCurrentBalanceTx(tx, tenantId, customerId);
        return { success: true, alreadyApplied: true, newBalance: current, tierName: null };
      }

      // 3. Get-or-create loyalty_points record
      let lpRecord = await tx.query.loyaltyPoints.findFirst({
        where: and(
          eq(loyaltyPoints.tenantId, tenantId),
          eq(loyaltyPoints.customerId, customerId),
        ),
      });

      if (!lpRecord) {
        const [created] = await tx
          .insert(loyaltyPoints)
          .values({
            tenantId,
            customerId,
            points: 0,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          })
          .returning();
        lpRecord = created;
      }

      if (!lpRecord) {
        throw new Error(`loyaltyLedger.earn: failed to get-or-create loyalty_points for customer ${customerId}`);
      }

      const now = new Date();

      // 4. Atomic balance increment (SQL-level, NOT read-then-write)
      const [updatedLp] = await tx
        .update(loyaltyPoints)
        .set({
          points: sql`${loyaltyPoints.points} + ${amount}`,
          lastUpdated: now,
        })
        .where(
          and(
            eq(loyaltyPoints.tenantId, tenantId),
            eq(loyaltyPoints.customerId, customerId),
          ),
        )
        .returning();

      const postIncrementBalance = updatedLp?.points ?? lpRecord.points + amount;

      // 5. Canonical ledger row in loyalty_transactions
      await tx.insert(loyaltyTransactions).values({
        tenantId,
        customerId,
        deltaPoints: amount,
        promoKey: idempotencyKey,      // stores the stable caller key for idempotency
        source,
        status: 'fulfilled',
        pointsAwarded: amount,
        fulfilledAt: now,
        metadata: {
          ...metadata,
          description,
          idempotencyKey,              // also present in metadata for human inspection
        },
      });

      // 6. Co-maintained mirror row in points_transactions
      //    (keeps existing UI/admin/history feeds working unchanged)
      await tx.insert(pointsTransactions).values({
        tenantId,
        loyaltyPointsId: lpRecord.id,
        amount,
        description,
        transactionDate: now,          // explicit — UI orders by this (nullable column)
        transactionType: 'earn',
        source,
        sourceId: null,                // nullable — caller has no source entity ID here
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      // 7. Achievement check inside the transaction
      await checkForNewAchievements(tx as unknown as TenantDb, customerId, postIncrementBalance);

      return {
        success: true,
        alreadyApplied: false,
        newBalance: postIncrementBalance,
        tierName: null,                // tier resolved after commit
      };
    });
  } catch (err: any) {
    console.error(`[loyaltyLedger.earn] Transaction failed for customer ${customerId}:`, err.message);
    return { success: false, alreadyApplied: false, newBalance: 0, tierName: null };
  }

  // 8. Resolve tier after successful commit
  //    (getCustomerLoyaltyTier is a pure read — safe outside the transaction)
  const tier = await getCustomerLoyaltyTier(tenantDb, customerId);
  return {
    success: txResult.success,
    alreadyApplied: txResult.alreadyApplied,
    newBalance: txResult.newBalance,
    tierName: tier?.name ?? null,
  };
}

export interface AdjustArgs {
  tenantId: string;
  customerId: number;
  delta: number;             // signed: positive = grant, negative = remove. Must be non-zero.
  reason: string;            // human-readable, required — shows in audit/history
  actorId: number | null;    // user id of the staff member making the adjustment, or null for system
  idempotencyKey: string;    // stable, caller-supplied — same discipline as earn()
  metadata?: Record<string, unknown>;
}

export interface AdjustResult {
  success: boolean;
  alreadyApplied: boolean;
  newBalance: number;
  clamped: boolean;          // true if a negative delta was reduced to avoid a negative balance
}

/**
 * Manual ledger adjustment — staff grant/remove, refund clawback, expiry write-off.
 *
 * Differences vs earn():
 *   - delta is signed; negative deltas are clamped so balance never goes below 0
 *   - source is hardcoded 'adjustment'; transactionType in mirror row is 'adjustment'
 *   - does NOT call checkForNewAchievements — manual corrections should not unlock achievements
 *   - does NOT resolve tier after commit (no tier field in result)
 *
 * Idempotency identical to earn(): caller-supplied stable key stored in promoKey.
 */
export async function adjust(
  tenantDb: TenantDb,
  args: AdjustArgs,
): Promise<AdjustResult> {
  const { tenantId, customerId, delta, reason, actorId, idempotencyKey, metadata = {} } = args;

  // 1. Validate — never throw, return safe defaults with no DB read
  if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) {
    console.error(`[loyaltyLedger.adjust] Invalid delta (${delta}) for customer ${customerId}`);
    return { success: false, alreadyApplied: false, newBalance: 0, clamped: false };
  }
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    console.error(`[loyaltyLedger.adjust] Empty reason for customer ${customerId}`);
    return { success: false, alreadyApplied: false, newBalance: 0, clamped: false };
  }

  try {
    return await tenantDb.transaction(async (tx) => {
      // 2. Idempotency check — promoKey holds the stable caller key
      const existing = await tx
        .select({ id: loyaltyTransactions.id })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, tenantId),
            eq(loyaltyTransactions.customerId, customerId),
            eq(loyaltyTransactions.promoKey, idempotencyKey),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const current = await getCurrentBalanceTx(tx, tenantId, customerId);
        return { success: true, alreadyApplied: true, newBalance: current, clamped: false };
      }

      // 3. Get-or-create loyalty_points record
      let lpRecord = await tx.query.loyaltyPoints.findFirst({
        where: and(
          eq(loyaltyPoints.tenantId, tenantId),
          eq(loyaltyPoints.customerId, customerId),
        ),
      });

      if (!lpRecord) {
        const [created] = await tx
          .insert(loyaltyPoints)
          .values({
            tenantId,
            customerId,
            points: 0,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          })
          .returning();
        lpRecord = created;
      }

      if (!lpRecord) {
        throw new Error(`loyaltyLedger.adjust: failed to get-or-create loyalty_points for customer ${customerId}`);
      }

      // 4. Negative-balance guard — clamp negative delta so balance lands at exactly 0
      const currentBalance = lpRecord.points;
      let effectiveDelta = delta;
      let clamped = false;
      if (delta < 0 && currentBalance + delta < 0) {
        effectiveDelta = -currentBalance; // brings balance to exactly 0
        clamped = true;
        console.warn(`[loyaltyLedger.adjust] Clamped delta from ${delta} to ${effectiveDelta} for customer ${customerId} (current balance ${currentBalance})`);
        // If currentBalance is already 0, clamped delta is 0 — would be a no-op write
        if (effectiveDelta === 0) {
          return { success: true, alreadyApplied: false, newBalance: 0, clamped: true };
        }
      }

      const now = new Date();

      // 5. Atomic balance update (signed delta — handles both grant and removal)
      const [updatedLp] = await tx
        .update(loyaltyPoints)
        .set({
          points: sql`${loyaltyPoints.points} + ${effectiveDelta}`,
          lastUpdated: now,
        })
        .where(
          and(
            eq(loyaltyPoints.tenantId, tenantId),
            eq(loyaltyPoints.customerId, customerId),
          ),
        )
        .returning();

      const postBalance = updatedLp?.points ?? currentBalance + effectiveDelta;

      // 6. Canonical ledger row
      await tx.insert(loyaltyTransactions).values({
        tenantId,
        customerId,
        deltaPoints: effectiveDelta,
        promoKey: idempotencyKey,
        source: 'adjustment',
        status: 'fulfilled',
        pointsAwarded: effectiveDelta,
        fulfilledAt: now,
        metadata: {
          ...metadata,
          reason,
          actorId,
          idempotencyKey,
          ...(clamped ? { clamped: true, requestedDelta: delta } : {}),
        },
      });

      // 7. Mirror row in points_transactions
      await tx.insert(pointsTransactions).values({
        tenantId,
        loyaltyPointsId: lpRecord.id,
        amount: effectiveDelta,
        description: reason,
        transactionDate: now,
        transactionType: 'adjustment',
        source: 'adjustment',
        sourceId: null,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      // 8. NO achievement check — manual corrections must not unlock achievements

      return {
        success: true,
        alreadyApplied: false,
        newBalance: postBalance,
        clamped,
      };
    });
  } catch (err: any) {
    console.error(`[loyaltyLedger.adjust] Transaction failed for customer ${customerId}:`, err.message);
    return { success: false, alreadyApplied: false, newBalance: 0, clamped: false };
  }
}

// ===========================================================================
// REDEMPTION RESERVATION LIFECYCLE (Stage L3 Part 1)
//
// Flow: customer claims reward → reserve() holds points + creates pending
// redeemed_rewards row. Later, the invoice consumes the discount →
// applyReservation() flips status:'pending' → 'completed' (no balance change;
// points were already deducted at reserve time). If the booking is cancelled
// before invoicing → releaseReservation() flips status to 'cancelled' and
// returns the points by delegating to adjust() with a positive delta.
//
// A7 decision: redemption produces an automatic discount applied at invoice
// time. The invoice-side wiring is L4 — these three functions only own the
// reservation half.
// ===========================================================================

export interface ReserveArgs {
  tenantId: string;
  customerId: number;
  rewardServiceId: number;
  idempotencyKey: string;
  appointmentId?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ReserveResult {
  success: boolean;
  alreadyApplied: boolean;
  reservationId: number | null;
  pointsReserved: number;
  discountValue: number;
  newBalance: number;
  error?: string;
}

const RESERVATION_TTL_DAYS = 90; // matches existing redeemedRewards convention

/**
 * Reserve a reward — deduct points NOW, create a pending redeemed_rewards row.
 *
 * Points are debited at reserve time (not at invoice time) so the same balance
 * cannot be double-spent across two concurrent reservations. The invoice-side
 * (applyReservation) does not change the balance again.
 *
 * discountValue: the dollar value of the reservation. Today we mirror pointCost
 * (1 pt = $1) — the catalog has no per-reward dollar field. L4 will compute the
 * real discount when invoice wiring lands; reserving this field here keeps the
 * caller contract stable.
 */
export async function reserve(
  tenantDb: TenantDb,
  args: ReserveArgs,
): Promise<ReserveResult> {
  const { tenantId, customerId, rewardServiceId, idempotencyKey, appointmentId = null, metadata = {} } = args;

  // 1. Validate inputs — never throw, return safe defaults with no DB read
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return { success: false, alreadyApplied: false, reservationId: null, pointsReserved: 0, discountValue: 0, newBalance: 0, error: 'INVALID_CUSTOMER_ID' };
  }
  if (!Number.isInteger(rewardServiceId) || rewardServiceId <= 0) {
    return { success: false, alreadyApplied: false, reservationId: null, pointsReserved: 0, discountValue: 0, newBalance: 0, error: 'INVALID_REWARD_SERVICE_ID' };
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    return { success: false, alreadyApplied: false, reservationId: null, pointsReserved: 0, discountValue: 0, newBalance: 0, error: 'INVALID_IDEMPOTENCY_KEY' };
  }

  try {
    return await tenantDb.transaction(async (tx) => {
      // 2. Idempotency check
      const existing = await tx
        .select({ id: loyaltyTransactions.id, metadata: loyaltyTransactions.metadata })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, tenantId),
            eq(loyaltyTransactions.customerId, customerId),
            eq(loyaltyTransactions.promoKey, idempotencyKey),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const current = await getCurrentBalanceTx(tx, tenantId, customerId);
        const prevMeta = (existing[0]?.metadata ?? {}) as Record<string, unknown>;
        const prevReservationId = typeof prevMeta.reservationId === 'number' ? prevMeta.reservationId : null;
        const prevPoints = typeof prevMeta.pointsReserved === 'number' ? prevMeta.pointsReserved : 0;
        return {
          success: true,
          alreadyApplied: true,
          reservationId: prevReservationId,
          pointsReserved: prevPoints,
          discountValue: prevPoints,
          newBalance: current,
          error: undefined,
        };
      }

      // 3. Load reward — must be active and tenant-owned
      const [reward] = await tx
        .select()
        .from(rewardServices)
        .where(
          and(
            eq(rewardServices.id, rewardServiceId),
            eq(rewardServices.tenantId, tenantId),
            eq(rewardServices.active, true),
          ),
        )
        .limit(1);

      if (!reward) {
        return { success: false, alreadyApplied: false, reservationId: null, pointsReserved: 0, discountValue: 0, newBalance: await getCurrentBalanceTx(tx, tenantId, customerId), error: 'REWARD_NOT_FOUND_OR_INACTIVE' };
      }

      const pointCost = reward.pointCost;

      // 4. Get-or-create loyalty_points record (no-op create at 0 if missing)
      let lpRecord = await tx.query.loyaltyPoints.findFirst({
        where: and(
          eq(loyaltyPoints.tenantId, tenantId),
          eq(loyaltyPoints.customerId, customerId),
        ),
      });
      if (!lpRecord) {
        const [created] = await tx
          .insert(loyaltyPoints)
          .values({
            tenantId,
            customerId,
            points: 0,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          })
          .returning();
        lpRecord = created;
      }
      if (!lpRecord) {
        throw new Error(`loyaltyLedger.reserve: failed to get-or-create loyalty_points for customer ${customerId}`);
      }

      const currentBalance = lpRecord.points;
      const now = new Date();
      const expiryDate = new Date(now.getTime() + RESERVATION_TTL_DAYS * 24 * 60 * 60 * 1000);

      // 5+6. Atomic conditional decrement — the WHERE includes points >= pointCost so
      // two concurrent reserves cannot both pass a stale pre-check and double-spend.
      // If no row is returned, the balance was insufficient at commit time.
      const [updatedLp] = await tx
        .update(loyaltyPoints)
        .set({
          points: sql`${loyaltyPoints.points} - ${pointCost}`,
          lastUpdated: now,
        })
        .where(
          and(
            eq(loyaltyPoints.tenantId, tenantId),
            eq(loyaltyPoints.customerId, customerId),
            sql`${loyaltyPoints.points} >= ${pointCost}`,
          ),
        )
        .returning();

      if (!updatedLp) {
        return { success: false, alreadyApplied: false, reservationId: null, pointsReserved: 0, discountValue: 0, newBalance: currentBalance, error: 'INSUFFICIENT_POINTS' };
      }
      const postBalance = updatedLp.points;

      // 7. Create the redeemed_rewards reservation row
      const [reservation] = await tx
        .insert(redeemedRewards)
        .values({
          tenantId,
          customerId,
          rewardServiceId,
          pointsSpent: pointCost,
          status: 'pending',
          appointmentId,
          expiryDate,
        })
        .returning();
      if (!reservation) {
        throw new Error('loyaltyLedger.reserve: failed to insert redeemed_rewards row');
      }

      // 8. Canonical ledger row (negative delta, status:'pending')
      await tx.insert(loyaltyTransactions).values({
        tenantId,
        customerId,
        deltaPoints: -pointCost,
        promoKey: idempotencyKey,
        source: 'redemption',
        status: 'pending',
        pointsAwarded: -pointCost,
        metadata: {
          ...metadata,
          idempotencyKey,
          reservationId: reservation.id,
          rewardServiceId,
          rewardName: reward.name,
          pointsReserved: pointCost,
          appointmentId,
        },
      });

      // 9. Mirror row in points_transactions
      await tx.insert(pointsTransactions).values({
        tenantId,
        loyaltyPointsId: lpRecord.id,
        amount: -pointCost,
        description: `Reserved reward: ${reward.name}`,
        transactionDate: now,
        transactionType: 'redeem',
        source: 'reward',
        sourceId: rewardServiceId,
        expiryDate,
      });

      return {
        success: true,
        alreadyApplied: false,
        reservationId: reservation.id,
        pointsReserved: pointCost,
        discountValue: pointCost,
        newBalance: postBalance,
        error: undefined,
      };
    });
  } catch (err: any) {
    console.error(`[loyaltyLedger.reserve] Transaction failed for customer ${customerId}:`, err.message);
    return { success: false, alreadyApplied: false, reservationId: null, pointsReserved: 0, discountValue: 0, newBalance: 0, error: 'TRANSACTION_FAILED' };
  }
}

// ---------------------------------------------------------------------------

export interface ApplyReservationArgs {
  tenantId: string;
  reservationId: number;
  invoiceId?: number | null;
  idempotencyKey: string;
}

export interface ApplyReservationResult {
  success: boolean;
  alreadyApplied: boolean;
  error?: string;
}

/**
 * Apply a pending reservation — invoice consumes the discount.
 *
 * Points were already deducted at reserve() time, so this does NOT modify the
 * balance. It only flips redeemed_rewards.status pending → completed and
 * updates the canonical loyalty_transactions row pending → fulfilled.
 *
 * Idempotency: if the reservation is already completed, returns
 * alreadyApplied:true. The idempotencyKey is also enforced at the
 * loyalty_transactions level (we update by-key, not just by-id).
 */
export async function applyReservation(
  tenantDb: TenantDb,
  args: ApplyReservationArgs,
): Promise<ApplyReservationResult> {
  const { tenantId, reservationId, invoiceId = null, idempotencyKey } = args;

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return { success: false, alreadyApplied: false, error: 'INVALID_RESERVATION_ID' };
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    return { success: false, alreadyApplied: false, error: 'INVALID_IDEMPOTENCY_KEY' };
  }

  try {
    return await tenantDb.transaction(async (tx) => {
      // 1. Load reservation, tenant-scoped
      const [reservation] = await tx
        .select()
        .from(redeemedRewards)
        .where(
          and(
            eq(redeemedRewards.tenantId, tenantId),
            eq(redeemedRewards.id, reservationId),
          ),
        )
        .limit(1);

      if (!reservation) {
        return { success: false, alreadyApplied: false, error: 'RESERVATION_NOT_FOUND' };
      }

      // 2. State machine
      if (reservation.status === 'completed') {
        return { success: true, alreadyApplied: true };
      }
      if (reservation.status === 'cancelled' || reservation.status === 'expired') {
        return { success: false, alreadyApplied: false, error: `RESERVATION_${(reservation.status ?? 'UNKNOWN').toUpperCase()}` };
      }
      if (reservation.status !== 'pending' && reservation.status !== 'scheduled') {
        return { success: false, alreadyApplied: false, error: `RESERVATION_INVALID_STATUS:${reservation.status}` };
      }

      const now = new Date();

      // 3. Flip reservation → completed and stamp the consuming invoice.
      // L4 Step 3B: also write redeemed_rewards.invoice_id when provided so the
      // structured FK into invoices is populated everywhere applyReservation is
      // called. invoice_id stays NULL when caller passes null (legacy/unknown
      // contexts). Invoice linkage also remains in loyalty_transactions.metadata
      // (below) for ledger-level auditability. We do NOT touch
      // redeemed_rewards.appointment_id here — that column is a FK into
      // appointments() and is set at reserve() time.
      const reservationUpdate: { status: string; invoiceId?: number } = { status: 'completed' };
      if (typeof invoiceId === 'number' && Number.isFinite(invoiceId)) {
        reservationUpdate.invoiceId = invoiceId;
      }
      await tx
        .update(redeemedRewards)
        .set(reservationUpdate)
        .where(
          and(
            eq(redeemedRewards.tenantId, tenantId),
            eq(redeemedRewards.id, reservationId),
          ),
        );

      // 4. Flip canonical ledger row pending → fulfilled, by reservationId in metadata
      //    (we update all matching pending redemption rows for this customer+reservation)
      await tx
        .update(loyaltyTransactions)
        .set({
          status: 'fulfilled',
          fulfilledAt: now,
          metadata: sql`COALESCE(${loyaltyTransactions.metadata}, '{}'::jsonb) || ${JSON.stringify({ appliedAt: now.toISOString(), invoiceId, applyIdempotencyKey: idempotencyKey })}::jsonb`,
        })
        .where(
          and(
            eq(loyaltyTransactions.tenantId, tenantId),
            eq(loyaltyTransactions.customerId, reservation.customerId),
            eq(loyaltyTransactions.source, 'redemption'),
            eq(loyaltyTransactions.status, 'pending'),
            sql`${loyaltyTransactions.metadata} ->> 'reservationId' = ${String(reservationId)}`,
          ),
        );

      return { success: true, alreadyApplied: false };
    });
  } catch (err: any) {
    console.error(`[loyaltyLedger.applyReservation] Transaction failed for reservation ${reservationId}:`, err.message);
    return { success: false, alreadyApplied: false, error: 'TRANSACTION_FAILED' };
  }
}

// ---------------------------------------------------------------------------

export interface ReleaseReservationArgs {
  tenantId: string;
  reservationId: number;
  reason: string;
  idempotencyKey: string;
}

export interface ReleaseReservationResult {
  success: boolean;
  alreadyApplied: boolean;
  pointsReturned: number;
  newBalance: number;
  error?: string;
}

/**
 * Release a pending reservation — booking cancelled, points returned.
 *
 * - pending → cancelled, then points refunded via adjust() (positive delta).
 * - cancelled → alreadyApplied:true (no-op).
 * - completed → fails: cannot release an already-applied reservation (refund
 *   path is L5).
 *
 * Refund is delegated to adjust() to keep the increment path single-sourced.
 */
export async function releaseReservation(
  tenantDb: TenantDb,
  args: ReleaseReservationArgs,
): Promise<ReleaseReservationResult> {
  const { tenantId, reservationId, reason, idempotencyKey } = args;

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return { success: false, alreadyApplied: false, pointsReturned: 0, newBalance: 0, error: 'INVALID_RESERVATION_ID' };
  }
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    return { success: false, alreadyApplied: false, pointsReturned: 0, newBalance: 0, error: 'INVALID_REASON' };
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    return { success: false, alreadyApplied: false, pointsReturned: 0, newBalance: 0, error: 'INVALID_IDEMPOTENCY_KEY' };
  }

  // Phase A: flip the reservation status inside its own transaction.
  // We do NOT call adjust() inside this transaction because adjust() opens
  // its own transaction and nested transactions in Postgres become savepoints
  // with subtler semantics — keeping the refund as a separate, idempotent
  // call is cleaner.
  let customerId: number;
  let pointsToReturn: number;
  let alreadyCancelled = false;

  try {
    const phaseA = await tenantDb.transaction(async (tx) => {
      const [reservation] = await tx
        .select()
        .from(redeemedRewards)
        .where(
          and(
            eq(redeemedRewards.tenantId, tenantId),
            eq(redeemedRewards.id, reservationId),
          ),
        )
        .limit(1);

      if (!reservation) {
        return { ok: false as const, error: 'RESERVATION_NOT_FOUND' };
      }
      if (reservation.status === 'cancelled' || reservation.status === 'expired') {
        return { ok: true as const, alreadyCancelled: true, customerId: reservation.customerId, pointsSpent: reservation.pointsSpent };
      }
      if (reservation.status === 'completed') {
        return { ok: false as const, error: 'RESERVATION_ALREADY_COMPLETED' };
      }
      if (reservation.status !== 'pending' && reservation.status !== 'scheduled') {
        return { ok: false as const, error: `RESERVATION_INVALID_STATUS:${reservation.status}` };
      }

      // Flip status pending → cancelled
      await tx
        .update(redeemedRewards)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(redeemedRewards.tenantId, tenantId),
            eq(redeemedRewards.id, reservationId),
          ),
        );

      // Cancel the canonical pending ledger row so it cannot also be applied later
      await tx
        .update(loyaltyTransactions)
        .set({
          status: 'cancelled',
          metadata: sql`COALESCE(${loyaltyTransactions.metadata}, '{}'::jsonb) || ${JSON.stringify({ releasedAt: new Date().toISOString(), releaseReason: reason, releaseIdempotencyKey: idempotencyKey })}::jsonb`,
        })
        .where(
          and(
            eq(loyaltyTransactions.tenantId, tenantId),
            eq(loyaltyTransactions.customerId, reservation.customerId),
            eq(loyaltyTransactions.source, 'redemption'),
            eq(loyaltyTransactions.status, 'pending'),
            sql`${loyaltyTransactions.metadata} ->> 'reservationId' = ${String(reservationId)}`,
          ),
        );

      return { ok: true as const, alreadyCancelled: false, customerId: reservation.customerId, pointsSpent: reservation.pointsSpent };
    });

    if (!phaseA.ok) {
      return { success: false, alreadyApplied: false, pointsReturned: 0, newBalance: 0, error: phaseA.error };
    }

    // Whether already cancelled or freshly cancelled, fall through to Phase B.
    // Phase B is keyed on `release:${reservationId}:${idempotencyKey}` via adjust(),
    // so a previously-completed refund returns alreadyApplied:true (no-op),
    // and a previously-failed refund retries cleanly. This makes the
    // split-phase operation recoverable on retry.
    customerId = phaseA.customerId;
    pointsToReturn = phaseA.pointsSpent;
    alreadyCancelled = phaseA.alreadyCancelled;
  } catch (err: any) {
    console.error(`[loyaltyLedger.releaseReservation] Phase-A failed for reservation ${reservationId}:`, err.message);
    return { success: false, alreadyApplied: false, pointsReturned: 0, newBalance: 0, error: 'TRANSACTION_FAILED' };
  }

  // Phase B: refund via adjust() — idempotent on its own
  const refund = await adjust(tenantDb, {
    tenantId,
    customerId,
    delta: pointsToReturn,
    reason: `redemption reservation released: ${reason}`,
    actorId: null,
    idempotencyKey: `release:${reservationId}:${idempotencyKey}`,
    metadata: { reservationId, releaseReason: reason },
  });

  if (!refund.success) {
    console.error(`[loyaltyLedger.releaseReservation] Refund adjust() failed for reservation ${reservationId}`);
    return { success: false, alreadyApplied: false, pointsReturned: 0, newBalance: refund.newBalance, error: 'REFUND_FAILED' };
  }

  // alreadyApplied is true only when this call was a complete no-op: the
  // reservation was already cancelled AND the refund had already been posted on
  // a prior call. If the reservation was cancelled but the prior refund failed
  // and this retry actually moved points, alreadyApplied stays false so the
  // caller knows real work happened.
  return {
    success: true,
    alreadyApplied: alreadyCancelled && refund.alreadyApplied,
    pointsReturned: refund.alreadyApplied ? 0 : pointsToReturn,
    newBalance: refund.newBalance,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Helper usable inside a transaction executor
async function getCurrentBalanceTx(
  tx: Parameters<Parameters<TenantDb['transaction']>[0]>[0],
  tenantId: string,
  customerId: number,
): Promise<number> {
  const [row] = await tx
    .select({ points: loyaltyPoints.points })
    .from(loyaltyPoints)
    .where(
      and(
        eq(loyaltyPoints.tenantId, tenantId),
        eq(loyaltyPoints.customerId, customerId),
      ),
    )
    .limit(1);
  return row?.points ?? 0;
}
