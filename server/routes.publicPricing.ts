/**
 * Public Pricing Endpoint
 * 
 * Provides pricing plans and feature comparison data for the public pricing page
 * and in-app upgrade flows.
 * 
 * This endpoint is PUBLIC and does not require authentication.
 */

import { Router, Request, Response } from 'express';
import { PRICING_PLANS, PRICING_FEATURES, PRICING_MARKETING, type PricingPlanId } from '@shared/pricingConfig';
import { TIER_FEATURES, type FeatureKey } from '@shared/features';

const router = Router();

/**
 * GET /api/public/pricing
 * 
 * Returns complete pricing information including:
 * - Plan configurations (Free, Starter, Pro, Elite)
 * - Feature comparison matrix
 * - Marketing copy
 * 
 * This is the single source of truth for pricing UI components
 */
router.get('/pricing', (req: Request, res: Response) => {
  try {
    // Build feature comparison matrix
    const features = PRICING_FEATURES.map(feature => {
      const planAccess: Partial<Record<PricingPlanId, boolean>> = {};
      
      // Map PRICING_FEATURES keys to TIER_FEATURES keys
      const featureKey = feature.key as FeatureKey;
      
      // For each plan, check if feature is enabled
      (['free', 'starter', 'pro', 'elite'] as PricingPlanId[]).forEach(planId => {
        const tierFeatures = TIER_FEATURES[planId];
        planAccess[planId] = tierFeatures?.[featureKey] ?? false;
      });

      return {
        key: feature.key,
        label: feature.label,
        description: feature.description,
        category: feature.category,
        planAccess,
      };
    });

    // Return complete pricing data
    res.json({
      success: true,
      plans: PRICING_PLANS,
      features,
      marketing: PRICING_MARKETING,
    });
  } catch (error) {
    console.error('[PUBLIC PRICING] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load pricing information',
    });
  }
});

export default router;
