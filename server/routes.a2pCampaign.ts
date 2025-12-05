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
import {
  submitOrUpdateCampaign,
  refreshCampaignStatus,
  TrustHubError,
  getPhoneSmsStatus,
} from './services/a2pTrustHubService';
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

// ============================================================
// TWILIO TRUSTHUB INTEGRATION ENDPOINTS
// ============================================================

/**
 * Submit campaign to Twilio TrustHub
 * POST /api/a2p/campaign/submit
 * 
 * Submits the campaign to Twilio for A2P 10DLC registration.
 * Campaign must be in 'ready_to_submit' status.
 */
router.post('/campaign/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant ID not found in session',
      });
    }

    // Get the campaign for this tenant
    const campaign = await getCampaignForTenant(req.tenantDb!, tenantId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'No campaign found. Create one first.',
        code: 'CAMPAIGN_NOT_FOUND',
      });
    }

    // Validate campaign is complete before submission
    const validation = validateCampaignForSubmission(campaign);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Campaign is not complete',
        code: 'VALIDATION_FAILED',
        validationErrors: validation.errors,
      });
    }

    // Submit to TrustHub
    const result = await submitOrUpdateCampaign(req.tenantDb!, tenantId, campaign.id);

    // Fetch updated campaign
    const updatedCampaign = await getCampaignForTenant(req.tenantDb!, tenantId);

    return res.json({
      success: true,
      campaign: updatedCampaign,
      campaignSid: result.campaignSid,
      status: result.status,
      message: result.message,
    });
  } catch (error) {
    console.error('[A2P CAMPAIGN] Error submitting to TrustHub:', error);
    
    if (error instanceof TrustHubError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to submit campaign to Twilio',
      code: 'A2P_TWILIO_ERROR',
    });
  }
});

/**
 * Refresh campaign status from Twilio TrustHub
 * POST /api/a2p/campaign/refresh-status
 * 
 * Fetches the current status from Twilio and updates local state.
 * Campaign must have been submitted (have a twilio_campaign_sid).
 */
router.post('/campaign/refresh-status', requireAuth, async (req: Request, res: Response) => {
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
      return res.status(404).json({
        success: false,
        error: 'No campaign found',
        code: 'CAMPAIGN_NOT_FOUND',
      });
    }

    // Refresh status from TrustHub
    const result = await refreshCampaignStatus(req.tenantDb!, tenantId, campaign.id);

    // Fetch updated campaign
    const updatedCampaign = await getCampaignForTenant(req.tenantDb!, tenantId);

    return res.json({
      success: true,
      campaign: updatedCampaign,
      status: result.status,
      trusthubStatus: result.trusthubStatus,
      rejectionReason: result.rejectionReason,
      message: result.message,
    });
  } catch (error) {
    console.error('[A2P CAMPAIGN] Error refreshing status:', error);
    
    if (error instanceof TrustHubError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to refresh campaign status',
      code: 'A2P_REFRESH_ERROR',
    });
  }
});

/**
 * Resubmit a rejected campaign to Twilio TrustHub
 * POST /api/a2p/campaign/resubmit
 * 
 * Re-submits a campaign that was previously rejected.
 * Campaign must be in 'rejected' status.
 */
router.post('/campaign/resubmit', requireAuth, async (req: Request, res: Response) => {
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
      return res.status(404).json({
        success: false,
        error: 'No campaign found',
        code: 'CAMPAIGN_NOT_FOUND',
      });
    }

    // Only allow resubmit if rejected or has an error
    if (campaign.status !== 'rejected' && campaign.trusthubStatus !== 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'Campaign can only be resubmitted if it was rejected',
        code: 'INVALID_STATUS',
      });
    }

    // Validate campaign is complete
    const validation = validateCampaignForSubmission(campaign);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Campaign is not complete. Fix issues before resubmitting.',
        code: 'VALIDATION_FAILED',
        validationErrors: validation.errors,
      });
    }

    // Resubmit to TrustHub
    const result = await submitOrUpdateCampaign(req.tenantDb!, tenantId, campaign.id);

    // Fetch updated campaign
    const updatedCampaign = await getCampaignForTenant(req.tenantDb!, tenantId);

    return res.json({
      success: true,
      campaign: updatedCampaign,
      campaignSid: result.campaignSid,
      status: result.status,
      message: 'Campaign resubmitted for review',
    });
  } catch (error) {
    console.error('[A2P CAMPAIGN] Error resubmitting campaign:', error);
    
    if (error instanceof TrustHubError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to resubmit campaign',
      code: 'A2P_RESUBMIT_ERROR',
    });
  }
});

/**
 * Get phone and SMS setup status for setup wizard
 * GET /api/a2p/phone-sms-status
 * 
 * Returns current phone, messaging service, and A2P status for the tenant.
 * Used by setup wizard Step 2.
 */
router.get('/phone-sms-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant ID not found in session',
      });
    }

    const status = await getPhoneSmsStatus(tenantId);

    return res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('[A2P CAMPAIGN] Error getting phone/SMS status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get phone/SMS status',
    });
  }
});

export default router;
