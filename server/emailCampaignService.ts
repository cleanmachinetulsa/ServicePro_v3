import type { TenantDb } from './tenantDb';
import { MailService } from '@sendgrid/mail';
import { 
  customers,
  emailCampaigns,
  emailTemplates,
  emailSubscribers,
  campaignRecipients,
  emailSuppressionList,
  dailySendCounters,
  type InsertEmailCampaign,
  type InsertEmailTemplate
} from '@shared/schema';
import { eq, ne, gt, lt, and, desc, sql, inArray, lte } from 'drizzle-orm';
import OpenAI from 'openai';
import Bottleneck from 'bottleneck';

// Initialize SendGrid
const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY || '');

// Initialize OpenAI for content generation
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;

if (!OPENAI_ENABLED) {
  console.warn('[OPENAI] OPENAI_API_KEY not found in emailCampaignService, AI content generation will be disabled');
}

const openai = OPENAI_ENABLED ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }) : null;

// Rate limiter: Respects both SendGrid API limits (600 req/min) and tier limits (50-100/day)
// Dynamic configuration based on remaining daily capacity
const sendGridLimiter = new Bottleneck({
  reservoir: 600, // API rate limit: 600 req/min max
  reservoirRefreshAmount: 600,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 5, // Max 5 concurrent requests
  minTime: 100, // Min 100ms between requests (10 req/sec)
});

/**
 * Check remaining capacity before scheduling send
 * Ensures we never exceed daily tier limits
 */
async function checkDailyCapacityBeforeSend(tenantDb: TenantDb): Promise<boolean> {
  const counter = await getTodaySendCounter(tenantDb);
  const remaining = counter.emailLimit - counter.emailCount;
  
  if (remaining <= 0) {
    console.log(`[EMAIL CAMPAIGN] Daily limit reached (${counter.emailCount}/${counter.emailLimit})`);
    return false;
  }
  
  return true;
}

// Interface for campaign data
export interface CampaignData {
  id?: number;
  name: string;
  subject: string;
  content: string;
  scheduledDate: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  targetAudience: string;
  recipientCount: number;
}

// Interface for template data
export interface TemplateData {
  id?: number;
  name: string;
  subject: string;
  content: string;
  category: string;
}

/**
 * Get all email campaigns
 */
export async function getAllCampaigns(tenantDb: TenantDb) {
  try {
    return await tenantDb.query.emailCampaigns.findMany({
      where: tenantDb.withTenantFilter(emailCampaigns),
      orderBy: desc(emailCampaigns.createdAt)
    });
  } catch (error) {
    console.error('Error getting campaigns:', error);
    throw new Error('Failed to retrieve email campaigns');
  }
}

/**
 * Get campaign by ID
 */
export async function getCampaignById(tenantDb: TenantDb, id: number) {
  try {
    const campaign = await tenantDb.query.emailCampaigns.findFirst({
      where: tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id))
    });
    
    return campaign || null;
  } catch (error) {
    console.error('Error getting campaign by ID:', error);
    throw new Error('Failed to retrieve email campaign');
  }
}

/**
 * Create a new email campaign with recipient population
 */
export async function createCampaign(tenantDb: TenantDb, campaignData: CampaignData & { createdBy: number }) {
  try {
    const insertData: InsertEmailCampaign = {
      name: campaignData.name,
      subject: campaignData.subject,
      content: campaignData.content,
      scheduledDate: campaignData.scheduledDate ? new Date(campaignData.scheduledDate) : null,
      status: campaignData.status,
      targetAudience: campaignData.targetAudience,
      recipientCount: 0,
      createdBy: campaignData.createdBy
    };
    
    const [newCampaign] = await tenantDb.insert(emailCampaigns).values(insertData).returning();
    
    // Populate recipients based on target audience
    await populateCampaignRecipients(tenantDb, newCampaign.id, campaignData.targetAudience);
    
    // If scheduled for immediate send, update status
    if (campaignData.status === 'scheduled' && new Date(campaignData.scheduledDate!) <= new Date()) {
      await tenantDb
        .update(emailCampaigns)
        .set({ status: 'scheduled' })
        .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, newCampaign.id)));
    }
    
    return newCampaign;
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw new Error('Failed to create email campaign');
  }
}

/**
 * Populate campaign recipients based on target audience
 */
