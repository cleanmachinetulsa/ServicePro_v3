import { db } from "./db";
import { 
  customers, loyaltyPoints, pointsTransactions, rewardServices, redeemedRewards,
  loyaltyTiers, achievements, customerAchievements, loyaltyTransactions
} from "@shared/schema";
import { eq, gt, and, sql, like } from "drizzle-orm";
import { sendRewardNotificationEmail } from "./emailService.rewards";
import { addDays, addMonths } from "date-fns";
import type { TenantDb } from './tenantDb';
import { checkLoyaltyGuardrails, type LineItem, type LoyaltyGuardrailResult } from './gamificationService';
import { earn as ledgerEarn, reserve as ledgerReserve } from './services/loyaltyLedger';
import crypto from 'crypto';

/**
 * Custom error class for loyalty guardrail blocks
 */
export type LoyaltyGuardrailErrorCode =
  | 'MIN_CART_TOTAL'
  | 'CORE_SERVICE_REQUIRED'
  | 'LOYALTY_NOT_CONFIGURED'
  | 'GUARDRAIL_CHECK_FAILED';

export class LoyaltyGuardrailError extends Error {
  code: LoyaltyGuardrailErrorCode;

  constructor(code: LoyaltyGuardrailErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'LoyaltyGuardrailError';
  }
}

/**
 * Loyalty Redemption Journey v2 - Validation Result Type
 * 
 * This is the canonical return shape for validateLoyaltyRedemption.
 * Used by the frontend to show/hide guardrail messaging.
 */
export interface LoyaltyRedemptionValidation {
  canRedeem: boolean;
  reason?: string;
  appliedValue?: number;
  rewardName?: string;
  pointsCost?: number;
}

/**
 * Loyalty Redemption Journey v2 - Validate redemption without actually redeeming
 * 
 * This is a pure validation function that checks all guardrails and point requirements
 * without making any mutations. Used by the booking flow to show real-time eligibility.
 * 
 * Guardrails enforced:
 * - loyalty_min_cart_total: Minimum cart value required
 * - loyalty_require_core_service: Must book a core service (not add-ons only)
 * 
 * Where guardrails are currently enforced:
 * - checkLoyaltyGuardrails() in gamificationService.ts
 * - redeemPointsForReward() in loyaltyService.ts (calls checkLoyaltyGuardrails)
 * 
 * @param args Validation parameters
 * @returns LoyaltyRedemptionValidation result
 */
export async function validateLoyaltyRedemption(args: {
  tenantDb: TenantDb;
  tenantId: string;
  customerId: number;
  rewardId: number;
  cartTotal: number;
  selectedServices: LineItem[];
}): Promise<LoyaltyRedemptionValidation> {
  const { tenantDb, tenantId, customerId, rewardId, cartTotal, selectedServices } = args;
  
  try {
    // 1. Get reward service details
    const [rewardService] = await tenantDb
      .select()
      .from(rewardServices)
      .where(
        and(
          eq(rewardServices.id, rewardId),
          eq(rewardServices.active, true)
        )
      );
    
    if (!rewardService) {
      return {
        canRedeem: false,
        reason: "This reward is no longer available.",
      };
    }
    
    // 2. Check customer has enough points
    const [pointsRecord] = await tenantDb
      .select()
      .from(loyaltyPoints)
      .where(eq(loyaltyPoints.customerId, customerId));
    
    if (!pointsRecord || pointsRecord.points < rewardService.pointCost) {
      return {
        canRedeem: false,
        reason: `You need ${rewardService.pointCost} points to redeem this reward, but you have ${pointsRecord?.points || 0}.`,
        rewardName: rewardService.name,
        pointsCost: rewardService.pointCost,
      };
    }
    
    // 3. Check guardrails (min cart total, core service requirement)
    const guardrailResult = await checkLoyaltyGuardrails({
      tenantId,
      cartTotal,
      lineItems: selectedServices,
    });
    
    if (!guardrailResult.ok) {
      return {
        canRedeem: false,
        reason: guardrailResult.message,
        rewardName: rewardService.name,
        pointsCost: rewardService.pointCost,
      };
    }
    
    // 4. All checks passed - redemption is valid
    return {
      canRedeem: true,
      appliedValue: rewardService.pointCost, // Could be monetary value if we track that
      rewardName: rewardService.name,
      pointsCost: rewardService.pointCost,
    };
  } catch (error) {
    console.error('[LOYALTY VALIDATION] Error validating redemption:', error);
    return {
      canRedeem: false,
      reason: "Unable to validate reward redemption. Please try again.",
    };
  }
}

