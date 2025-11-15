import { db } from './db';
import { sql } from 'drizzle-orm';
import { eq, and, or, lte, isNull, inArray } from 'drizzle-orm';
import Bottleneck from 'bottleneck';
import twilio from 'twilio';
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addDays } from 'date-fns';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  throw new Error('[SMS CAMPAIGN] TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
}

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
console.log('[SMS CAMPAIGN] Twilio client initialized for campaigns');

const smsCampaigns = {
  id: 'id',
  name: 'name',
  message: 'message',
  scheduledDate: 'scheduled_date',
  sentAt: 'sent_at',
  completedAt: 'completed_at',
  status: 'status',
  targetAudience: 'target_audience',
  recipientCount: 'recipient_count',
  sentCount: 'sent_count',
  failedCount: 'failed_count',
  deliveredCount: 'delivered_count',
  fromNumber: 'from_number',
  estimatedSegments: 'estimated_segments',
  createdAt: 'created_at',
  createdBy: 'created_by'
};

const smsCampaignRecipients = {
  id: 'id',
  campaignId: 'campaign_id',
  customerId: 'customer_id',
  phoneNumber: 'phone_number',
  status: 'status',
  scheduledFor: 'scheduled_for',
  sentAt: 'sent_at',
  deliveredAt: 'delivered_at',
  failedAt: 'failed_at',
  attemptCount: 'attempt_count',
  lastError: 'last_error',
  twilioSid: 'twilio_sid',
  deliveryStatusId: 'delivery_status_id',
  timezone: 'timezone',
  metadata: 'metadata',
  createdAt: 'created_at'
};

const dailySendCounters = {
  id: 'id',
  counterDate: 'counter_date',
  smsCount: 'sms_count',
  smsLimit: 'sms_limit',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
};

const smsSuppressionList = {
  id: 'id',
  phoneNumber: 'phone_number',
  reason: 'reason',
  addedAt: 'added_at'
};

// Twilio rate limiter - 600 requests/min
const twilioLimiter = new Bottleneck({
  reservoir: 600,
  reservoirRefreshAmount: 600,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 10,
  minTime: 100
});

console.log('[SMS CAMPAIGN] Bottleneck rate limiter initialized: 600 req/min for Twilio API');

/**
 * TCPA Compliance: Check if current time is within quiet hours (9 PM - 8 AM) for a timezone
 * Uses date-fns-tz formatInTimeZone for timezone-aware hour extraction
 */
function isQuietHours(timezone: string = 'America/Chicago'): boolean {
  const now = new Date();
  
  // Get hour in recipient's timezone using formatInTimeZone (avoids server-timezone drift)
  const hourStr = formatInTimeZone(now, timezone, 'H');
  const hour = parseInt(hourStr, 10);
  
  // Quiet hours: 9 PM (21:00) to 8 AM (08:00)
  return hour >= 21 || hour < 8;
}

/**
 * Calculate when quiet hours end for a timezone
 * Returns Date object (in UTC) for next 8 AM in that timezone
 * Ensures the returned time is strictly in the future
 */
function getNextSendTime(timezone: string = 'America/Chicago'): Date {
  const now = new Date();
  
  // Get current date/time in recipient's timezone
  const dateStr = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  const hourStr = formatInTimeZone(now, timezone, 'H');
  const hour = parseInt(hourStr, 10);
  
  // Build 8 AM date string in recipient's timezone
  let targetDateStr = `${dateStr} 08:00:00`;
  
  // If we're at or past 8 AM local time, schedule for tomorrow
  if (hour >= 8) {
    const tomorrow = addDays(now, 1);
    const tomorrowDateStr = formatInTimeZone(tomorrow, timezone, 'yyyy-MM-dd');
    targetDateStr = `${tomorrowDateStr} 08:00:00`;
  }
  
  // fromZonedTime accepts a Date object and interprets it AS IF it were in the target timezone
  // We need to create a Date with the exact values we want (8 AM on target date)
  // The Date constructor uses LOCAL timezone, but fromZonedTime will reinterpret it
  const parts = targetDateStr.split(/[\s:-]/).map(p => parseInt(p));
  
  // Create a Date using the values we want (year, month-1, day, hour, minute, second)
  // This Date will be WRONG in absolute time (it's in server timezone)
  // But fromZonedTime will reinterpret these component values as being in the target timezone
  const dateWithTargetComponents = new Date(
    parts[0],      // year
    parts[1] - 1,  // month (0-indexed)
    parts[2],      // day  
    parts[3],      // hour = 8
    parts[4],      // minute = 0
    parts[5]       // second = 0
  );
  
  // fromZonedTime takes this date's components (year, month, day, 8, 0, 0)
  // and interprets them as being in the target timezone, then converts to UTC
  const nextSendUtc = fromZonedTime(dateWithTargetComponents, timezone);
  
  // Safety check: ensure scheduled time is strictly in the future
  if (nextSendUtc <= now) {
    // Add 24 hours if we somehow got a past time
    return addDays(nextSendUtc, 1);
  }
  
  return nextSendUtc;
}

