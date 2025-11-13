import { db } from "./db";
import { referrals, customers, invoices } from "@shared/schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { awardPointsForReferral } from "./gamificationService";
import { nanoid } from "nanoid";

/**
 * Generate a unique referral code for a customer
 * Format: FIRSTNAME-XXXXX (e.g., "JOHN-AB3C5")
 */
export async function generateReferralCode(customerId: number): Promise<{ success: boolean; code?: string; message?: string }> {
  try {
    // Get customer info
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId));

    if (!customer) {
      return { success: false, message: "Customer not found" };
    }

    // Create unique code: FIRSTNAME-XXXXX
    const firstName = customer.name.split(' ')[0].toUpperCase().substring(0, 10);
    let code: string;
    let attempts = 0;
    let isUnique = false;

    // Try up to 5 times to generate a unique code
    while (!isUnique && attempts < 5) {
      const randomSuffix = nanoid(5).toUpperCase();
      code = `${firstName}-${randomSuffix}`;

      // Check if code already exists
      const [existing] = await db
        .select()
        .from(referrals)
        .where(eq(referrals.referralCode, code));

      if (!existing) {
        isUnique = true;
        
        // Create the referral record
        const [newReferral] = await db
          .insert(referrals)
          .values({
            referrerId: customerId,
            referralCode: code,
            status: "pending",
            pointsAwarded: 500,
          })
          .returning();

        return { 
          success: true, 
          code: newReferral.referralCode,
          message: "Referral code generated successfully"
        };
      }

      attempts++;
    }

    return { success: false, message: "Unable to generate unique referral code" };
  } catch (error) {
    console.error("Error generating referral code:", error);
    return { success: false, message: "Failed to generate referral code" };
  }
}

/**
 * Get all referrals made by a customer
 */
export async function getReferralsByReferrer(customerId: number) {
  try {
    const customerReferrals = await db
      .select({
        id: referrals.id,
        referralCode: referrals.referralCode,
        refereeName: referrals.refereeName,
        refereePhone: referrals.refereePhone,
        refereeEmail: referrals.refereeEmail,
        status: referrals.status,
        pointsAwarded: referrals.pointsAwarded,
        createdAt: referrals.createdAt,
        signedUpAt: referrals.signedUpAt,
        completedAt: referrals.completedAt,
        rewardedAt: referrals.rewardedAt,
        expiresAt: referrals.expiresAt,
      })
      .from(referrals)
      .where(eq(referrals.referrerId, customerId))
      .orderBy(sql`${referrals.createdAt} DESC`);

    return customerReferrals;
  } catch (error) {
    console.error("Error getting referrals:", error);
    return [];
  }
}

/**
 * Get stats for a customer's referrals
 */
export async function getReferralStats(customerId: number) {
  try {
    const allReferrals = await getReferralsByReferrer(customerId);

    const stats = {
      totalReferrals: allReferrals.length,
      pending: allReferrals.filter(r => r.status === 'pending').length,
      signedUp: allReferrals.filter(r => r.status === 'signed_up').length,
      completed: allReferrals.filter(r => r.status === 'first_service_completed' || r.status === 'rewarded').length,
      totalPointsEarned: allReferrals
        .filter(r => r.status === 'rewarded')
        .reduce((sum, r) => sum + (r.pointsAwarded || 0), 0),
    };

    return stats;
  } catch (error) {
    console.error("Error getting referral stats:", error);
    return null;
  }
}

/**
 * Validate a referral code
 * Returns the referral if valid, null otherwise
 */
export async function validateReferralCode(code: string) {
  try {
    const [referral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referralCode, code.toUpperCase()));

    if (!referral) {
      return { valid: false, message: "Referral code not found" };
    }

    // Check if expired
    if (referral.expiresAt && new Date() > referral.expiresAt) {
      // Mark as expired
      await db
        .update(referrals)
        .set({ status: "expired" })
        .where(eq(referrals.id, referral.id));

      return { valid: false, message: "Referral code has expired" };
    }

    // Check if already used
    if (referral.status !== 'pending') {
      return { valid: false, message: "Referral code has already been used" };
    }

    return { 
      valid: true, 
      referral,
      message: "Referral code is valid"
    };
  } catch (error) {
    console.error("Error validating referral code:", error);
    return { valid: false, message: "Error validating referral code" };
  }
}

/**
 * Track when a referee uses a referral code (signs up)
 */
export async function trackReferralSignup(
  code: string,
  refereeInfo: {
    phone?: string;
    email?: string;
    name?: string;
    customerId?: number;
  }
) {
  try {
    const validation = await validateReferralCode(code);
    
    if (!validation.valid || !validation.referral) {
      return { success: false, message: validation.message };
    }

    // Require at least phone OR email
    if (!refereeInfo.phone && !refereeInfo.email) {
      return { success: false, message: "Phone or email is required" };
    }

    // Check if this phone/email has already been used for a referral in any non-pending status
    // This prevents fraud by checking signed_up, first_service_completed, and rewarded states
    const existingReferrals = await db
      .select()
      .from(referrals)
      .where(
        and(
          or(
            refereeInfo.phone ? eq(referrals.refereePhone, refereeInfo.phone) : sql`false`,
            refereeInfo.email ? eq(referrals.refereeEmail, refereeInfo.email) : sql`false`
          ),
          or(
            eq(referrals.status, 'signed_up'),
            eq(referrals.status, 'first_service_completed'),
            eq(referrals.status, 'rewarded')
          )
        )
      );

    if (existingReferrals.length > 0) {
      return { 
        success: false, 
        message: "This contact has already been referred" 
      };
    }

    // Update referral with referee info and mark as signed up
    await db
      .update(referrals)
      .set({
        refereePhone: refereeInfo.phone,
        refereeEmail: refereeInfo.email,
        refereeName: refereeInfo.name,
        refereeCustomerId: refereeInfo.customerId,
        status: "signed_up",
        signedUpAt: new Date(),
      })
      .where(eq(referrals.id, validation.referral.id));

    return { 
      success: true, 
      message: "Referral tracked successfully",
      referralId: validation.referral.id
    };
  } catch (error) {
    console.error("Error tracking referral signup:", error);
    return { success: false, message: "Failed to track referral" };
  }
}

