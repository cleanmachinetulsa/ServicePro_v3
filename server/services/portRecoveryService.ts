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
import { awardPoints } from '../gamificationService';

// Default SMS template for port recovery
const DEFAULT_SMS_TEMPLATE = `Hey this is Jody with Clean Machine Auto Detail. We recently upgraded our phone & text system, and there's a small chance we missed a message from you. I'm really sorry if that happened. To make it right, we've added 500 reward points to your account – you can use them toward interior protection, engine bay cleaning, or save them up toward a maintenance detail. Tap here to view options & book: {{bookingUrl}}. Reply STOP to unsubscribe.`;

// Default email subject
const DEFAULT_EMAIL_SUBJECT = "We may have missed your message – here's 500 points to make it right";

/**
 * Normalize phone number to E.164 format for deduplication
 */
function normalizePhone(phone: string | null | undefined): string | null {
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
  
  // 1. Pull from customers table
  const customerRows = await tenantDb
    .select({
      id: customers.id,
      phone: customers.phone,
      email: customers.email,
      name: customers.name,
      smsConsent: customers.smsConsent,
    })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        // Respect SMS consent - include customers who have consented or never responded
        or(
          eq(customers.smsConsent, true),
          sql`${customers.smsConsent} IS NULL`
        )
      )
    );
  
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
  
  // Create campaign
  const [campaign] = await tenantDb
    .insert(portRecoveryCampaigns)
    .values({
      tenantId,
      name: campaignName,
      createdByUserId,
      status: 'draft',
      totalTargets: stats.totalUnique,
      pointsPerCustomer: 500,
      smsTemplate: DEFAULT_SMS_TEMPLATE,
      emailSubject: DEFAULT_EMAIL_SUBJECT,
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

/**
 * Grant points to a customer for port recovery
 * Uses existing gamificationService for consistency
 */
async function grantPortRecoveryPoints(
  tenantDb: TenantDb,
  customerId: number,
  points: number,
  campaignId: number
): Promise<{ success: boolean; currentPoints: number }> {
  return await awardPoints(
    tenantDb,
    customerId,
    points,
    'port_recovery',
    campaignId,
    `Port recovery apology - ${points} loyalty points`
  );
}

/**
 * Send SMS for a target
 */
async function sendPortRecoverySms(
  target: PortRecoveryTarget,
  template: string,
  fromNumber: string
): Promise<{ success: boolean; twilioSid?: string; error?: string }> {
  if (!target.phone) {
    return { success: false, error: 'No phone number' };
  }
  
  if (!twilioClient) {
    return { success: false, error: 'Twilio client not configured' };
  }
  
  try {
    // Replace placeholders in template
    const bookingUrl = 'https://cleanmachinetulsa.com/book';
    const messageBody = template.replace('{{bookingUrl}}', bookingUrl);
    
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
  campaignId: number
): Promise<{ success: boolean; error?: string }> {
  if (!target.email) {
    return { success: false, error: 'No email address' };
  }
  
  try {
    // Import SendGrid dynamically
    const sgMail = (await import('@sendgrid/mail')).default;
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      return { success: false, error: 'SendGrid not configured' };
    }
    
    sgMail.setApiKey(apiKey);
    
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@cleanmachinetulsa.com';
    const bookingUrl = 'https://cleanmachinetulsa.com/book';
    
    await sgMail.send({
      to: target.email,
      from: fromEmail,
      subject: subject,
      text: `Hey${target.customerName ? ` ${target.customerName}` : ''}!\n\nWe recently upgraded our phone & text system at Clean Machine Auto Detail, and there's a small chance we missed a message from you. I'm really sorry if that happened.\n\nTo make it right, we've added 500 reward points to your account – you can use them toward interior protection, engine bay cleaning, or save them up toward a maintenance detail.\n\nTap here to view options & book: ${bookingUrl}\n\nThank you for your patience!\n\nJody\nClean Machine Auto Detail`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">We May Have Missed Your Message</h2>
          <p>Hey${target.customerName ? ` ${target.customerName}` : ''}!</p>
          <p>We recently upgraded our phone & text system at Clean Machine Auto Detail, and there's a small chance we missed a message from you. I'm really sorry if that happened.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #059669; margin-top: 0;">🎁 500 Points Added!</h3>
            <p>To make it right, we've added <strong>500 reward points</strong> to your account – you can use them toward interior protection, engine bay cleaning, or save them up toward a maintenance detail.</p>
          </div>
          <a href="${bookingUrl}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">View Options & Book</a>
          <p style="margin-top: 30px;">Thank you for your patience!</p>
          <p><strong>Jody</strong><br>Clean Machine Auto Detail</p>
        </div>
      `,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error(`[PORT RECOVERY] Email failed for ${target.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Process a batch of targets for the campaign
 */
export async function runPortRecoveryBatch(
  tenantDb: TenantDb,
  campaignId: number,
  limit: number = 100
): Promise<{
  processed: number;
  smsSent: number;
  emailSent: number;
  pointsGranted: number;
  errors: number;
  isComplete: boolean;
}> {
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
  let emailSent = 0;
  let totalPointsGranted = 0;
  let errors = 0;
  
  const fromNumber = process.env.MAIN_PHONE_NUMBER || process.env.TWILIO_TEST_SMS_NUMBER || '';
  
  for (const target of targets) {
    const updates: Partial<PortRecoveryTarget> = {
      processedAt: new Date(),
      updatedAt: new Date(),
    };
    
    // 1. Grant points if customer exists
    if (target.customerId) {
      const pointsResult = await grantPortRecoveryPoints(
        tenantDb,
        target.customerId,
        campaign.pointsPerCustomer,
        campaignId
      );
      
      if (pointsResult.success) {
        updates.pointsGranted = campaign.pointsPerCustomer;
        totalPointsGranted += campaign.pointsPerCustomer;
      }
    }
    
    // 2. Send SMS if phone exists
    if (target.phone && fromNumber) {
      const smsResult = await sendPortRecoverySms(
        target,
        campaign.smsTemplate || DEFAULT_SMS_TEMPLATE,
        fromNumber
      );
      
      if (smsResult.success) {
        updates.smsStatus = 'sent';
        updates.twilioSid = smsResult.twilioSid;
        smsSent++;
      } else {
        updates.smsStatus = 'failed';
        updates.smsErrorMessage = smsResult.error;
        errors++;
      }
    } else {
      updates.smsStatus = 'skipped';
      updates.smsErrorMessage = !target.phone ? 'No phone number' : 'No from number configured';
    }
    
    // 3. Send email if email exists
    if (target.email) {
      const emailResult = await sendPortRecoveryEmail(
        target,
        campaign.emailSubject || DEFAULT_EMAIL_SUBJECT,
        campaignId
      );
      
      if (emailResult.success) {
        updates.emailStatus = 'sent';
        emailSent++;
      } else {
        updates.emailStatus = 'failed';
        updates.emailErrorMessage = emailResult.error;
      }
    } else {
      updates.emailStatus = 'skipped';
    }
    
    // Update target record
    await tenantDb
      .update(portRecoveryTargets)
      .set(updates)
      .where(eq(portRecoveryTargets.id, target.id));
  }
  
  // Update campaign stats
  await tenantDb
    .update(portRecoveryCampaigns)
    .set({
      totalSmsSent: sql`${portRecoveryCampaigns.totalSmsSent} + ${smsSent}`,
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
 */
export async function sendTestSms(
  tenantDb: TenantDb,
  campaignId: number
): Promise<{ success: boolean; error?: string }> {
  const campaign = await getCampaign(tenantDb, campaignId);
  if (!campaign) {
    return { success: false, error: 'Campaign not found' };
  }
  
  const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
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
    const bookingUrl = 'https://cleanmachinetulsa.com/book';
    const messageBody = (campaign.smsTemplate || DEFAULT_SMS_TEMPLATE)
      .replace('{{bookingUrl}}', bookingUrl);
    
    await twilioClient.messages.create({
      to: ownerPhone,
      from: fromNumber,
      body: `[TEST] ${messageBody}`,
    });
    
    console.log(`[PORT RECOVERY] Test SMS sent to ${ownerPhone}`);
    return { success: true };
  } catch (error: any) {
    console.error('[PORT RECOVERY] Test SMS failed:', error.message);
    return { success: false, error: error.message };
  }
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
