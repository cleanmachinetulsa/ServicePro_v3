import type { TenantDb } from './tenantDb';
import { 
  referralProgramConfig, 
  type SelectReferralProgramConfig, 
  type InsertReferralProgramConfig,
  type RewardType, 
  type RewardDescriptor 
} from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Referral Config Service
 * Manages referral program configuration with in-memory caching
 * 
 * Architecture:
 * - referral_program_config is a singleton table (only 1 row)
 * - In-memory cache for performance (avoids DB hit on every booking)
 * - Cache invalidation on updates
 */

// In-memory cache
let configCache: SelectReferralProgramConfig | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get referral program configuration
 * Uses in-memory cache with TTL, falls back to database
 */
export async function getReferralConfig(tenantDb: TenantDb): Promise<SelectReferralProgramConfig | null> {
  try {
    // Check cache validity
    const now = Date.now();
    if (configCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
      return configCache;
    }

    // Fetch from database
    const configs = await tenantDb
      .select()
      .from(referralProgramConfig)
      .where(tenantDb.withTenantFilter(referralProgramConfig))
      .limit(1);

    if (configs.length === 0) {
      console.warn("[REFERRAL CONFIG] No configuration found - using defaults");
      return null;
    }

    // Update cache
    configCache = configs[0];
    cacheTimestamp = now;

    return configCache;
  } catch (error) {
    console.error("[REFERRAL CONFIG] Error fetching config:", error);
    return null;
  }
}

/**
 * Update referral program configuration
 * Invalidates cache and ensures singleton behavior
 */