async function populateCampaignRecipients(tenantDb: TenantDb, campaignId: number, targetAudience: string) {
  // Get recipients based on target audience
  const recipients = await getRecipientsByAudience(tenantDb, targetAudience);
  
  if (recipients.length === 0) {
    return;
  }
  
  // Insert recipients
  await tenantDb.insert(campaignRecipients).values(
    recipients.map((recipient: any) => ({
      campaignId,
      customerId: recipient.id,
      email: recipient.email,
      status: 'pending' as const,
    }))
  );
  
  // Update campaign recipient count
  await tenantDb
    .update(emailCampaigns)
    .set({ recipientCount: recipients.length })
    .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, campaignId)));
}

/**
 * Get or create today's send counter
 */
async function getTodaySendCounter(tenantDb: TenantDb) {
  const today = new Date().toISOString().split('T')[0];
  
  const [counter] = await tenantDb
    .select()
    .from(dailySendCounters)
    .where(tenantDb.withTenantFilter(dailySendCounters, eq(dailySendCounters.date, today)))
    .limit(1);
  
  if (counter) {
    return counter;
  }
  
  // Create new counter for today
  const [newCounter] = await tenantDb
    .insert(dailySendCounters)
    .values({
      date: today,
      emailCount: 0,
      smsCount: 0,
      emailLimit: 50, // Free tier: 50/day for campaigns
      smsLimit: 200,
    })
    .returning();
  
  return newCounter;
}

/**
 * Check if we can send more emails today
 */
async function canSendEmail(tenantDb: TenantDb): Promise<boolean> {
  const counter = await getTodaySendCounter(tenantDb);
  return counter.emailCount < counter.emailLimit;
}

/**
 * Atomically increment today's email counter with daily limit check
 * Returns true if increment succeeded (within limit), false if limit reached
 */
