import { Express, Request, Response } from 'express';
import { requireRole } from './rbacMiddleware';
import {
  getReferralConfig,
  updateReferralConfig,
  getReferrerRewardDescriptor,
  getRefereeRewardDescriptor,
  formatRewardDescription,
  invalidateConfigCache,
} from './referralConfigService';
import { insertReferralProgramConfigSchema } from '@shared/schema';
import { z } from 'zod';

/**
 * Referral Program Configuration Routes
 * RBAC: Manager and Owner roles only
 * 
 * Endpoints:
 * - GET /api/referral/config - Get current configuration
 * - PATCH /api/referral/config - Update configuration
 * - GET /api/referral/config/rewards-preview - Preview current rewards
 */
export function registerReferralConfigRoutes(app: Express) {
  
  /**
   * Get current referral program configuration
   * Returns the singleton config with all settings
   * Auth: Manager/Owner only
   */
  app.get('/api/referral/config', requireRole('manager', 'owner'), async (req: Request, res: Response) => {
    try {
      const config = await getReferralConfig();
      
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Configuration not found - please initialize the system',
        });
      }
      
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      console.error('[REFERRAL CONFIG API] Error fetching config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch referral configuration',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Update referral program configuration
   * Partial update - only sends fields that changed
   * Auth: Manager/Owner only
   */
  app.patch('/api/referral/config', requireRole('manager', 'owner'), async (req: Request, res: Response) => {
    try {
      // Validate request body against schema
      const updateSchema = insertReferralProgramConfigSchema.partial();
      const validationResult = updateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration data',
          errors: validationResult.error.errors,
        });
      }
      
      // Get user ID from session for audit trail
      const userId = (req as any).user?.id;
      
      // Update configuration
      const result = await updateReferralConfig(validationResult.data, userId);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message || 'Failed to update configuration',
        });
      }
      
      // Log the update
      console.log(`[REFERRAL CONFIG API] Configuration updated by user ${userId}`);
      
      res.json({
        success: true,
        data: result.config,
        message: 'Configuration updated successfully',
      });
    } catch (error) {
      console.error('[REFERRAL CONFIG API] Error updating config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update referral configuration',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Get preview of current reward settings
   * Returns human-readable reward descriptions
   * Auth: Manager/Owner only
   */
  app.get('/api/referral/config/rewards-preview', requireRole('manager', 'owner'), async (req: Request, res: Response) => {
    try {
      const referrerReward = await getReferrerRewardDescriptor();
      const refereeReward = await getRefereeRewardDescriptor();
      
      if (!referrerReward || !refereeReward) {
        return res.status(404).json({
          success: false,
          message: 'Reward configuration not found',
        });
      }
      
      res.json({
        success: true,
        data: {
          referrer: {
            ...referrerReward,
            description: formatRewardDescription(referrerReward),
          },
          referee: {
            ...refereeReward,
            description: formatRewardDescription(refereeReward),
          },
        },
      });
    } catch (error) {
      console.error('[REFERRAL CONFIG API] Error fetching reward preview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reward preview',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Invalidate configuration cache
   * Forces reload from database on next request
   * Auth: Manager/Owner only
   * Useful after manual database changes
   */
  app.post('/api/referral/config/invalidate-cache', requireRole('manager', 'owner'), async (req: Request, res: Response) => {
    try {
      invalidateConfigCache();
      
      res.json({
        success: true,
        message: 'Cache invalidated successfully',
      });
    } catch (error) {
      console.error('[REFERRAL CONFIG API] Error invalidating cache:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to invalidate cache',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
