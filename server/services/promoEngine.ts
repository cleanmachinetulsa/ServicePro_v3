/**
 * Phase 14 - Unified Loyalty & Promo Engine (Anti-Abuse)
 * 
 * Central service for awarding promotional loyalty points with comprehensive anti-abuse checks:
 * - Per-customer lifetime limits
 * - Per-customer annual limits
 * - Per-household annual limits (using Phase 16 household data)
 * - Eligibility requirements (e.g., must have existing completed job)
 * - Award modes: immediate vs. pending until next job completion
 * 
 * This service is fully multi-tenant and generic for all service industries.
 */

import { and, eq, gte, lte, sql, count, inArray } from 'drizzle-orm';
import { 
  loyaltyPoints, 
  loyaltyTransactions, 
  customers, 
  households, 
  appointments 
} from '@shared/schema';
import type { TenantDb } from '../tenantDb';
import { PROMO_RULES, type PromoKey, getPromoRules } from '../config/promoRules';

// ============================================================
// PUBLIC API
// ============================================================

export interface AwardPromoPointsArgs {
  tenantId: string;
  customerId: number;          // Changed to number to match schema
  promoKey: string;            // 'welcome_back_v1', 'referral_v1', etc.
  basePoints: number;          // "headline" points for this promo
  source: string;              // 'campaign', 'manual', 'invoice', etc.
  metadata?: Record<string, any>;
}

export interface AwardPromoPointsResult {
  awarded: boolean;
  pointsGranted: number;
  reason?: string;             // 'already_awarded', 'household_limit', 'not_existing_customer', 'no_rule', 'pending', etc.
}

/**
 * Award promotional points to a customer with anti-abuse checks
 * 
 * @param db - Tenant-scoped database instance (req.tenantDb)
 * @param args - Promo award parameters
 * @returns Result indicating whether points were awarded and reason
 */
