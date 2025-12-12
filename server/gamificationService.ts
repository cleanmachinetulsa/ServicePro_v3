import type { TenantDb } from "./db";
import { db } from "./db";
import { 
  loyaltyPoints, 
  pointsTransactions, 
  achievements, 
  customerAchievements,
  loyaltyTiers,
  businessSettings,
  type InsertLoyaltyPoints,
  type InsertPointsTransaction,
  type InsertAchievement,
  type InsertCustomerAchievement,
  type InsertLoyaltyTier
} from "@shared/schema";
import { eq, and, gte, sql, ilike } from "drizzle-orm";

/**
 * Loyalty Guardrail Result Type
 * Used to enforce minimum cart total and core service requirements for point redemption
 */
export type LoyaltyGuardrailResult =
  | { ok: true }
  | {
      ok: false;
      code: 'MIN_CART_TOTAL' | 'CORE_SERVICE_REQUIRED';
      message: string;
    };

/**
 * Line item for guardrail checking
 */
export interface LineItem {
  id: string | number;
  name: string;
  price?: number;
  tags?: string[];
  isAddOn?: boolean;
}

/**
 * Check loyalty guardrails before allowing point redemption
 * Enforces min cart total and core service requirements based on business settings
 * 
 * NOTE: businessSettings is currently a singleton table.
 * All tenants (including non-root) use the same root settings until multi-tenant settings are added.
 * This ensures all tenants are protected by guardrails.
 */
export async function checkLoyaltyGuardrails(args: {
  tenantId: string;
  cartTotal: number;
  lineItems: LineItem[];
}): Promise<LoyaltyGuardrailResult> {
  try {
    // Load business settings (global singleton table - applies to all tenants)
    // All tenants use root settings until tenant-specific businessSettings are implemented
    const [settings] = await db
      .select()
      .from(businessSettings)
      .limit(1);
    
    if (!settings) {
      // No settings found, allow redemption by default
      return { ok: true };
    }
    
    // 1) Check minimum cart total
    const minTotal = settings.loyaltyMinCartTotal;
    if (typeof minTotal === 'number' && minTotal > 0) {
      if (args.cartTotal < minTotal) {
        return {
          ok: false,
          code: 'MIN_CART_TOTAL',
          message:
            settings.loyaltyGuardrailMessage ??
            `Points can only be used on orders of at least $${minTotal}.`,
        };
      }
    }
    
    // 2) Check core service requirement
    if (settings.loyaltyRequireCoreService) {
      // Check if at least one line item is a core service (not an add-on)
      const hasCore = args.lineItems.some((item) => {
        // Check for core_service tag
        if ((item.tags ?? []).includes('core_service')) {
          return true;
        }
        // Check explicit isAddOn flag (core services have isAddOn = false or undefined)
        if (item.isAddOn === false) {
          return true;
        }
        // If no tags and not explicitly an add-on, treat as core
        if (!item.tags?.length && item.isAddOn !== true) {
          return true;
        }
        return false;
      });
      
      if (!hasCore) {
        return {
          ok: false,
          code: 'CORE_SERVICE_REQUIRED',
          message:
            settings.loyaltyGuardrailMessage ??
            'Points can only be redeemed when booking a main/core service (not add-ons alone).',
        };
      }
    }
    
    return { ok: true };
  } catch (error) {
    console.error('[LOYALTY GUARDRAILS] Error checking guardrails:', error);
    // On error, allow redemption to avoid blocking legitimate transactions
    return { ok: true };
  }
}

/**
 * Get current loyalty guardrail settings for display in UI
 * 
 * NOTE: businessSettings is currently a singleton table.
 * All tenants (including non-root) use the same root settings until multi-tenant settings are added.
 * This ensures all tenants are protected and see the same guardrail requirements.
 * 
 * @param tenantId - Tenant ID (currently unused - all tenants use global settings)
 */
