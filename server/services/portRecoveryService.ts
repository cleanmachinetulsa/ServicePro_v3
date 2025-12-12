/**
 * Port Recovery Campaign Service
 * 
 * Manages one-time blast campaigns to apologize for messages lost during 
 * phone number porting and grant loyalty points to affected customers.
 * 
 * Consolidates customers from:
 * - customers table
 * - conversation participants (SMS)
 * - Google Voice imports (source = 'google_voice_import')
 */

import { db } from '../db';
import type { TenantDb } from '../tenantDb';
import { 
  portRecoveryCampaigns, 
  portRecoveryTargets,
  customers,
  conversations,
  messages,
  loyaltyPoints,
  pointsTransactions,
  type PortRecoveryCampaign,
  type PortRecoveryTarget,
  type InsertPortRecoveryCampaign,
  type InsertPortRecoveryTarget,
} from '@shared/schema';
import { eq, and, sql, ne, isNotNull, desc, or } from 'drizzle-orm';
import { twilioClient } from '../twilioClient';
import { awardPoints, awardCampaignPointsOnce } from '../gamificationService';
import { generateRewardsToken } from '../routes.loyalty';
import { tenantDomains } from '@shared/schema';
import { formatInTimeZone } from 'date-fns-tz';

// Oklahoma quiet hours: 8pm-8am CST - no campaign messages during this time
const OKLAHOMA_TIMEZONE = 'America/Chicago';
const QUIET_HOURS_START = 20; // 8:00 PM
const QUIET_HOURS_END = 8;    // 8:00 AM

/**
 * Check if current time is within Oklahoma quiet hours (8pm-8am CST)
 * Oklahoma law mandates no campaign messages during this time.
 * @returns true if it's quiet hours (sending blocked), false if sending is allowed
 */
export function isQuietHours(): boolean {
  const now = new Date();
  // Get current hour in Oklahoma timezone
  const oklahomaNow = formatInTimeZone(now, OKLAHOMA_TIMEZONE, 'HH');
  const currentHour = parseInt(oklahomaNow, 10);
  
  // Quiet hours are 8pm (20:00) to 8am (08:00)
  // So blocked hours are: 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7
  const isInQuietHours = currentHour >= QUIET_HOURS_START || currentHour < QUIET_HOURS_END;
  
  if (isInQuietHours) {
    console.log(`[PORT RECOVERY] QUIET HOURS: Current Oklahoma time ${currentHour}:00 - SMS blocked until 8:00 AM CST`);
  }
  
  return isInQuietHours;
}

/**
 * Get the next allowed send time (after quiet hours end)
 * @returns Date object for when sending is next allowed
 */
export function getNextAllowedSendTime(): Date {
  const now = new Date();
  // Create a date for 8:00 AM Oklahoma time today
  const today8am = new Date();
  today8am.setHours(0, 0, 0, 0);
  
  // Get current Oklahoma hour
  const oklahomaNow = formatInTimeZone(now, OKLAHOMA_TIMEZONE, 'HH');
  const currentHour = parseInt(oklahomaNow, 10);
  
  // If before 8am, next allowed is today at 8am
  // If after 8pm, next allowed is tomorrow at 8am
  if (currentHour < QUIET_HOURS_END) {
    // Before 8am today - can send at 8am today
    const nextSend = new Date();
    // Set to 8am in Oklahoma timezone
    nextSend.setUTCHours(14, 0, 0, 0); // 8am CST = 14:00 UTC (standard time)
    return nextSend;
  } else if (currentHour >= QUIET_HOURS_START) {
    // After 8pm - can send at 8am tomorrow
    const nextSend = new Date();
    nextSend.setDate(nextSend.getDate() + 1);
    nextSend.setUTCHours(14, 0, 0, 0); // 8am CST = 14:00 UTC
    return nextSend;
  }
  
  // Currently in allowed hours
  return now;
}

// Default SMS template for port recovery (holiday gift-card campaign version)
const DEFAULT_SMS_TEMPLATE = `Hey {{firstNameOrFallback}}, it's Jody with Clean Machine Auto Detail. We had a phone system change and may have missed a message from you — I'm really sorry about that. To make it right, I've added 500 reward points to your account good toward protectants or future details. You can check your rewards or book here: {{ctaUrl}} P.S. We now offer digital gift cards – perfect last-minute gifts. Reply STOP to unsubscribe.`;

// Default email subject
const DEFAULT_EMAIL_SUBJECT = "We're sorry if we missed you – 500 points added to your Clean Machine account";

// Default CTA URL
const DEFAULT_CTA_URL = 'https://cleanmachinetulsa.com/book';

// Default email HTML template
const DEFAULT_EMAIL_HTML_TEMPLATE = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 32px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Clean Machine Auto Detail</h1>
  </div>
  
  <div style="padding: 32px 24px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Hey{{customerNameGreeting}}!
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      We recently upgraded our phone & text system at Clean Machine Auto Detail, and there's a small chance we missed a message from you. I'm really sorry if that happened.
    </p>
    
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 8px;">🎁</div>
      <h2 style="color: white; margin: 0 0 8px; font-size: 22px; font-weight: 700;">500 Points Added!</h2>
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px;">
        Use them toward interior protection, engine bay cleaning, or save them for a maintenance detail.
      </p>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ctaUrl}}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Check My Rewards & Book
      </a>
    </div>
    
    <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <h3 style="color: #92400e; margin: 0 0 8px; font-size: 16px; font-weight: 600;">🎄 Perfect Last-Minute Gift!</h3>
      <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
        Need a last-minute gift? Our digital gift cards are great for anyone whose car needs some love. Available instantly!
      </p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
      Thank you for your patience!
    </p>
    <p style="color: #374151; font-size: 14px; margin: 8px 0 0;">
      <strong>Jody</strong><br>
      Clean Machine Auto Detail
    </p>
  </div>
  
  <div style="background-color: #f3f4f6; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      Clean Machine Auto Detail • Tulsa, OK<br>
      <a href="{{ctaUrl}}" style="color: #7c3aed;">Visit our website</a>
    </p>
  </div>
