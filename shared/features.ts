/**
 * Phase 7: Feature Gating System
 * 
 * Defines which features are available to each plan tier.
 * Includes the special 'internal' tier for family/friends at-cost access.
 */

// Feature keys that can be gated by plan tier
export const FEATURE_KEYS = [
  'aiSmsAgent',
  'aiVoiceAgent',
  'dedicatedNumber',
  'campaigns',
  'dataExport',
  'websiteGenerator',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * Feature availability matrix for each plan tier
 * 
 * Tiers:
 * - starter: Entry level, basic features only
 * - pro: Professional tier with AI SMS and campaigns
 * - elite: Full feature set including AI voice
 * - internal: Family/friends at-cost tier - all features enabled, no SaaS markup
 */
export const TIER_FEATURES: Record<string, Record<FeatureKey, boolean>> = {
  starter: {
    aiSmsAgent: false,
    aiVoiceAgent: false,
    dedicatedNumber: false,
    campaigns: false,
    dataExport: true,
    websiteGenerator: true,
  },
  pro: {
    aiSmsAgent: true,
    aiVoiceAgent: false,
    dedicatedNumber: true,
    campaigns: true,
    dataExport: true,
    websiteGenerator: true,
  },
  elite: {
    aiSmsAgent: true,
    aiVoiceAgent: true,
    dedicatedNumber: true,
    campaigns: true,
    dataExport: true,
    websiteGenerator: true,
  },
  internal: {
    // Internal = "family / friends at-cost" → all features ON, no SaaS markup
    aiSmsAgent: true,
    aiVoiceAgent: true,
    dedicatedNumber: true,
    campaigns: true,
    dataExport: true,
    websiteGenerator: true,
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
