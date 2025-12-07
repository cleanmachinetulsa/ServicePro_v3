/**
 * SP-16: Extended Feature Gating Service
 * 
 * Extends the basic tier-based feature gating with add-on support.
 * This service checks both plan tier features AND active add-on feature flags.
 * 
 * The original hasFeature() from shared/features.ts remains synchronous
 * for use in frontend code. This service is for server-side checks that
 * need database access to query add-ons.
 */

import { hasFeature, type FeatureKey, TIER_FEATURES } from '@shared/features';
import { hasAddonFeatureFlag, getAddonFeatureFlags } from './addonService';
import { ADDONS_CATALOG, getAddonProvidingFlag } from '@shared/addonsConfig';

/**
 * Mapping of feature keys to add-on feature flags
 * This allows add-ons to unlock features that would normally require a higher tier
 */
const FEATURE_TO_ADDON_FLAGS: Record<string, string[]> = {
  prioritySupport: ['support.priority', 'support.dedicatedQueue'],
  multiUser: ['users.extraSeats'],
  dedicatedNumber: ['telephony.extraNumber', 'telephony.multiLine'],
};

/**
 * Check if a tenant has access to a feature via their plan tier OR active add-ons
 * 
 * @param tenantId - The tenant ID to check
 * @param planTier - The tenant's current plan tier
 * @param featureKey - The feature key to check (from FEATURE_KEYS)
 * @returns true if tenant has access via tier OR add-on
 * 
 * @example
 * ```typescript
 * const canUsePrioritySupport = await isFeatureEnabled(tenantId, tenant.planTier, 'prioritySupport');
 * ```
 */
export async function isFeatureEnabled(
  tenantId: string,
  planTier: string,
  featureKey: FeatureKey
): Promise<boolean> {
  if (hasFeature({ planTier }, featureKey)) {
    return true;
  }
  
  const addonFlags = FEATURE_TO_ADDON_FLAGS[featureKey];
  if (!addonFlags || addonFlags.length === 0) {
    return false;
  }
  
  for (const flag of addonFlags) {
    if (await hasAddonFeatureFlag(tenantId, flag)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a tenant has access to a specific add-on feature flag
 * 
 * @param tenantId - The tenant ID to check
 * @param featureFlag - The add-on feature flag (e.g., 'ai.higherLimits')
 * @returns true if any active add-on provides this flag
 * 
 * @example
 * ```typescript
 * const hasHigherAiLimits = await hasAddonFlag(tenantId, 'ai.higherLimits');
 * ```
 */
export async function hasAddonFlag(
  tenantId: string,
  featureFlag: string
): Promise<boolean> {
  return hasAddonFeatureFlag(tenantId, featureFlag);
}

/**
 * Get all feature flags available to a tenant (from add-ons)
 * 
 * @param tenantId - The tenant ID
 * @returns Array of feature flag strings
 */
export async function getAllAddonFlags(tenantId: string): Promise<string[]> {
  return getAddonFeatureFlags(tenantId);
}

/**
 * Check if a feature requires an upgrade or add-on, and suggest which add-on could unlock it
 * 
 * @param planTier - Current plan tier
 * @param featureKey - Feature to check
 * @returns Upgrade suggestion or null if feature is available
 */
export function getFeatureUpgradeSuggestion(
  planTier: string,
  featureKey: FeatureKey
): { type: 'upgrade' | 'addon'; suggestion: string } | null {
  if (hasFeature({ planTier }, featureKey)) {
    return null;
  }
  
  const addonFlags = FEATURE_TO_ADDON_FLAGS[featureKey];
  if (addonFlags && addonFlags.length > 0) {
    for (const flag of addonFlags) {
      const addon = getAddonProvidingFlag(flag);
      if (addon && addon.isVisible) {
        return {
          type: 'addon',
          suggestion: `Add "${addon.name}" ($${addon.monthlyPrice}/mo) to unlock this feature`,
        };
      }
    }
  }
  
  const tierOrder = ['free', 'starter', 'pro', 'elite'];
  const currentIdx = tierOrder.indexOf(planTier);
  
  for (let i = currentIdx + 1; i < tierOrder.length; i++) {
    const tier = tierOrder[i];
    const tierConfig = TIER_FEATURES[tier];
    if (tierConfig && tierConfig[featureKey]) {
      return {
        type: 'upgrade',
        suggestion: `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan to unlock this feature`,
      };
    }
  }
  
  return null;
}
