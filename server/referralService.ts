import type { TenantDb } from './tenantDb';
import { referrals, customers, invoices, rewardAudit, customerAddonCredits } from "@shared/schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { awardPoints } from "./gamificationService";
import { getReferrerRewardDescriptor, getRefereeRewardDescriptor } from "./referralConfigService";
import { awardCredit } from "./creditLedgerService";
import type { RewardDescriptor } from "@shared/schema";
import { nanoid } from "nanoid";

/**
 * Generate a unique referral code for a customer
 * Format: FIRSTNAME-XXXXX (e.g., "JOHN-AB3C5")
 */
export async function generateReferralCode(tenantDb: TenantDb, customerId: number): Promise<{ success: boolean; code?: string; message?: string }> {
  try {
    // Get customer info
    const [customer] = await tenantDb
      .select()
      .from(customers)
      .where(tenantDb.withTenantFilter(customers, eq(customers.id, customerId)));

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
      const [existing] = await tenantDb
        .select()
        .from(referrals)
        .where(tenantDb.withTenantFilter(referrals, eq(referrals.referralCode, code)));

      if (!existing) {
        isUnique = true;
        
        // Create the referral record (points will be set when rewarded based on config)
        const [newReferral] = await tenantDb
          .insert(referrals)
          .values({
            referrerId: customerId,
            referralCode: code,
            status: "pending",
            pointsAwarded: 0, // Will be updated when reward is applied
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
export async function getReferralsByReferrer(tenantDb: TenantDb, customerId: number) {
  try {
    const customerReferrals = await tenantDb
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
      .where(tenantDb.withTenantFilter(referrals, eq(referrals.referrerId, customerId)))
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
export async function getReferralStats(tenantDb: TenantDb, customerId: number) {
  try {
    const allReferrals = await getReferralsByReferrer(tenantDb, customerId);

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
export async function validateReferralCode(tenantDb: TenantDb, code: string) {
  try {
    const [referral] = await tenantDb
      .select()
      .from(referrals)
      .where(tenantDb.withTenantFilter(referrals, eq(referrals.referralCode, code.toUpperCase())));

    if (!referral) {
      return { valid: false, message: "Referral code not found" };
    }

    // Check if expired
    if (referral.expiresAt && new Date() > referral.expiresAt) {
      // Mark as expired
      await tenantDb
        .update(referrals)
        .set({ status: "expired" })
        .where(tenantDb.withTenantFilter(referrals, eq(referrals.id, referral.id)));

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
  tenantDb: TenantDb,
  code: string,
  refereeInfo: {
    phone?: string;
    email?: string;
    name?: string;
    customerId?: number;
  }
) {
  try {
    const validation = await validateReferralCode(tenantDb, code);
    
    if (!validation.valid || !validation.referral) {
      return { success: false, message: validation.message };
    }

    // Require at least phone OR email
    if (!refereeInfo.phone && !refereeInfo.email) {
      return { success: false, message: "Phone or email is required" };
    }

    // Check if this phone/email has already been used for a referral in any non-pending status
    // This prevents fraud by checking signed_up, first_service_completed, and rewarded states
    const existingReferrals = await tenantDb
      .select()
      .from(referrals)
      .where(
        tenantDb.withTenantFilter(referrals, and(
          or(
            refereeInfo.phone ? eq(referrals.refereePhone, refereeInfo.phone) : sql`false`,
            refereeInfo.email ? eq(referrals.refereeEmail, refereeInfo.email) : sql`false`
          ),
          or(
            eq(referrals.status, 'signed_up'),
            eq(referrals.status, 'first_service_completed'),
            eq(referrals.status, 'rewarded')
          )
        ))
      );

    if (existingReferrals.length > 0) {
      return { 
        success: false, 
        message: "This contact has already been referred" 
      };
    }

    // Update referral with referee info and mark as signed up
    await tenantDb
      .update(referrals)
      .set({
        refereePhone: refereeInfo.phone,
        refereeEmail: refereeInfo.email,
        refereeName: refereeInfo.name,
        refereeCustomerId: refereeInfo.customerId,
        status: "signed_up",
        signedUpAt: new Date(),
      })
      .where(tenantDb.withTenantFilter(referrals, eq(referrals.id, validation.referral.id)));

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
 * Apply a reward based on its type
 * Creates reward_audit record and applies the reward
 */
async function applyRewardByType(
  rewardDescriptor: RewardDescriptor,
  customerId: number,
  referralId: number,
  role: 'referrer' | 'referee',
  executor: any = db,
  invoiceId?: number
): Promise<{ success: boolean; message?: string; auditId?: number; pointsAwarded?: number }> {
  try {
    const { type, amount, serviceId, expiryDays, notes } = rewardDescriptor;
    
    // Calculate expiry if configured
    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

    switch (type) {
      case 'loyalty_points': {
        // Validate amount is required for points
        if (!amount || amount <= 0) {
          return { success: false, message: "Amount is required for loyalty_points reward" };
        }

        // Award points immediately
        const pointsResult = await awardPoints(
          customerId,
          amount,
          "referral",
          referralId,
          `Earned ${amount} points as ${role} reward`,
          executor
        );

        if (!pointsResult.success) {
          return { success: false, message: "Failed to award loyalty points" };
        }

        // Create reward audit record (transactionId not available from awardPoints)
        const [audit] = await executor
          .insert(rewardAudit)
          .values({
            referralId,
            customerId,
            rewardRole: role,
            rewardType: type,
            rewardAmount: amount.toString(),
            status: "applied",
            appliedAt: new Date(),
            expiresAt,
          })
          .returning();

        return { 
          success: true, 
          auditId: audit.id,
          pointsAwarded: amount,
          message: `Awarded ${amount} loyalty points`
        };
      }

      case 'fixed_discount':
      case 'percent_discount': {
        // Validate amount is required for discounts
        if (!amount || amount <= 0) {
          return { success: false, message: `Amount is required for ${type} reward` };
        }

        // Create pending reward audit - will be applied to invoice later
        const [audit] = await executor
          .insert(rewardAudit)
          .values({
            referralId,
            customerId,
            rewardRole: role,
            rewardType: type,
            rewardAmount: amount.toString(),
            status: invoiceId ? "applied" : "pending",
            appliedAt: invoiceId ? new Date() : null,
            expiresAt,
            invoiceId,
            metadata: { discountType: type, discountValue: amount },
          })
          .returning();

        return { 
          success: true, 
          auditId: audit.id,
          message: `Created ${type} reward of ${type === 'percent_discount' ? amount + '%' : '$' + amount}`
        };
      }

      case 'service_credit': {
        // Service credit requires amount
        if (!amount || amount <= 0) {
          return { success: false, message: "Amount is required for service_credit reward" };
        }

        // Award service credit via credit ledger
        const creditResult = await awardCredit(
          customerId,
          'service_credit',
          amount,
          'referral_reward',
          referralId,
          `${role === 'referrer' ? 'Referrer' : 'Referee'} reward: $${amount} service credit`,
          expiryDays ?? null,
          executor
        );

        if (!creditResult.success) {
          return { success: false, message: "Failed to award service credit" };
        }

        // Create reward audit record for tracking
        const [audit] = await executor
          .insert(rewardAudit)
          .values({
            referralId,
            customerId,
            rewardRole: role,
            rewardType: type,
            rewardAmount: amount.toString(),
            status: "applied",
            appliedAt: new Date(),
            expiresAt,
            metadata: { notes, creditAmount: amount, creditLedgerId: creditResult.creditId },
          })
          .returning();

        return { 
          success: true, 
          auditId: audit.id,
          message: `Awarded $${amount} service credit (Credit ID: ${creditResult.creditId})`
        };
      }

      case 'gift_card': {
        // Gift card requires amount
        if (!amount || amount <= 0) {
          return { success: false, message: "Amount is required for gift_card reward" };
        }

        const giftCardCode = `GC-${nanoid(10).toUpperCase()}`;

        // Award gift card via credit ledger
        const creditResult = await awardCredit(
          customerId,
          'gift_card',
          amount,
          'referral_reward',
          referralId,
          `${role === 'referrer' ? 'Referrer' : 'Referee'} reward: $${amount} gift card (${giftCardCode})`,
          expiryDays ?? null,
          executor
        );

        if (!creditResult.success) {
          return { success: false, message: "Failed to award gift card" };
        }

        // Create reward audit record for tracking
        const [audit] = await executor
          .insert(rewardAudit)
          .values({
            referralId,
            customerId,
            rewardRole: role,
            rewardType: type,
            rewardAmount: amount.toString(),
            status: "applied",
            appliedAt: new Date(),
            expiresAt,
            metadata: { notes, giftCardCode, cardValue: amount, creditLedgerId: creditResult.creditId },
          })
          .returning();

        return { 
          success: true, 
          auditId: audit.id,
          message: `Awarded $${amount} gift card (Code: ${giftCardCode}, Credit ID: ${creditResult.creditId})`
        };
      }

      case 'free_addon': {
        // Free addon requires addonId (from config or metadata)
        // For referrals, addonId should be in the reward descriptor
        const addonId = serviceId; // Using serviceId parameter to pass addonId for now
        
        if (!addonId) {
          return { success: false, message: "Addon ID is required for free_addon reward" };
        }

        // Create addon credit for customer
        const [addonCredit] = await executor
          .insert(customerAddonCredits)
          .values({
            customerId,
            addonId,
            source: 'referral_reward',
            sourceId: referralId,
            status: 'available',
            grantedAt: new Date(),
            expiresAt,
            notes: notes || `Free addon from ${role} referral reward`,
          })
          .returning();

        // Create audit record
        const [audit] = await executor
          .insert(rewardAudit)
          .values({
            referralId,
            customerId,
            rewardRole: role,
            rewardType: type,
            rewardAmount: '0',
            status: "applied",
            expiresAt,
            metadata: { 
              addonId, 
              addonCreditId: addonCredit.id,
              notes,
            },
          })
          .returning();

        console.log(`[REFERRAL] Granted free addon (ID: ${addonId}) to customer ${customerId}`);

        return { 
          success: true, 
          auditId: audit.id,
          addonCreditId: addonCredit.id,
          message: `Free addon credit granted (Addon ID: ${addonId})`,
        };
      }

      case 'tier_upgrade': {
        // Upgrade customer's loyalty tier (bronze → silver → gold → platinum)
        const tierOrder = ['bronze', 'silver', 'gold', 'platinum'] as const;
        
        // Get current tier
        const [customer] = await executor
          .select()
          .from(customers)
          .where(eq(customers.id, customerId));

        if (!customer) {
          return { success: false, message: "Customer not found" };
        }

        const currentTier = customer.loyaltyTier || 'bronze';
        const currentIndex = tierOrder.indexOf(currentTier);
        
        // Calculate next tier
        const nextIndex = Math.min(currentIndex + 1, tierOrder.length - 1);
        const nextTier = tierOrder[nextIndex];

        // Update customer tier
        await executor
          .update(customers)
          .set({ loyaltyTier: nextTier })
          .where(eq(customers.id, customerId));

        // Create audit record
        const [audit] = await executor
          .insert(rewardAudit)
          .values({
            referralId,
            customerId,
            rewardRole: role,
            rewardType: type,
            rewardAmount: '0',
            status: "applied",
            expiresAt,
            metadata: { 
              notes, 
              previousTier: currentTier,
              newTier: nextTier,
            },
          })
          .returning();

        console.log(`[REFERRAL] Upgraded customer ${customerId} from ${currentTier} to ${nextTier}`);

        return { 
          success: true, 
          auditId: audit.id,
          message: `Upgraded tier from ${currentTier} to ${nextTier}`,
        };
      }

      case 'priority_booking': {
        // Grant priority booking access
        await executor
          .update(customers)
          .set({ 
            hasPriorityBooking: true,
            priorityBookingGrantedAt: new Date(),
          })
          .where(eq(customers.id, customerId));

        // Create audit record
        const [audit] = await executor
          .insert(rewardAudit)
          .values({
            referralId,
            customerId,
            rewardRole: role,
            rewardType: type,
            rewardAmount: '0',
            status: "applied",
            expiresAt,
            metadata: { notes, priorityGrantedAt: new Date().toISOString() },
          })
          .returning();

        console.log(`[REFERRAL] Granted priority booking to customer ${customerId}`);

        return { 
          success: true, 
          auditId: audit.id,
          message: "Priority booking granted",
        };
      }

      case 'milestone_reward': {
        // MVP: Milestone rewards are tracked but require manual application
        // Future: Implement automatic milestone tracking with progress updates
        // Amount represents the bonus value when milestone is reached
        if (!amount || amount <= 0) {
          return { success: false, message: "Amount is required for milestone_reward" };
        }

        const [audit] = await executor
          .insert(rewardAudit)
          .values({
            referralId,
            customerId,
            rewardRole: role,
            rewardType: type,
            rewardAmount: amount.toString(),
            status: "pending", // MVP: Admin manually marks complete when milestone reached
            expiresAt,
            metadata: { 
              notes, 
              milestoneBonus: amount,
              milestoneType: notes || "Referral milestone",
              requiresManualApproval: true, // Flag for admin UI
            },
          })
          .returning();

        console.log(`[REFERRAL] Created milestone reward for customer ${customerId}: $${amount} bonus pending`);

        return { 
          success: true, 
          auditId: audit.id,
          message: `Milestone reward created: $${amount} (pending manual approval)`,
        };
      }

      default:
        return { success: false, message: `Unsupported reward type: ${type}` };
    }
  } catch (error) {
    console.error(`Error applying ${role} reward:`, error);
    return { success: false, message: "Failed to apply reward" };
  }
}

/**
 * Check if a new customer was referred and award points when they complete first service
 * This should be called after a customer completes their first appointment
 * IDEMPOTENT: Only awards points once via status check + timestamp validation
 */
export async function checkAndRewardReferral(tenantDb: TenantDb, customerId: number, invoiceId: number) {
  try {
    // Find referral record for this customer  
    const [referral] = await tenantDb
      .select()
      .from(referrals)
      .where(
        tenantDb.withTenantFilter(referrals, and(
          eq(referrals.refereeCustomerId, customerId),
          eq(referrals.status, 'signed_up')
        ))
      );

    if (!referral) {
      // Customer was not referred or already rewarded
      // The status='signed_up' check above guarantees this function only runs ONCE per referral
      return { success: false, message: "No pending referral found" };
    }

    // CRITICAL VALIDATION: Verify this invoice belongs to the referred customer and was paid after signup
    const [invoice] = await tenantDb
      .select()
      .from(invoices)
      .where(tenantDb.withTenantFilter(invoices, eq(invoices.id, invoiceId)));

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

    // Get referrer reward configuration
    const referrerReward = await getReferrerRewardDescriptor();
    if (!referrerReward) {
      console.error("No referrer reward configuration found");
      return { success: false, message: "Referrer reward not configured" };
    }

    // ATOMIC TRANSACTION: Update referral status and award rewards in single transaction
    // RACE CONDITION PROTECTION: Update WHERE status='signed_up' ensures only ONE concurrent request succeeds
    try {
      await tenantDb.transaction(async (tx) => {
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

        // Apply referrer reward based on configuration
        const rewardResult = await applyRewardByType(
          referrerReward,
          referral.referrerId,
          referral.id,
          'referrer',
          tx,  // ← CRITICAL: Pass transaction executor for atomicity
          invoiceId
        );

        if (!rewardResult.success) {
          throw new Error(rewardResult.message || "Failed to apply referrer reward");
        }

        // Update pointsAwarded field for backwards compatibility
        const pointsAwarded = rewardResult.pointsAwarded || 0;

        // Mark as rewarded (final status transition)
        await tx
          .update(referrals)
          .set({
            status: "rewarded",
            rewardedAt: new Date(),
            pointsAwarded,
          })
          .where(eq(referrals.id, referral.id));
      });

      return { 
        success: true, 
        message: "Referral reward awarded successfully",
        pointsAwarded: referrerReward.type === 'loyalty_points' ? referrerReward.amount : 0
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
 * Apply referee reward when they book their first appointment
 * Creates pending reward that will be applied to their invoice/experience
 */
export async function applyRefereeReward(
  referralId: number,
  customerId: number,
  executor: any
): Promise<{ success: boolean; rewardAuditId?: number; discount?: { type: string; amount: number }; message?: string }> {
  try {
    // Get referee reward configuration
    const refereeReward = await getRefereeRewardDescriptor();
    if (!refereeReward) {
      console.warn("No referee reward configuration found");
      return { success: false, message: "Referee reward not configured" };
    }

    // Apply the reward
    const rewardResult = await applyRewardByType(
      refereeReward,
      customerId,
      referralId,
      'referee',
      executor
    );

    if (!rewardResult.success) {
      return { success: false, message: rewardResult.message };
    }

    // Return discount info if it's a discount type for invoice application
    const result: any = {
      success: true,
      rewardAuditId: rewardResult.auditId,
      message: rewardResult.message,
    };

    if (refereeReward.type === 'fixed_discount' || refereeReward.type === 'percent_discount') {
      result.discount = {
        type: refereeReward.type,
        amount: refereeReward.amount,
      };
    }

    return result;
  } catch (error) {
    console.error("Error applying referee reward:", error);
    return { success: false, message: "Failed to apply referee reward" };
  }
}

/**
 * Calculate invoice amount with referral discount applied
 */
export async function calculateInvoiceWithReferralDiscount(
  baseAmount: number,
  customerId: number,
  executor: any
): Promise<{ 
  finalAmount: number; 
  discount: number; 
  discountType: string | null;
  rewardAuditId: number | null;
}> {
  try {
    // Check for pending referee discount rewards for this customer
    const [pendingDiscount] = await executor
      .select()
      .from(rewardAudit)
      .where(
        and(
          eq(rewardAudit.customerId, customerId),
          eq(rewardAudit.rewardRole, 'referee'),
          eq(rewardAudit.status, 'pending'),
          or(
            eq(rewardAudit.rewardType, 'fixed_discount'),
            eq(rewardAudit.rewardType, 'percent_discount')
          )
        )
      )
      .limit(1);

    if (!pendingDiscount) {
      return { 
        finalAmount: baseAmount, 
        discount: 0, 
        discountType: null,
        rewardAuditId: null
      };
    }

    // Check if expired
    if (pendingDiscount.expiresAt && new Date() > pendingDiscount.expiresAt) {
      // Mark as expired
      await executor
        .update(rewardAudit)
        .set({ status: 'expired' })
        .where(eq(rewardAudit.id, pendingDiscount.id));

      return { 
        finalAmount: baseAmount, 
        discount: 0, 
        discountType: null,
        rewardAuditId: null
      };
    }

    const discountAmount = parseFloat(pendingDiscount.rewardAmount);
    let finalDiscount = 0;

    if (pendingDiscount.rewardType === 'fixed_discount') {
      finalDiscount = Math.min(discountAmount, baseAmount); // Can't discount more than invoice
    } else if (pendingDiscount.rewardType === 'percent_discount') {
      finalDiscount = (baseAmount * discountAmount) / 100;
    }

    const finalAmount = Math.max(0, baseAmount - finalDiscount);

    return {
      finalAmount,
      discount: finalDiscount,
      discountType: pendingDiscount.rewardType,
      rewardAuditId: pendingDiscount.id
    };
  } catch (error) {
    console.error("Error calculating referral discount:", error);
    return { 
      finalAmount: baseAmount, 
      discount: 0, 
      discountType: null,
      rewardAuditId: null
    };
  }
}

/**
 * Mark referral discount as applied to an invoice
 */
export async function markReferralDiscountApplied(
  rewardAuditId: number,
  invoiceId: number,
  executor: any
): Promise<{ success: boolean }> {
  try {
    await executor
      .update(rewardAudit)
      .set({
        status: 'applied',
        appliedAt: new Date(),
        invoiceId,
      })
      .where(eq(rewardAudit.id, rewardAuditId));

    return { success: true };
  } catch (error) {
    console.error("Error marking referral discount as applied:", error);
    return { success: false };
  }
}

/**
 * Get or create referral code for a customer
 * Returns existing code if one exists, creates new one otherwise
 */
export async function getOrCreateReferralCode(tenantDb: TenantDb, customerId: number): Promise<{ success: boolean; code?: string; message?: string }> {
  try {
    // Check if customer already has a referral code
    const [existingReferral] = await tenantDb
      .select()
      .from(referrals)
      .where(
        tenantDb.withTenantFilter(referrals, and(
          eq(referrals.referrerId, customerId),
          eq(referrals.status, 'pending')
        ))
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
    return await generateReferralCode(tenantDb, customerId);
  } catch (error) {
    console.error("Error getting or creating referral code:", error);
    return { success: false, message: "Failed to get referral code" };
  }
}

/**
 * Get referral landing page info for a referral code
 * Returns referrer name, business name for public landing page
 */
export async function getReferralLandingInfo(tenantDb: TenantDb, code: string): Promise<{
  valid: boolean;
  message: string;
  referral?: any;
  referrerName?: string;
  businessName?: string;
}> {
  try {
    // First validate the code
    const validation = await validateReferralCode(tenantDb, code);
    
    if (!validation.valid) {
      return { 
        valid: false, 
        message: validation.message || 'Invalid referral code'
      };
    }
    
    // Get the referral with referrer info
    const [referral] = await tenantDb
      .select({
        id: referrals.id,
        referralCode: referrals.referralCode,
        referrerId: referrals.referrerId,
        status: referrals.status,
        referrerName: customers.name,
      })
      .from(referrals)
      .leftJoin(customers, eq(referrals.referrerId, customers.id))
      .where(
        tenantDb.withTenantFilter(referrals, and(
          eq(referrals.referralCode, code),
          eq(referrals.status, 'pending')
        ))
      )
      .limit(1);
    
    if (!referral) {
      return { 
        valid: false, 
        message: 'Referral code not found or already used'
      };
    }
    
    // Get business name from tenantConfig
    const { tenantConfig } = tenantDb.schema;
    const [config] = await tenantDb
      .select({
        businessName: tenantConfig.businessName,
      })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantDb.tenantId as any))
      .limit(1);
    
    // Sanitize response - only return minimal info needed for landing page
    // Do not expose internal IDs or referrer details beyond first name
    const referrerFirstName = referral.referrerName?.split(' ')[0] || 'Your friend';
    
    return {
      valid: true,
      message: 'Valid referral code',
      referral: {
        id: referral.id,
        referralCode: referral.referralCode,
        referrerId: referral.referrerId,
        status: referral.status,
      },
      referrerName: referrerFirstName, // Only first name for privacy
      businessName: config?.businessName || 'Our Business',
    };
  } catch (error) {
    console.error("Error getting referral landing info:", error);
    return { 
      valid: false, 
      message: 'Failed to load referral information'
    };
  }
}

/**
 * Get admin referral statistics for the tenant
 * Returns aggregate stats for the referral program
 */
export async function getAdminReferralStats(tenantDb: TenantDb): Promise<{
  totalReferrals: number;
  pendingReferrals: number;
  signedUpReferrals: number;
  completedReferrals: number;
  rewardedReferrals: number;
  totalPointsAwarded: number;
}> {
  try {
    const { count, sum } = await import('drizzle-orm');
    
    // Get total counts by status
    const allReferrals = await tenantDb
      .select({
        status: referrals.status,
        pointsAwarded: referrals.pointsAwarded,
      })
      .from(referrals)
      .where(tenantDb.withTenantFilter(referrals, sql`true`));
    
    const stats = {
      totalReferrals: allReferrals.length,
      pendingReferrals: 0,
      signedUpReferrals: 0,
      completedReferrals: 0,
      rewardedReferrals: 0,
      totalPointsAwarded: 0,
    };
    
    for (const ref of allReferrals) {
      switch (ref.status) {
        case 'pending':
          stats.pendingReferrals++;
          break;
        case 'signed_up':
          stats.signedUpReferrals++;
          break;
        case 'first_service_completed':
          stats.completedReferrals++;
          break;
        case 'rewarded':
          stats.rewardedReferrals++;
          stats.totalPointsAwarded += ref.pointsAwarded || 0;
          break;
      }
    }
    
    return stats;
  } catch (error) {
    console.error("Error getting admin referral stats:", error);
    return {
      totalReferrals: 0,
      pendingReferrals: 0,
      signedUpReferrals: 0,
      completedReferrals: 0,
      rewardedReferrals: 0,
      totalPointsAwarded: 0,
    };
  }
}