export async function getLoyaltyGuardrailSettings(_tenantId: string = 'root'): Promise<{
  minCartTotal: number | null;
  requireCoreService: boolean;
  guardrailMessage: string | null;
}> {
  try {
    // Load business settings (global singleton table - applies to all tenants)
    // tenantId is accepted for future multi-tenant support but currently uses global settings
    const [settings] = await db
      .select({
        minCartTotal: businessSettings.loyaltyMinCartTotal,
        requireCoreService: businessSettings.loyaltyRequireCoreService,
        guardrailMessage: businessSettings.loyaltyGuardrailMessage,
      })
      .from(businessSettings)
      .limit(1);
    
    return {
      minCartTotal: settings?.minCartTotal ?? null,
      requireCoreService: settings?.requireCoreService ?? false,
      guardrailMessage: settings?.guardrailMessage ?? null,
    };
  } catch (error) {
    console.error('[LOYALTY GUARDRAILS] Error fetching settings:', error);
    return {
      minCartTotal: null,
      requireCoreService: false,
      guardrailMessage: null,
    };
  }
}

/**
 * Award points to a customer
 */
export async function awardPoints(
  tenantDb: TenantDb,
  customerId: number,
  amount: number,
  source: string,
  sourceId: number | null,
  description: string
): Promise<{ success: boolean; currentPoints: number }> {
  try {
    // Get or create loyalty points record for customer
    let customerPoints = await getCustomerLoyaltyPoints(tenantDb, customerId);
    
    if (!customerPoints) {
      // Create new loyalty points record for customer
      const [newPoints] = await tenantDb
        .insert(loyaltyPoints)
        .values({ customerId, points: 0 })
        .returning();
      
      customerPoints = newPoints;
    }
    
    // Update points
    const newPointsTotal = customerPoints.points + amount;
    
    // Update the loyalty points record
    const [updatedPoints] = await tenantDb
      .update(loyaltyPoints)
      .set({ 
        points: newPointsTotal,
        lastUpdated: new Date()
      })
      .where(eq(loyaltyPoints.id, customerPoints.id))
      .returning();
    
    // Record the transaction
    await tenantDb.insert(pointsTransactions).values({
      loyaltyPointsId: customerPoints.id,
      amount,
      description,
      transactionType: "earn",
      source,
      sourceId: sourceId || undefined
    });
    
    // Check if customer has earned any new achievements
    await checkForNewAchievements(tenantDb, customerId, newPointsTotal);
    
    return { 
      success: true, 
      currentPoints: updatedPoints.points 
    };
  } catch (error) {
    console.error("Error awarding points:", error);
    return { 
      success: false, 
      currentPoints: 0 
    };
  }
}

/**
 * Award campaign points idempotently - only awards once per customer per campaign
 * Uses source + sourceId (campaign ID) for idempotency check since these are already
 * present in existing transactions.
 * 
 * @param tenantDb - Tenant database instance
 * @param customerId - Customer ID to award points to
 * @param amount - Number of points to award
 * @param campaignKey - Unique identifier for the campaign (for logging/description)
 * @param source - Source category (e.g. 'port_recovery')
 * @param sourceId - Campaign ID - REQUIRED for idempotency
 * @param description - Human-readable description
 * @returns Object with success status, wasSkipped flag, and current points
 */
