/**
 * Phase 14 - Promo Engine Rules Configuration
 * 
 * Defines anti-abuse rules for promotional loyalty point awards.
 * These rules are tenant-agnostic but enforced per-tenant via the promo engine.
 * 
 * Future: These could be moved to database for per-tenant customization.
 */

export const PROMO_RULES = {
  welcome_back_v1: {
    perCustomerLifetimeMax: 1,      // Customer can only get welcome back bonus once ever
    perCustomerPerYearMax: 1,       // Annual cap (redundant with lifetime but enforces calendar year tracking)
    perHouseholdPerYearMax: 1,      // Only 1 person per household can claim per year
    requireExistingJob: false,      // TODO Phase 14: Set to true once job-based eligibility is implemented
    awardMode: 'pending_until_next_completed_job' as const, // Points pending until next job completion
  },
  referral_v1: {
    perCustomerPerYearMax: 5,       // Can refer up to 5 people per year
    awardMode: 'immediate' as const, // Points awarded immediately when referral completes first job
  },
  // Future promos can be added here:
  // review_bonus_v1: { ... },
  // seasonal_promo_v1: { ... },
} as const;

export type PromoKey = keyof typeof PROMO_RULES;
export type AwardMode = 'immediate' | 'pending_until_next_completed_job';

// Helper to validate promo key
export function isValidPromoKey(key: string): key is PromoKey {
  return key in PROMO_RULES;
}

// Helper to get rules for a promo
export function getPromoRules(promoKey: PromoKey) {
  return PROMO_RULES[promoKey];
}
