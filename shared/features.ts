/**
 * Phase 7: Feature Gating System
 * 
 * Defines which features are available to each plan tier.
 * Includes the special 'internal' tier for family/friends at-cost access.
 */

// Feature keys that can be gated by plan tier
// Extended for pricing comparison table (Phase 7B)
export const FEATURE_KEYS = [
  'aiSmsAgent',
  'aiVoiceAgent',
  'dedicatedNumber',
  'campaigns',
  'dataExport',
  'websiteGenerator',
  'customDomain',
  'crmBasic',
  'loyalty',
  'multiUser',
  'advancedAnalytics',
  'prioritySupport',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * Feature availability matrix for each plan tier
 * 
 * Tiers:
 * - free: Limited features, watermarked website, perfect for testing (Phase 23)
 * - starter: Entry level, professional features, no watermark
 * - pro: Professional tier with AI SMS and campaigns (RECOMMENDED)
 * - elite: Full feature set including AI voice
 * - internal: Family/friends at-cost tier - all features enabled, no SaaS markup
 */
export const TIER_FEATURES: Record<string, Record<FeatureKey, boolean>> = {
  free: {
    // Free tier: Basic CRM and website with watermark
    aiSmsAgent: false,
    aiVoiceAgent: false,
    dedicatedNumber: false,
    campaigns: false,
    dataExport: false,
    websiteGenerator: true, // With watermark
    customDomain: false,
    crmBasic: true,
    loyalty: false,
    multiUser: false,
    advancedAnalytics: false,
    prioritySupport: false,
  },
  starter: {
    // Starter: Remove watermark, add custom domain and basic automation
    aiSmsAgent: false,
    aiVoiceAgent: false,
    dedicatedNumber: false,
    campaigns: false,
    dataExport: true,
    websiteGenerator: true, // No watermark
    customDomain: true,
    crmBasic: true,
    loyalty: false,
    multiUser: false,
    advancedAnalytics: false,
    prioritySupport: false,
  },
  pro: {
    // Pro: AI SMS, campaigns, loyalty - RECOMMENDED
    aiSmsAgent: true,
    aiVoiceAgent: false,
    dedicatedNumber: true,
    campaigns: true,
    dataExport: true,
    websiteGenerator: true,
    customDomain: true,
    crmBasic: true,
    loyalty: true,
    multiUser: true,
    advancedAnalytics: false,
    prioritySupport: true,
  },
  elite: {
    // Elite: Full feature set including AI voice
    aiSmsAgent: true,
    aiVoiceAgent: true,
    dedicatedNumber: true,
    campaigns: true,
    dataExport: true,
    websiteGenerator: true,
    customDomain: true,
    crmBasic: true,
    loyalty: true,
    multiUser: true,
    advancedAnalytics: true,
    prioritySupport: true,
  },
  internal: {
    // Internal = "family / friends at-cost" → all features ON, no SaaS markup
    aiSmsAgent: true,
    aiVoiceAgent: true,
    dedicatedNumber: true,
    campaigns: true,
    dataExport: true,
    websiteGenerator: true,
    customDomain: true,
    crmBasic: true,
    loyalty: true,
    multiUser: true,
    advancedAnalytics: true,
    prioritySupport: true,
  },
};

/**
 * Check if a tenant has access to a specific feature based on their plan tier
 * 
 * @param tenant - Tenant object with planTier field
 * @param key - Feature key to check
 * @returns true if tenant has access to the feature, false otherwise
 * 
 * @example
 * ```typescript
 * if (!hasFeature(tenant, 'aiSmsAgent')) {
 *   return res.status(403).json({ 
 *     error: 'AI SMS Agent requires Pro plan or higher' 
 *   });
 * }
 * ```
 */
export function hasFeature(tenant: { planTier: string }, key: FeatureKey): boolean {
  const tierConfig = TIER_FEATURES[tenant.planTier] ?? TIER_FEATURES.starter;
  return !!tierConfig[key];
}

/**
 * Get all features available to a tenant based on their plan tier
 * 
 * @param tenant - Tenant object with planTier field
 * @returns Object with all feature keys and their availability status
 */
export function getTenantFeatures(tenant: { planTier: string }): Record<FeatureKey, boolean> {
  return TIER_FEATURES[tenant.planTier] ?? TIER_FEATURES.starter;
}

/**
 * Get list of feature keys that are enabled for a tenant
 * 
 * @param tenant - Tenant object with planTier field
 * @returns Array of enabled feature keys
 */
export function getEnabledFeatures(tenant: { planTier: string }): FeatureKey[] {
  const features = getTenantFeatures(tenant);
  return FEATURE_KEYS.filter(key => features[key]);
}

/**
 * Get list of feature keys that are disabled for a tenant
 * 
 * @param tenant - Tenant object with planTier field
 * @returns Array of disabled feature keys
 */
export function getDisabledFeatures(tenant: { planTier: string }): FeatureKey[] {
  const features = getTenantFeatures(tenant);
  return FEATURE_KEYS.filter(key => !features[key]);
}
