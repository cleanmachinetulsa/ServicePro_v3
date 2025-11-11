import cron from 'node-cron';
import { processEmailCampaigns } from './emailCampaignService';
import { processSMSCampaigns } from './smsCampaignService';

/**
 * Initialize campaign cron job processor (email + SMS)
 * Runs every hour at :00 minutes to process scheduled campaigns
 */
export function initializeCampaignScheduler() {
  // Run every hour (at the start of each hour)
  cron.schedule('0 * * * *', async () => {
    console.log('[CAMPAIGN SCHEDULER] Running hourly campaign processing...');
    try {
      await Promise.all([
        processEmailCampaigns(),
        processSMSCampaigns()
      ]);
    } catch (error) {
      console.error('[CAMPAIGN SCHEDULER] Error processing campaigns:', error);
    }
  }, {
    timezone: 'America/Chicago' // Tulsa, OK timezone
  });
  
  console.log('[CAMPAIGN SCHEDULER] Email + SMS campaign processor scheduled (runs hourly)');
}

/**
 * Manually trigger campaign processing (for testing)
 */
export async function triggerCampaignProcessing() {
  console.log('[CAMPAIGN SCHEDULER] Manually triggering campaign processing...');
  try {
    await Promise.all([
      processEmailCampaigns(),
      processSMSCampaigns()
    ]);
    return { success: true, message: 'Campaign processing triggered successfully' };
  } catch (error: any) {
    console.error('[CAMPAIGN SCHEDULER] Error:', error);
    return { success: false, error: error.message };
  }
}
