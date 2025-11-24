/**
 * Stripe Service
 * 
 * Central Stripe configuration for subscription billing (Phase 7C)
 * Provides:
 * - Stripe client initialization
 * - Price ID mapping for subscription tiers
 * - Helper functions for tier/price lookups
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY (required for billing)
 * - STRIPE_WEBHOOK_SECRET (required for webhook signature verification)
 * - STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_ELITE (optional, can be hardcoded)
 */

import Stripe from 'stripe';

// Initialize Stripe client (or null if not configured)
const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;

export const stripe = STRIPE_ENABLED
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-04-30.basil',
    })
  : null;

if (!STRIPE_ENABLED) {
  console.warn('[STRIPE SERVICE] STRIPE_SECRET_KEY not configured - billing features will be disabled');
}

/**
 * Subscription tier to Stripe Price ID mapping
 * 
 * REQUIRED: Set these in environment variables before enabling billing:
 * - STRIPE_PRICE_STARTER (e.g., price_xxxxx for $39/mo)
 * - STRIPE_PRICE_PRO (e.g., price_xxxxx for $89/mo)
 * - STRIPE_PRICE_ELITE (e.g., price_xxxxx for $199/mo)
 * 
 * Free tier has no Stripe price (it's free!)
 * Internal tier has no billing (family/friends access)
 */
function getPlanToPriceIdMapping(): Record<'starter' | 'pro' | 'elite', string> {
  const mapping = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    elite: process.env.STRIPE_PRICE_ELITE,
  };

  // Validate all price IDs are configured
  const missing = Object.entries(mapping)
    .filter(([_, priceId]) => !priceId)
    .map(([tier]) => `STRIPE_PRICE_${tier.toUpperCase()}`);

  if (missing.length > 0 && STRIPE_ENABLED) {
    console.warn(
      `[STRIPE SERVICE] Missing price ID env vars: ${missing.join(', ')}. ` +
      `Billing features will fail for these tiers.`
    );
  }

  return mapping as Record<'starter' | 'pro' | 'elite', string>;
}

const PLAN_TO_PRICE_ID = getPlanToPriceIdMapping();

/**
 * Reverse mapping: Stripe Price ID → Tier
 * Built dynamically from PLAN_TO_PRICE_ID
 */
const PRICE_ID_TO_PLAN: Record<string, 'starter' | 'pro' | 'elite'> = Object.fromEntries(
  Object.entries(PLAN_TO_PRICE_ID).map(([tier, priceId]) => [priceId, tier])
) as Record<string, 'starter' | 'pro' | 'elite'>;

/**
 * Get Stripe Price ID for a given tier
 * 
 * @param tier - Target subscription tier ('starter', 'pro', or 'elite')
 * @returns Stripe price ID (e.g., 'price_xxxxx')
 * @throws Error if price ID not configured for tier
 */
export function getPriceIdForTier(tier: 'starter' | 'pro' | 'elite'): string {
  const priceId = PLAN_TO_PRICE_ID[tier];
  
  if (!priceId) {
    throw new Error(
      `No Stripe price configured for tier: ${tier}. ` +
      `Please set STRIPE_PRICE_${tier.toUpperCase()} environment variable.`
    );
  }
  
  return priceId;
}

/**
 * Get tier for a given Stripe Price ID
 * 
 * @param priceId - Stripe price ID (from subscription or checkout session)
 * @returns Tier name ('starter', 'pro', or 'elite') or null if not found
 */
export function getTierForPriceId(priceId: string): 'starter' | 'pro' | 'elite' | null {
  return PRICE_ID_TO_PLAN[priceId] || null;
}

/**
 * Tier hierarchy for validation (lower index = lower tier)
 * Used to ensure upgrades are to higher tiers only
 */
const TIER_HIERARCHY = ['free', 'starter', 'pro', 'elite', 'internal'] as const;

/**
 * Check if targetTier is higher than currentTier
 * 
 * @param currentTier - Current subscription tier
 * @param targetTier - Target subscription tier
 * @returns true if upgrade is valid (target > current), false otherwise
 */
export function isValidUpgrade(
  currentTier: string,
  targetTier: 'starter' | 'pro' | 'elite'
): boolean {
  const currentIndex = TIER_HIERARCHY.indexOf(currentTier as any);
  const targetIndex = TIER_HIERARCHY.indexOf(targetTier);
  
  if (currentIndex === -1 || targetIndex === -1) {
    return false; // Unknown tier
  }
  
  return targetIndex > currentIndex;
}

/**
 * Get human-readable tier name for display
 */
export function getTierDisplayName(tier: string): string {
  const names: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    elite: 'Elite',
    internal: 'Internal',
  };
  return names[tier] || tier;
}

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  return STRIPE_ENABLED;
}