/**
 * Normalize phone number for consistent lookup
 * Handles different formats: (123) 456-7890, 123-456-7890, 1234567890
 */
function normalizePhoneNumber(phone: string): string[] {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Format with hyphens (123-456-7890)
  const withHyphens = digitsOnly.length === 10
    ? `${digitsOnly.substring(0, 3)}-${digitsOnly.substring(3, 6)}-${digitsOnly.substring(6)}`
    : phone;
  
  // Return array of possible formats to search for
  return [phone, digitsOnly, withHyphens];
}

/**
 * Get customer achievements data
 * Returns recent achievements (earned in last 30 days) and next milestones (not yet earned)
 * Multi-tenant safe: filters by tenant to ensure proper data isolation
 */
async function getCustomerAchievementsData(tenantDb: TenantDb, customerId: number) {
  try {
    // Get all achievements for this tenant (tenant-scoped)
    const allAchievements = await tenantDb
      .select()
      .from(achievements)
      .where(tenantDb.withTenantFilter(achievements));
    
    // Get customer's earned achievements (tenant-scoped)
    const earnedAchievements = await tenantDb
      .select({
        id: customerAchievements.id,
        achievementId: customerAchievements.achievementId,
        dateEarned: customerAchievements.dateEarned,
        notified: customerAchievements.notified,
        achievement: {
          id: achievements.id,
          name: achievements.name,
          description: achievements.description,
          pointValue: achievements.pointValue,
          icon: achievements.icon,
          level: achievements.level,
          criteria: achievements.criteria,
        }
      })
      .from(customerAchievements)
      .innerJoin(achievements, eq(customerAchievements.achievementId, achievements.id))
      .where(
        and(
          tenantDb.withTenantFilter(customerAchievements),
          eq(customerAchievements.customerId, customerId)
        )
      )
      .orderBy(sql`${customerAchievements.dateEarned} DESC`);
    
    // Get recent achievements (earned in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentAchievements = earnedAchievements.filter(a => 
      a.dateEarned && new Date(a.dateEarned) >= thirtyDaysAgo
    ).slice(0, 5); // Limit to 5 most recent
    
    // Get earned achievement IDs for filtering next milestones
    const earnedIds = new Set(earnedAchievements.map(a => a.achievementId));
    
    // Get next milestones (unearned achievements sorted by level/difficulty)
    const nextMilestones = allAchievements
      .filter(a => !earnedIds.has(a.id))
      .sort((a, b) => (a.level ?? 1) - (b.level ?? 1))
      .slice(0, 3); // Show top 3 achievable milestones
    
    return {
      recentAchievements: recentAchievements.map(a => ({
        id: a.id,
        achievementId: a.achievementId,
        name: a.achievement.name,
        description: a.achievement.description,
        pointValue: a.achievement.pointValue,
        icon: a.achievement.icon,
        level: a.achievement.level,
        dateEarned: a.dateEarned,
      })),
      nextMilestones: nextMilestones.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        pointValue: a.pointValue,
        icon: a.icon,
        level: a.level,
        criteria: a.criteria,
      })),
      totalEarned: earnedAchievements.length,
      totalAvailable: allAchievements.length,
    };
  } catch (error) {
    console.error('Error getting customer achievements data:', error);
    return {
      recentAchievements: [],
      nextMilestones: [],
      totalEarned: 0,
      totalAvailable: 0,
    };
  }
}

