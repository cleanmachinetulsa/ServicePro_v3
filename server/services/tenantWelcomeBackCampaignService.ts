import { db } from '../db';
import type { TenantDb } from '../tenantDb';
import { campaignConfigs, customers, loyaltyPoints, pointsTransactions, tenants } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { sendSMS, sendEmail } from '../notifications';
import { addMonths } from 'date-fns';
import { hasFeature } from '@shared/features';

/**
 * ServicePro v3 - Multi-Tenant Welcome Back Campaign System
 * 
 * Allows each tenant to configure and send VIP/Regular customer campaigns
 * with bonus loyalty points. Features:
 * - Per-tenant configuration (points, templates, URLs)
 * - Idempotent points grants (won't double-award same customer)
 * - Multi-channel delivery (SMS + Email)
 * - Preview mode before sending
 * - Plan tier enforcement (requires 'campaigns' feature)
 */

export type CampaignAudience = 'vip' | 'regular';

export interface TenantWelcomeBackCampaignConfig {
  campaignKey: string;         // e.g. 'welcome_back_v1'
  vipPointsBonus: number;      // default 500
  regularPointsBonus: number;  // default 100
  smsTemplateVip: string;
  smsTemplateRegular: string;
  emailTemplateVip?: string;
  emailTemplateRegular?: string;
  bookingBaseUrl: string;
  rewardsBaseUrl: string;
  qrUrlVip?: string;
  qrUrlRegular?: string;
}

export interface TenantWelcomeBackSendOptions {
  tenantId: string;
  audience: CampaignAudience;
  previewOnly?: boolean;
}

export interface TenantWelcomeBackSendResult {
  total: number;
  success: number;
  failed: number;
  errors: { customerId: number; customerName: string; reason: string }[];
  sampleMessage?: string; // For preview mode
}

/**
 * Default campaign templates (Version A from requirements)
 */
const DEFAULT_VIP_SMS_TEMPLATE = `Hey {{customerName}}! 🎉 We miss you at {{businessName}}!

As one of our VIP customers, we've added 500 BONUS POINTS to your rewards account!

Ready to book? 
📅 {{bookingLink}}

Check your rewards:
🏆 {{rewardsLink}}

Reply STOP to opt out`;

const DEFAULT_REGULAR_SMS_TEMPLATE = `Hi {{customerName}}! We miss you at {{businessName}}!

We've added 100 BONUS POINTS to your rewards account as a thank you!

Book your next service:
📅 {{bookingLink}}

View your rewards:
🏆 {{rewardsLink}}

Reply STOP to opt out`;

const DEFAULT_VIP_EMAIL_TEMPLATE = `<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1>Welcome Back, {{customerName}}!</h1>
  <p>We miss you at {{businessName}}!</p>
  <p>As one of our <strong>VIP customers</strong>, we've added <strong>500 BONUS POINTS</strong> to your rewards account!</p>
  <p><a href="{{bookingLink}}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">Book Now</a></p>
  <p><a href="{{rewardsLink}}">Check Your Rewards</a></p>
</body>
</html>`;

const DEFAULT_REGULAR_EMAIL_TEMPLATE = `<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1>We Miss You, {{customerName}}!</h1>
  <p>Thanks for being a valued customer at {{businessName}}!</p>
  <p>We've added <strong>100 BONUS POINTS</strong> to your rewards account!</p>
  <p><a href="{{bookingLink}}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">Book Your Next Service</a></p>
  <p><a href="{{rewardsLink}}">View Your Rewards</a></p>
</body>
</html>`;

/**
 * Get campaign configuration for a tenant
 * Creates default config if none exists
 */