async function incrementEmailCounterAtomic(tenantDb: TenantDb): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  
  // Atomic update: only increment if under limit
  const result = await tenantDb
    .update(dailySendCounters)
    .set({
      emailCount: sql`${dailySendCounters.emailCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      tenantDb.withTenantFilter(
        dailySendCounters,
        and(
          eq(dailySendCounters.date, today),
          sql`${dailySendCounters.emailCount} < ${dailySendCounters.emailLimit}`
        )
      )
    )
    .returning();
  
  // If no rows updated, limit was reached
  return result.length > 0;
}

/**
 * Process email campaigns - called by cron job hourly
 */
export async function processEmailCampaigns(tenantDb: TenantDb) {
  console.log('[EMAIL CAMPAIGN] Starting hourly processing...');
  
  // Check daily limit
  const canSend = await canSendEmail(tenantDb);
  if (!canSend) {
    const counter = await getTodaySendCounter(tenantDb);
    console.log(`[EMAIL CAMPAIGN] Daily limit reached (${counter.emailCount}/${counter.emailLimit})`);
    return;
  }
  
  // Find campaigns in 'scheduled' or 'sending' status
  const activeCampaigns = await tenantDb
    .select()
    .from(emailCampaigns)
    .where(
      tenantDb.withTenantFilter(
        emailCampaigns,
        and(
          inArray(emailCampaigns.status, ['scheduled', 'sending']),
          lte(emailCampaigns.scheduledDate, new Date())
        )
      )
    )
    .orderBy(emailCampaigns.scheduledDate)
    .limit(5);
  
  if (activeCampaigns.length === 0) {
    console.log('[EMAIL CAMPAIGN] No active campaigns to process');
    return;
  }
  
  console.log(`[EMAIL CAMPAIGN] Found ${activeCampaigns.length} active campaigns`);
  
  for (const campaign of activeCampaigns) {
    await processSingleCampaign(tenantDb, campaign);
  }
}

/**
 * Process individual campaign - send batch of emails
 */
async function processSingleCampaign(tenantDb: TenantDb, campaign: any) {
  console.log(`[EMAIL CAMPAIGN] Processing campaign ${campaign.id}: ${campaign.name}`);
  
  // Update status to 'sending' if 'scheduled'
  if (campaign.status === 'scheduled') {
    await tenantDb
      .update(emailCampaigns)
      .set({ status: 'sending', sentAt: new Date() })
      .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, campaign.id)));
  }
  
  // Get counter to check remaining capacity
  const counter = await getTodaySendCounter(tenantDb);
  const remainingCapacity = counter.emailLimit - counter.emailCount;
  
  if (remainingCapacity <= 0) {
    console.log(`[EMAIL CAMPAIGN] No remaining capacity today`);
    return;
  }
  
  // Get pending recipients with row locking (respecting scheduledFor deferrals)
  const now = new Date();
  const pendingRecipients = await tenantDb
    .select()
    .from(campaignRecipients)
    .where(
      tenantDb.withTenantFilter(
        campaignRecipients,
        and(
          eq(campaignRecipients.campaignId, campaign.id),
          eq(campaignRecipients.status, 'pending'),
          // Only select recipients whose scheduledFor time has passed (or is null)
          sql`(${campaignRecipients.scheduledFor} IS NULL OR ${campaignRecipients.scheduledFor} <= ${now})`
        )
      )
    )
    .limit(remainingCapacity)
    .for('update', { skipLocked: true });
  
  if (pendingRecipients.length === 0) {
    // Check if campaign is complete (no pending recipients remaining)
    const [stats] = await tenantDb
      .select({
        total: sql<number>`COUNT(*)::int`,
        pending: sql<number>`COUNT(CASE WHEN ${campaignRecipients.status} = 'pending' THEN 1 END)::int`
      })
      .from(campaignRecipients)
      .where(tenantDb.withTenantFilter(campaignRecipients, eq(campaignRecipients.campaignId, campaign.id)));
    
    // Campaign is complete when there are no pending recipients
    // (all have reached terminal states: sent, delivered, bounced, unsubscribed, complained, failed)
    if (stats && stats.pending === 0) {
      await tenantDb
        .update(emailCampaigns)
        .set({ status: 'sent', completedAt: new Date() })
        .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, campaign.id)));
      
      console.log(`[EMAIL CAMPAIGN] Campaign ${campaign.id} completed`);
    }
    return;
  }
  
  console.log(`[EMAIL CAMPAIGN] Sending ${pendingRecipients.length} emails for campaign ${campaign.id}`);
  
  // Send emails with rate limiting
  for (const recipient of pendingRecipients) {
    await sendSingleCampaignEmail(tenantDb, campaign, recipient);
  }
}

/**
 * Send individual campaign email with rate limiting and tracking
 */
async function sendSingleCampaignEmail(tenantDb: TenantDb, campaign: any, recipient: any) {
  try {
    // Check suppression list
    const [suppressed] = await tenantDb
      .select()
      .from(emailSuppressionList)
      .where(tenantDb.withTenantFilter(emailSuppressionList, eq(emailSuppressionList.email, recipient.email)))
      .limit(1);
    
    if (suppressed) {
      console.log(`[EMAIL CAMPAIGN] Email ${recipient.email} is suppressed (${suppressed.reason})`);
      
      await tenantDb
        .update(campaignRecipients)
        .set({ 
          status: suppressed.reason === 'unsubscribe' ? 'unsubscribed' : 'bounced',
          attemptCount: sql`${campaignRecipients.attemptCount} + 1`,
          lastError: `Suppressed: ${suppressed.reason}`,
        })
        .where(tenantDb.withTenantFilter(campaignRecipients, eq(campaignRecipients.id, recipient.id)));
      
      return;
    }
    
    // Mark as sending
    await tenantDb
      .update(campaignRecipients)
      .set({ status: 'sending' })
      .where(tenantDb.withTenantFilter(campaignRecipients, eq(campaignRecipients.id, recipient.id)));
    
    // Personalize content
    const personalizedContent = personalizeCampaignContent(campaign.content, recipient);
    
    // Build unsubscribe link with production-ready domain
    // Required for CAN-SPAM compliance - must be a working one-click unsubscribe
    let baseDomain = process.env.PUBLIC_URL || 
                     process.env.REPLIT_DEV_DOMAIN || 
                     'clean-machine-auto-detail.replit.app';
    // Strip protocol if present (PUBLIC_URL might include https://)
    baseDomain = baseDomain.replace(/^https?:\/\//, '');
    const unsubscribeUrl = `https://${baseDomain}/api/email/unsubscribe?email=${encodeURIComponent(recipient.email)}&campaign=${campaign.id}`;
    const contentWithFooter = `${personalizedContent}<br><br><p style="font-size: 12px; color: #666;">Don't want to receive these emails? <a href="${unsubscribeUrl}">Unsubscribe</a></p>`;
    
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@cleanmachinetulsa.com';
    
    // Atomically claim a send slot BEFORE calling SendGrid (prevents overage)
    const incrementSuccess = await incrementEmailCounterAtomic(tenantDb);
    
    if (!incrementSuccess) {
      // Daily limit reached - defer this recipient WITHOUT sending
      console.log(`[EMAIL CAMPAIGN] Daily limit reached before send, deferring ${recipient.email}`);
      await tenantDb
        .update(campaignRecipients)
        .set({ 
          status: 'pending',
          scheduledFor: new Date(Date.now() + 60 * 60 * 1000), // Try again in 1 hour
        })
        .where(tenantDb.withTenantFilter(campaignRecipients, eq(campaignRecipients.id, recipient.id)));
      return;
    }
    
    // Send with rate limiting (slot already claimed above, so we're guaranteed within limit)
    await sendGridLimiter.schedule(async () => {
      const msg = {
        to: recipient.email,
        from: fromEmail,
        subject: campaign.subject,
        html: contentWithFooter,
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        },
        customArgs: {
          campaign_id: campaign.id.toString(),
          recipient_id: recipient.id.toString()
        }
      };
      
      const [response] = await mailService.send(msg);
      
      // Update recipient status
      await tenantDb
        .update(campaignRecipients)
        .set({ 
          status: 'sent',
          sentAt: new Date(),
          attemptCount: sql`${campaignRecipients.attemptCount} + 1`,
          messageSid: response.headers['x-message-id'] as string || null,
        })
        .where(tenantDb.withTenantFilter(campaignRecipients, eq(campaignRecipients.id, recipient.id)));
      
      // Increment campaign sent counter
      await tenantDb
        .update(emailCampaigns)
        .set({ sentCount: sql`${emailCampaigns.sentCount} + 1` })
        .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, campaign.id)));
      
      console.log(`[EMAIL CAMPAIGN] Sent email to ${recipient.email}`);
    });
  } catch (error: any) {
    console.error(`[EMAIL CAMPAIGN] Error sending to ${recipient.email}:`, error);
    
    const shouldRetry = recipient.attemptCount < 2;
    
    await tenantDb
      .update(campaignRecipients)
      .set({ 
        status: shouldRetry ? 'pending' : 'failed',
        attemptCount: sql`${campaignRecipients.attemptCount} + 1`,
        lastError: error.message,
        scheduledFor: shouldRetry ? new Date(Date.now() + 60 * 60 * 1000) : null,
      })
      .where(tenantDb.withTenantFilter(campaignRecipients, eq(campaignRecipients.id, recipient.id)));
    
    if (!shouldRetry) {
      await tenantDb
        .update(emailCampaigns)
        .set({ failedCount: sql`${emailCampaigns.failedCount} + 1` })
        .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, campaign.id)));
    }
  }
}