export async function getLoyaltyPointsByPhone(tenantDb: TenantDb, phone: string) {
  try {
    console.log(`Getting loyalty points for phone: ${phone}`);
    
    // Normalize the phone number to handle different formats
    const phoneFormats = normalizePhoneNumber(phone);
    
    // First try to get customer from PostgreSQL database using all possible formats
    let customer = null;
    for (const phoneFormat of phoneFormats) {
      const [found] = await tenantDb
        .select()
        .from(customers)
        .where(tenantDb.withTenantFilter(customers, eq(customers.phone, phoneFormat)));
      
      if (found) {
        customer = found;
        break;
      }
    }
    
    // If found in PostgreSQL database, use the standard approach
    if (customer) {
      console.log(`Customer found in PostgreSQL: ${customer.name}`);
      // Get or create loyalty points record
      const [points] = await tenantDb
        .select()
        .from(loyaltyPoints)
        .where(tenantDb.withTenantFilter(loyaltyPoints, eq(loyaltyPoints.customerId, customer.id)));

      if (!points) {
        // If no loyalty points record, check if customer has opted in
        if (!customer.loyaltyProgramOptIn) {
          return { 
            customer,
            loyaltyPoints: null,
            transactions: [],
            message: "Not enrolled in loyalty program",
            achievements: null,
          };
        }

        // Create new loyalty points record with a points
        const [newPoints] = await tenantDb
          .insert(loyaltyPoints)
          .values({
            customerId: customer.id,
            points: 0,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          })
          .returning();

        // Get achievements data for newly enrolled customer
        const achievementsData = await getCustomerAchievementsData(tenantDb, customer.id);

        return { 
          customer,
          loyaltyPoints: newPoints,
          transactions: [],
          message: "New loyalty account created",
          achievements: achievementsData,
        };
      }

      // Get transactions for this customer
      const transactions = await tenantDb
        .select()
        .from(pointsTransactions)
        .where(eq(pointsTransactions.loyaltyPointsId, points.id))
        .orderBy(sql`${pointsTransactions.transactionDate} DESC`)
        .limit(10);

      // Get achievements data for this customer
      const achievementsData = await getCustomerAchievementsData(tenantDb, customer.id);

      return { 
        customer,
        loyaltyPoints: points,
        transactions,
        message: "Loyalty points retrieved",
        achievements: achievementsData,
      };
    } 
    
    // If not found in database, try Google Sheets customer records
    console.log("Customer not found in PostgreSQL, checking Google Sheets");
    const { getEnhancedCustomerServiceHistory } = await import('./enhancedCustomerSearch');
    
    try {
      const customerInfo = await getEnhancedCustomerServiceHistory(phone);
      
      if (!customerInfo || !customerInfo.found) {
        console.log("Customer not found in Google Sheets either");
        return null;
      }
      
      console.log(`Customer found in Google Sheets: ${customerInfo.name}`);
      
      // Extract loyalty information from Google Sheets data
      const loyaltyPoints = parseInt(customerInfo.loyaltyPoints) || 0;
      const loyaltyTier = customerInfo.loyaltyTier || 'Bronze';
      const lastInvoiceDate = customerInfo.lastInvoiceDate || '';
      
      // Create a virtual loyalty record from the sheets data
      return {
        customer: {
          id: 0, // Virtual ID since this comes from Google Sheets
          name: customerInfo.name,
          phone: customerInfo.phone,
          email: customerInfo.email,
          address: customerInfo.address || '',
          vehicleInfo: customerInfo.vehicleInfo || '',
          loyaltyProgramOptIn: true
        },
        loyaltyPoints: {
          id: 0, // Virtual ID since this comes from Google Sheets
          customerId: 0,
          points: loyaltyPoints,
          tier: loyaltyTier,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        transactions: [], // No transaction history available from sheets
        message: "Loyalty points retrieved from Google Sheets",
        source: 'sheets',
        achievements: {
          recentAchievements: [],
          nextMilestones: [],
          totalEarned: 0,
          totalAvailable: 0,
        },
      };
    } catch (sheetsError) {
      console.error("Error getting customer data from Google Sheets:", sheetsError);
      return null;
    }
  } catch (error) {
    console.error('Error getting loyalty points by phone:', error);
    return null;
  }
}

/**
 * Get loyalty points for a customer by email
 */
export async function getLoyaltyPointsByEmail(tenantDb: TenantDb, email: string) {
  try {
    console.log(`Getting loyalty points for email: ${email}`);
    
    // First try to get customer from PostgreSQL database
    const [customer] = await tenantDb
      .select()
      .from(customers)
      .where(tenantDb.withTenantFilter(customers, eq(customers.email, email)));

    if (customer) {
      console.log(`Customer found in PostgreSQL by email: ${customer.name}`);
      return getLoyaltyPointsByPhone(tenantDb, customer.phone);
    }
    
    // If not found in database, try Google Sheets customer records
    console.log("Customer not found in PostgreSQL by email, checking Google Sheets");
    const { searchAllCustomerData } = await import('./enhancedCustomerSearch');
    
    try {
      // Search for customer by email in Google Sheets
      const customerRecords = await searchAllCustomerData(email, 'email');
      
      if (!customerRecords || customerRecords.length === 0) {
        console.log("Customer not found in Google Sheets by email");
        return null;
      }
      
      // Use the first matching record's phone to look up loyalty info
      const primaryRecord = customerRecords[0];
      console.log(`Customer found in Google Sheets by email: ${primaryRecord.name}`);
      
      return getLoyaltyPointsByPhone(tenantDb, primaryRecord.phone);
    } catch (sheetsError) {
      console.error("Error searching Google Sheets by email:", sheetsError);
      return null;
    }
  } catch (error) {
    console.error('Error getting loyalty points by email:', error);
    return null;
  }
}

/**
 * Get available loyalty point offers
 */
export async function getAvailableRewardServices(tenantDb: TenantDb) {
  return tenantDb
    .select()
    .from(rewardServices)
    .where(eq(rewardServices.active, true))
    .orderBy(sql`${rewardServices.pointCost} ASC`);
}

/**
 * Get all loyalty points records for dashboard display
 */
export async function getAllLoyaltyPoints(tenantDb: TenantDb) {
  try {
    const points = await tenantDb
      .select()
      .from(loyaltyPoints);
      
    return points;
  } catch (error) {
    console.error('Error fetching all loyalty points:', error);
    return [];
  }
}

/**
 * Get all customers for dashboard display
 */
export async function getAllCustomers(tenantDb: TenantDb) {
  try {
    const customerList = await tenantDb
      .select()
      .from(customers);
      
    return customerList;
  } catch (error) {
    console.error('Error fetching all customers:', error);
    return [];
  }
}

/**
 * Get all points transactions for dashboard display
 */
export async function getAllTransactions(tenantDb: TenantDb) {
  try {
    const transactions = await tenantDb
      .select()
      .from(pointsTransactions)
      .orderBy(sql`${pointsTransactions.transactionDate} DESC`);
      
    return transactions;
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    return [];
  }
}

/**
 * Get all loyalty tiers for dashboard display
 */
export async function getAllLoyaltyTiers(tenantDb: TenantDb) {
  try {
    const tiers = await tenantDb
      .select()
      .from(loyaltyTiers)
      .orderBy(loyaltyTiers.pointThreshold);
      
    return tiers;
  } catch (error) {
    console.error('Error fetching all loyalty tiers:', error);
    return [];
  }
}

/**
 * Get all achievements for dashboard display
 */
export async function getAllAchievements(tenantDb: TenantDb) {
  try {
    const achievementList = await tenantDb
      .select()
      .from(achievements)
      .orderBy(achievements.level);
      
    return achievementList;
  } catch (error) {
    console.error('Error fetching all achievements:', error);
    return [];
  }
}

/**
 * Get all customer achievements for dashboard display
 */
export async function getAllCustomerAchievements(tenantDb: TenantDb) {
  try {
    const customerAchievementList = await tenantDb
      .select()
      .from(customerAchievements);
      
    // Join with achievements to get full details
    const results = [];
    
    for (const ca of customerAchievementList) {
      const [achievement] = await tenantDb
        .select()
        .from(achievements)
        .where(eq(achievements.id, ca.achievementId));
        
      const [customer] = await tenantDb
        .select()
        .from(customers)
        .where(eq(customers.id, ca.customerId));
        
      if (achievement && customer) {
        results.push({
          ...ca,
          achievement,
          customer,
        });
      }
    }
      
    return results;
  } catch (error) {
    console.error('Error fetching all customer achievements:', error);
    return [];
  }
}

/**
 * Get all redeemed rewards for dashboard display
 */
export async function getAllRedeemedRewards(tenantDb: TenantDb) {
  try {
    const rewards = await tenantDb
      .select()
      .from(redeemedRewards);
      
    // Join with customers and reward services
    const results = [];
    
    for (const reward of rewards) {
      const [customer] = await tenantDb
        .select()
        .from(customers)
        .where(eq(customers.id, reward.customerId));
        
      const [service] = await tenantDb
        .select()
        .from(rewardServices)
        .where(eq(rewardServices.id, reward.rewardServiceId));
        
      if (customer && service) {
        results.push({
          ...reward,
          customer,
          rewardService: service,
        });
      }
    }
      
    return results;
  } catch (error) {
    console.error('Error fetching all redeemed rewards:', error);
    return [];
  }
}

/**
 * Get all reward services for dashboard display
 */
export async function getRewardServicesForDashboard(tenantDb: TenantDb) {
  try {
    const services = await tenantDb
      .select()
      .from(rewardServices);
      
    return services;
  } catch (error) {
    console.error('Error fetching all reward services:', error);
    return [];
  }
}

/**
 * Add loyalty points for a customer from an invoice
 * $1 = 1 point
 */
export async function addLoyaltyPointsFromInvoice(tenantDb: TenantDb, customerId: number, invoiceId: number, amount: number) {
  // L3 Part 2A: delegate to loyaltyLedger.earn(). The ledger owns transaction
  // atomicity, idempotency, and balance increment. This facade preserves the
  // opt-in guard and the reward-eligibility email side-effect.

  // Preserve opt-in guard: if no loyalty_points row AND customer not opted in,
  // return null (existing contract — callers rely on this to skip awarding).
  const [existingPoints] = await tenantDb
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));

  if (!existingPoints) {
    const [customer] = await tenantDb
      .select()
      .from(customers)
      .where(eq(customers.id, customerId));

    if (!customer?.loyaltyProgramOptIn) {
      return null; // Customer hasn't opted in
    }
  }

  // Calculate points to add (1 point per $1). Preserve previous early-return
  // for non-positive amounts (returns current points record, not null).
  const pointsToAdd = Math.floor(Number(amount));
  if (pointsToAdd <= 0) {
    return existingPoints ?? null;
  }

  // Delegate to canonical ledger. Idempotency key is stable per (invoice,customer)
  // so a retry of the same invoice award never double-credits.
  const result = await ledgerEarn(tenantDb, {
    tenantId: tenantDb.tenantId,
    customerId,
    amount: pointsToAdd,
    source: 'invoice',
    idempotencyKey: `invoice:${invoiceId}:${customerId}`,
    description: `Points earned from invoice #${invoiceId}`,
    metadata: { invoiceId },
  });

  if (!result.success) {
    return null;
  }

  // Re-read the loyalty_points row to preserve the legacy return shape (callers
  // currently just JSON-stringify dbResult; no caller inspects specific fields).
  const [updatedPoints] = await tenantDb
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));

  // Email side-effect stays in the facade (NOT in the ledger). Only fire on a
  // first-time award — duplicate idempotent calls should not re-notify.
  if (!result.alreadyApplied && updatedPoints) {
    checkAndNotifyRewardEligibility(tenantDb, customerId, updatedPoints.points);
  }

  return updatedPoints ?? null;
}

