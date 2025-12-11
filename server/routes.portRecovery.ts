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
  isQuietHours,
  getNextAllowedSendTime,
} from './services/portRecoveryService';
import { importCustomersFromSheet } from './services/customerImportFromSheetsService';
import { portRecoveryCampaigns, portRecoveryTargets } from '@shared/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { generateRewardsToken } from './routes.loyalty';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

// Store for scheduled sends (in-memory for simplicity, persists until server restart)
const scheduledSends: Map<number, { scheduledFor: Date; timer: NodeJS.Timeout }> = new Map();

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
 * 
 * OKLAHOMA COMPLIANCE: Respects quiet hours (8pm-8am CST)
 */
router.post('/campaigns/:id/run-batch', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = wrapTenantDb(db, tenantId);
    const campaignId = parseInt(req.params.id);
    const limit = parseInt(req.body.limit) || 100;
    
    const result = await runPortRecoveryBatch(tenantDb, campaignId, limit);
    
    // Check if blocked by quiet hours
    if (result.blockedByQuietHours) {
      const nextSendTime = getNextAllowedSendTime();
      const formattedTime = formatInTimeZone(nextSendTime, 'America/Chicago', 'h:mm a');
      return res.json({
        success: false,
        blockedByQuietHours: true,
        message: `Oklahoma quiet hours in effect (8pm-8am CST). SMS sending will be available after ${formattedTime} CST.`,
        nextAllowedSendTime: nextSendTime.toISOString(),
      });
    }
    
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
 * 
 * OKLAHOMA COMPLIANCE: Respects quiet hours (8pm-8am CST)
 */
router.post('/campaigns/:id/send-all', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = wrapTenantDb(db, tenantId);
    const campaignId = parseInt(req.params.id);
    
    // Check quiet hours before starting
    if (isQuietHours()) {
      const nextSendTime = getNextAllowedSendTime();
      const formattedTime = formatInTimeZone(nextSendTime, 'America/Chicago', 'h:mm a');
      return res.json({
        success: false,
        blockedByQuietHours: true,
        message: `Oklahoma quiet hours in effect (8pm-8am CST). SMS sending will be available after ${formattedTime} CST. Use "Schedule Send" to queue for 11am tomorrow.`,
        nextAllowedSendTime: nextSendTime.toISOString(),
      });
    }
    
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
      
      // Check if blocked by quiet hours mid-send
      if (result.blockedByQuietHours) {
        console.log('[PORT RECOVERY] Quiet hours started during send, stopping');
        break;
      }
      
      totalSent += result.smsSent || 0;
      totalFailed += result.errors || 0;
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

/**
 * Schedule a campaign send for a specific time (respects Oklahoma quiet hours)
 * POST /api/port-recovery/campaigns/:id/schedule-send
 * 
 * Body: { scheduledTime?: string } - ISO datetime string (defaults to 11am CST tomorrow)
 */
router.post('/campaigns/:id/schedule-send', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = wrapTenantDb(db, tenantId);
    const campaignId = parseInt(req.params.id);
    
    // Default to 11am CST tomorrow
    let scheduledTime: Date;
    if (req.body.scheduledTime) {
      scheduledTime = new Date(req.body.scheduledTime);
    } else {
      // Calculate 11am CST tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Create 11:00 AM in Oklahoma timezone and convert to UTC
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}T11:00:00`;
      scheduledTime = fromZonedTime(localDateStr, 'America/Chicago');
    }
    
    // Verify the scheduled time is not during quiet hours
    const scheduledHour = parseInt(formatInTimeZone(scheduledTime, 'America/Chicago', 'HH'), 10);
    if (scheduledHour >= 20 || scheduledHour < 8) {
      return res.status(400).json({
        success: false,
        error: 'Cannot schedule during quiet hours (8pm-8am CST). Choose a time between 8am and 8pm.',
      });
    }
    
    // Calculate milliseconds until scheduled time
    const msUntilSend = scheduledTime.getTime() - Date.now();
    if (msUntilSend < 0) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled time must be in the future',
      });
    }
    
    // Clear any existing scheduled send for this campaign
    const existing = scheduledSends.get(campaignId);
    if (existing) {
      clearTimeout(existing.timer);
      scheduledSends.delete(campaignId);
    }
    
    // Schedule the send
    const timer = setTimeout(async () => {
      console.log(`[PORT RECOVERY SCHEDULED] ⏰ Executing scheduled send for campaign ${campaignId} at ${new Date().toISOString()}`);
      
      try {
        let totalSent = 0;
        let totalFailed = 0;
        let isComplete = false;
        let iterations = 0;
        const maxIterations = 200;
        
        while (!isComplete && iterations < maxIterations) {
          iterations++;
          const result = await runPortRecoveryBatch(tenantDb, campaignId, 50);
          
          if (result.blockedByQuietHours) {
            console.log('[PORT RECOVERY SCHEDULED] Quiet hours started, stopping');
            break;
          }
          
          totalSent += result.smsSent || 0;
          totalFailed += result.errors || 0;
          isComplete = result.isComplete || false;
          
          if (!isComplete) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        console.log(`[PORT RECOVERY SCHEDULED] ✅ COMPLETED: Sent ${totalSent} SMS, ${totalFailed} failed, ${iterations} batches`);
      } catch (error: any) {
        console.error(`[PORT RECOVERY SCHEDULED] ❌ ERROR:`, error.message);
      }
      
      scheduledSends.delete(campaignId);
    }, msUntilSend);
    
    scheduledSends.set(campaignId, { scheduledFor: scheduledTime, timer });
    
    const formattedTime = formatInTimeZone(scheduledTime, 'America/Chicago', 'EEEE, MMMM d, yyyy \'at\' h:mm a');
    console.log(`[PORT RECOVERY] 📅 Scheduled send for campaign ${campaignId} at ${formattedTime} CST`);
    
    res.json({
      success: true,
      scheduledFor: scheduledTime.toISOString(),
      scheduledForLocal: formattedTime + ' CST',
      msUntilSend,
      message: `Campaign scheduled to send at ${formattedTime} CST. The server will automatically send all remaining messages at that time.`,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error scheduling send:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get scheduled send status for a campaign
 * GET /api/port-recovery/campaigns/:id/schedule-status
 */
router.get('/campaigns/:id/schedule-status', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const scheduled = scheduledSends.get(campaignId);
    
    if (!scheduled) {
      return res.json({
        success: true,
        isScheduled: false,
      });
    }
    
    const formattedTime = formatInTimeZone(scheduled.scheduledFor, 'America/Chicago', 'EEEE, MMMM d, yyyy \'at\' h:mm a');
    const msRemaining = scheduled.scheduledFor.getTime() - Date.now();
    
    res.json({
      success: true,
      isScheduled: true,
      scheduledFor: scheduled.scheduledFor.toISOString(),
      scheduledForLocal: formattedTime + ' CST',
      msRemaining,
      minutesRemaining: Math.round(msRemaining / 60000),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Cancel a scheduled send
 * POST /api/port-recovery/campaigns/:id/cancel-schedule
 */
router.post('/campaigns/:id/cancel-schedule', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const scheduled = scheduledSends.get(campaignId);
    
    if (!scheduled) {
      return res.json({
        success: true,
        message: 'No scheduled send to cancel',
      });
    }
    
    clearTimeout(scheduled.timer);
    scheduledSends.delete(campaignId);
    
    console.log(`[PORT RECOVERY] ❌ Cancelled scheduled send for campaign ${campaignId}`);
    
    res.json({
      success: true,
      message: 'Scheduled send cancelled',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Sync customers from Google Sheets and add missing ones to port recovery targets
 * POST /api/port-recovery/campaigns/:id/sync-customers
 * 
 * This pulls customers from Google Sheets Customer Database/Customer Information tabs
 * and adds any new ones to the campaign targets list.
 */
router.post('/campaigns/:id/sync-customers', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 'default';
    const tenantDb = wrapTenantDb(db, tenantId);
    const campaignId = parseInt(req.params.id);
    const dryRun = req.body.dryRun !== false; // Default to dry run for safety
    
    console.log(`[PORT RECOVERY] Starting customer sync for campaign ${campaignId} (dryRun: ${dryRun})`);
    
    // First, import customers from Google Sheets into customers table
    const importResult = await importCustomersFromSheet(tenantId, { dryRun: false });
    console.log(`[PORT RECOVERY] Sheets import: ${importResult.created} created, ${importResult.updated} updated`);
    
    // Now get all customers and find ones not already in port_recovery_targets
    const existingTargetPhones = await tenantDb.execute(sql`
      SELECT REGEXP_REPLACE(phone, '[^0-9]', '', 'g') as phone_digits
      FROM port_recovery_targets 
      WHERE campaign_id = ${campaignId} AND phone IS NOT NULL
    `);
    
    const existingPhoneSet = new Set(
      (existingTargetPhones.rows as any[]).map(r => r.phone_digits)
    );
    
    // Get all customers with phones not already in targets
    const allCustomers = await tenantDb.execute(sql`
      SELECT id, name, phone, email
      FROM customers
      WHERE tenant_id = ${tenantId}
        AND phone IS NOT NULL
        AND LENGTH(phone) > 6
    `);
    
    const newTargets: any[] = [];
    for (const customer of allCustomers.rows as any[]) {
      const phoneDigits = customer.phone?.replace(/\D/g, '');
      if (phoneDigits && !existingPhoneSet.has(phoneDigits)) {
        newTargets.push({
          campaignId,
          tenantId,
          customerId: customer.id,
          phone: customer.phone,
          email: customer.email,
          customerName: customer.name,
          source: 'customer_sync',
          smsStatus: 'pending',
          emailStatus: 'pending',
        });
      }
    }
    
    let inserted = 0;
    if (!dryRun && newTargets.length > 0) {
      // Insert in batches of 100
      for (let i = 0; i < newTargets.length; i += 100) {
        const batch = newTargets.slice(i, i + 100);
        await tenantDb.insert(portRecoveryTargets).values(batch);
        inserted += batch.length;
      }
      
      // Update campaign total targets count
      await tenantDb
        .update(portRecoveryCampaigns)
        .set({
          totalTargets: sql`${portRecoveryCampaigns.totalTargets} + ${inserted}`,
          updatedAt: new Date(),
        })
        .where(eq(portRecoveryCampaigns.id, campaignId));
      
      console.log(`[PORT RECOVERY] Added ${inserted} new targets from customer sync`);
    }
    
    res.json({
      success: true,
      sheetsImport: {
        created: importResult.created,
        updated: importResult.updated,
        totalRows: importResult.totalRows,
        errors: importResult.errors,
      },
      newTargetsFound: newTargets.length,
      targetsAdded: dryRun ? 0 : inserted,
      dryRun,
      message: dryRun 
        ? `Dry run: Found ${newTargets.length} new customers to add to campaign. Set dryRun=false to add them.`
        : `Added ${inserted} new customers to campaign targets.`,
    });
  } catch (error: any) {
    console.error('[PORT RECOVERY] Error syncing customers:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Check quiet hours status
 * GET /api/port-recovery/quiet-hours-status
 */
router.get('/quiet-hours-status', async (req, res) => {
  try {
    const inQuietHours = isQuietHours();
    const nextAllowed = getNextAllowedSendTime();
    const formattedTime = formatInTimeZone(nextAllowed, 'America/Chicago', 'h:mm a');
    const currentOklahomaTime = formatInTimeZone(new Date(), 'America/Chicago', 'h:mm a');
    
    res.json({
      success: true,
      isQuietHours: inQuietHours,
      currentOklahomaTime,
      nextAllowedSendTime: nextAllowed.toISOString(),
      nextAllowedSendTimeLocal: formattedTime + ' CST',
      quietHoursRange: '8:00 PM - 8:00 AM CST',
      message: inQuietHours 
        ? `Oklahoma quiet hours in effect. Next send allowed at ${formattedTime} CST.`
        : 'SMS sending is currently allowed.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