/**
 * Update an existing campaign
 */
export async function updateCampaign(tenantDb: TenantDb, id: number, campaignData: Partial<CampaignData>) {
  try {
    const [campaign] = await tenantDb
      .select()
      .from(emailCampaigns)
      .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id)));
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    // Don't allow updates to sent campaigns
    if (campaign.status === 'sent') {
      throw new Error('Cannot update a campaign that has already been sent');
    }
    
    const updateData: Partial<InsertEmailCampaign> = {
      name: campaignData.name,
      subject: campaignData.subject,
      content: campaignData.content,
      status: campaignData.status,
      targetAudience: campaignData.targetAudience,
      recipientCount: campaignData.recipientCount
    };
    
    if (campaignData.scheduledDate) {
      updateData.scheduledDate = new Date(campaignData.scheduledDate);
      
      // If status changed to scheduled, set up the job
      if (campaignData.status === 'scheduled' && campaign.status !== 'scheduled') {
        scheduleEmailCampaign(tenantDb, id, new Date(campaignData.scheduledDate));
      }
    }
    
    const [updatedCampaign] = await tenantDb
      .update(emailCampaigns)
      .set(updateData)
      .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id)))
      .returning();
    
    return updatedCampaign;
  } catch (error) {
    console.error('Error updating campaign:', error);
    throw new Error('Failed to update email campaign');
  }
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(tenantDb: TenantDb, id: number) {
  try {
    const [campaign] = await tenantDb
      .select()
      .from(emailCampaigns)
      .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id)));
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    // Don't allow deletion of sent campaigns
    if (campaign.status === 'sent') {
      throw new Error('Cannot delete a campaign that has already been sent');
    }
    
    await tenantDb
      .delete(emailCampaigns)
      .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id)));
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw new Error('Failed to delete email campaign');
  }
}