export async function awardCampaignPointsOnce(
  tenantDb: TenantDb,
  customerId: number,
  amount: number,
  campaignKey: string,
  source: string,
  sourceId: number,
  description: string
): Promise<{ success: boolean; wasSkipped: boolean; currentPoints: number }> {
  try {
    let customerPoints = await getCustomerLoyaltyPoints(tenantDb, customerId);
    
    // Create loyalty points record if it doesn't exist
    if (!customerPoints) {
      const [created] = await tenantDb.insert(loyaltyPoints).values({
        customerId,
        points: 0,
      }).returning();
      customerPoints = created;
      console.log('[LOYALTY] Created loyalty points record for customer', { customerId });
    }
    
    if (customerPoints) {
      const existingTx = await tenantDb
        .select()
        .from(pointsTransactions)
        .where(
          and(
            eq(pointsTransactions.loyaltyPointsId, customerPoints.id),
            eq(pointsTransactions.source, source),
            eq(pointsTransactions.sourceId, sourceId)
          )
        )
        .limit(1);
      
      if (existingTx.length > 0) {
        console.log('[LOYALTY] Skipping extra points; already awarded for campaign', {
          customerId,
          campaignKey,
          sourceId,
          existingTxId: existingTx[0].id,
        });
        return { 
          success: true, 
          wasSkipped: true, 
          currentPoints: customerPoints.points 
        };
      }
    }
    
    const descriptionWithKey = description.includes(campaignKey) 
      ? description 
      : `${description} [${campaignKey}]`;
    
    const result = await awardPoints(tenantDb, customerId, amount, source, sourceId, descriptionWithKey);
    
    return { 
      success: result.success, 
      wasSkipped: false, 
      currentPoints: result.currentPoints 
    };
  } catch (error) {
    console.error('[LOYALTY] Error in awardCampaignPointsOnce:', error);
    return { success: false, wasSkipped: false, currentPoints: 0 };
  }
}

/**
 * Get campaign transactions by source and sourceId
 * Used for normalization/correction of over-awarded points
 * 
 * @param tenantDb - Tenant database instance  
 * @param sourceId - Campaign ID to find transactions for
 * @param source - Source category (default: 'port_recovery')
 */
export async function getCampaignTransactionsBySourceId(
  tenantDb: TenantDb,
  sourceId: number,
  source: string = 'port_recovery'
): Promise<Array<{
  id: number;
  customerId: number;
  amount: number;
  description: string;
  loyaltyPointsId: number;
  sourceId: number | null;
}>> {
  const transactions = await tenantDb
    .select({
      id: pointsTransactions.id,
      amount: pointsTransactions.amount,
      description: pointsTransactions.description,
      loyaltyPointsId: pointsTransactions.loyaltyPointsId,
      sourceId: pointsTransactions.sourceId,
    })
    .from(pointsTransactions)
    .where(
      and(
        eq(pointsTransactions.source, source),
        eq(pointsTransactions.sourceId, sourceId)
      )
    );
  
  const lpToCustomer = new Map<number, number>();
  const loyaltyPointsIds = [...new Set(transactions.map(t => t.loyaltyPointsId))];
  
  if (loyaltyPointsIds.length > 0) {
    const lpRecords = await tenantDb
      .select({ id: loyaltyPoints.id, customerId: loyaltyPoints.customerId })
      .from(loyaltyPoints)
      .where(sql`${loyaltyPoints.id} IN (${sql.join(loyaltyPointsIds.map(id => sql`${id}`), sql`, `)})`);
    
    for (const lp of lpRecords) {
      lpToCustomer.set(lp.id, lp.customerId);
    }
  }
  
  return transactions.map(t => ({
    id: t.id,
    customerId: lpToCustomer.get(t.loyaltyPointsId) ?? 0,
    amount: t.amount,
    description: t.description ?? '',
    loyaltyPointsId: t.loyaltyPointsId,
    sourceId: t.sourceId,
  }));
}

/**
 * Get port_recovery transactions for specific campaign IDs
 * Used for normalization - scoped to the exact campaigns we want to correct
 * 
 * @param tenantDb - Tenant database instance
 * @param campaignIds - Array of campaign IDs to include in the search
 */