/**
 * Estimate SMS segments (160 chars = 1 segment, 70 for Unicode)
 */
function estimateSmsSegments(message: string): number {
  // Check for Unicode characters
  const hasUnicode = /[^\x00-\x7F]/.test(message);
  const charLimit = hasUnicode ? 70 : 160;
  
  return Math.ceil(message.length / charLimit);
}

/**
 * Atomically increment SMS counter with daily limit check
 * Returns true if increment succeeded, false if limit reached
 */
async function incrementSmsCounterAtomic(): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db.execute(sql`
    UPDATE daily_send_counters
    SET 
      sms_count = sms_count + 1,
      updated_at = NOW()
    WHERE 
      counter_date = ${today.toISOString().split('T')[0]}::date
      AND sms_count < sms_limit
    RETURNING sms_count, sms_limit
  `);
  
  if (result.rows.length === 0) {
    console.log('[SMS CAMPAIGN] Daily SMS limit reached');
    return false;
  }
  
  const { sms_count, sms_limit } = result.rows[0] as { sms_count: number; sms_limit: number };
  console.log(`[SMS CAMPAIGN] Daily SMS counter: ${sms_count}/${sms_limit}`);
  
  return true;
}

/**
 * Get recipients based on target audience
 */
async function getRecipientsByAudience(targetAudience: string): Promise<Array<{ phone: string; customerId?: number; timezone?: string }>> {
  if (targetAudience === 'all') {
    const result = await db.execute(sql`
      SELECT 
        c.id as customer_id,
        c.phone_number as phone,
        COALESCE(c.timezone, 'America/Chicago') as timezone
      FROM customers c
      WHERE c.phone_number IS NOT NULL 
        AND c.phone_number != ''
        AND c.sms_consent = true
    `);
    
    return result.rows.map((row: any) => ({
      phone: row.phone,
      customerId: row.customer_id,
      timezone: row.timezone || 'America/Chicago'
    }));
  } else if (targetAudience === 'vip') {
    const result = await db.execute(sql`
      SELECT 
        c.id as customer_id,
        c.phone_number as phone,
        COALESCE(c.timezone, 'America/Chicago') as timezone
      FROM customers c
      WHERE c.phone_number IS NOT NULL 
        AND c.phone_number != ''
        AND c.sms_consent = true
        AND c.is_vip = true
    `);
    
    return result.rows.map((row: any) => ({
      phone: row.phone,
      customerId: row.customer_id,
      timezone: row.timezone || 'America/Chicago'
    }));
  } else if (targetAudience === 'loyalty') {
    const result = await db.execute(sql`
      SELECT 
        c.id as customer_id,
        c.phone_number as phone,
        COALESCE(c.timezone, 'America/Chicago') as timezone
      FROM customers c
      WHERE c.phone_number IS NOT NULL 
        AND c.phone_number != ''
        AND c.sms_consent = true
        AND c.loyalty_points > 0
    `);
    
    return result.rows.map((row: any) => ({
      phone: row.phone,
      customerId: row.customer_id,
      timezone: row.timezone || 'America/Chicago'
    }));
  }
  
  return [];
}

/**
 * Create campaign recipients in database
 */