/**
 * Cancel a scheduled campaign
 */
export async function cancelCampaign(tenantDb: TenantDb, id: number) {
  try {
    const [campaign] = await tenantDb
      .select()
      .from(emailCampaigns)
      .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id)));
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    if (campaign.status !== 'scheduled') {
      throw new Error('Only scheduled campaigns can be cancelled');
    }
    
    const [cancelledCampaign] = await tenantDb
      .update(emailCampaigns)
      .set({ status: 'cancelled' })
      .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id)))
      .returning();
    
    return cancelledCampaign;
  } catch (error) {
    console.error('Error cancelling campaign:', error);
    throw new Error('Failed to cancel email campaign');
  }
}

/**
 * Send a campaign immediately (schedules for immediate processing via cron)
 * Routes through same limiter path to respect daily quotas
 */
export async function sendCampaignNow(tenantDb: TenantDb, id: number) {
  try {
    const [campaign] = await tenantDb
      .select()
      .from(emailCampaigns)
      .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id)));
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    if (campaign.status === 'sent') {
      throw new Error('Campaign has already been sent');
    }
    
    // Update campaign to scheduled status with current time (triggers immediate processing by cron)
    await tenantDb
      .update(emailCampaigns)
      .set({ 
        status: 'scheduled',
        scheduledDate: new Date() // Set to now for immediate processing
      })
      .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id)));
    
    // Populate recipients if not already done
    if (campaign.recipientCount === 0) {
      await populateCampaignRecipients(tenantDb, id, campaign.targetAudience || 'all');
    }
    
    // Trigger campaign processing immediately (respects all limits and quotas)
    await processEmailCampaigns(tenantDb);
    
    // Return updated campaign
    const updatedCampaign = await tenantDb.query.emailCampaigns.findFirst({
      where: tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, id))
    });
    
    return updatedCampaign;
  } catch (error) {
    console.error('Error sending campaign:', error);
    throw new Error('Failed to send email campaign');
  }
}

/**
 * Get all templates
 */