export async function awardPromoPoints(
  db: TenantDb,
  args: AwardPromoPointsArgs,
): Promise<AwardPromoPointsResult> {
  const { tenantId, customerId, promoKey, basePoints, source, metadata = {} } = args;

  // 1. Load rules for this promo
  const rules = PROMO_RULES[promoKey as PromoKey];
  if (!rules) {
    console.warn(`[PROMO ENGINE] Unknown promo key: ${promoKey}`);
    return { awarded: false, pointsGranted: 0, reason: 'no_rule' };
  }

  console.log(`[PROMO ENGINE] Evaluating ${promoKey} for customer ${customerId} in tenant ${tenantId}`);

  // 2. Compute time boundaries for annual limits
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

  // 3. Check per-customer lifetime cap
  if (rules.perCustomerLifetimeMax !== undefined) {
    const lifetimeCount = await db
      .select({ count: count() })
      .from(loyaltyTransactions)
      .where(
        db.withTenantFilter(
          loyaltyTransactions,
          and(
            eq(loyaltyTransactions.customerId, customerId),
            eq(loyaltyTransactions.promoKey, promoKey),
            sql`${loyaltyTransactions.deltaPoints} > 0` // Only count actual awards, not pending
          )
        )
      );

    const lifetimeUsage = lifetimeCount[0]?.count || 0;
    if (lifetimeUsage >= rules.perCustomerLifetimeMax) {
      console.log(`[PROMO ENGINE] Customer ${customerId} already used ${promoKey} ${lifetimeUsage} times (lifetime limit: ${rules.perCustomerLifetimeMax})`);
      return { awarded: false, pointsGranted: 0, reason: 'already_awarded' };
    }
  }

  // 4. Check per-customer annual cap
  if (rules.perCustomerPerYearMax !== undefined) {
    const annualCount = await db
      .select({ count: count() })
      .from(loyaltyTransactions)
      .where(
        db.withTenantFilter(
          loyaltyTransactions,
          and(
            eq(loyaltyTransactions.customerId, customerId),
            eq(loyaltyTransactions.promoKey, promoKey),
            gte(loyaltyTransactions.createdAt, startOfYear),
            lte(loyaltyTransactions.createdAt, endOfYear),
            sql`${loyaltyTransactions.deltaPoints} > 0`
          )
        )
      );

    const annualUsage = annualCount[0]?.count || 0;
    if (annualUsage >= rules.perCustomerPerYearMax) {
      console.log(`[PROMO ENGINE] Customer ${customerId} already used ${promoKey} ${annualUsage} times this year (annual limit: ${rules.perCustomerPerYearMax})`);
      return { awarded: false, pointsGranted: 0, reason: 'already_awarded' };
    }
  }

  // 5. Check per-household annual cap (if household limits exist)
  if (rules.perHouseholdPerYearMax !== undefined) {
    // Get customer's household
    const customer = await db.query.customers.findFirst({
      where: db.withTenantFilter(customers, eq(customers.id, customerId)),
      columns: { id: true, householdId: true },
    });

    if (customer?.householdId) {
      // Find all customers in this household
      const householdCustomers = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          db.withTenantFilter(
            customers,
            eq(customers.householdId, customer.householdId)
          )
        );

      const householdCustomerIds = householdCustomers.map(c => c.id);

      if (householdCustomerIds.length > 0) {
        // Count promo usage across all household members this year
        const householdCount = await db
          .select({ count: count() })
          .from(loyaltyTransactions)
          .where(
            db.withTenantFilter(
              loyaltyTransactions,
              and(
                inArray(loyaltyTransactions.customerId, householdCustomerIds),
                eq(loyaltyTransactions.promoKey, promoKey),
                gte(loyaltyTransactions.createdAt, startOfYear),
                lte(loyaltyTransactions.createdAt, endOfYear),
                sql`${loyaltyTransactions.deltaPoints} > 0`
              )
            )
          );

        const householdUsage = householdCount[0]?.count || 0;
        if (householdUsage >= rules.perHouseholdPerYearMax) {
          console.log(`[PROMO ENGINE] Household already used ${promoKey} ${householdUsage} times this year (household limit: ${rules.perHouseholdPerYearMax})`);
          return { awarded: false, pointsGranted: 0, reason: 'household_limit' };
        }
      }
    }
  }

  // 6. Check eligibility (e.g., require existing completed job)
  if (rules.requireExistingJob) {
    const completedJobCount = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        db.withTenantFilter(
          appointments,
          and(
            eq(appointments.customerId, customerId),
            eq(appointments.status, 'completed')
          )
        )
      );

    const hasCompletedJob = (completedJobCount[0]?.count || 0) > 0;
    if (!hasCompletedJob) {
      console.log(`[PROMO ENGINE] Customer ${customerId} has no completed jobs (required for ${promoKey})`);
      return { awarded: false, pointsGranted: 0, reason: 'not_existing_customer' };
    }
  }

  // 7. Award points based on mode
  if (rules.awardMode === 'pending_until_next_completed_job') {
    // Create pending transaction (deltaPoints = 0, points stored in metadata)
    await db.insert(loyaltyTransactions).values({
      tenantId,
      customerId,
      deltaPoints: 0, // No immediate points
      promoKey,
      source,
      metadata: {
        ...metadata,
        status: 'pending',
        pendingBonusPoints: basePoints,
      },
    });

    console.log(`[PROMO ENGINE] ✅ Pending award created: ${basePoints} points for ${promoKey} (will be granted on next job completion)`);
    return {
      awarded: true,
      pointsGranted: 0,
      reason: 'pending',
    };
  } else if (rules.awardMode === 'immediate') {
    // Award points immediately in a transaction
    return await db.transaction(async (tx) => {
      // Insert loyalty transaction
      await tx.insert(loyaltyTransactions).values({
        tenantId,
        customerId,
        deltaPoints: basePoints,
        promoKey,
        source,
        metadata,
      });

      // Upsert loyalty points balance
      const existing = await tx.query.loyaltyPoints.findFirst({
        where: and(
          eq(loyaltyPoints.tenantId, tenantId),
          eq(loyaltyPoints.customerId, customerId)
        ),
      });

      if (existing) {
        // Update existing balance
        await tx
          .update(loyaltyPoints)
          .set({
            points: sql`${loyaltyPoints.points} + ${basePoints}`,
            lastUpdated: new Date(),
          })
          .where(
            and(
              eq(loyaltyPoints.tenantId, tenantId),
              eq(loyaltyPoints.customerId, customerId)
            )
          );
      } else {
        // Create new balance
        await tx.insert(loyaltyPoints).values({
          tenantId,
          customerId,
          points: basePoints,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        });
      }

      console.log(`[PROMO ENGINE] ✅ Immediate award: ${basePoints} points granted for ${promoKey}`);
      return {
        awarded: true,
        pointsGranted: basePoints,
      };
    });
  }

  // Fallback (should never reach here)
  console.warn(`[PROMO ENGINE] Unknown award mode for ${promoKey}`);
  return { awarded: false, pointsGranted: 0, reason: 'unknown_mode' };
}