async function populateCampaignRecipients(campaignId: number, targetAudience: string): Promise<number> {
  const recipients = await getRecipientsByAudience(targetAudience);
  
  if (recipients.length === 0) {
    throw new Error('No recipients found for target audience');
  }
  
  for (const recipient of recipients) {
    await db.execute(sql`
      INSERT INTO sms_campaign_recipients (
        campaign_id, 
        customer_id, 
        phone_number,
        timezone,
        status,
        attempt_count
      ) VALUES (
        ${campaignId},
        ${recipient.customerId || null},
        ${recipient.phone},
        ${recipient.timezone || 'America/Chicago'},
        'pending',
        0
      )
    `);
  }
  
  // Update campaign recipient count
  await db.execute(sql`
    UPDATE sms_campaigns
    SET recipient_count = ${recipients.length}
    WHERE id = ${campaignId}
  `);
  
  return recipients.length;
}

/**
 * Process all scheduled SMS campaigns (called by cron)
 */
export async function processSMSCampaigns() {
  try {
    console.log('[SMS CAMPAIGN] Processing scheduled campaigns...');
    
    const now = new Date();
    
    // Find campaigns scheduled for now or earlier that aren't completed
    const campaigns = await db.execute(sql`
      SELECT * FROM sms_campaigns
      WHERE status = 'scheduled'
        AND scheduled_date <= ${now.toISOString()}
      ORDER BY scheduled_date ASC
    `);
    
    if (campaigns.rows.length === 0) {
      console.log('[SMS CAMPAIGN] No campaigns to process');
      return;
    }
    
    console.log(`[SMS CAMPAIGN] Found ${campaigns.rows.length} campaign(s) to process`);
    
    for (const campaign of campaigns.rows) {
      await processSingleCampaign(campaign);
    }
    
  } catch (error) {
    console.error('[SMS CAMPAIGN] Error processing campaigns:', error);
  }
}

/**
 * Process a single campaign
 */
async function processSingleCampaign(campaign: any) {
  try {
    console.log(`[SMS CAMPAIGN] Processing campaign: ${campaign.name} (ID: ${campaign.id})`);
    
    // Update status to sending
    await db.execute(sql`
      UPDATE sms_campaigns
      SET status = 'sending'
      WHERE id = ${campaign.id}
    `);
    
    // Get pending recipients (including deferred ones whose scheduledFor has arrived)
    const recipients = await db.execute(sql`
      SELECT * FROM sms_campaign_recipients
      WHERE campaign_id = ${campaign.id}
        AND status = 'pending'
        AND (scheduled_for IS NULL OR scheduled_for <= NOW())
        AND attempt_count < 3
      ORDER BY scheduled_for ASC NULLS FIRST
      LIMIT 50
    `);
    
    if (recipients.rows.length === 0) {
      // Check if campaign is complete (all recipients in terminal states)
      const pending = await db.execute(sql`
        SELECT COUNT(*) as count FROM sms_campaign_recipients
        WHERE campaign_id = ${campaign.id}
          AND status = 'pending'
      `);
      
      if ((pending.rows[0] as any).count === 0) {
        await db.execute(sql`
          UPDATE sms_campaigns
          SET status = 'sent', completed_at = NOW()
          WHERE id = ${campaign.id}
        `);
        console.log(`[SMS CAMPAIGN] Campaign ${campaign.id} completed`);
      }
      
      return;
    }
    
    console.log(`[SMS CAMPAIGN] Processing ${recipients.rows.length} recipient(s)`);
    
    // Send to each recipient
    for (const recipient of recipients.rows) {
      await sendSingleCampaignSMS(campaign, recipient);
    }
    
  } catch (error) {
    console.error(`[SMS CAMPAIGN] Error processing campaign ${campaign.id}:`, error);
    await db.execute(sql`
      UPDATE sms_campaigns
      SET status = 'failed'
      WHERE id = ${campaign.id}
    `);
  }
}

/**
 * Send individual SMS with TCPA compliance and rate limiting
 */