export async function getTenantWelcomeBackCampaignConfig(
  tenantDb: TenantDb,
  tenantId: string
): Promise<TenantWelcomeBackCampaignConfig> {
  const campaignKey = 'welcome_back_v1';

  // Try to fetch existing config
  const [existingConfig] = await tenantDb
    .select()
    .from(campaignConfigs)
    .where(
      and(
        eq(campaignConfigs.tenantId, tenantId),
        eq(campaignConfigs.campaignKey, campaignKey)
      )
    )
    .limit(1);

  if (existingConfig) {
    return {
      campaignKey,
      vipPointsBonus: existingConfig.configJson.vipPointsBonus ?? 500,
      regularPointsBonus: existingConfig.configJson.regularPointsBonus ?? 100,
      smsTemplateVip: existingConfig.configJson.smsTemplateVip ?? DEFAULT_VIP_SMS_TEMPLATE,
      smsTemplateRegular: existingConfig.configJson.smsTemplateRegular ?? DEFAULT_REGULAR_SMS_TEMPLATE,
      emailTemplateVip: existingConfig.configJson.emailTemplateVip ?? DEFAULT_VIP_EMAIL_TEMPLATE,
      emailTemplateRegular: existingConfig.configJson.emailTemplateRegular ?? DEFAULT_REGULAR_EMAIL_TEMPLATE,
      bookingBaseUrl: existingConfig.configJson.bookingBaseUrl ?? 'https://yoursite.com/book',
      rewardsBaseUrl: existingConfig.configJson.rewardsBaseUrl ?? 'https://yoursite.com/rewards',
      qrUrlVip: existingConfig.configJson.qrUrlVip,
      qrUrlRegular: existingConfig.configJson.qrUrlRegular,
    };
  }

  // Create default config
  const defaultConfig: TenantWelcomeBackCampaignConfig = {
    campaignKey,
    vipPointsBonus: 500,
    regularPointsBonus: 100,
    smsTemplateVip: DEFAULT_VIP_SMS_TEMPLATE,
    smsTemplateRegular: DEFAULT_REGULAR_SMS_TEMPLATE,
    emailTemplateVip: DEFAULT_VIP_EMAIL_TEMPLATE,
    emailTemplateRegular: DEFAULT_REGULAR_EMAIL_TEMPLATE,
    bookingBaseUrl: 'https://yoursite.com/book',
    rewardsBaseUrl: 'https://yoursite.com/rewards',
  };

  // Save default config to database
  await tenantDb.insert(campaignConfigs).values({
    tenantId,
    campaignKey,
    configJson: {
      vipPointsBonus: defaultConfig.vipPointsBonus,
      regularPointsBonus: defaultConfig.regularPointsBonus,
      smsTemplateVip: defaultConfig.smsTemplateVip,
      smsTemplateRegular: defaultConfig.smsTemplateRegular,
      emailTemplateVip: defaultConfig.emailTemplateVip,
      emailTemplateRegular: defaultConfig.emailTemplateRegular,
      bookingBaseUrl: defaultConfig.bookingBaseUrl,
      rewardsBaseUrl: defaultConfig.rewardsBaseUrl,
    },
  });

  return defaultConfig;
}

/**
 * Update campaign configuration for a tenant
 */
export async function updateTenantWelcomeBackCampaignConfig(
  tenantDb: TenantDb,
  tenantId: string,
  partial: Partial<Omit<TenantWelcomeBackCampaignConfig, 'campaignKey'>>
): Promise<TenantWelcomeBackCampaignConfig> {
  const campaignKey = 'welcome_back_v1';

  // Get existing config to merge with updates
  const current = await getTenantWelcomeBackCampaignConfig(tenantDb, tenantId);

  const updated = {
    ...current,
    ...partial,
  };

  // Update or insert
  await tenantDb
    .insert(campaignConfigs)
    .values({
      tenantId,
      campaignKey,
      configJson: {
        vipPointsBonus: updated.vipPointsBonus,
        regularPointsBonus: updated.regularPointsBonus,
        smsTemplateVip: updated.smsTemplateVip,
        smsTemplateRegular: updated.smsTemplateRegular,
        emailTemplateVip: updated.emailTemplateVip,
        emailTemplateRegular: updated.emailTemplateRegular,
        bookingBaseUrl: updated.bookingBaseUrl,
        rewardsBaseUrl: updated.rewardsBaseUrl,
        qrUrlVip: updated.qrUrlVip,
        qrUrlRegular: updated.qrUrlRegular,
      },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [campaignConfigs.tenantId, campaignConfigs.campaignKey],
      set: {
        configJson: {
          vipPointsBonus: updated.vipPointsBonus,
          regularPointsBonus: updated.regularPointsBonus,
          smsTemplateVip: updated.smsTemplateVip,
          smsTemplateRegular: updated.smsTemplateRegular,
          emailTemplateVip: updated.emailTemplateVip,
          emailTemplateRegular: updated.emailTemplateRegular,
          bookingBaseUrl: updated.bookingBaseUrl,
          rewardsBaseUrl: updated.rewardsBaseUrl,
          qrUrlVip: updated.qrUrlVip,
          qrUrlRegular: updated.qrUrlRegular,
        },
        updatedAt: new Date(),
      },
    });

  return updated;
}

