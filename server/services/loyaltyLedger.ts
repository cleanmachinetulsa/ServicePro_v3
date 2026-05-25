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