</div>
`;

/**
 * Normalize phone number to E.164 format for deduplication
 * SP-REWARDS-CAMPAIGN-TOKENS: Exported for reuse in preview endpoint
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle 10-digit US numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Handle 11-digit numbers starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // Already has country code
  if (digits.length >= 11) {
    return `+${digits}`;
  }
  
  return null; // Invalid phone
}

/**
 * Build consolidated target list from all customer sources
 * Returns unique customers by normalized phone/email
 */
export async function buildTargetListForPortRecovery(
  tenantDb: TenantDb,
  tenantId: string
): Promise<{
  targets: Array<{
    customerId: number | null;
    phone: string | null;
    email: string | null;
    customerName: string | null;
    source: string;
  }>;
  stats: {
    totalFromCustomers: number;
    totalFromConversations: number;
    totalFromGoogleVoice: number;
    totalUnique: number;
    totalWithPhone: number;
    totalWithEmail: number;
  };
}> {
  // Map to track unique customers by normalized phone
  const uniqueByPhone = new Map<string, {
    customerId: number | null;
    phone: string;
    email: string | null;
    customerName: string | null;
    source: string;
  }>();
  
  // Also track unique by email for those without phones
  const uniqueByEmail = new Map<string, {
    customerId: number | null;
    phone: string | null;
    email: string;
    customerName: string | null;
    source: string;
  }>();
  
  let totalFromCustomers = 0;
  let totalFromConversations = 0;
  
  // 1. Pull from customers table - include ALL customers, defer SMS consent check to send step
  // This ensures every customer gets their customer_id set for points awarding
  const customerRows = await tenantDb
    .select({
      id: customers.id,
      phone: customers.phone,
      email: customers.email,
      name: customers.name,
      smsConsent: customers.smsConsent,
    })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));
  
  for (const c of customerRows) {
    totalFromCustomers++;
    const normalizedPhone = normalizePhone(c.phone);
    
    if (normalizedPhone) {
      if (!uniqueByPhone.has(normalizedPhone)) {
        uniqueByPhone.set(normalizedPhone, {
          customerId: c.id,
          phone: normalizedPhone,
          email: c.email || null,
          customerName: c.name || null,
          source: 'customers',
        });
      }
    } else if (c.email) {
      const emailLower = c.email.toLowerCase();
      if (!uniqueByEmail.has(emailLower)) {
        uniqueByEmail.set(emailLower, {
          customerId: c.id,
          phone: null,
          email: c.email,
          customerName: c.name || null,
          source: 'customers',
        });
      }
    }
  }
  
  // 2. Pull from conversations (unique participant phones)
  const conversationParticipants = await tenantDb
    .select({
      customerPhone: conversations.customerPhone,
      customerName: conversations.customerName,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        isNotNull(conversations.customerPhone)
      )
    );
  
  for (const c of conversationParticipants) {
    const normalizedPhone = normalizePhone(c.customerPhone);
    if (normalizedPhone && !uniqueByPhone.has(normalizedPhone)) {
      totalFromConversations++;
      uniqueByPhone.set(normalizedPhone, {
        customerId: null,
        phone: normalizedPhone,
        email: null,
        customerName: c.customerName || null,
        source: 'conversations',
      });
    }
  }
  
  // 3. Google Voice imports - Currently disabled as messages table doesn't have source/from_number columns
  // Future: If Google Voice import tracking is needed, add a dedicated table or fields to messages schema
  // For now, the target list is built from customers and conversations tables which cover most cases
  
  // Combine phone-based and email-only targets
  const targets = [
    ...Array.from(uniqueByPhone.values()),
    ...Array.from(uniqueByEmail.values()).filter(e => !e.phone), // Only email-only ones
  ];
  
  return {
    targets,
    stats: {
      totalFromCustomers,
      totalFromConversations,
      totalFromGoogleVoice: 0, // Disabled - would require schema changes to messages table
      totalUnique: targets.length,
      totalWithPhone: uniqueByPhone.size,
      totalWithEmail: targets.filter(t => t.email).length,
    },
  };
}

/**
 * Create a new port recovery campaign with targets
 */
export async function createPortRecoveryCampaign(
  tenantDb: TenantDb,
  tenantId: string,
  createdByUserId: number,
  campaignName: string = '2024-number-port-recovery'
): Promise<{
  campaign: PortRecoveryCampaign;
  targetCount: number;
}> {
  // Build target list
  const { targets, stats } = await buildTargetListForPortRecovery(tenantDb, tenantId);
  
  // Create campaign with all default templates
  const [campaign] = await tenantDb
    .insert(portRecoveryCampaigns)
    .values({
      tenantId,
      name: campaignName,
      createdByUserId,
      status: 'draft',
      totalTargets: stats.totalUnique,
      pointsPerCustomer: 500,
      smsEnabled: true,
      emailEnabled: true,
      smsTemplate: DEFAULT_SMS_TEMPLATE,
      emailSubject: DEFAULT_EMAIL_SUBJECT,
      emailHtmlTemplate: DEFAULT_EMAIL_HTML_TEMPLATE,
      ctaUrl: DEFAULT_CTA_URL,
    })
    .returning();
  
  // Insert targets
  if (targets.length > 0) {
    const targetValues: InsertPortRecoveryTarget[] = targets.map(t => ({
      campaignId: campaign.id,
      tenantId,
      customerId: t.customerId,
      phone: t.phone,
      email: t.email,
      customerName: t.customerName,
      smsStatus: 'pending' as const,
      emailStatus: 'pending' as const,
      pointsGranted: 0,
    }));
    
    // Insert in batches to avoid query size limits
    const batchSize = 500;
    for (let i = 0; i < targetValues.length; i += batchSize) {
      const batch = targetValues.slice(i, i + batchSize);
      await tenantDb.insert(portRecoveryTargets).values(batch);
    }
  }
  
  return { campaign, targetCount: targets.length };
}

/**
 * Get campaign by ID
 */
export async function getCampaign(
  tenantDb: TenantDb,
  campaignId: number
): Promise<PortRecoveryCampaign | null> {
  const [campaign] = await tenantDb
    .select()
    .from(portRecoveryCampaigns)
    .where(eq(portRecoveryCampaigns.id, campaignId))
    .limit(1);
  
  return campaign || null;
}

/**
 * Get all campaigns for a tenant
 */
export async function getCampaigns(
  tenantDb: TenantDb,
  tenantId: string
): Promise<PortRecoveryCampaign[]> {
  return await tenantDb
    .select()
    .from(portRecoveryCampaigns)
    .where(eq(portRecoveryCampaigns.tenantId, tenantId))
    .orderBy(desc(portRecoveryCampaigns.createdAt));
}

/**
 * Get targets for a campaign with optional status filter
 */
export async function getCampaignTargets(
  tenantDb: TenantDb,
  campaignId: number,
  options?: {
    smsStatus?: 'pending' | 'sent' | 'failed' | 'skipped';
    limit?: number;
    offset?: number;
  }
): Promise<{ targets: PortRecoveryTarget[]; total: number }> {
  let query = tenantDb
    .select()
    .from(portRecoveryTargets)
    .where(
      options?.smsStatus
        ? and(
            eq(portRecoveryTargets.campaignId, campaignId),
            eq(portRecoveryTargets.smsStatus, options.smsStatus)
          )
        : eq(portRecoveryTargets.campaignId, campaignId)
    );
  
  // Get total count
  const countResult = await tenantDb
    .select({ count: sql<number>`count(*)` })
    .from(portRecoveryTargets)
    .where(
      options?.smsStatus
        ? and(
            eq(portRecoveryTargets.campaignId, campaignId),
            eq(portRecoveryTargets.smsStatus, options.smsStatus)
          )
        : eq(portRecoveryTargets.campaignId, campaignId)
    );
  
  const total = Number(countResult[0]?.count || 0);
  
  // Apply pagination
  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }
  
  const targets = await query;
  
  return { targets, total };
}

const PORT_RECOVERY_CAMPAIGN_KEY = 'port-recovery-2025-12-11';

/**
 * Grant points to a customer for port recovery
 * Uses idempotent awardCampaignPointsOnce to prevent duplicate awards
 */
async function grantPortRecoveryPoints(
  tenantDb: TenantDb,
  customerId: number,
  points: number,
  campaignId: number
): Promise<{ success: boolean; currentPoints: number; wasSkipped?: boolean }> {
  const result = await awardCampaignPointsOnce(
    tenantDb,
    customerId,
    points,
    PORT_RECOVERY_CAMPAIGN_KEY,
    'port_recovery',
    campaignId,
    `Port recovery apology - ${points} loyalty points`
  );
  
  return {
    success: result.success,
    currentPoints: result.currentPoints,
    wasSkipped: result.wasSkipped,
  };
}

/**
 * Helper to extract first name from full name
 */
function getFirstName(fullName: string | null): string {
  if (!fullName) return '';
  const firstName = fullName.split(' ')[0];
  return firstName || '';
}

/**
 * SP-REWARDS-CAMPAIGN-TOKENS: Get the public base URL for a tenant
 * Priority: verified custom domain > PUBLIC_APP_BASE_URL > Replit default
 * Exported for reuse in preview endpoints
 */
export async function getTenantPublicBaseUrl(tenantId: string): Promise<string> {
  const envBase = process.env.PUBLIC_APP_BASE_URL;
  
  try {
    const [customDomain] = await db
      .select()
      .from(tenantDomains)
      .where(
        and(
          eq(tenantDomains.tenantId, tenantId),
          eq(tenantDomains.status, 'verified'),
          eq(tenantDomains.isPrimary, true)
        )
      )
      .limit(1);
    
    if (customDomain?.domain) {
      return `https://${customDomain.domain}`;
    }
  } catch (err) {
    console.error('[PORT RECOVERY] Error fetching tenant domain:', err);
  }
  
  if (envBase) return envBase;
  
  return 'https://cleanmachinetulsa.com';
}