// ============================================================
// PENDING PROMO FULFILLMENT
// ============================================================

/**
 * Fulfill all pending promo bonuses for a customer when they complete a job
 * Called from job completion logic
 * 
 * @param db - Tenant-scoped database instance
 * @param tenantId - Tenant ID
 * @param customerId - Customer who just completed a job
 * @returns Total points granted from fulfilled pending promos
 */
export async function fulfillPendingPromos(
  db: TenantDb,
  tenantId: string,
  customerId: number,
): Promise<number> {
  console.log(`[PROMO ENGINE] Checking for pending promos to fulfill for customer ${customerId} in tenant ${tenantId}`);

  // Find all pending promo transactions for this customer
  const pendingPromos = await db
    .select()
    .from(loyaltyTransactions)
    .where(
      db.withTenantFilter(
        loyaltyTransactions,
        and(
          eq(loyaltyTransactions.customerId, customerId),
          eq(loyaltyTransactions.deltaPoints, 0),
          sql`${loyaltyTransactions.metadata}->>'status' = 'pending'`
        )
      )
    );

  if (pendingPromos.length === 0) {
    console.log(`[PROMO ENGINE] No pending promos to fulfill for customer ${customerId}`);
    return 0;
  }

  console.log(`[PROMO ENGINE] Found ${pendingPromos.length} pending promo(s) to fulfill`);

  let totalPointsGranted = 0;

  // Fulfill each pending promo in a transaction
  for (const pendingPromo of pendingPromos) {
    const pendingBonusPoints = (pendingPromo.metadata as any)?.pendingBonusPoints || 0;

    if (pendingBonusPoints <= 0) {
      console.warn(`[PROMO ENGINE] Pending promo ${pendingPromo.id} has invalid pendingBonusPoints: ${pendingBonusPoints}`);
      continue;
    }

    await db.transaction(async (tx) => {
      // Update pending transaction to mark as fulfilled
      await tx
        .update(loyaltyTransactions)
        .set({
          metadata: {
            ...(pendingPromo.metadata as any),
            status: 'fulfilled',
            fulfilledAt: new Date().toISOString(),
          },
        })
        .where(eq(loyaltyTransactions.id, pendingPromo.id));

      // Insert new transaction with actual points
      await tx.insert(loyaltyTransactions).values({
        tenantId,
        customerId,
        deltaPoints: pendingBonusPoints,
        promoKey: pendingPromo.promoKey,
        source: 'promo_pending_fulfilled',
        metadata: {
          originalPendingTransactionId: pendingPromo.id,
          originalPromoKey: pendingPromo.promoKey,
          fulfilledFromPending: true,
        },
      });

      // Upsert loyalty points balance
      const existing = await tx.query.loyaltyPoints.findFirst({
        where: and(
          eq(loyaltyPoints.tenantId, tenantId),
          eq(loyaltyPoints.customerId, customerId)
        ),
      });

      if (existing) {
        await tx
          .update(loyaltyPoints)
          .set({
            points: sql`${loyaltyPoints.points} + ${pendingBonusPoints}`,
            lastUpdated: new Date(),
          })
          .where(
            and(
              eq(loyaltyPoints.tenantId, tenantId),
              eq(loyaltyPoints.customerId, customerId)
            )
          );
      } else {
        await tx.insert(loyaltyPoints).values({
          tenantId,
          customerId,
          points: pendingBonusPoints,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      }

      console.log(`[PROMO ENGINE] ✅ Fulfilled pending promo ${pendingPromo.promoKey}: ${pendingBonusPoints} points granted`);
      totalPointsGranted += pendingBonusPoints;
    });
  }

  console.log(`[PROMO ENGINE] ✅ Total points granted from ${pendingPromos.length} pending promo(s): ${totalPointsGranted}`);
  return totalPointsGranted;
}
