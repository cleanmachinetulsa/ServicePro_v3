import { db } from "./db";
import { 
  loyaltyPoints, 
  pointsTransactions, 
  achievements, 
  customerAchievements,
  loyaltyTiers,
  type InsertLoyaltyPoints,
  type InsertPointsTransaction,
  type InsertAchievement,
  type InsertCustomerAchievement,
  type InsertLoyaltyTier
} from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";

/**
 * Award points to a customer
 */
export async function awardPoints(
  customerId: number,
  amount: number,
  source: string,
  sourceId: number | null,
  description: string
): Promise<{ success: boolean; currentPoints: number }> {
  try {
    // Get or create loyalty points record for customer
    let customerPoints = await getCustomerLoyaltyPoints(customerId);
    
    if (!customerPoints) {
      // Create new loyalty points record for customer
      const [newPoints] = await db
        .insert(loyaltyPoints)
        .values({ customerId, points: 0 })
        .returning();
      
      customerPoints = newPoints;
    }
    
    // Update points
    const newPointsTotal = customerPoints.points + amount;
    
    // Update the loyalty points record
    const [updatedPoints] = await db
      .update(loyaltyPoints)
      .set({ 
        points: newPointsTotal,
        lastUpdated: new Date()
      })
      .where(eq(loyaltyPoints.id, customerPoints.id))
      .returning();
    
    // Record the transaction
    await db.insert(pointsTransactions).values({
      loyaltyPointsId: customerPoints.id,
      amount,
      description,
      transactionType: "earn",
      source,
      sourceId: sourceId || undefined
    });
    
    // Check if customer has earned any new achievements
    await checkForNewAchievements(customerId, newPointsTotal);
    
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
 * Redeem points from a customer's balance
 */
export async function redeemPoints(
  customerId: number,
  amount: number,
  source: string,
  sourceId: number | null,
  description: string
): Promise<{ success: boolean; currentPoints: number }> {
  try {
    // Get loyalty points record for customer
    const customerPoints = await getCustomerLoyaltyPoints(customerId);
    
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
    const [updatedPoints] = await db
      .update(loyaltyPoints)
      .set({ 
        points: newPointsTotal,
        lastUpdated: new Date()
      })
      .where(eq(loyaltyPoints.id, customerPoints.id))
      .returning();
    
    // Record the transaction
    await db.insert(pointsTransactions).values({
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
export async function getCustomerLoyaltyPoints(customerId: number) {
  const [customerPoints] = await db
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));
  
  return customerPoints;
}

/**
 * Get a customer's current loyalty tier
 */
export async function getCustomerLoyaltyTier(customerId: number) {
  const customerPoints = await getCustomerLoyaltyPoints(customerId);
  
  if (!customerPoints) {
    return null;
  }
  
  // Get highest tier customer qualifies for
  const [tier] = await db
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
export async function getCustomerTransactionHistory(customerId: number) {
  const customerPoints = await getCustomerLoyaltyPoints(customerId);
  
  if (!customerPoints) {
    return [];
  }
  
  return db
    .select()
    .from(pointsTransactions)
    .where(eq(pointsTransactions.loyaltyPointsId, customerPoints.id))
    .orderBy(sql`${pointsTransactions.transactionDate} DESC`);
}

/**
 * Get a customer's achievements
 */
export async function getCustomerAchievements(customerId: number) {
  return db
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
async function checkForNewAchievements(customerId: number, currentPoints: number) {
  try {
    // Get all achievements
    const allAchievements = await db.select().from(achievements);
    
    // Get customer's existing achievements
    const existingAchievements = await db
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
      await db.insert(customerAchievements).values(newAchievements);
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
export async function createDefaultAchievements() {
  try {
    const count = await db.select({ count: sql<number>`count(*)` }).from(achievements);
    
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
      
      await db.insert(achievements).values(defaultAchievements);
    }
  } catch (error) {
    console.error("Error creating default achievements:", error);
  }
}

/**
 * Create default loyalty tiers if not exists
 */
export async function createDefaultLoyaltyTiers() {
  try {
    const count = await db.select({ count: sql<number>`count(*)` }).from(loyaltyTiers);
    
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
      
      await db.insert(loyaltyTiers).values(defaultTiers);
    }
  } catch (error) {
    console.error("Error creating default loyalty tiers:", error);
  }
}

/**
 * Award points for a completed appointment
 */
export async function awardPointsForAppointment(
  customerId: number,
  appointmentId: number,
  serviceAmount: number
) {
  // Calculate points (1 point per dollar spent)
  const pointsEarned = Math.floor(serviceAmount);
  
  return awardPoints(
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
  customerId: number,
  referredCustomerId: number
) {
  // Referrals are worth 500 points
  const referralPoints = 500;
  
  return awardPoints(
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
  customerId: number,
  invoiceId: number
) {
  // Reviews are worth 100 points
  const reviewPoints = 100;
  
  return awardPoints(
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
  customerId: number,
  yearsActive: number
) {
  // 250 points per year as customer
  const anniversaryPoints = 250 * yearsActive;
  
  return awardPoints(
    customerId,
    anniversaryPoints,
    "anniversary",
    null,
    `Earned ${anniversaryPoints} points for ${yearsActive} year account anniversary`
  );
}