/**
 * SP-REWARDS-CAMPAIGN-TOKENS: Generate personalized rewards link with token
 */
function generatePersonalizedRewardsLink(
  baseUrl: string,
  phone: string,
  tenantId: string,
  expiryDays: number = 30
): string {
  const token = generateRewardsToken(phone, tenantId, expiryDays);
  return `${baseUrl}/rewards/welcome?token=${encodeURIComponent(token)}`;
}

/**
 * SP-REWARDS-CAMPAIGN-TOKENS: Check if template contains a rewards link placeholder
 */
function templateHasRewardsLink(template: string): boolean {
  return /\{\{rewardsLink\}\}|\{rewards_link\}/i.test(template);
}

/**
 * Interpolate template variables
 * SP-REWARDS-CAMPAIGN-TOKENS: Now supports {{rewardsLink}} and {{rewards_link}} for personalized token URLs
 */
function interpolateTemplate(
  template: string,
  target: PortRecoveryTarget,
  ctaUrl: string,
  points: number,
  rewardsLink?: string
): string {
  const firstName = getFirstName(target.customerName);
  const firstNameOrFallback = (firstName && firstName !== 'unknown') ? firstName : 'there';
  const customerNameGreeting = target.customerName ? ` ${target.customerName}` : '';
  
  let result = template
    .replace(/\{\{firstNameOrFallback\}\}/g, firstNameOrFallback)
    .replace(/\{\{customerName\}\}/g, target.customerName || 'Valued Customer')
    .replace(/\{\{customerNameGreeting\}\}/g, customerNameGreeting)
    .replace(/\{\{ctaUrl\}\}/g, ctaUrl)
    .replace(/\{\{bookingUrl\}\}/g, ctaUrl)
    .replace(/\{\{points\}\}/g, points.toString());
  
  if (rewardsLink) {
    result = result
      .replace(/\{\{rewardsLink\}\}/gi, rewardsLink)
      .replace(/\{rewards_link\}/gi, rewardsLink);
  }
  
  return result;
}

