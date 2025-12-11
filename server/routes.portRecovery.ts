/**
 * Port Recovery Campaign API Routes
 * 
 * Admin-only routes for managing one-time SMS/email recovery campaigns
 * to win back customers who may have been lost during phone number porting.
 * 
 * Part 2 of Block B: Prepare → Preview → Send workflow
 */

import { Router } from 'express';
import { wrapTenantDb } from './tenantDb';
import { db } from './db';
import {
  previewTargetList,
  createPortRecoveryCampaign,
  getCampaigns,
  getCampaign,
  getCampaignTargets,
  runPortRecoveryBatch,
  sendTestSms,
  getRecentRunHistory,
  updateCampaign,
  getOrCreateCampaignConfig,
  normalizePhone,
  getTenantPublicBaseUrl,
  backfillTargetsWithCustomerData,
} from './services/portRecoveryService';
import { portRecoveryCampaigns } from '@shared/schema';
import { eq, gte } from 'drizzle-orm';
import { generateRewardsToken } from './routes.loyalty';

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
    const tenantDb = wrapTenantDb(db, tenantId);
    
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
    
    // Get or create campaign config to use the saved template
    const campaignConfig = await getOrCreateCampaignConfig(tenantDb, tenantId, 1);
    const savedTemplate = campaignConfig.smsTemplate || DEFAULT_SMS_TEMPLATE;
    const ctaUrl = campaignConfig.ctaUrl || 'https://cleanmachinetulsa.com/book';
    const points = (campaignConfig.pointsPerCustomer || 500).toString();
    
    // Format sample SMS with personalization using saved template
    // SP-REWARDS-CAMPAIGN-TOKENS: Include sample rewards link in preview
    const sampleName = result.sampleTargets?.[0]?.customerName || 'Valued Customer';
    const rawPhone = result.sampleTargets?.[0]?.phone || '+19185551234';
    // Use production normalizePhone helper for consistent token generation
    const samplePhone = normalizePhone(rawPhone) || '+19185551234';
    const firstName = sampleName.split(' ')[0] || 'there';
    
    // Generate sample rewards link for preview using production helper for parity
    const tenantBaseUrl = await getTenantPublicBaseUrl(tenantId);
    const sampleToken = generateRewardsToken(samplePhone, tenantId, 30);
    const sampleRewardsLink = `${tenantBaseUrl}/rewards/welcome?token=${encodeURIComponent(sampleToken)}`;
    
    let sampleSms = savedTemplate
      .replace(/\{\{firstNameOrFallback\}\}/g, firstName)
      .replace(/\{\{customerName\}\}/g, sampleName)
      .replace(/\{\{ctaUrl\}\}/g, ctaUrl)
      .replace(/\{\{bookingUrl\}\}/g, ctaUrl)
      .replace(/\{\{points\}\}/g, points)
      .replace(/\{\{rewardsLink\}\}/gi, sampleRewardsLink)
      .replace(/\{rewards_link\}/gi, sampleRewardsLink);
    
    // Auto-append rewards link if not in template
    const hasRewardsLink = /\{\{rewardsLink\}\}|\{rewards_link\}/i.test(savedTemplate);
    if (!hasRewardsLink) {
      sampleSms += `\n\nView your rewards: ${sampleRewardsLink}`;
    }
    
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
      availableVariables: [
        '{{firstNameOrFallback}}',
        '{{customerName}}',
        '{{ctaUrl}}',
        '{{bookingUrl}}',
        '{{points}}',
        '{{rewardsLink}}',
        '{rewards_link}',
      ],
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
    const tenantDb = wrapTenantDb(db, tenantId);
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
 * Get campaign configuration for editing
 * GET /api/admin/port-recovery/campaign
 */