export async function updateReferralConfig(
  tenantDb: TenantDb,
  updates: Partial<InsertReferralProgramConfig>,
  userId?: number
): Promise<{ success: boolean; config?: SelectReferralProgramConfig; message?: string }> {
  try {
    // Get existing config
    const existing = await tenantDb
      .select()
      .from(referralProgramConfig)
      .where(tenantDb.withTenantFilter(referralProgramConfig))
      .limit(1);

    let updatedConfig: SelectReferralProgramConfig;

    if (existing.length === 0) {
      // Create initial config (should only happen once)
      const [newConfig] = await tenantDb
        .insert(referralProgramConfig)
        .values({
          ...updates,
          updatedBy: userId,
        })
        .returning();

      updatedConfig = newConfig;
      console.log("[REFERRAL CONFIG] Created initial configuration");
    } else {
      // Update existing singleton row
      const [updated] = await tenantDb
        .update(referralProgramConfig)
        .set({
          ...updates,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(tenantDb.withTenantFilter(referralProgramConfig, eq(referralProgramConfig.id, existing[0].id)))
        .returning();

      updatedConfig = updated;
      console.log("[REFERRAL CONFIG] Updated configuration");
    }

    // Update cache with fresh data and reset TTL
    configCache = updatedConfig;
    cacheTimestamp = Date.now();

    return {
      success: true,
      config: updatedConfig,
      message: "Configuration updated successfully"
    };
  } catch (error) {
    console.error("[REFERRAL CONFIG] Error updating config:", error);
    return {
      success: false,
      message: "Failed to update configuration"
    };
  }
}

/**
 * Invalidate the config cache
 * Called when config is updated externally
 * Forces reload from database on next request
 */
export function invalidateConfigCache(): void {
  configCache = null;
  cacheTimestamp = null;
  console.log("[REFERRAL CONFIG] Cache invalidated - will reload from database");
}

/**
 * Get referrer reward descriptor from config
 * Returns a structured reward object
 * Handles numeric types properly and guards against null/NaN
 */
export async function getReferrerRewardDescriptor(tenantDb: TenantDb): Promise<RewardDescriptor | null> {
  const config = await getReferralConfig(tenantDb);
  if (!config) return null;

  // Handle numeric amount - schema stores as numeric type
  const amount = config.referrerRewardAmount ? 
    (typeof config.referrerRewardAmount === 'string' ? 
      parseFloat(config.referrerRewardAmount) : 
      Number(config.referrerRewardAmount)) : 0;

  // Guard against NaN
  const safeAmount = isNaN(amount) ? 0 : amount;

  return {
    type: config.referrerRewardType as RewardType,
    amount: safeAmount,
    serviceId: config.referrerRewardServiceId || undefined,
    expiryDays: config.referrerRewardExpiryDays || undefined,
    notes: config.referrerRewardNotes || undefined,
  };
}

/**
 * Get referee reward descriptor from config
 * Returns a structured reward object
 * Handles numeric types properly and guards against null/NaN
 */
export async function getRefereeRewardDescriptor(tenantDb: TenantDb): Promise<RewardDescriptor | null> {
  const config = await getReferralConfig(tenantDb);
  if (!config) return null;

  // Handle numeric amount - schema stores as numeric type
  const amount = config.refereeRewardAmount ? 
    (typeof config.refereeRewardAmount === 'string' ? 
      parseFloat(config.refereeRewardAmount) : 
      Number(config.refereeRewardAmount)) : 0;

  // Guard against NaN
  const safeAmount = isNaN(amount) ? 0 : amount;

  return {
    type: config.refereeRewardType as RewardType,
    amount: safeAmount,
    serviceId: config.refereeRewardServiceId || undefined,
    expiryDays: config.refereeRewardExpiryDays || undefined,
    notes: config.refereeRewardNotes || undefined,
  };
}

/**
 * Format reward descriptor as human-readable text
 * Used for SMS messages, UI previews, etc.
 */
export function formatRewardDescription(reward: RewardDescriptor): string {
  switch (reward.type) {
    case 'loyalty_points':
      return `${reward.amount} loyalty points`;
    
    case 'fixed_discount':
      return `$${reward.amount} off`;
    
    case 'percent_discount':
      return `${reward.amount}% off`;
    
    case 'service_credit':
      return `$${reward.amount} service credit`;
    
    case 'free_addon':
      return reward.notes || "Free add-on service";
    
    case 'tier_upgrade':
      return "Tier upgrade";
    
    case 'priority_booking':
      return "Priority booking access";
    
    case 'milestone_reward':
      return reward.notes || "Milestone bonus";
    
    case 'gift_card':
      return `$${reward.amount} gift card`;
    
    default:
      return reward.notes || "Reward";
  }
}

/**
 * Get default config values
 * Used for fallback when database is empty
 * Returns proper insert schema type
 */
export function getDefaultConfig(): Partial<InsertReferralProgramConfig> {
  return {
    enabled: true,
    
    // Referrer defaults (current system: 500 points)
    referrerRewardType: "loyalty_points",
    referrerRewardAmount: "500",
    referrerRewardExpiryDays: null, // No expiry
    referrerRewardNotes: "Thank you for referring!",
    
    // Referee defaults (current system: $25 off)
    refereeRewardType: "fixed_discount",
    refereeRewardAmount: "25",
    refereeRewardExpiryDays: null, // No expiry
    refereeRewardNotes: "Welcome! Enjoy your discount.",
    
    // Code settings
    codeExpiryDays: 90,
    maxUsesPerCode: 1,
    
    // Milestones disabled by default
    milestonesEnabled: false,
    milestoneConfig: [],
  };
}

/**
 * Initialize referral config if not exists
 * Should be called on server startup
 */
export async function initializeReferralConfig(tenantDb: TenantDb): Promise<void> {
  try {
    const existing = await tenantDb
      .select()
      .from(referralProgramConfig)
      .where(tenantDb.withTenantFilter(referralProgramConfig))
      .limit(1);

    if (existing.length === 0) {
      await tenantDb
        .insert(referralProgramConfig)
        .values(getDefaultConfig());
      
      console.log("[REFERRAL CONFIG] Initialized with default configuration");
    } else {
      console.log("[REFERRAL CONFIG] Configuration already exists");
    }
  } catch (error) {
    console.error("[REFERRAL CONFIG] Error initializing config:", error);
  }
}