async function sendSingleCampaignSMS(campaign: any, recipient: any) {
  try {
    // Check suppression list
    const suppressed = await db.execute(sql`
      SELECT * FROM sms_suppression_list
      WHERE phone_number = ${recipient.phone_number}
    `);
    
    if (suppressed.rows.length > 0) {
      console.log(`[SMS CAMPAIGN] Skipping suppressed number: ${recipient.phone_number}`);
      await db.execute(sql`
        UPDATE sms_campaign_recipients
        SET status = 'suppressed', last_error = 'Number is on suppression list'
        WHERE id = ${recipient.id}
      `);
      return;
    }
    
    // TCPA Compliance: Check quiet hours for recipient's timezone
    if (isQuietHours(recipient.timezone || 'America/Chicago')) {
      const nextSendTime = getNextSendTime(recipient.timezone || 'America/Chicago');
      console.log(`[SMS CAMPAIGN] Quiet hours for ${recipient.phone_number}, deferring until ${nextSendTime.toISOString()}`);
      
      await db.execute(sql`
        UPDATE sms_campaign_recipients
        SET 
          status = 'pending',
          scheduled_for = ${nextSendTime.toISOString()}
        WHERE id = ${recipient.id}
      `);
      return;
    }
    
    // Mark as sending
    await db.execute(sql`
      UPDATE sms_campaign_recipients
      SET status = 'sending'
      WHERE id = ${recipient.id}
    `);
    
    // Atomically claim a send slot BEFORE calling Twilio (prevents overage)
    const incrementSuccess = await incrementSmsCounterAtomic();
    
    if (!incrementSuccess) {
      // Daily limit reached - defer this recipient WITHOUT sending
      console.log(`[SMS CAMPAIGN] Daily limit reached before send, deferring ${recipient.phone_number}`);
      await db.execute(sql`
        UPDATE sms_campaign_recipients
        SET 
          status = 'pending',
          scheduled_for = ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}
        WHERE id = ${recipient.id}
      `);
      return;
    }
    
    // Personalize message (replace {name} with customer name if available)
    let personalizedMessage = campaign.message;
    if (recipient.customer_id) {
      const customer = await db.execute(sql`
        SELECT name FROM customers WHERE id = ${recipient.customer_id}
      `);
      
      if (customer.rows.length > 0) {
        const customerName = (customer.rows[0] as any).name;
        personalizedMessage = personalizedMessage.replace(/\{name\}/gi, customerName);
      }
    }
    
    // Add opt-out message
    const finalMessage = `${personalizedMessage}\n\nReply STOP to unsubscribe`;
    
    // Send with rate limiting (slot already claimed above, so we're guaranteed within limit)
    await twilioLimiter.schedule(async () => {
      // CRITICAL FIX: Use sendSMS() from notifications.ts with phoneLineId
      // Campaigns use Main Line (ID 1) for automated messages
      const { sendSMS } = await import('./notifications');
      
      const result = await sendSMS(
        recipient.phone_number,
        finalMessage,
        undefined, // conversationId
        undefined, // messageId
        1 // phoneLineId: Main Line for campaigns
      );
      
      if (!result.success) {
        throw new Error(result.error || 'SMS send failed');
      }
      
      // Update recipient status
      await db.execute(sql`
        UPDATE sms_campaign_recipients
        SET 
          status = 'sent',
          sent_at = NOW(),
          attempt_count = attempt_count + 1,
          twilio_sid = ${result.messageSid || null}
        WHERE id = ${recipient.id}
      `);
      
      // Increment campaign sent counter
      await db.execute(sql`
        UPDATE sms_campaigns
        SET sent_count = sent_count + 1
        WHERE id = ${campaign.id}
      `);
      
      console.log(`[SMS CAMPAIGN] Sent SMS to ${recipient.phone_number} (SID: ${result.messageSid})`);
    });
    
  } catch (error: any) {
    console.error(`[SMS CAMPAIGN] Error sending to ${recipient.phone_number}:`, error);
    
    const shouldRetry = recipient.attempt_count < 2;
    
    await db.execute(sql`
      UPDATE sms_campaign_recipients
      SET 
        status = ${shouldRetry ? 'pending' : 'failed'},
        attempt_count = attempt_count + 1,
        last_error = ${error.message},
        failed_at = ${shouldRetry ? null : new Date().toISOString()},
        scheduled_for = ${shouldRetry ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null}
      WHERE id = ${recipient.id}
    `);
    
    if (!shouldRetry) {
      await db.execute(sql`
        UPDATE sms_campaigns
        SET failed_count = failed_count + 1
        WHERE id = ${campaign.id}
      `);
    }
  }
}

/**
 * Create a new SMS campaign
 */