router.get('/admin/campaign', async (req, res) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
    const userId = (req.session as any)?.userId || 1;
    const tenantDb = wrapTenantDb(db, tenantId);
    
    const campaign = await getOrCreateCampaignConfig(tenantDb, tenantId, userId);
    
    res.json({
      success: true,
      campaign,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error fetching campaign config:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update campaign configuration
 * PUT /api/admin/port-recovery/campaign
 */
router.put('/admin/campaign', async (req, res) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
    const userId = (req.session as any)?.userId || 1;
    const tenantDb = wrapTenantDb(db, tenantId);
    
    const {
      campaignId,
      smsTemplate,
      emailSubject,
      emailHtmlTemplate,
      ctaUrl,
      smsEnabled,
      emailEnabled,
      pointsPerCustomer,
    } = req.body;
    
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required',
      });
    }
    
    const updatedCampaign = await updateCampaign(tenantDb, campaignId, {
      smsTemplate,
      emailSubject,
      emailHtmlTemplate,
      ctaUrl,
      smsEnabled,
      emailEnabled,
      pointsPerCustomer,
    });
    
    if (!updatedCampaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }
    
    res.json({
      success: true,
      campaign: updatedCampaign,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error updating campaign:', error);
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
    const tenantDb = wrapTenantDb(db, tenantId);
    
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
    const tenantDb = wrapTenantDb(db, tenantId);
    
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
    const tenantDb = wrapTenantDb(db, tenantId);
    
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
    const tenantDb = wrapTenantDb(db, tenantId);
    
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
    const tenantDb = wrapTenantDb(db, tenantId);
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
    const tenantDb = wrapTenantDb(db, tenantId);
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
    const tenantDb = wrapTenantDb(db, tenantId);
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
 * Send ALL remaining messages in the campaign
 * POST /api/port-recovery/campaigns/:id/send-all
 * FIXED: Returns iterations, totalFailed, smsSent, totalPoints
 */
router.post('/campaigns/:id/send-all', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = wrapTenantDb(db, tenantId);
    const campaignId = parseInt(req.params.id);
    
    let totalSent = 0;
    let totalFailed = 0;
    let totalPoints = 0;
    let isComplete = false;
    let iterations = 0;
    const maxIterations = 200; // Safety limit (200 * 50 = 10k messages)
    
    // Keep running batches until all messages are sent
    while (!isComplete && iterations < maxIterations) {
      iterations++;
      const result = await runPortRecoveryBatch(tenantDb, campaignId, 50);
      
      totalSent += result.smsSent || 0;
      totalFailed += result.smsErrors?.length || 0;
      totalPoints += result.pointsGranted || 0;
      isComplete = result.isComplete || false;
      
      // Small delay between batches to avoid overwhelming the system
      if (!isComplete) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    res.json({
      success: true,
      smsSent: totalSent,
      emailSent: 0,
      pointsGranted: totalPoints,
      totalFailed,
      isComplete,
      iterations,
      message: `Sent ${totalSent} messages${totalFailed > 0 ? ` (${totalFailed} failed)` : ''} in ${iterations} batches`,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error sending all:', error);
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
    const tenantDb = wrapTenantDb(db, tenantId);
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

/**
 * Backfill targets with customer_id and email for campaign
 * POST /api/port-recovery/campaigns/:id/backfill
 * 
 * This uses improved phone matching (digits-only) to:
 * 1. Match targets to customer records by phone
 * 2. Populate missing emails from customer records
 * 3. Award points to matched customers who haven't received them yet
 */
router.post('/campaigns/:id/backfill', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = wrapTenantDb(db, tenantId);
    const campaignId = parseInt(req.params.id);
    
    console.log(`[PORT RECOVERY] Starting backfill for campaign ${campaignId}`);
    
    const result = await backfillTargetsWithCustomerData(tenantDb, campaignId);
    
    res.json({
      success: true,
      ...result,
      message: `Backfill complete: ${result.customersMatched} customers matched, ${result.emailsPopulated} emails populated, ${result.pointsAwarded} points awarded`,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error running backfill:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