export async function getAllTemplates(tenantDb: TenantDb) {
  try {
    return await tenantDb.query.emailTemplates.findMany({
      where: tenantDb.withTenantFilter(emailTemplates),
      orderBy: desc(emailTemplates.lastUsed)
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    throw new Error('Failed to retrieve email templates');
  }
}

/**
 * Create a new template
 */
export async function createTemplate(tenantDb: TenantDb, templateData: TemplateData) {
  try {
    const insertData: InsertEmailTemplate = {
      name: templateData.name,
      subject: templateData.subject,
      content: templateData.content,
      category: templateData.category
    };
    
    const [newTemplate] = await tenantDb.insert(emailTemplates).values(insertData).returning();
    return newTemplate;
  } catch (error) {
    console.error('Error creating template:', error);
    throw new Error('Failed to create email template');
  }
}

/**
 * Update a template
 */
export async function updateTemplate(tenantDb: TenantDb, id: number, templateData: Partial<TemplateData>) {
  try {
    const [template] = await tenantDb
      .select()
      .from(emailTemplates)
      .where(tenantDb.withTenantFilter(emailTemplates, eq(emailTemplates.id, id)));
    
    if (!template) {
      throw new Error('Template not found');
    }
    
    const [updatedTemplate] = await tenantDb
      .update(emailTemplates)
      .set({
        name: templateData.name ?? template.name,
        subject: templateData.subject ?? template.subject,
        content: templateData.content ?? template.content,
        category: templateData.category ?? template.category,
      })
      .where(tenantDb.withTenantFilter(emailTemplates, eq(emailTemplates.id, id)))
      .returning();
    
    return updatedTemplate;
  } catch (error) {
    console.error('Error updating template:', error);
    throw new Error('Failed to update email template');
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(tenantDb: TenantDb, id: number) {
  try {
    await tenantDb
      .delete(emailTemplates)
      .where(tenantDb.withTenantFilter(emailTemplates, eq(emailTemplates.id, id)));
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting template:', error);
    throw new Error('Failed to delete email template');
  }
}

/**
 * Get all customers for email campaigns
 */
export async function getEmailCustomers(tenantDb: TenantDb) {
  try {
    // First try to get customers from the database
    let customerList: Array<{ id: number; name: string; email: string | null; phone: string | null }> = [];
    try {
      customerList = await tenantDb
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone
        })
        .from(customers)
        .where(
          tenantDb.withTenantFilter(
            customers,
            and(
              sql`${customers.email} IS NOT NULL`,
              sql`${customers.email} != ''`
            )
          )
        );
    } catch (dbError) {
      console.log('Database query for customers failed, will use Google Sheets instead:', dbError);
      customerList = [];
    }
    
    // If no customers from database, fetch from Google Sheets
    if (customerList.length === 0) {
      try {
        // Import the customer search function
        const { getAllCustomers } = await import('./customerSearch');
        const sheetCustomers = await getAllCustomers();
        
        // Map sheet customers to our expected format
        customerList = sheetCustomers
          .filter(customer => customer.email && customer.email.trim() !== '')
          .map(customer => ({
            id: parseInt(customer.id || String(Date.now() + Math.floor(Math.random() * 1000))),
            name: customer.name || 'Unknown',
            email: customer.email,
            phone: customer.phone || ''
          }));
      } catch (sheetError) {
        console.error('Error fetching customers from Google Sheets:', sheetError);
      }
    }
    
    // Get unsubscribed list
    const unsubscribed = await tenantDb
      .select({
        email: emailSubscribers.email
      })
      .from(emailSubscribers)
      .where(tenantDb.withTenantFilter(emailSubscribers, eq(emailSubscribers.subscribed, false)));
    
    const unsubscribedEmails = new Set(unsubscribed.map(u => u.email.toLowerCase()));
    
    // Mark customers as unsubscribed
    return customerList.map(customer => ({
      ...customer,
      unsubscribed: customer.email ? unsubscribedEmails.has(customer.email.toLowerCase()) : false
    }));
  } catch (error) {
    console.error('Error getting email customers:', error);
    throw new Error('Failed to retrieve email customers');
  }
}

/**
 * Generate email content using AI
 */
export async function generateEmailContent(prompt: string, template?: string) {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const contextTemplate = template ? `Use this as inspiration: ${template}` : '';
    const systemPrompt = `You are an expert email marketing copywriter for an auto detailing business called "Clean Machine". 
    Write compelling email marketing content that converts. Your content should be concise, engaging, and focused on the customer benefits.
    Include a subject line and email body content. Format the response as a JSON object with 'subject' and 'content' fields.
    ${contextTemplate}`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content generated');
    }
    
    try {
      const parsed = JSON.parse(content);
      return {
        subject: parsed.subject || 'Your Clean Machine Special Offer',
        content: parsed.content || 'Content could not be generated.'
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Extract subject and content if possible
      const subjectMatch = content.match(/subject[":]+\s*"([^"]+)"/i);
      const contentMatch = content.match(/content[":]+\s*"([^"]+)"/i);
      
      return {
        subject: subjectMatch ? subjectMatch[1] : 'Your Clean Machine Special Offer',
        content: contentMatch ? contentMatch[1] : content
      };
    }
  } catch (error) {
    console.error('Error generating email content:', error);
    throw new Error('Failed to generate email content');
  }
}

/**
 * Subscribe or unsubscribe a customer from email campaigns
 */
export async function updateSubscription(tenantDb: TenantDb, email: string, subscribed: boolean) {
  try {
    // Check if subscriber exists
    const [existing] = await tenantDb
      .select()
      .from(emailSubscribers)
      .where(tenantDb.withTenantFilter(emailSubscribers, eq(emailSubscribers.email, email.toLowerCase())));
    
    if (existing) {
      // Update existing
      await tenantDb
        .update(emailSubscribers)
        .set({ subscribed })
        .where(tenantDb.withTenantFilter(emailSubscribers, eq(emailSubscribers.email, email.toLowerCase())));
    } else {
      // Create new
      await tenantDb
        .insert(emailSubscribers)
        .values({
          email: email.toLowerCase(),
          subscribed,
          unsubscribedAt: subscribed ? null : new Date()
        });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw new Error('Failed to update subscription');
  }
}

/**
 * Schedule an email campaign for future sending
 */
function scheduleEmailCampaign(tenantDb: TenantDb, campaignId: number, scheduledDate: Date) {
  const now = new Date();
  const delay = scheduledDate.getTime() - now.getTime();
  
  if (delay <= 0) {
    // If the scheduled date is in the past, send immediately
    sendCampaignNow(tenantDb, campaignId).catch(error => {
      console.error(`Error sending immediate campaign ${campaignId}:`, error);
    });
    return;
  }
  
  // Schedule for future (in a real system, this would use a job queue like Bull)
  setTimeout(async () => {
    try {
      // Check if the campaign is still scheduled
      const [campaign] = await tenantDb
        .select()
        .from(emailCampaigns)
        .where(
          tenantDb.withTenantFilter(
            emailCampaigns,
            and(
              eq(emailCampaigns.id, campaignId),
              eq(emailCampaigns.status, 'scheduled')
            )
          )
        );
      
      if (campaign) {
        await sendCampaignNow(tenantDb, campaignId);
      }
    } catch (error) {
      console.error(`Error sending scheduled campaign ${campaignId}:`, error);
    }
  }, delay);
  
  console.log(`Campaign ${campaignId} scheduled to be sent on ${scheduledDate}`);
}

/**
 * Get recipients based on audience targeting
 */
async function getRecipientsByAudience(tenantDb: TenantDb, targetAudience: string) {
  // Get all active subscribers
  const activeSubscribers = await tenantDb
    .select({
      email: emailSubscribers.email
    })
    .from(emailSubscribers)
    .where(tenantDb.withTenantFilter(emailSubscribers, eq(emailSubscribers.subscribed, true)));
  
  const subscribedEmails = new Set(activeSubscribers.map(s => s.email.toLowerCase()));
  
  // Get customers based on targeting
  let query = tenantDb
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email
    })
    .from(customers)
    .where(
      tenantDb.withTenantFilter(
        customers,
        and(
          sql`${customers.email} IS NOT NULL`,
          sql`${customers.email} != ''`
        )
      )
    );
  
  switch (targetAudience) {
    case 'repeat_customers':
      // Customers with more than one service
      // Filter would require counting appointments - for now just use all
      // In production: JOIN with appointments and GROUP BY to count
      break;
    case 'new_customers':
      // New customers in the last 90 days
      // Filter would require createdAt field on customers table
      // For now, send to all customers
      break;
    case 'premium_customers':
      // Customers who have spent more than $500
      // Filter would require totalSpent field on customers table
      // For now, send to all customers
      break;
    // 'all' customers - no additional filters
  }
  
  const potentialRecipients = await query;
  
  // Filter to only include subscribed emails
  return potentialRecipients.filter(
    customer => customer.email && subscribedEmails.has(customer.email.toLowerCase())
  );
}

/**
 * Send an email campaign to recipients
 */
async function sendEmailCampaign(tenantDb: TenantDb, campaign: any, recipients: any[]) {
  // Get sender email from environment variable
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@cleanmachinetulsa.com';
  
  // In production, we'd batch these sends to avoid rate limits
  const sendPromises = recipients.map(recipient => {
    const personalizedContent = personalizeCampaignContent(campaign.content, recipient);
    
    const msg = {
      to: recipient.email,
      from: fromEmail,
      subject: campaign.subject,
      html: personalizedContent,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      customArgs: {
        campaign_id: campaign.id.toString()
      }
    };
    
    return mailService.send(msg);
  });
  
  await Promise.all(sendPromises);
  
  // Update campaign status
  await tenantDb
    .update(emailCampaigns)
    .set({
      status: 'sent',
      sentAt: new Date(),
      recipientCount: recipients.length
    })
    .where(tenantDb.withTenantFilter(emailCampaigns, eq(emailCampaigns.id, campaign.id)));
  
  return {
    success: true,
    recipientCount: recipients.length
  };
}

/**
 * Personalize email content for recipient
 */
function personalizeCampaignContent(content: string, recipient: any): string {
  let personalized = content;
  
  // Replace placeholder tokens with recipient data
  personalized = personalized.replace(/\{name\}/g, recipient.name || 'Valued Customer');
  personalized = personalized.replace(/\{email\}/g, recipient.email);
  
  // Add unsubscribe link
  const unsubscribeLink = `https://www.cleanmachine.com/unsubscribe?email=${encodeURIComponent(recipient.email)}`;
  personalized += `<br><br><p style="font-size: 12px; color: #888;">If you no longer wish to receive these emails, <a href="${unsubscribeLink}">click here to unsubscribe</a>.</p>`;
  
  return personalized;
}