/**
 * Check if customer is eligible for loyalty offers and send notification
 */
async function checkAndNotifyRewardEligibility(tenantDb: TenantDb, customerId: number, points: number) {
  // Check if customer has enough points for any loyalty offer
  const rewardsAvailable = await tenantDb
    .select()
    .from(rewardServices)
    .where(
      and(
        eq(rewardServices.active, true),
        sql`${rewardServices.pointCost} <= ${points}`
      )
    )
    .orderBy(sql`${rewardServices.pointCost} DESC`)
    .limit(1);

  if (rewardsAvailable.length > 0) {
    // Customer has enough points for a loyalty offer, send notification
    const [customer] = await tenantDb
      .select()
      .from(customers)
      .where(eq(customers.id, customerId));

    if (customer && customer.email) {
      await sendRewardNotificationEmail(
        customer.email,
        customer.name,
        points,
        rewardsAvailable[0]
      );
    }
  }
}

/**
 * Redeem loyalty points for an offer
 * Now includes guardrail checks for min cart total and core service requirements
 * 
 * @param tenantDb - Tenant database connection
 * @param customerId - Customer ID
 * @param rewardServiceId - Reward service ID
 * @param quantity - Number of rewards to redeem (1-3)
 * @param options - Optional guardrail parameters
 * @param options.cartTotal - Current cart total for min cart check
 * @param options.lineItems - Line items in cart for core service check
 * @param options.skipGuardrails - Skip guardrail checks (for admin use only)
 */