export async function createSMSCampaign(data: {
  name: string;
  message: string;
  targetAudience: string;
  scheduledDate?: Date;
  fromNumber?: string;
  createdBy?: number;
}) {
  try {
    const segments = estimateSmsSegments(data.message);
    
    const result = await db.execute(sql`
      INSERT INTO sms_campaigns (
        name,
        message,
        scheduled_date,
        status,
        target_audience,
        from_number,
        estimated_segments,
        created_by
      ) VALUES (
        ${data.name},
        ${data.message},
        ${data.scheduledDate?.toISOString() || null},
        ${data.scheduledDate ? 'scheduled' : 'draft'},
        ${data.targetAudience},
        ${data.fromNumber || process.env.TWILIO_PHONE_NUMBER || null},
        ${segments},
        ${data.createdBy || null}
      )
      RETURNING *
    `);
    
    const campaign = result.rows[0];
    
    // If scheduled, populate recipients
    if (data.scheduledDate) {
      await populateCampaignRecipients((campaign as any).id, data.targetAudience);
    }
    
    return campaign;
  } catch (error) {
    console.error('Error creating SMS campaign:', error);
    throw new Error('Failed to create SMS campaign');
  }
}

/**
 * Send campaign immediately
 */
export async function sendSMSCampaignNow(id: number) {
  try {
    const campaign = await db.execute(sql`
      SELECT * FROM sms_campaigns WHERE id = ${id}
    `);
    
    if (campaign.rows.length === 0) {
      throw new Error('Campaign not found');
    }
    
    const campaignData = campaign.rows[0] as any;
    
    if (campaignData.status === 'sent') {
      throw new Error('Campaign has already been sent');
    }
    
    // Update to scheduled with current time (triggers immediate processing by cron)
    await db.execute(sql`
      UPDATE sms_campaigns
      SET 
        status = 'scheduled',
        scheduled_date = NOW()
      WHERE id = ${id}
    `);
    
    // Populate recipients if not already done
    if (campaignData.recipient_count === 0) {
      await populateCampaignRecipients(id, campaignData.target_audience || 'all');
    }
    
    // Trigger campaign processing immediately (respects all limits and quotas)
    await processSMSCampaigns();
    
    // Return updated campaign
    const updated = await db.execute(sql`
      SELECT * FROM sms_campaigns WHERE id = ${id}
    `);
    
    return updated.rows[0];
  } catch (error) {
    console.error('Error sending SMS campaign:', error);
    throw new Error('Failed to send SMS campaign');
  }
}

/**
 * Get all campaigns
 */
export async function getAllSMSCampaigns() {
  const result = await db.execute(sql`
    SELECT * FROM sms_campaigns
    ORDER BY created_at DESC
  `);
  
  return result.rows;
}

/**
 * Get campaign by ID with recipient stats
 */
export async function getSMSCampaignById(id: number) {
  const campaign = await db.execute(sql`
    SELECT * FROM sms_campaigns WHERE id = ${id}
  `);
  
  if (campaign.rows.length === 0) {
    throw new Error('Campaign not found');
  }
  
  const recipients = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as count
    FROM sms_campaign_recipients
    WHERE campaign_id = ${id}
    GROUP BY status
  `);
  
  return {
    ...campaign.rows[0],
    recipientStats: recipients.rows
  };
}

/**
 * Cancel a scheduled campaign
 */
export async function cancelSMSCampaign(id: number) {
  try {
    const result = await db.execute(sql`
      UPDATE sms_campaigns
      SET status = 'cancelled'
      WHERE id = ${id} AND status IN ('draft', 'scheduled')
      RETURNING *
    `);
    
    if (result.rows.length === 0) {
      throw new Error('Campaign not found or already sent');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error cancelling SMS campaign:', error);
    throw new Error('Failed to cancel SMS campaign');
  }
}

/**
 * Add phone number to suppression list
 */
export async function addToSMSSuppressionList(phoneNumber: string, reason: string = 'user_request') {
  await db.execute(sql`
    INSERT INTO sms_suppression_list (phone_number, reason, added_at)
    VALUES (${phoneNumber}, ${reason}, NOW())
    ON CONFLICT (phone_number) DO NOTHING
  `);
  
  console.log(`[SMS CAMPAIGN] Added ${phoneNumber} to suppression list (reason: ${reason})`);
}

/**
 * Check if phone number is on suppression list
 */
export async function isPhoneSuppressed(phoneNumber: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM sms_suppression_list
    WHERE phone_number = ${phoneNumber}
  `);
  
  return (result.rows[0] as any).count > 0;
}