/**
 * Interpolate template variables
 */
function interpolateTemplate(
  template: string,
  vars: {
    customerName: string;
    businessName: string;
    bookingLink: string;
    rewardsLink: string;
    qrLink?: string;
  }
): string {
  return template
    .replace(/\{\{customerName\}\}/g, vars.customerName)
    .replace(/\{\{businessName\}\}/g, vars.businessName)
    .replace(/\{\{bookingLink\}\}/g, vars.bookingLink)
    .replace(/\{\{rewardsLink\}\}/g, vars.rewardsLink)
    .replace(/\{\{qrLink\}\}/g, vars.qrLink ?? '');
}

/**
 * Check if customer has already received this campaign
 * Uses pointsTransactions with source='campaign' and sourceId=campaignKey+audience
 */
async function hasReceivedCampaign(
  tenantDb: TenantDb,
  customerId: number,
  campaignKey: string,
  audience: CampaignAudience
): Promise<boolean> {
  const sourceId = `${campaignKey}_${audience}`;

  // Check if there's already a points transaction for this campaign
  const [existing] = await tenantDb
    .select({ id: loyaltyPoints.id })
    .from(loyaltyPoints)
    .innerJoin(pointsTransactions, eq(pointsTransactions.loyaltyPointsId, loyaltyPoints.id))
    .where(
      and(
        eq(loyaltyPoints.customerId, customerId),
        eq(pointsTransactions.source, 'campaign'),
        eq(pointsTransactions.sourceId, sourceId)
      )
    )
    .limit(1);

  return !!existing;
}

/**
 * Grant campaign points to a customer (idempotent)
 */
async function grantCampaignPoints(
  tenantDb: TenantDb,
  customerId: number,
  points: number,
  campaignKey: string,
  audience: CampaignAudience
): Promise<void> {
  // Check if already granted
  if (await hasReceivedCampaign(tenantDb, customerId, campaignKey, audience)) {
    console.log(`[Campaign] Customer ${customerId} already received ${campaignKey}_${audience}, skipping points`);
    return;
  }

  // Get or create loyalty points record
  let [pointsRecord] = await tenantDb
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId));

  if (!pointsRecord) {
    // Create new loyalty points record
    [pointsRecord] = await tenantDb
      .insert(loyaltyPoints)
      .values({
        customerId,
        points: 0,
        expiryDate: addMonths(new Date(), 12),
      })
      .returning();
  }

  // Add transaction record
  const sourceId = `${campaignKey}_${audience}`;
  const expiryDate = addMonths(new Date(), 12);

  await tenantDb.insert(pointsTransactions).values({
    loyaltyPointsId: pointsRecord.id,
    amount: points,
    description: `Welcome Back Campaign - ${audience === 'vip' ? 'VIP' : 'Regular'} Bonus`,
    transactionType: 'earn',
    source: 'campaign',
    sourceId,
    expiryDate,
  });

  // Update points balance
  await tenantDb
    .update(loyaltyPoints)
    .set({
      points: pointsRecord.points + points,
      lastUpdated: new Date(),
    })
    .where(eq(loyaltyPoints.id, pointsRecord.id));

  console.log(`[Campaign] Granted ${points} points to customer ${customerId} for ${sourceId}`);
}