export async function getPortRecoveryTransactionsByCampaignIds(
  tenantDb: TenantDb,
  campaignIds: number[]
): Promise<Array<{
  id: number;
  customerId: number;
  amount: number;
  description: string;
  loyaltyPointsId: number;
  sourceId: number | null;
}>> {
  if (campaignIds.length === 0) {
    return [];
  }
  
  const transactions = await tenantDb
    .select({
      id: pointsTransactions.id,
      amount: pointsTransactions.amount,
      description: pointsTransactions.description,
      loyaltyPointsId: pointsTransactions.loyaltyPointsId,
      sourceId: pointsTransactions.sourceId,
    })
    .from(pointsTransactions)
    .where(
      and(
        eq(pointsTransactions.source, 'port_recovery'),
        sql`${pointsTransactions.sourceId} IN (${sql.join(campaignIds.map(id => sql`${id}`), sql`, `)})`
      )
    );
  
  const lpToCustomer = new Map<number, number>();
  const loyaltyPointsIds = [...new Set(transactions.map(t => t.loyaltyPointsId))];
  
  if (loyaltyPointsIds.length > 0) {
    const lpRecords = await tenantDb
      .select({ id: loyaltyPoints.id, customerId: loyaltyPoints.customerId })
      .from(loyaltyPoints)
      .where(sql`${loyaltyPoints.id} IN (${sql.join(loyaltyPointsIds.map(id => sql`${id}`), sql`, `)})`);
    
    for (const lp of lpRecords) {
      lpToCustomer.set(lp.id, lp.customerId);
    }
  }
  
  return transactions.map(t => ({
    id: t.id,
    customerId: lpToCustomer.get(t.loyaltyPointsId) ?? 0,
    amount: t.amount,
    description: t.description ?? '',
    loyaltyPointsId: t.loyaltyPointsId,
    sourceId: t.sourceId,
  }));
}

/**
 * Redeem points from a customer's balance
 */
export async function redeemPoints(
  tenantDb: TenantDb,
  customerId: number,
  amount: number,
  source: string,
  sourceId: number | null,
  description: string
): Promise<{ success: boolean; currentPoints: number }> {
  try {
    // Get loyalty points record for customer
    const customerPoints = await getCustomerLoyaltyPoints(tenantDb, customerId);
    
    if (!customerPoints) {
      return { 
        success: false, 
        currentPoints: 0 
      };
    }
    
    // Check if customer has enough points
    if (customerPoints.points < amount) {
      return { 
        success: false, 
        currentPoints: customerPoints.points 
      };
    }
    
    // Update points
    const newPointsTotal = customerPoints.points - amount;
    
    // Update the loyalty points record
    const [updatedPoints] = await tenantDb
      .update(loyaltyPoints)
      .set({ 
        points: newPointsTotal,
        lastUpdated: new Date()
      })
      .where(eq(loyaltyPoints.id, customerPoints.id))
      .returning();
    
    // Record the transaction
    await tenantDb.insert(pointsTransactions).values({
      loyaltyPointsId: customerPoints.id,
      amount: -amount, // Negative for redemption
      description,
      transactionType: "redeem",
      source,
      sourceId: sourceId || undefined
    });
    
    return { 
      success: true, 
      currentPoints: updatedPoints.points 
    };
  } catch (error) {
    console.error("Error redeeming points:", error);
    return { 
      success: false, 
      currentPoints: 0 
    };
  }
}

/**
 * Get a customer's loyalty points
 */
export async function getCustomerLoyaltyPoints(tenantDb: TenantDb, customerId: number) {
  const [customerPoints] = await tenantDb
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));
  
  return customerPoints;
}

/**
 * Get a customer's current loyalty tier
 */
export async function getCustomerLoyaltyTier(tenantDb: TenantDb, customerId: number) {
  const customerPoints = await getCustomerLoyaltyPoints(tenantDb, customerId);
  
  if (!customerPoints) {
    return null;
  }
  
  // Get highest tier customer qualifies for
  const [tier] = await tenantDb
    .select()
    .from(loyaltyTiers)
    .where(gte(customerPoints.points, loyaltyTiers.pointThreshold))
    .orderBy(sql`${loyaltyTiers.pointThreshold} DESC`)
    .limit(1);
  
  return tier;
}