/**
 * Send SMS for a target
 * SP-REWARDS-CAMPAIGN-TOKENS: Now supports personalized rewards link
 */
async function sendPortRecoverySms(
  target: PortRecoveryTarget,
  template: string,
  fromNumber: string,
  ctaUrl: string,
  points: number,
  rewardsLink?: string
): Promise<{ success: boolean; twilioSid?: string; error?: string }> {
  if (!target.phone) {
    return { success: false, error: 'No phone number' };
  }
  
  if (!twilioClient) {
    return { success: false, error: 'Twilio client not configured' };
  }
  
  try {
    let messageBody = interpolateTemplate(template, target, ctaUrl, points, rewardsLink);
    
    if (rewardsLink && !templateHasRewardsLink(template)) {
      messageBody += `\n\nView your rewards: ${rewardsLink}`;
    }
    
    const message = await twilioClient.messages.create({
      to: target.phone,
      from: fromNumber,
      body: messageBody,
    });
    
    return { success: true, twilioSid: message.sid };
  } catch (error: any) {
    console.error(`[PORT RECOVERY] SMS failed for ${target.phone}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send email for a target (if email service is available)
 */
async function sendPortRecoveryEmail(
  target: PortRecoveryTarget,
  subject: string,
  htmlTemplate: string,
  ctaUrl: string,
  points: number
): Promise<{ success: boolean; error?: string }> {
  if (!target.email) {
    return { success: false, error: 'No email address' };
  }
  
  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      return { success: false, error: 'SendGrid not configured' };
    }
    
    sgMail.setApiKey(apiKey);
    
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@cleanmachinetulsa.com';
    
    const interpolatedSubject = interpolateTemplate(subject, target, ctaUrl, points);
    const interpolatedHtml = interpolateTemplate(htmlTemplate, target, ctaUrl, points);
    
    const customerGreeting = target.customerName ? ` ${target.customerName}` : '';
    const plainText = `Hey${customerGreeting}!\n\nWe recently upgraded our phone & text system at Clean Machine Auto Detail, and there's a small chance we missed a message from you. I'm really sorry if that happened.\n\nTo make it right, we've added ${points} reward points to your account – you can use them toward interior protection, engine bay cleaning, or save them up toward a maintenance detail.\n\nTap here to view options & book: ${ctaUrl}\n\nP.S. Need a last-minute gift? Our digital gift cards are great for anyone whose car needs some love!\n\nThank you for your patience!\n\nJody\nClean Machine Auto Detail`;
    
    await sgMail.send({
      to: target.email,
      from: fromEmail,
      subject: interpolatedSubject,
      text: plainText,
      html: interpolatedHtml,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error(`[PORT RECOVERY] Email failed for ${target.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Process a batch of targets for the campaign
 * 
 * OKLAHOMA COMPLIANCE: Respects quiet hours (8pm-8am CST) - will throw error if attempted during quiet hours
 */
export async function runPortRecoveryBatch(
  tenantDb: TenantDb,
  campaignId: number,
  limit: number = 100,
  options: { bypassQuietHoursCheck?: boolean } = {}
): Promise<{
  processed: number;
  smsSent: number;
  emailSent: number;
  pointsGranted: number;
  errors: number;
  isComplete: boolean;
  blockedByQuietHours?: boolean;
}> {
  // OKLAHOMA QUIET HOURS COMPLIANCE: Block SMS campaigns during 8pm-8am CST
  if (!options.bypassQuietHoursCheck && isQuietHours()) {
    const nextAllowed = getNextAllowedSendTime();
    console.log(`[PORT RECOVERY] BLOCKED: Oklahoma quiet hours in effect. Next allowed send time: ${nextAllowed.toISOString()}`);
    return {
      processed: 0,
      smsSent: 0,
      emailSent: 0,
      pointsGranted: 0,
      errors: 0,
      isComplete: false,
      blockedByQuietHours: true,
    };
  }
  
  // Get campaign
  const campaign = await getCampaign(tenantDb, campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  // Mark as running if not already
  if (campaign.status === 'draft') {
    await tenantDb
      .update(portRecoveryCampaigns)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(portRecoveryCampaigns.id, campaignId));
  }
  
  // Get pending targets
  const { targets } = await getCampaignTargets(tenantDb, campaignId, {
    smsStatus: 'pending',
    limit,
  });
  
  if (targets.length === 0) {
    // No more pending targets - mark campaign as complete
    await tenantDb
      .update(portRecoveryCampaigns)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(portRecoveryCampaigns.id, campaignId));
    
    return {
      processed: 0,
      smsSent: 0,
      emailSent: 0,
      pointsGranted: 0,
      errors: 0,
      isComplete: true,
    };
  }
  
  let smsSent = 0;
  let smsFailed = 0;
  let emailSent = 0;
  let totalPointsGranted = 0;
  let errors = 0;
  
  const fromNumber = process.env.MAIN_PHONE_NUMBER || process.env.TWILIO_TEST_SMS_NUMBER || '';
  const ctaUrl = campaign.ctaUrl || DEFAULT_CTA_URL;
  const smsTemplate = campaign.smsTemplate || DEFAULT_SMS_TEMPLATE;
  const emailSubject = campaign.emailSubject || DEFAULT_EMAIL_SUBJECT;
  const emailHtmlTemplate = campaign.emailHtmlTemplate || DEFAULT_EMAIL_HTML_TEMPLATE;
  const smsEnabled = campaign.smsEnabled !== false;
  const emailEnabled = campaign.emailEnabled !== false;
  
  const tenantId = campaign.tenantId;
  const tenantBaseUrl = await getTenantPublicBaseUrl(tenantId);
  
  for (const target of targets) {
    const updates: Partial<PortRecoveryTarget> = {
      processedAt: new Date(),
      updatedAt: new Date(),
    };
    
    // 1. Grant points - try to find customer by phone, or auto-create if from conversations
    let customerId = target.customerId;
    let targetEmail = target.email;
    
    if (!customerId && target.phone) {
      // First try to find existing customer
      const foundCustomer = await findCustomerByPhone(tenantDb, target.phone);
      if (foundCustomer) {
        customerId = foundCustomer.id;
        updates.customerId = customerId;
        // Also capture email from customer record if target doesn't have one
        if (!targetEmail && foundCustomer.email) {
          targetEmail = foundCustomer.email;
          updates.email = targetEmail;
        }
        console.log(`[PORT RECOVERY] Found customer ${customerId} for target phone ${target.phone}`);
      } else {
        // Auto-create customer if target is from conversations
        const autoCreatedId = await autoCreateCustomerIfNeeded(
          tenantDb,
          tenantId,
          target.phone,
          target.customerName,
          target.source
        );
        if (autoCreatedId) {
          customerId = autoCreatedId;
          updates.customerId = customerId;
          console.log(`[PORT RECOVERY] Auto-created customer ${customerId} for target phone ${target.phone}`);
        }
      }
    }
    
    if (customerId) {
      const pointsResult = await grantPortRecoveryPoints(
        tenantDb,
        customerId,
        campaign.pointsPerCustomer,
        campaignId
      );
      
      if (pointsResult.success) {
        updates.pointsGranted = campaign.pointsPerCustomer;
        totalPointsGranted += campaign.pointsPerCustomer;
        console.log(`[PORT RECOVERY] Awarded ${campaign.pointsPerCustomer} points to customer ${customerId}`);
      } else {
        console.log(`[PORT RECOVERY] Failed to award points to customer ${customerId}: ${pointsResult}`);
      }
    } else {
      console.log(`[PORT RECOVERY] No customer matched for target phone=${target.phone} email=${target.email}`);
    }
    
    // Channel priority: SMS-first, email-only-fallback
    // If target has phone + SMS enabled -> send SMS only
    // If target has no phone/no consent but has email + email enabled -> send email
    // Never send both to same person in same run
    
    let sentViaSms = false;
    
    // 2. Try SMS first if phone exists and SMS is enabled
    // Check SMS consent if we have a customer record - respect opt-outs
    let hasConsentToSms = true; // Default to true for unknown contacts
    if (customerId) {
      try {
        const [customerRecord] = await tenantDb
          .select({ smsConsent: customers.smsConsent })
          .from(customers)
          .where(eq(customers.id, customerId))
          .limit(1);
        // Only block if explicitly opted out (smsConsent = false)
        // Allow if true or null (not yet specified)
        if (customerRecord?.smsConsent === false) {
          hasConsentToSms = false;
        }
      } catch (err) {
        // Continue if we can't check consent
      }
    }
    
    if (smsEnabled && target.phone && fromNumber && hasConsentToSms) {
      const personalizedRewardsLink = generatePersonalizedRewardsLink(
        tenantBaseUrl,
        target.phone,
        tenantId,
        30
      );
      
      const smsResult = await sendPortRecoverySms(
        target,
        smsTemplate,
        fromNumber,
        ctaUrl,
        campaign.pointsPerCustomer,
        personalizedRewardsLink
      );
      
      if (smsResult.success) {
        updates.smsStatus = 'sent';
        updates.twilioSid = smsResult.twilioSid;
        smsSent++;
        sentViaSms = true;
      } else {
        updates.smsStatus = 'failed';
        updates.smsErrorMessage = smsResult.error;
        smsFailed++;
        errors++;
      }
    } else if (!hasConsentToSms) {
      updates.smsStatus = 'skipped';
      updates.smsErrorMessage = 'Customer opted out of SMS';
    } else if (!smsEnabled) {
      updates.smsStatus = 'skipped';
      updates.smsErrorMessage = 'SMS disabled for this campaign';
    } else {
      updates.smsStatus = 'skipped';
      updates.smsErrorMessage = !target.phone ? 'No phone number' : 'No from number configured';
    }
    
    // 3. Send email only as fallback if SMS wasn't sent successfully
    // Use targetEmail which may have been populated from customer lookup
    if (!sentViaSms && emailEnabled && targetEmail) {
      // Create a modified target with the resolved email for sending
      const targetWithEmail = { ...target, email: targetEmail };
      const emailResult = await sendPortRecoveryEmail(
        targetWithEmail,
        emailSubject,
        emailHtmlTemplate,
        ctaUrl,
        campaign.pointsPerCustomer
      );
      
      if (emailResult.success) {
        updates.emailStatus = 'sent';
        emailSent++;
      } else {
        updates.emailStatus = 'failed';
        updates.emailErrorMessage = emailResult.error;
      }
    } else if (!emailEnabled) {
      updates.emailStatus = 'skipped';
    } else if (sentViaSms) {
      updates.emailStatus = 'skipped';
      updates.emailErrorMessage = 'Skipped - SMS sent successfully';
    } else {
      updates.emailStatus = 'skipped';
      updates.emailErrorMessage = 'No email address available';
    }
    
    // Update target record
    await tenantDb
      .update(portRecoveryTargets)
      .set(updates)
      .where(eq(portRecoveryTargets.id, target.id));
  }
  
  // Update campaign stats including failed counts
  await tenantDb
    .update(portRecoveryCampaigns)
    .set({
      totalSmsSent: sql`${portRecoveryCampaigns.totalSmsSent} + ${smsSent}`,
      totalSmsFailed: sql`COALESCE(${portRecoveryCampaigns.totalSmsFailed}, 0) + ${smsFailed}`,
      totalEmailSent: sql`${portRecoveryCampaigns.totalEmailSent} + ${emailSent}`,
      totalPointsGranted: sql`${portRecoveryCampaigns.totalPointsGranted} + ${totalPointsGranted}`,
      updatedAt: new Date(),
    })
    .where(eq(portRecoveryCampaigns.id, campaignId));
  
  // Check if there are more pending targets
  const remainingResult = await tenantDb
    .select({ count: sql<number>`count(*)` })
    .from(portRecoveryTargets)
    .where(
      and(
        eq(portRecoveryTargets.campaignId, campaignId),
        eq(portRecoveryTargets.smsStatus, 'pending')
      )
    );
  
  const remaining = Number(remainingResult[0]?.count || 0);
  const isComplete = remaining === 0;
  
  if (isComplete) {
    await tenantDb
      .update(portRecoveryCampaigns)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(portRecoveryCampaigns.id, campaignId));
  }
  
  return {
    processed: targets.length,
    smsSent,
    emailSent,
    pointsGranted: totalPointsGranted,
    errors,
    isComplete,
  };
}

/**
 * Send a test SMS to the owner's phone
 * SP-REWARDS-CAMPAIGN-TOKENS: Now generates personalized token URL for test sends
 * FIXED: Now also awards points to the owner's customer record so the landing page works
 */
export async function sendTestSms(
  tenantDb: TenantDb,
  campaignId: number,
  phoneOverride?: string
): Promise<{ success: boolean; error?: string; pointsAwarded?: number }> {
  const campaign = await getCampaign(tenantDb, campaignId);
  if (!campaign) {
    return { success: false, error: 'Campaign not found' };
  }
  
  const ownerPhone = phoneOverride || process.env.BUSINESS_OWNER_PERSONAL_PHONE;
  const fromNumber = process.env.MAIN_PHONE_NUMBER || process.env.TWILIO_TEST_SMS_NUMBER;
  
  if (!ownerPhone) {
    return { success: false, error: 'BUSINESS_OWNER_PERSONAL_PHONE not configured' };
  }
  
  if (!fromNumber) {
    return { success: false, error: 'No from number configured' };
  }
  
  if (!twilioClient) {
    return { success: false, error: 'Twilio client not configured' };
  }
  
  try {
    const ctaUrl = campaign.ctaUrl || DEFAULT_CTA_URL;
    const smsTemplate = campaign.smsTemplate || DEFAULT_SMS_TEMPLATE;
    const tenantId = campaign.tenantId;
    
    // Find or create customer for owner's phone so points can be awarded
    const normalizedPhone = normalizePhone(ownerPhone);
    let customerId: number | null = null;
    let customerName = 'Test Customer';
    
    if (normalizedPhone) {
      // Look for existing customer by phone
      const existingCustomer = await findCustomerByPhone(tenantDb, normalizedPhone);
      if (existingCustomer) {
        customerId = existingCustomer.id;
        customerName = existingCustomer.name || 'Test Customer';
        console.log(`[PORT RECOVERY] Test SMS: Found existing customer ${customerId} for phone ${normalizedPhone}`);
      }
    }
    
    // Award points if we found a customer record
    let pointsAwarded = 0;
    if (customerId) {
      const pointsResult = await grantPortRecoveryPoints(
        tenantDb,
        customerId,
        campaign.pointsPerCustomer,
        campaignId
      );
      if (pointsResult.success) {
        pointsAwarded = campaign.pointsPerCustomer;
        console.log(`[PORT RECOVERY] Test SMS: Awarded ${pointsAwarded} points to customer ${customerId}`);
      }
    } else {
      console.log(`[PORT RECOVERY] Test SMS: No customer found for ${normalizedPhone}, skipping points award`);
    }
    
    const testTarget: PortRecoveryTarget = {
      id: 0,
      campaignId,
      tenantId,
      customerId,
      phone: ownerPhone,
      email: null,
      customerName,
      smsStatus: 'pending',
      emailStatus: 'pending',
      pointsGranted: pointsAwarded,
      smsErrorMessage: null,
      emailErrorMessage: null,
      twilioSid: null,
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const tenantBaseUrl = await getTenantPublicBaseUrl(tenantId);
    const personalizedRewardsLink = generatePersonalizedRewardsLink(
      tenantBaseUrl,
      ownerPhone,
      tenantId,
      30
    );
    
    let messageBody = interpolateTemplate(smsTemplate, testTarget, ctaUrl, campaign.pointsPerCustomer, personalizedRewardsLink);
    
    if (!templateHasRewardsLink(smsTemplate)) {
      messageBody += `\n\nView your rewards: ${personalizedRewardsLink}`;
    }
    
    await twilioClient.messages.create({
      to: ownerPhone,
      from: fromNumber,
      body: `[TEST] ${messageBody}`,
    });
    
    console.log(`[PORT RECOVERY] Test SMS sent to ${ownerPhone} with personalized rewards link, points awarded: ${pointsAwarded}`);
    return { success: true, pointsAwarded };
  } catch (error: any) {
    console.error('[PORT RECOVERY] Test SMS failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Helper to find a customer by phone number
 * Uses digits-only comparison to handle any phone format
 */
async function findCustomerByPhone(
  tenantDb: TenantDb,
  phone: string
): Promise<{ id: number; name: string | null; email: string | null } | null> {
  // Extract just the digits from the input phone
  const inputDigits = phone.replace(/\D/g, '');
  
  // Handle 10-digit vs 11-digit (with country code)
  const last10Digits = inputDigits.length >= 10 
    ? inputDigits.slice(-10) 
    : inputDigits;
  
  if (last10Digits.length < 10) {
    return null;
  }
  
  // Query using SQL to strip non-digits from stored phone and compare
  const [customer] = await tenantDb
    .select({ 
      id: customers.id, 
      name: customers.name,
      email: customers.email 
    })
    .from(customers)
    .where(
      sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '\\D', '', 'g'), 10) = ${last10Digits}`
    )
    .limit(1);
  
  if (customer) {
    return customer;
  }
  
  return null;
}

/**
 * Helper to find a customer by name (exact match, case-insensitive)
 * Used as fallback when phone matching fails
 */
async function findCustomerByName(
  tenantDb: TenantDb,
  tenantId: string,
  name: string
): Promise<{ id: number; name: string | null; email: string | null; phone: string | null } | null> {
  if (!name || name.length < 2) {
    return null;
  }
  
  // Clean and normalize the name for matching
  const normalizedName = name.trim().toLowerCase();
  
  // Query using case-insensitive matching
  const [customer] = await tenantDb
    .select({ 
      id: customers.id, 
      name: customers.name,
      email: customers.email,
      phone: customers.phone
    })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        sql`LOWER(TRIM(${customers.name})) = ${normalizedName}`
      )
    )
    .limit(1);
  
  if (customer) {
    return customer;
  }
  
  return null;
}

/**
 * Auto-create a minimal customer record if one doesn't exist
 * Used for port recovery targets from conversations
 */
async function autoCreateCustomerIfNeeded(
  tenantDb: TenantDb,
  tenantId: string,
  phone: string | null,
  name: string | null,
  source: string
): Promise<number | null> {
  // Only auto-create for conversation participants (not random extracted contacts)
  if (source !== 'conversations') {
    return null;
  }
  
  if (!phone) {
    return null;
  }
  
  // Check if customer already exists
  const existing = await findCustomerByPhone(tenantDb, phone);
  if (existing) {
    return existing.id;
  }
  
  try {
    // Normalize phone to E.164 format for storage
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      console.log(`[PORT RECOVERY] Could not normalize phone for auto-create: ${phone}`);
      return null;
    }
    
    // Create minimal customer record
    const [newCustomer] = await tenantDb
      .insert(customers)
      .values({
        tenantId,
        phone: normalizedPhone,
        name: name || null,
        email: null,
        smsConsent: null, // Neutral - they can opt-in/out later
      })
      .returning({ id: customers.id });
    
    if (newCustomer) {
      console.log(`[PORT RECOVERY] Auto-created customer ${newCustomer.id} for phone ${normalizedPhone}`);
      return newCustomer.id;
    }
  } catch (error: any) {
    console.error(`[PORT RECOVERY] Error auto-creating customer for ${phone}:`, error.message);
  }
  
  return null;
}

/**
 * Update campaign settings
 */
export async function updateCampaign(
  tenantDb: TenantDb,
  campaignId: number,
  updates: {
    smsTemplate?: string;
    emailSubject?: string;
    emailHtmlTemplate?: string;
    ctaUrl?: string;
    smsEnabled?: boolean;
    emailEnabled?: boolean;
    pointsPerCustomer?: number;
  }
): Promise<PortRecoveryCampaign | null> {
  // Filter out undefined values to prevent overwriting existing fields with NULL
  const cleanUpdates = Object.entries(updates)
    .filter(([, value]) => value !== undefined)
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  
  const [campaign] = await tenantDb
    .update(portRecoveryCampaigns)
    .set({
      ...cleanUpdates,
      updatedAt: new Date(),
    })
    .where(eq(portRecoveryCampaigns.id, campaignId))
    .returning();
  
  return campaign || null;
}

/**
 * Get recent run history for display in admin panel
 */
export async function getRecentRunHistory(
  tenantDb: TenantDb,
  tenantId: string,
  limit: number = 5
): Promise<Array<{
  id: string;
  startedAt: string | null;
  finishedAt: string | null;
  totalTargets: number;
  totalSent: number;
  totalFailed: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}>> {
  const campaigns = await tenantDb
    .select()
    .from(portRecoveryCampaigns)
    .where(eq(portRecoveryCampaigns.tenantId, tenantId))
    .orderBy(desc(portRecoveryCampaigns.createdAt))
    .limit(limit);
  
  return campaigns.map(c => ({
    id: c.id.toString(),
    startedAt: c.startedAt?.toISOString() || c.createdAt?.toISOString() || null,
    finishedAt: c.completedAt?.toISOString() || null,
    totalTargets: c.totalTargets || 0,
    totalSent: (c.totalSmsSent || 0) + (c.totalEmailSent || 0),
    totalFailed: c.totalSmsFailed || 0,
    status: mapStatus(c.status),
  }));
}

function mapStatus(status: string): 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' {
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
 * Get or create the current campaign configuration for a tenant
 */
export async function getOrCreateCampaignConfig(
  tenantDb: TenantDb,
  tenantId: string,
  userId: number
): Promise<PortRecoveryCampaign> {
  const campaigns = await getCampaigns(tenantDb, tenantId);
  const draftCampaign = campaigns.find(c => c.status === 'draft');
  
  if (draftCampaign) {
    return draftCampaign;
  }
  
  const { campaign } = await createPortRecoveryCampaign(tenantDb, tenantId, userId);
  return campaign;
}

/**
 * Preview target list without creating campaign
 */
export async function previewTargetList(
  tenantDb: TenantDb,
  tenantId: string
): Promise<{
  stats: {
    totalFromCustomers: number;
    totalFromConversations: number;
    totalFromGoogleVoice: number;
    totalUnique: number;
    totalWithPhone: number;
    totalWithEmail: number;
  };
  sampleTargets: Array<{
    phone: string | null;
    email: string | null;
    customerName: string | null;
    source: string;
  }>;
}> {
  const { targets, stats } = await buildTargetListForPortRecovery(tenantDb, tenantId);
  
  // Return first 10 as sample
  const sampleTargets = targets.slice(0, 10).map(t => ({
    phone: t.phone,
    email: t.email,
    customerName: t.customerName,
    source: t.source,
  }));
  
  return { stats, sampleTargets };
}

/**
 * Backfill existing port_recovery_targets to populate missing customer_id and email
 * This uses the improved findCustomerByPhone with digits-only matching
 */
export async function backfillTargetsWithCustomerData(
  tenantDb: TenantDb,
  campaignId: number
): Promise<{
  processed: number;
  customersMatched: number;
  emailsPopulated: number;
  pointsAwarded: number;
}> {
  let processed = 0;
  let customersMatched = 0;
  let emailsPopulated = 0;
  let pointsAwarded = 0;
  
  // Get campaign for points value
  const campaign = await getCampaign(tenantDb, campaignId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  
  // Get all targets that need backfill (no customer_id and have phone)
  const targetsToBackfill = await tenantDb
    .select()
    .from(portRecoveryTargets)
    .where(
      and(
        eq(portRecoveryTargets.campaignId, campaignId),
        sql`${portRecoveryTargets.customerId} IS NULL`,
        isNotNull(portRecoveryTargets.phone)
      )
    );
  
  console.log(`[PORT RECOVERY BACKFILL] Processing ${targetsToBackfill.length} targets for campaign ${campaignId}`);
  
  let matchedByPhone = 0;
  let matchedByName = 0;
  
  for (const target of targetsToBackfill) {
    processed++;
    
    if (!target.phone) continue;
    
    // Try to find customer by phone first
    let foundCustomer = await findCustomerByPhone(tenantDb, target.phone);
    let matchMethod = 'phone';
    
    // If no phone match, try matching by name
    if (!foundCustomer && target.customerName) {
      foundCustomer = await findCustomerByName(tenantDb, campaign.tenantId, target.customerName);
      matchMethod = 'name';
    }
    
    if (foundCustomer) {
      customersMatched++;
      if (matchMethod === 'phone') matchedByPhone++;
      if (matchMethod === 'name') matchedByName++;
      
      const updates: Partial<PortRecoveryTarget> = {
        customerId: foundCustomer.id,
        updatedAt: new Date(),
      };
      
      // Populate email if missing
      if (!target.email && foundCustomer.email) {
        updates.email = foundCustomer.email;
        emailsPopulated++;
      }
      
      // NOTE: Removed phone backfill to customer records - target phone data from 
      // Google Voice imports is unverified and could corrupt legitimate customer data.
      // Customer phone numbers should be updated through verified sources only.
      
      // Award points if not already awarded
      if (!target.pointsGranted || target.pointsGranted === 0) {
        try {
          const pointsResult = await grantPortRecoveryPoints(
            tenantDb,
            foundCustomer.id,
            campaign.pointsPerCustomer,
            campaignId
          );
          
          if (pointsResult.success) {
            updates.pointsGranted = campaign.pointsPerCustomer;
            pointsAwarded += campaign.pointsPerCustomer;
          }
        } catch (err) {
          console.error(`[BACKFILL] Error awarding points to customer ${foundCustomer.id}:`, err);
        }
      }
      
      // Update the target record
      await tenantDb
        .update(portRecoveryTargets)
        .set(updates)
        .where(eq(portRecoveryTargets.id, target.id));
    }
    
    // Log progress every 100 records
    if (processed % 100 === 0) {
      console.log(`[BACKFILL] Processed ${processed}/${targetsToBackfill.length}, matched ${customersMatched} (phone:${matchedByPhone}, name:${matchedByName})`);
    }
  }
  
  console.log(`[BACKFILL] Match breakdown: phone=${matchedByPhone}, name=${matchedByName}`);
  
  // Update campaign totals
  await tenantDb
    .update(portRecoveryCampaigns)
    .set({
      totalPointsGranted: sql`${portRecoveryCampaigns.totalPointsGranted} + ${pointsAwarded}`,
      updatedAt: new Date(),
    })
    .where(eq(portRecoveryCampaigns.id, campaignId));
  
  console.log(`[PORT RECOVERY BACKFILL] Complete: processed=${processed}, matched=${customersMatched}, emails=${emailsPopulated}, points=${pointsAwarded}`);
  
  return { processed, customersMatched, emailsPopulated, pointsAwarded };
}
