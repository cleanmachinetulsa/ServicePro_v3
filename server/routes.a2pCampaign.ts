/**
 * A2P Campaign Routes
 * 
 * Provides tenant-scoped API endpoints for managing A2P SMS campaign registration.
 * All endpoints require authentication and operate on the authenticated tenant's data only.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { insertA2pCampaignSchema } from '@shared/schema';
import {
  getCampaignForTenant,
  getDefaultCampaignForTenant,
  upsertCampaignForTenant,
  updateCampaignStatus,
  generateAISuggestions,
  validateCampaignForSubmission,
} from './services/a2pCampaignService';
import { z } from 'zod';

const router = Router();

/**
 * Get the current tenant's A2P campaign
 * GET /api/a2p/campaign
 * 
 * Returns existing campaign or sensible defaults for a new campaign
 */
router.get('/campaign', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant ID not found in session',
      });
    }

    // Try to get existing campaign
    const existing = await getCampaignForTenant(req.tenantDb!, tenantId);
    
    if (existing) {
      return res.json({
        success: true,
        campaign: existing,
        isNew: false,
      });
    }

    // Return defaults for new campaign
    const defaults = await getDefaultCampaignForTenant(tenantId);
    
    return res.json({
      success: true,
      campaign: defaults,
      isNew: true,
    });
  } catch (error) {
    console.error('[A2P CAMPAIGN] Error fetching campaign:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch A2P campaign',
    });
  }
});

/**
 * Update the current tenant's A2P campaign
 * PUT /api/a2p/campaign
 * 
 * Creates or updates the campaign with provided fields
 */
router.put('/campaign', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant ID not found in session',
      });
    }

    // Validate input - allow partial updates
    const updateSchema = insertA2pCampaignSchema.partial().omit({ tenantId: true });
    const parseResult = updateSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign data',
        details: parseResult.error.flatten(),
      });
    }

    const campaign = await upsertCampaignForTenant(
      req.tenantDb!,
      tenantId,
      parseResult.data
    );

    return res.json({
      success: true,
      campaign,
      message: 'Campaign saved successfully',
    });
  } catch (error) {
    console.error('[A2P CAMPAIGN] Error updating campaign:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update A2P campaign',
    });
  }
});

/**
 * Update campaign status
 * POST /api/a2p/campaign/status
 * 
 * Transitions campaign to a new status with validation
 */
router.post('/campaign/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant ID not found in session',
      });
    }

    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
      });
    }

    // If marking as ready_to_submit, validate completeness first
    if (status === 'ready_to_submit') {
      const existing = await getCampaignForTenant(req.tenantDb!, tenantId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'No campaign found. Save your campaign first.',
        });
      }

      const validation = validateCampaignForSubmission(existing);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Campaign is not complete',
          validationErrors: validation.errors,
        });
      }
    }

    const campaign = await updateCampaignStatus(req.tenantDb!, tenantId, status);

    return res.json({
      success: true,
      campaign,
      message: `Campaign status updated to ${status}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[A2P CAMPAIGN] Error updating status:', error);
    return res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * Generate AI suggestions for campaign content
 * POST /api/a2p/campaign/ai-suggest
 * 
 * Uses tenant context to generate compliant campaign content
 * Does NOT save to database - returns suggestions for user review
 */
router.post('/campaign/ai-suggest', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant ID not found in session',
      });
    }

    const suggestions = await generateAISuggestions(tenantId);

    return res.json({
      success: true,
      suggestions,
      message: 'AI suggestions generated. Review and apply to your campaign.',
    });
  } catch (error) {
    console.error('[A2P CAMPAIGN] Error generating AI suggestions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI suggestions. Please try again.',
    });
  }
});

/**
 * Validate campaign completeness
 * POST /api/a2p/campaign/validate
 * 
 * Checks if campaign has all required fields for submission
 */
router.post('/campaign/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant ID not found in session',
      });
    }

    const campaign = await getCampaignForTenant(req.tenantDb!, tenantId);
    
    if (!campaign) {
      return res.json({
        success: true,
        valid: false,
        errors: ['No campaign found. Create one first.'],
      });
    }

    const validation = validateCampaignForSubmission(campaign);

    return res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
    });
  } catch (error) {
    console.error('[A2P CAMPAIGN] Error validating campaign:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate campaign',
    });
  }
});

export default router;