/**
 * Get a customer's transaction history
 */
export async function getCustomerTransactionHistory(tenantDb: TenantDb, customerId: number) {
  const customerPoints = await getCustomerLoyaltyPoints(tenantDb, customerId);
  
  if (!customerPoints) {
    return [];
  }
  
  return tenantDb
    .select()
    .from(pointsTransactions)
    .where(eq(pointsTransactions.loyaltyPointsId, customerPoints.id))
    .orderBy(sql`${pointsTransactions.transactionDate} DESC`);
}

/**
 * Get a customer's achievements
 */
export async function getCustomerAchievements(tenantDb: TenantDb, customerId: number) {
  return tenantDb
    .select({
      id: achievements.id,
      name: achievements.name,
      description: achievements.description,
      pointValue: achievements.pointValue,
      icon: achievements.icon,
      level: achievements.level,
      dateEarned: customerAchievements.dateEarned
    })
    .from(customerAchievements)
    .innerJoin(achievements, eq(customerAchievements.achievementId, achievements.id))
    .where(eq(customerAchievements.customerId, customerId));
}

/**
 * Check if a customer has earned any new achievements
 */
async function checkForNewAchievements(tenantDb: TenantDb, customerId: number, currentPoints: number) {
  try {
    // Get all achievements
    const allAchievements = await tenantDb.select().from(achievements);
    
    // Get customer's existing achievements
    const existingAchievements = await tenantDb
      .select()
      .from(customerAchievements)
      .where(eq(customerAchievements.customerId, customerId));
    
    const existingAchievementIds = existingAchievements.map(a => a.achievementId);
    
    // Get achievements that operate based on point thresholds
    const pointsBasedAchievements = allAchievements.filter(
      a => a.criteria.startsWith('points:') && !existingAchievementIds.includes(a.id)
    );
    
    // Check for new achievements
    const newAchievements: InsertCustomerAchievement[] = [];
    
    for (const achievement of pointsBasedAchievements) {
      // Parse criteria (example format: "points:100")
      const pointThreshold = parseInt(achievement.criteria.split(':')[1]);
      
      if (currentPoints >= pointThreshold) {
        newAchievements.push({
          customerId,
          achievementId: achievement.id,
          notified: false
        });
      }
    }
    
    // Save new achievements
    if (newAchievements.length > 0) {
      await tenantDb.insert(customerAchievements).values(newAchievements);
    }
    
    return newAchievements.length;
  } catch (error) {
    console.error("Error checking for achievements:", error);
    return 0;
  }
}

/**
 * Create default achievements if not exists
 */
export async function createDefaultAchievements(tenantDb: TenantDb) {
  try {
    const count = await tenantDb.select({ count: sql<number>`count(*)` }).from(achievements);
    
    if (count[0].count === 0) {
      // No achievements exist, let's create defaults
      const defaultAchievements: InsertAchievement[] = [
        {
          name: "First Detail",
          description: "Completed your first detailing service",
          pointValue: 100,
          criteria: "appointments:1",
          icon: "award",
          level: 1
        },
        {
          name: "Detail Enthusiast",
          description: "Completed 5 detailing services",
          pointValue: 250,
          criteria: "appointments:5",
          icon: "car",
          level: 2
        },
        {
          name: "Loyal Customer",
          description: "Completed 10 detailing services",
          pointValue: 500,
          criteria: "appointments:10",
          icon: "heart",
          level: 3
        },
        {
          name: "Detail Aficionado",
          description: "Reached 1,000 loyalty points",
          pointValue: 200,
          criteria: "points:1000",
          icon: "star",
          level: 2
        },
        {
          name: "Premium Member",
          description: "Reached 2,500 loyalty points",
          pointValue: 500,
          criteria: "points:2500",
          icon: "crown",
          level: 3
        },
        {
          name: "Detail Legend",
          description: "Reached 5,000 loyalty points",
          pointValue: 1000,
          criteria: "points:5000",
          icon: "trophy",
          level: 4
        },
        {
          name: "First Referral",
          description: "Referred your first friend",
          pointValue: 200,
          criteria: "referrals:1",
          icon: "users",
          level: 1
        },
        {
          name: "Top Referrer",
          description: "Referred 5 friends",
          pointValue: 500,
          criteria: "referrals:5",
          icon: "network",
          level: 3
        }
      ];
      
      await tenantDb.insert(achievements).values(defaultAchievements);
    }
  } catch (error) {
    console.error("Error creating default achievements:", error);
  }
}

