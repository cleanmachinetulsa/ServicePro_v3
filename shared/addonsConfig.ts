/**
 * SP-16: Add-Ons System Configuration
 * 
 * Central catalog of add-ons that tenants can enable on top of their base plan.
 * Feature gating checks both plan tier and active add-ons.
 */

export type AddonKey =
  | "extra_phone_number"
  | "extra_user_seats"
  | "ai_power_pack"
  | "priority_support"
  | "multi_location"
  | "white_label_plus";

export type AddonMinTier = "starter" | "pro" | "elite";
export type AddonRecommendedTier = "starter" | "pro" | "elite" | "agency";

export interface AddonDefinition {
  key: AddonKey;
  name: string;
  shortLabel: string;
  description: string;
  monthlyPrice: number;
  recommendedTier: AddonRecommendedTier;
  minTier: AddonMinTier;
  featureFlags: string[];
  isVisible: boolean;
}

/**
 * Add-Ons Catalog
 * 
 * To add a new add-on:
 * 1. Add the key to AddonKey type above
 * 2. Add the definition to this array
 * 3. Feature flags can be checked via isFeatureEnabledWithAddons()
 */
export const ADDONS_CATALOG: AddonDefinition[] = [
  {
    key: "extra_phone_number",
    name: "Extra Phone Number",
    shortLabel: "Extra #",
    description: "Add an additional dedicated phone number for your business. Great for separating departments or locations.",
    monthlyPrice: 15,
    recommendedTier: "pro",
    minTier: "starter",
    featureFlags: ["telephony.extraNumber", "telephony.multiLine"],
    isVisible: true,
  },
  {
    key: "extra_user_seats",
    name: "Extra User Seats (2-pack)",
    shortLabel: "+2 Seats",
    description: "Add 2 additional user seats to your account. Perfect for growing teams.",
    monthlyPrice: 20,
    recommendedTier: "pro",
    minTier: "starter",
    featureFlags: ["users.extraSeats"],
    isVisible: true,
  },
  {
    key: "ai_power_pack",
    name: "AI Power Pack",
    shortLabel: "AI+",
    description: "Unlock higher AI usage limits, faster response times, and advanced AI features like sentiment analysis.",
    monthlyPrice: 35,
    recommendedTier: "pro",
    minTier: "pro",
    featureFlags: ["ai.higherLimits", "ai.fastResponses", "ai.sentimentAnalysis", "ai.advancedFeatures"],
    isVisible: true,
  },
  {
    key: "priority_support",
    name: "Priority Support",
    shortLabel: "Priority",
    description: "Get faster response times from our support team with dedicated priority queue access.",
    monthlyPrice: 25,
    recommendedTier: "starter",
    minTier: "starter",
    featureFlags: ["support.priority", "support.dedicatedQueue"],
    isVisible: true,
  },
  {
    key: "multi_location",
    name: "Multi-Location Management",
    shortLabel: "Multi-Loc",
    description: "Manage multiple business locations from a single dashboard with location-specific settings and reporting.",
    monthlyPrice: 45,
    recommendedTier: "elite",
    minTier: "pro",
    featureFlags: ["locations.multiple", "locations.separateReporting", "locations.staffAssignment"],
    isVisible: true,
  },
  {
    key: "white_label_plus",
    name: "White-Label Plus",
    shortLabel: "White Label",
    description: "Advanced branding options including custom email domains, branded mobile app, and removal of all ServicePro branding.",
    monthlyPrice: 50,
    recommendedTier: "elite",
    minTier: "elite",
    featureFlags: ["branding.customEmailDomain", "branding.mobileApp", "branding.fullWhiteLabel"],
    isVisible: false,
  },
];

/**
 * Get an add-on definition by key
 */
export function getAddonByKey(key: AddonKey): AddonDefinition | undefined {
  return ADDONS_CATALOG.find(addon => addon.key === key);
}

/**
 * Get all visible add-ons (for tenant-facing pages)
 */
export function getVisibleAddons(): AddonDefinition[] {
  return ADDONS_CATALOG.filter(addon => addon.isVisible);
}

/**
 * Get add-ons available for a specific plan tier
 */
export function getAddonsForTier(tier: string): AddonDefinition[] {
  const tierOrder: Record<string, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    elite: 3,
    internal: 4,
  };
  
  const currentTierLevel = tierOrder[tier] ?? 0;
  
  return ADDONS_CATALOG.filter(addon => {
    const minTierLevel = tierOrder[addon.minTier] ?? 0;
    return addon.isVisible && currentTierLevel >= minTierLevel;
  });
}

/**
 * Check if a feature flag is provided by any add-on
 */
export function getAddonProvidingFlag(featureFlag: string): AddonDefinition | undefined {
  return ADDONS_CATALOG.find(addon => addon.featureFlags.includes(featureFlag));
}
