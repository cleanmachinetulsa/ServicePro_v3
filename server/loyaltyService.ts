import { db } from "./db";
import { 
  customers, loyaltyPoints, pointsTransactions, rewardServices, redeemedRewards,
  loyaltyTiers, achievements, customerAchievements
} from "@shared/schema";
import { eq, gt, and, sql } from "drizzle-orm";
import { sendRewardNotificationEmail } from "./emailService.rewards";
import { addDays, addMonths } from "date-fns";

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

export async function getLoyaltyPointsByPhone(phone: string) {
  try {
    console.log(`Getting loyalty points for phone: ${phone}`);
    
    // Normalize the phone number to handle different formats
    const phoneFormats = normalizePhoneNumber(phone);
    
    // First try to get customer from PostgreSQL database using all possible formats
    let customer = null;
    for (const phoneFormat of phoneFormats) {
      const [found] = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, phoneFormat));
      
      if (found) {
        customer = found;
        break;
      }
    }
    
    // If found in PostgreSQL database, use the standard approach
    if (customer) {
      console.log(`Customer found in PostgreSQL: ${customer.name}`);
      // Get or create loyalty points record
      const [points] = await db
        .select()
        .from(loyaltyPoints)
        .where(eq(loyaltyPoints.customerId, customer.id));

      if (!points) {
        // If no loyalty points record, check if customer has opted in
        if (!customer.loyaltyProgramOptIn) {
          return { 
            customer,
            loyaltyPoints: null,
            message: "Not enrolled in loyalty program" 
          };
        }

        // Create new loyalty points record with a points
        const [newPoints] = await db
          .insert(loyaltyPoints)
          .values({
            customerId: customer.id,
            points: 0,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          })
          .returning();

        return { 
          customer,
          loyaltyPoints: newPoints,
          transactions: [],
          message: "New loyalty account created"
        };
      }

      // Get transactions for this customer
      const transactions = await db
        .select()
        .from(pointsTransactions)
        .where(eq(pointsTransactions.loyaltyPointsId, points.id))
        .orderBy(sql`${pointsTransactions.transactionDate} DESC`)
        .limit(10);

      return { 
        customer,
        loyaltyPoints: points,
        transactions,
        message: "Loyalty points retrieved"
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
        source: 'sheets'
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
export async function getLoyaltyPointsByEmail(email: string) {
  try {
    console.log(`Getting loyalty points for email: ${email}`);
    
    // First try to get customer from PostgreSQL database
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, email));

    if (customer) {
      console.log(`Customer found in PostgreSQL by email: ${customer.name}`);
      return getLoyaltyPointsByPhone(customer.phone);
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
      
      return getLoyaltyPointsByPhone(primaryRecord.phone);
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
export async function getAvailableRewardServices() {
  return db
    .select()
    .from(rewardServices)
    .where(eq(rewardServices.active, true))
    .orderBy(sql`${rewardServices.pointCost} ASC`);
}

/**
 * Get all loyalty points records for dashboard display
 */
export async function getAllLoyaltyPoints() {
  try {
    const points = await db
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
export async function getAllCustomers() {
  try {
    const customerList = await db
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
export async function getAllTransactions() {
  try {
    const transactions = await db
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
export async function getAllLoyaltyTiers() {
  try {
    const tiers = await db
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
export async function getAllAchievements() {
  try {
    const achievementList = await db
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
export async function getAllCustomerAchievements() {
  try {
    const customerAchievementList = await db
      .select()
      .from(customerAchievements);
      
    // Join with achievements to get full details
    const results = [];
    
    for (const ca of customerAchievementList) {
      const [achievement] = await db
        .select()
        .from(achievements)
        .where(eq(achievements.id, ca.achievementId));
        
      const [customer] = await db
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
export async function getAllRedeemedRewards() {
  try {
    const rewards = await db
      .select()
      .from(redeemedRewards);
      
    // Join with customers and reward services
    const results = [];
    
    for (const reward of rewards) {
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, reward.customerId));
        
      const [service] = await db
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
export async function getRewardServicesForDashboard() {
  try {
    const services = await db
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
export async function addLoyaltyPointsFromInvoice(customerId: number, invoiceId: number, amount: number) {
  // Get or create loyalty points record
  let [pointsRecord] = await db
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));

  if (!pointsRecord) {
    // Check if customer has opted into the loyalty program
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId));

    if (!customer?.loyaltyProgramOptIn) {
      return null; // Customer hasn't opted in
    }

    // Create new loyalty points record
    [pointsRecord] = await db
      .insert(loyaltyPoints)
      .values({
        customerId,
        points: 0,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      })
      .returning();
  }

  // Calculate points to add (1 point per $1)
  const pointsToAdd = Math.floor(Number(amount));
  if (pointsToAdd <= 0) {
    return pointsRecord;
  }

  // Set expiry date for these points (12 months from now)
  const expiryDate = addMonths(new Date(), 12);

  // Add transaction record
  await db.insert(pointsTransactions).values({
    loyaltyPointsId: pointsRecord.id,
    amount: pointsToAdd,
    description: `Points earned from invoice #${invoiceId}`,
    transactionType: 'earn',
    source: 'invoice',
    sourceId: invoiceId,
    expiryDate,
  });

  // Update points balance
  const [updatedPoints] = await db
    .update(loyaltyPoints)
    .set({ 
      points: pointsRecord.points + pointsToAdd,
      lastUpdated: new Date(),
    })
    .where(eq(loyaltyPoints.id, pointsRecord.id))
    .returning();

  // Check if customer has reached loyalty offer thresholds and send notification
  checkAndNotifyRewardEligibility(customerId, updatedPoints.points);

  return updatedPoints;
}

/**
 * Check if customer is eligible for loyalty offers and send notification
 */
async function checkAndNotifyRewardEligibility(customerId: number, points: number) {
  // Check if customer has enough points for any loyalty offer
  const rewardsAvailable = await db
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
    const [customer] = await db
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
 */
export async function redeemPointsForReward(
  customerId: number, 
  rewardServiceId: number,
  quantity: number = 1
) {
  if (quantity < 1 || quantity > 3) {
    throw new Error("You can redeem between 1 and 3 rewards at once");
  }

  // Get the reward service
  const [rewardService] = await db
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

  // Get customer's points
  const [pointsRecord] = await db
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));

  if (!pointsRecord) {
    throw new Error("No loyalty points record found for this customer");
  }

  // Calculate total points needed
  const totalPointsNeeded = rewardService.pointCost * quantity;

  // Check if customer has enough points
  if (pointsRecord.points < totalPointsNeeded) {
    throw new Error(`Not enough points. You need ${totalPointsNeeded} points but have ${pointsRecord.points}`);
  }

  // Create redeemed rewards records
  const redeemedRewardsRecords = [];
  const expiryDate = addDays(new Date(), 90); // Rewards expire in 90 days if not used

  for (let i = 0; i < quantity; i++) {
    const [redeemedReward] = await db
      .insert(redeemedRewards)
      .values({
        customerId,
        rewardServiceId,
        pointsSpent: rewardService.pointCost,
        status: 'pending',
        expiryDate,
      })
      .returning();

    redeemedRewardsRecords.push(redeemedReward);
  }

  // Add transaction record for the redemption
  await db.insert(pointsTransactions).values({
    loyaltyPointsId: pointsRecord.id,
    amount: -totalPointsNeeded,
    description: `Redeemed ${quantity} ${rewardService.name} loyalty offer(s)`,
    transactionType: 'redeem',
    source: 'reward',
    sourceId: rewardServiceId,
  });

  // Update points balance
  const [updatedPoints] = await db
    .update(loyaltyPoints)
    .set({ 
      points: pointsRecord.points - totalPointsNeeded,
      lastUpdated: new Date(),
    })
    .where(eq(loyaltyPoints.id, pointsRecord.id))
    .returning();

  return {
    updatedPoints,
    redeemedRewards: redeemedRewardsRecords,
    message: `Successfully redeemed ${quantity} ${rewardService.name} loyalty offer(s)`,
  };
}

/**
 * Opt a customer into the loyalty program
 */
export async function optInToLoyaltyProgram(customerId: number) {
  // Update customer record
  const [updatedCustomer] = await db
    .update(customers)
    .set({ 
      loyaltyProgramOptIn: true,
      loyaltyProgramJoinDate: new Date(),
    })
    .where(eq(customers.id, customerId))
    .returning();

  // Create loyalty points record if it doesn't exist
  let [pointsRecord] = await db
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));

  if (!pointsRecord) {
    [pointsRecord] = await db
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
export async function getRedeemedRewards(customerId: number) {
  try {
    const rewards = await db
      .select()
      .from(redeemedRewards)
      .where(eq(redeemedRewards.customerId, customerId))
      .orderBy(sql`${redeemedRewards.redeemedDate} DESC`);
      
    // Join with reward services
    const result = [];
    for (const reward of rewards) {
      const [service] = await db
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

/**
 * Process expired loyalty points
 * This should be run on a schedule (e.g., daily)
 */
export async function processExpiredPoints() {
  const now = new Date();
  
  // Find all loyalty points records with expired points
  const pointsRecords = await db
    .select()
    .from(loyaltyPoints)
    .where(and(
      sql`${loyaltyPoints.expiryDate} IS NOT NULL`,
      sql`${loyaltyPoints.expiryDate} < ${now}`
    ));

  // For each record, find transactions that have expired
  for (const record of pointsRecords) {
    const expiredTransactions = await db
      .select()
      .from(pointsTransactions)
      .where(and(
        eq(pointsTransactions.loyaltyPointsId, record.id),
        eq(pointsTransactions.transactionType, 'earn'),
        sql`${pointsTransactions.expiryDate} IS NOT NULL`,
        sql`${pointsTransactions.expiryDate} < ${now}`
      ));
    
    // Calculate total expired points
    let expiredPoints = 0;
    for (const tx of expiredTransactions) {
      expiredPoints += tx.amount;
    }
    
    if (expiredPoints > 0) {
      // Add a transaction record for the expired points
      await db.insert(pointsTransactions).values({
        loyaltyPointsId: record.id,
        amount: -expiredPoints,
        description: 'Points expired',
        transactionType: 'expire',
        source: 'system',
      });
      
      // Update points balance
      await db
        .update(loyaltyPoints)
        .set({ 
          points: Math.max(0, record.points - expiredPoints),
          lastUpdated: now,
        })
        .where(eq(loyaltyPoints.id, record.id));
    }
  }
}

/**
 * Clean up expired points 
 * Alias for processExpiredPoints for backward compatibility
 */
export async function cleanupExpiredPoints() {
  return processExpiredPoints();
}