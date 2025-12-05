/**
 * Port Recovery Campaign API Routes
 * 
 * Admin-only routes for managing one-time SMS/email recovery campaigns
 * to win back customers who may have been lost during phone number porting.
 * 
 * Part 2 of Block B: Prepare → Preview → Send workflow
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
  getRecentRunHistory,
} from './services/portRecoveryService';
import { portRecoveryCampaigns } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';

const router = Router();

// Default SMS template for preview display
const DEFAULT_SMS_TEMPLATE = `Hey this is Jody with Clean Machine Auto Detail. We recently upgraded our phone & text system, and there's a small chance we missed a message from you. I'm really sorry if that happened. To make it right, we've added 500 reward points to your account – you can use them toward interior protection, engine bay cleaning, or save them up toward a maintenance detail. Tap here to view options & book: {{bookingUrl}}. Reply STOP to unsubscribe.`;

/**
 * Enhanced preview endpoint for Part 2 of Block B
 * Returns canRun, totalTargets, sampleSms, and last run info
 * GET /api/admin/port-recovery/preview
 */
router.get('/admin/preview', async (req, res) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
    const tenantDb = createTenantDb(tenantId);
    
    const result = await previewTargetList(tenantDb, tenantId);
    
    // Get last run info
    const campaigns = await getCampaigns(tenantDb, tenantId);
    const lastRun = campaigns.find(c => c.status === 'completed' || c.status === 'running');
    
    // Check if there's a run in progress (within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const runInProgress = campaigns.find(c => 
      c.status === 'running' && 
      c.startedAt && 
      new Date(c.startedAt) > oneHourAgo
    );
    
    // Format sample SMS with personalization
    const sampleName = result.sampleTargets?.[0]?.customerName || 'Valued Customer';
    const sampleSms = DEFAULT_SMS_TEMPLATE
      .replace('Hey this is', `Hey ${sampleName}, this is`)
      .replace('{{bookingUrl}}', 'https://cleanmachinetulsa.com/book');
    
    res.json({
      success: true,
      canRun: !runInProgress && result.stats.totalUnique > 0,
      totalTargets: result.stats.totalUnique,
      sampleSms,
      sampleCustomerName: sampleName,
      lastRun: lastRun ? {
        startedAt: lastRun.startedAt,
        finishedAt: lastRun.completedAt,
        totalSent: lastRun.totalSmsSent,
        totalFailed: lastRun.totalSmsFailed || 0,
      } : null,
      runInProgress: !!runInProgress,
      stats: result.stats,
      sampleTargets: result.sampleTargets,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error in admin preview:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Run the campaign with safety checks
 * POST /api/admin/port-recovery/run
 */
router.post('/admin/run', async (req, res) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
    const userId = (req.session as any)?.userId;
    const tenantDb = createTenantDb(tenantId);
    const { dryRun } = req.body;
    
    // Check for run in progress (within last hour)
    const campaigns = await getCampaigns(tenantDb, tenantId);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const runInProgress = campaigns.find(c => 
      (c.status === 'running' || c.status === 'draft') && 
      c.startedAt && 
      new Date(c.startedAt) > oneHourAgo
    );
    
    if (runInProgress && !dryRun) {
      return res.status(409).json({
        success: false,
        error: 'A campaign is already in progress. Please wait at least 1 hour before starting another campaign to avoid duplicate messages.',
        runInProgress: true,
      });
    }
    
    // If dry run, just return preview data
    if (dryRun) {
      const result = await previewTargetList(tenantDb, tenantId);
      return res.json({
        success: true,
        dryRun: true,
        totalTargets: result.stats.totalUnique,
        stats: result.stats,
      });
    }
    
    // Check environment - in dev, skip actual sending unless explicitly enabled
    const isProduction = process.env.NODE_ENV === 'production';
    const forceDevSend = process.env.FORCE_DEV_SMS_SEND === 'true';
    
    // Create the campaign
    const campaignResult = await createPortRecoveryCampaign(
      tenantDb,
      tenantId,
      userId || 1,
      `port-recovery-${new Date().toISOString().split('T')[0]}`
    );
    
    // In development, log warning but still create the campaign
    if (!isProduction && !forceDevSend) {
      console.warn('[PORT RECOVERY] Running in development mode - SMS sending may be disabled');
    }
    
    res.json({
      success: true,
      ok: true,
      runId: campaignResult.campaign.id.toString(),
      totalQueued: campaignResult.targetCount,
      campaign: campaignResult.campaign,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error in admin run:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get history of recent runs
 * GET /api/admin/port-recovery/history
 */
router.get('/admin/history', async (req, res) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
    const tenantDb = createTenantDb(tenantId);
    
    const campaigns = await getCampaigns(tenantDb, tenantId);
    
    // Map campaigns to run history format
    const runs = campaigns.slice(0, 5).map(c => ({
      id: c.id.toString(),
      startedAt: c.startedAt?.toISOString() || c.createdAt?.toISOString(),
      finishedAt: c.completedAt?.toISOString() || null,
      totalTargets: c.totalTargets,
      totalSent: c.totalSmsSent,
      totalFailed: c.totalSmsFailed || 0,
      status: mapCampaignStatus(c.status),
    }));
    
    res.json({
      success: true,
      runs,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error fetching history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Map internal status to UI-friendly status
 */
function mapCampaignStatus(status: string): 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' {
  switch (status) {
    case 'draft': return 'PENDING';
    case 'scheduled': return 'PENDING';
    case 'running': return 'RUNNING';
    case 'completed': return 'COMPLETED';
    case 'cancelled': return 'FAILED';
    default: return 'PENDING';
  }
}

/**
 * Preview target list without creating campaign
 * GET /api/port-recovery/preview
 */
router.get('/preview', async (req, res) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
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