/**
 * Check if a new customer was referred and award points when they complete first service
 * This should be called after a customer completes their first appointment
 * IDEMPOTENT: Only awards points once via status check + timestamp validation
 */
export async function checkAndRewardReferral(customerId: number, invoiceId: number) {
  try {
    // Find referral record for this customer  
    const [referral] = await db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.refereeCustomerId, customerId),
          eq(referrals.status, 'signed_up')
        )
      );

    if (!referral) {
      // Customer was not referred or already rewarded
      // The status='signed_up' check above guarantees this function only runs ONCE per referral
      return { success: false, message: "No pending referral found" };
    }

    // CRITICAL VALIDATION: Verify this invoice belongs to the referred customer and was paid after signup
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId));

    if (!invoice) {
      console.error(`Invoice ${invoiceId} not found for referral reward`);
      return { success: false, message: "Invoice not found" };
    }

    // Verify invoice belongs to the referred customer (fraud prevention)
    if (invoice.customerId !== customerId) {
      console.error(`Invoice ${invoiceId} belongs to customer ${invoice.customerId}, expected ${customerId}`);
      return { success: false, message: "Invoice customer mismatch" };
    }

    // Verify payment happened AFTER referral signup (prevents backdated rewards)
    if (!invoice.paidAt || !referral.signedUpAt) {
      console.error(`Missing timestamps - invoice.paidAt: ${invoice.paidAt}, referral.signedUpAt: ${referral.signedUpAt}`);
      return { success: false, message: "Missing payment or signup timestamp" };
    }

    if (new Date(invoice.paidAt) < new Date(referral.signedUpAt)) {
      console.error(`Invoice paid ${invoice.paidAt} before referral signup ${referral.signedUpAt}`);
      return { success: false, message: "Payment predates referral signup" };
    }

    // TRIPLE IDEMPOTENCY LAYERS:
    // 1. Status check (primary) - only finds status='signed_up'
    // 2. Timestamp validation (secondary) - ensures payment after signup
    // 3. Invoice ID persistence (tertiary) - stores which invoice triggered reward
    // Together these guarantee points are awarded exactly once for legitimate first service

    // Log for debugging
    console.log(`Processing referral reward - customer ${customerId}, invoice ${invoiceId}, referral ID ${referral.id}`);

    // ATOMIC TRANSACTION: Update referral status and award points in single transaction
    // RACE CONDITION PROTECTION: Update WHERE status='signed_up' ensures only ONE concurrent request succeeds
    try {
      await db.transaction(async (tx) => {
        // CRITICAL: Mark as completed ONLY IF still in 'signed_up' status (prevents race condition)
        // If another concurrent request already updated this, this WHERE clause returns 0 rows
        const [updatedReferral] = await tx
          .update(referrals)
          .set({
            status: "first_service_completed",
            completedAt: new Date(),
            rewardedInvoiceId: invoiceId,  // Persist invoice ID for audit trail
          })
          .where(
            and(
              eq(referrals.id, referral.id),
              eq(referrals.status, 'signed_up')  // ← RACE CONDITION GUARD
            )
          )
          .returning();

        // If no rows updated, another concurrent request already processed this referral
        if (!updatedReferral) {
          console.log(`Referral ${referral.id} already processed by concurrent request, skipping`);
          throw new Error("Referral already processed");  // Abort transaction
        }

        // Award points to the referrer WITHIN TRANSACTION (throws on error)
        // Passing tx ensures points are only awarded if entire transaction succeeds
        const result = await awardPointsForReferral(
          referral.referrerId,
          customerId,
          tx  // ← CRITICAL: Pass transaction executor for atomicity
        );

        if (!result.success) {
          throw new Error("Failed to award referral points");
        }

        // Mark as rewarded (final status transition)
        await tx
          .update(referrals)
          .set({
            status: "rewarded",
            rewardedAt: new Date(),
          })
          .where(eq(referrals.id, referral.id));
      });

      return { 
        success: true, 
        message: "Referral reward awarded successfully",
        pointsAwarded: referral.pointsAwarded
      };
    } catch (transactionError) {
      console.error("Transaction failed during referral reward:", transactionError);
      return { success: false, message: "Failed to process referral reward atomically" };
    }
  } catch (error) {
    console.error("Error checking and rewarding referral:", error);
    return { success: false, message: "Failed to process referral reward" };
  }
}

/**
 * Get or create referral code for a customer
 * Returns existing code if one exists, creates new one otherwise
 */
export async function getOrCreateReferralCode(customerId: number): Promise<{ success: boolean; code?: string; message?: string }> {
  try {
    // Check if customer already has a referral code
    const [existingReferral] = await db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerId, customerId),
          eq(referrals.status, 'pending')
        )
      )
      .limit(1);

    if (existingReferral) {
      return { 
        success: true, 
        code: existingReferral.referralCode,
        message: "Existing referral code retrieved"
      };
    }

    // Generate new code
    return await generateReferralCode(customerId);
  } catch (error) {
    console.error("Error getting or creating referral code:", error);
    return { success: false, message: "Failed to get referral code" };
  }
}