export async function redeemPointsForReward(
  tenantDb: TenantDb,
  customerId: number, 
  rewardServiceId: number,
  quantity: number = 1,
  options?: {
    cartTotal?: number;
    lineItems?: LineItem[];
    skipGuardrails?: boolean;
    tenantId?: string;
    /**
     * Caller-supplied stable token for retry-deduplication. Per-unit ledger key
     * becomes `${idempotencyToken}:${i}`. The route layer generates one UUID per
     * HTTP request → retries dedupe; separate requests get distinct tokens.
     * If omitted, one is generated and a warning is logged (retry-unsafe).
     */
    idempotencyToken?: string;
  }
) {
  // Quantity validation kept in the facade — preserves existing route contract.
  if (quantity < 1 || quantity > 3) {
    throw new Error("You can redeem between 1 and 3 rewards at once");
  }

  const tenantId = options?.tenantId || tenantDb.tenantId;

  // Guardrails kept in the facade. The ledger is not responsible for cart-shape
  // policy — that's a business-rule layer, intentionally above the ledger.
  if (!options?.skipGuardrails) {
    const guardrailResult = await checkLoyaltyGuardrails({
      tenantId,
      cartTotal: options?.cartTotal ?? 0,
      lineItems: options?.lineItems ?? [],
    });
    
    if (!guardrailResult.ok) {
      console.warn('[LOYALTY] Guardrail blocked redemption:', {
        tenantId,
        code: guardrailResult.code,
        cartTotal: options?.cartTotal,
        customerId,
      });
      throw new LoyaltyGuardrailError(guardrailResult.code, guardrailResult.message);
    }
  }

  // Lookup reward — needed for the user-facing message string and the
  // totalPointsNeeded value surfaced in INSUFFICIENT_POINTS errors. reserve()
  // also re-loads this inside its transaction (single source of truth for the
  // actual debit), so this read is purely cosmetic / for error messages.
  const [rewardService] = await tenantDb
    .select()
    .from(rewardServices)
    .where(
      and(
        eq(rewardServices.id, rewardServiceId),
        eq(rewardServices.active, true)
      )
    );

  if (!rewardService) {
    throw new Error("Loyalty offer not found or inactive");
  }

  const totalPointsNeeded = rewardService.pointCost * quantity;

  // Idempotency token — required for safe retry behavior.
  let idempotencyToken = options?.idempotencyToken;
  if (!idempotencyToken) {
    idempotencyToken = crypto.randomUUID();
    console.warn(
      `[LOYALTY] redeemPointsForReward called WITHOUT options.idempotencyToken ` +
      `(customer=${customerId}, rewardServiceId=${rewardServiceId}, quantity=${quantity}). ` +
      `Generated fallback ${idempotencyToken}. Retries of this exact HTTP request ` +
      `CANNOT be deduplicated — caller should pass a stable per-request token.`
    );
  }

  // Retry detection — if ANY ledger row exists with a per-unit key prefixed by
  // this idempotencyToken, this is a retry of an already-processed request.
  // Skip the pre-check (balance was already debited by the original call;
  // checking it again would falsely throw INSUFFICIENT_POINTS). reserve() will
  // short-circuit each unit via alreadyApplied and we surface the original
  // reservations. Without this guard, idempotent retries break.
  const tokenPrefix = `${idempotencyToken}:`;
  const priorRows = await tenantDb
    .select({ id: loyaltyTransactions.id })
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.tenantId, tenantId),
        eq(loyaltyTransactions.customerId, customerId),
        like(loyaltyTransactions.promoKey, `${tokenPrefix}%`),
      ),
    )
    .limit(1);
  const isRetry = priorRows.length > 0;

  // All-or-nothing pre-check for FRESH multi-unit redemptions. Without this,
  // looped per-unit reserves can partially commit (e.g. quantity=3, balance
  // covers 2): unit 0 succeeds, unit 1 succeeds, unit 2 fails with
  // INSUFFICIENT_POINTS, leaving two reservations already committed while the
  // caller sees an error. Pre-check matches legacy behavior. Residual TOCTOU
  // window vs. a concurrent debit between this read and the first reserve()
  // is the same narrow race the legacy code had — acceptable; a future
  // hardening could wrap the whole sequence in a tx with release on
  // later-unit failure.
  if (!isRetry) {
    const [preCheckPoints] = await tenantDb
      .select()
      .from(loyaltyPoints)
      .where(eq(loyaltyPoints.customerId, customerId));

    const preBalance = preCheckPoints?.points ?? 0;
    if (preBalance < totalPointsNeeded) {
      throw new Error(`Not enough points. You need ${totalPointsNeeded} points but have ${preBalance}`);
    }
  }

  // Per-unit reserve via the ledger. The ledger owns: atomic conditional
  // decrement (no double-spend across concurrent calls), redeemed_rewards
  // insert, loyalty_transactions row, mirror points_transactions row.
  const records: Array<{
    id: number | null;
    customerId: number;
    rewardServiceId: number;
    pointsSpent: number;
    status: string;
  }> = [];

  for (let i = 0; i < quantity; i++) {
    const r = await ledgerReserve(tenantDb, {
      tenantId,
      customerId,
      rewardServiceId,
      idempotencyKey: `${idempotencyToken}:${i}`,
    });

    if (!r.success) {
      if (r.error === 'INSUFFICIENT_POINTS') {
        // Preserve the legacy error string the route surfaces to clients.
        throw new Error(`Not enough points. You need ${totalPointsNeeded} points but have ${r.newBalance}`);
      }
      if (r.error === 'REWARD_NOT_FOUND_OR_INACTIVE') {
        throw new Error('Loyalty offer not found or inactive');
      }
      throw new Error(`Failed to redeem reward: ${r.error ?? 'unknown error'}`);
    }

    records.push({
      id: r.reservationId,
      customerId,
      rewardServiceId,
      pointsSpent: r.pointsReserved,
      status: 'pending',
    });
  }

  // Re-read the final loyalty_points row so the caller still gets the same
  // shape it received before delegation. Callers JSON-stringify this — no
  // field-level dependencies (verified at routes.loyalty.ts:248).
  const [updatedPoints] = await tenantDb
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));

  return {
    updatedPoints: updatedPoints ?? null,
    redeemedRewards: records,
    message: `Successfully redeemed ${quantity} ${rewardService.name} loyalty offer(s)`,
  };
}

