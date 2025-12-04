/**
 * Port Recovery Campaign API Routes
 * 
 * Admin-only routes for managing one-time SMS/email recovery campaigns
 * to win back customers who may have been lost during phone number porting.
 */

import { Router } from 'express';
import { createTenantDb } from './tenantDb';
import {
  previewTargetList,
  createPortRecoveryCampaign,
  getCampaigns,
  getCampaign,
  getCampaignTargets,
  runPortRecoveryBatch,
  sendTestSms,
} from './services/portRecoveryService';

const router = Router();

/**
 * Preview target list without creating campaign
 * GET /api/port-recovery/preview
 */
router.get('/preview', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = createTenantDb(tenantId);
    
    const result = await previewTargetList(tenantDb, tenantId);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error previewing targets:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Create a new port recovery campaign
 * POST /api/port-recovery/campaigns
 */
router.post('/campaigns', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const userId = req.session?.userId;
    const tenantDb = createTenantDb(tenantId);
    
    const { name } = req.body;
    
    const result = await createPortRecoveryCampaign(
      tenantDb,
      tenantId,
      userId || 1,
      name || undefined
    );
    
    res.json({
      success: true,
      campaign: result.campaign,
      targetCount: result.targetCount,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get all campaigns for tenant
 * GET /api/port-recovery/campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = createTenantDb(tenantId);
    
    const campaigns = await getCampaigns(tenantDb, tenantId);
    
    res.json({
      success: true,
      campaigns,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get a specific campaign
 * GET /api/port-recovery/campaigns/:id
 */
router.get('/campaigns/:id', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = createTenantDb(tenantId);
    const campaignId = parseInt(req.params.id);
    
    const campaign = await getCampaign(tenantDb, campaignId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }
    
    // Get target stats
    const { targets, total } = await getCampaignTargets(tenantDb, campaignId);
    
    res.json({
      success: true,
      campaign,
      targetCount: total,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get campaign targets
 * GET /api/port-recovery/campaigns/:id/targets
 */
router.get('/campaigns/:id/targets', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = createTenantDb(tenantId);
    const campaignId = parseInt(req.params.id);
    const smsStatus = req.query.smsStatus as any;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const { targets, total } = await getCampaignTargets(tenantDb, campaignId, {
      smsStatus,
      limit,
      offset,
    });
    
    res.json({
      success: true,
      targets,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error fetching targets:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Run a batch of the campaign
 * POST /api/port-recovery/campaigns/:id/run-batch
 */
router.post('/campaigns/:id/run-batch', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = createTenantDb(tenantId);
    const campaignId = parseInt(req.params.id);
    const limit = parseInt(req.body.limit) || 100;
    
    const result = await runPortRecoveryBatch(tenantDb, campaignId, limit);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error running batch:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Send test SMS to owner
 * POST /api/port-recovery/campaigns/:id/test-sms
 */
router.post('/campaigns/:id/test-sms', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = createTenantDb(tenantId);
    const campaignId = parseInt(req.params.id);
    
    const result = await sendTestSms(tenantDb, campaignId);
    
    res.json(result);
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error sending test SMS:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