/**
 * Send Welcome Back Campaign to target audience
 */
export async function sendTenantWelcomeBackCampaign(
  tenantDb: TenantDb,
  options: TenantWelcomeBackSendOptions
): Promise<TenantWelcomeBackSendResult> {
  const { tenantId, audience, previewOnly = false } = options;

  // Load tenant and verify feature access
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (!hasFeature(tenant, 'campaigns')) {
    throw new Error('Campaigns feature not available for this plan tier');
  }

  // Load campaign config
  const config = await getTenantWelcomeBackCampaignConfig(tenantDb, tenantId);

  // Load tenant business name
  const { tenantConfig } = await import('@shared/schema');
  const [tenantCfg] = await tenantDb
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  const businessName = tenantCfg?.businessName ?? 'Our Business';

  // Determine target points and templates
  const pointsBonus = audience === 'vip' ? config.vipPointsBonus : config.regularPointsBonus;
  const smsTemplate = audience === 'vip' ? config.smsTemplateVip : config.smsTemplateRegular;
  const emailTemplate = audience === 'vip' ? config.emailTemplateVip : config.emailTemplateRegular;
  const qrUrl = audience === 'vip' ? config.qrUrlVip : config.qrUrlRegular;

  // Load target customers
  const targetCustomers = await tenantDb
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        eq(customers.loyaltyProgramOptIn, true),
        eq(customers.isVip, audience === 'vip')
      )
    );

  const result: TenantWelcomeBackSendResult = {
    total: targetCustomers.length,
    success: 0,
    failed: 0,
    errors: [],
  };

  // Preview mode - just return sample message
  if (previewOnly) {
    if (targetCustomers.length > 0) {
      const sampleCustomer = targetCustomers[0];
      const sampleMessage = interpolateTemplate(smsTemplate, {
        customerName: sampleCustomer.name,
        businessName,
        bookingLink: config.bookingBaseUrl,
        rewardsLink: config.rewardsBaseUrl,
        qrLink: qrUrl,
      });
      result.sampleMessage = sampleMessage;
    }
    return result;
  }

  // Send campaign to each customer
  for (const customer of targetCustomers) {
    try {
      // Check if already received this campaign
      if (await hasReceivedCampaign(tenantDb, customer.id, config.campaignKey, audience)) {
        console.log(`[Campaign] Skipping customer ${customer.id} - already received campaign`);
        result.failed++;
        result.errors.push({
          customerId: customer.id,
          customerName: customer.name,
          reason: 'Already received this campaign',
        });
        continue;
      }

      // Grant points
      await grantCampaignPoints(tenantDb, customer.id, pointsBonus, config.campaignKey, audience);

      // Build message
      const templateVars = {
        customerName: customer.name,
        businessName,
        bookingLink: config.bookingBaseUrl,
        rewardsLink: config.rewardsBaseUrl,
        qrLink: qrUrl,
      };

      // Send SMS
      if (customer.phone && customer.smsConsent) {
        const smsMessage = interpolateTemplate(smsTemplate, templateVars);
        const smsResult = await sendSMS(tenantDb, customer.phone, smsMessage);
        if (!smsResult.success) {
          throw new Error(`SMS failed: ${smsResult.error}`);
        }
      }

      // Send Email
      if (customer.email && emailTemplate) {
        const emailBody = interpolateTemplate(emailTemplate, templateVars);
        try {
          await sendEmail({
            to: customer.email,
            subject: `Welcome Back! ${pointsBonus} Bonus Points Added 🎉`,
            html: emailBody,
          });
        } catch (emailError) {
          console.error(`[Campaign] Email failed for customer ${customer.id}:`, emailError);
          // Don't fail the whole operation if email fails
        }
      }

      result.success++;
    } catch (error) {
      console.error(`[Campaign] Failed to process customer ${customer.id}:`, error);
      result.failed++;
      result.errors.push({
        customerId: customer.id,
        customerName: customer.name,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}