/**
 * Opt a customer into the loyalty program
 */
export async function optInToLoyaltyProgram(tenantDb: TenantDb, customerId: number) {
  // Update customer record
  const [updatedCustomer] = await tenantDb
    .update(customers)
    .set({ 
      loyaltyProgramOptIn: true,
      loyaltyProgramJoinDate: new Date(),
    })
    .where(eq(customers.id, customerId))
    .returning();

  // Create loyalty points record if it doesn't exist
  let [pointsRecord] = await tenantDb
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));

  if (!pointsRecord) {
    [pointsRecord] = await tenantDb
      .insert(loyaltyPoints)
      .values({
        customerId,
        points: 0,
        expiryDate: addMonths(new Date(), 12), // 1 year from now
      })
      .returning();
  }

  return {
    customer: updatedCustomer,
    loyaltyPoints: pointsRecord,
    message: "Successfully opted into loyalty program",
  };
}

/**
 * Get a customer's redeemed loyalty offers
 */
export async function getRedeemedRewards(tenantDb: TenantDb, customerId: number) {
  try {
    const rewards = await tenantDb
      .select()
      .from(redeemedRewards)
      .where(eq(redeemedRewards.customerId, customerId))
      .orderBy(sql`${redeemedRewards.redeemedDate} DESC`);
      
    // Join with reward services
    const result = [];
    for (const reward of rewards) {
      const [service] = await tenantDb
        .select()
        .from(rewardServices)
        .where(eq(rewardServices.id, reward.rewardServiceId));
        
      if (service) {
        result.push({
          ...reward,
          service,
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error getting redeemed rewards:', error);
    throw error;
  }
}

// L3 Part 2A: processExpiredPoints and cleanupExpiredPoints DELETED.
// Re-grep confirmed zero callers across server/ and client/ before deletion.
// Expiry handling (if/when re-introduced) belongs in loyaltyLedger as a
// dedicated expire() entry point — see TECHNICAL_DEBT_LEDGER_v3 LOY-8.