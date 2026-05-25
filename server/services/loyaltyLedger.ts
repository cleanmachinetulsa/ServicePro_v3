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

  // 1. Validate amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    const current = await getCurrentBalance(tenantDb, tenantId, customerId);
    const tier = await getCustomerLoyaltyTier(tenantDb, customerId);
    return { success: false, alreadyApplied: false, newBalance: current, tierName: tier?.name ?? null };
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCurrentBalance(
  tenantDb: TenantDb,
  tenantId: string,
  customerId: number,
): Promise<number> {
  const [row] = await tenantDb
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

// Same helper but usable inside a transaction executor
async function getCurrentBalanceTx(
  tx: any,
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