/**
 * Create default loyalty tiers if not exists
 */
export async function createDefaultLoyaltyTiers(tenantDb: TenantDb) {
  try {
    const count = await tenantDb.select({ count: sql<number>`count(*)` }).from(loyaltyTiers);
    
    if (count[0].count === 0) {
      // No tiers exist, let's create defaults
      const defaultTiers: InsertLoyaltyTier[] = [
        {
          name: "Bronze",
          description: "Welcome to our loyalty program",
          pointThreshold: 0,
          benefits: ["5% off add-on services"],
          icon: "medal-bronze"
        },
        {
          name: "Silver",
          description: "Silver tier member",
          pointThreshold: 1000,
          benefits: ["10% off add-on services", "Priority booking"],
          icon: "medal-silver"
        },
        {
          name: "Gold",
          description: "Gold tier member",
          pointThreshold: 2500,
          benefits: ["15% off add-on services", "Priority booking", "Free minor touch-ups"],
          icon: "medal-gold"
        },
        {
          name: "Platinum",
          description: "Our most loyal customers",
          pointThreshold: 3000,
          benefits: [
            "20% off add-on services", 
            "Priority booking", 
            "Free minor touch-ups", 
            "Annual free interior detail"
          ],
          icon: "medal-platinum"
        }
      ];
      
      await tenantDb.insert(loyaltyTiers).values(defaultTiers);
    }
  } catch (error) {
    console.error("Error creating default loyalty tiers:", error);
  }
}

/**
 * Award points for a completed appointment
 */
export async function awardPointsForAppointment(
  tenantDb: TenantDb,
  customerId: number,
  appointmentId: number,
  serviceAmount: number
) {
  // Calculate points (1 point per dollar spent)
  const pointsEarned = Math.floor(serviceAmount);
  
  return awardPoints(
    tenantDb,
    customerId,
    pointsEarned,
    "appointment",
    appointmentId,
    `Earned ${pointsEarned} points for appointment #${appointmentId}`
  );
}

/**
 * Award points for a referral
 */
export async function awardPointsForReferral(
  tenantDb: TenantDb,
  customerId: number,
  referredCustomerId: number
) {
  // Referrals are worth 500 points
  const referralPoints = 500;
  
  return awardPoints(
    tenantDb,
    customerId,
    referralPoints,
    "referral",
    referredCustomerId,
    `Earned ${referralPoints} points for referring a new customer`
  );
}

/**
 * Award points for leaving a review
 */
export async function awardPointsForReview(
  tenantDb: TenantDb,
  customerId: number,
  invoiceId: number
) {
  // Reviews are worth 100 points
  const reviewPoints = 100;
  
  return awardPoints(
    tenantDb,
    customerId,
    reviewPoints,
    "review",
    invoiceId,
    `Earned ${reviewPoints} points for leaving a review`
  );
}

/**
 * Award points for account anniversary 
 */
export async function awardPointsForAnniversary(
  tenantDb: TenantDb,
  customerId: number,
  yearsActive: number
) {
  // 250 points per year as customer
  const anniversaryPoints = 250 * yearsActive;
  
  return awardPoints(
    tenantDb,
    customerId,
    anniversaryPoints,
    "anniversary",
    null,
    `Earned ${anniversaryPoints} points for ${yearsActive} year account anniversary`
  );
}