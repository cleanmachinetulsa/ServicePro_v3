/**
 * Tenant Readiness Engine Service
 * 
 * Computes a comprehensive readiness report for any tenant by checking
 * branding, website, telephony, email, AI features, and conversations.
 * 
 * Reuses patterns from the Agent Context Engine (agentContextService.ts)
 * for consistency.
 */

import {
  TenantReadinessReport,
  ReadinessCategory,
  ReadinessItem,
  ReadinessStatus,
  computeOverallStatus,
  computeSummary,
} from '../../shared/readinessTypes';
import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import {
  tenants,
  tenantConfig,
  tenantPhoneConfig,
  tenantEmailProfiles,
  services,
  conversations,
  messages,
} from '@shared/schema';
import { eq, desc, gte, count, and } from 'drizzle-orm';

const hasGlobalSendGridConfig = (): boolean => {
  return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
};

interface TenantData {
  id: string;
  name: string;
  subdomain: string | null;
  planTier: string;
  status: string;
  businessName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  industry: string | null;
  industryPackId: string | null;
}

async function lookupTenantBySubdomainOrId(identifier: string): Promise<TenantData | null> {
  const result = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      planTier: tenants.planTier,
      status: tenants.status,
      businessName: tenantConfig.businessName,
      logoUrl: tenantConfig.logoUrl,
      primaryColor: tenantConfig.primaryColor,
      accentColor: tenantConfig.accentColor,
      industry: tenantConfig.industry,
      industryPackId: tenantConfig.industryPackId,
    })
    .from(tenants)
    .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
    .where(eq(tenants.subdomain, identifier))
    .limit(1);

  if (result && result.length > 0) {
    return result[0];
  }

  const resultById = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      planTier: tenants.planTier,
      status: tenants.status,
      businessName: tenantConfig.businessName,
      logoUrl: tenantConfig.logoUrl,
      primaryColor: tenantConfig.primaryColor,
      accentColor: tenantConfig.accentColor,
      industry: tenantConfig.industry,
      industryPackId: tenantConfig.industryPackId,
    })
    .from(tenants)
    .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
    .where(eq(tenants.id, identifier))
    .limit(1);

  if (resultById && resultById.length > 0) {
    return resultById[0];
  }

  return null;
}

function checkBranding(tenant: TenantData): ReadinessCategory {
  const items: ReadinessItem[] = [];

  items.push({
    key: 'tenant.exists',
    label: 'Tenant record exists',
    status: 'pass',
    details: `Tenant ID: ${tenant.id}`,
  });

  if (tenant.name && tenant.name.trim().length > 2) {
    items.push({
      key: 'tenant.name',
      label: 'Tenant name set',
      status: 'pass',
      details: tenant.name,
    });
  } else {
    items.push({
      key: 'tenant.name',
      label: 'Tenant name set',
      status: 'warn',
      details: tenant.name || 'Not set',
      suggestion: 'Set a descriptive business name in tenant settings.',
    });
  }

  items.push({
    key: 'tenant.subdomain',
    label: 'Tenant subdomain configured',
    status: tenant.subdomain ? 'pass' : 'warn',
    details: tenant.subdomain || 'Not set',
  });

  const hasLogo = !!tenant.logoUrl;
  const hasCustomColor = tenant.primaryColor && tenant.primaryColor !== '#3b82f6';

  if (hasLogo && hasCustomColor) {
    items.push({
      key: 'branding.visual_identity',
      label: 'Logo and brand colors configured',
      status: 'pass',
      details: 'Both logo and custom brand color are set.',
    });
  } else if (hasLogo || hasCustomColor) {
    items.push({
      key: 'branding.visual_identity',
      label: 'Logo and brand colors configured',
      status: 'warn',
      details: hasLogo ? 'Logo set, but using default colors' : 'Custom color set, but no logo',
      suggestion: hasLogo 
        ? 'Customize your brand colors to match your logo.' 
        : 'Upload a logo in Settings → Branding.',
    });
  } else {
    items.push({
      key: 'branding.visual_identity',
      label: 'Logo and brand colors configured',
      status: 'warn',
      details: 'Using default branding.',
      suggestion: 'Upload a logo and customize colors in Settings → Branding.',
    });
  }

  return {
    id: 'branding',
    label: 'Branding & Identity',
    items,
  };
}

function checkWebsiteBooking(tenant: TenantData, serviceCount: number): ReadinessCategory {
  const items: ReadinessItem[] = [];

  const hasWebsite = !!tenant.subdomain;
  
  if (hasWebsite) {
    items.push({
      key: 'website.enabled',
      label: 'Website/booking page enabled',
      status: 'pass',
      details: `Subdomain: ${tenant.subdomain}`,
    });

    const bookingUrl = `https://${tenant.subdomain}.serviceproapp.com`;
    items.push({
      key: 'website.booking_url',
      label: 'Public booking URL available',
      status: 'pass',
      details: bookingUrl,
    });
  } else {
    items.push({
      key: 'website.enabled',
      label: 'Website/booking page enabled',
      status: 'warn',
      details: 'No subdomain configured.',
      suggestion: 'Configure a subdomain to enable your public website.',
    });

    items.push({
      key: 'website.booking_url',
      label: 'Public booking URL available',
      status: 'warn',
      details: 'Cannot generate URL without subdomain.',
      suggestion: 'Set up a subdomain first.',
    });
  }

  if (serviceCount === 0) {
    items.push({
      key: 'booking.services_configured',
      label: 'Services configured for booking',
      status: 'fail',
      details: '0 active services.',
      suggestion: 'Add at least one service so customers can book appointments.',
    });
  } else if (serviceCount < 3) {
    items.push({
      key: 'booking.services_configured',
      label: 'Services configured for booking',
      status: 'warn',
      details: `${serviceCount} service(s) configured.`,
      suggestion: 'Consider adding more services to give customers more options.',
    });
  } else {
    items.push({
      key: 'booking.services_configured',
      label: 'Services configured for booking',
      status: 'pass',
      details: `${serviceCount} services configured.`,
    });
  }

  return {
    id: 'website',
    label: 'Website & Booking',
    items,
  };
}

interface PhoneConfigData {
  phoneNumber: string | null;
  messagingServiceSid: string | null;
  ivrMode: string | null;
}

async function checkTelephony(tenantId: string): Promise<ReadinessCategory> {
  const items: ReadinessItem[] = [];

  const phoneConfigs = await db
    .select({
      phoneNumber: tenantPhoneConfig.phoneNumber,
      messagingServiceSid: tenantPhoneConfig.messagingServiceSid,
      ivrMode: tenantPhoneConfig.ivrMode,
    })
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.tenantId, tenantId))
    .limit(1);

  if (!phoneConfigs || phoneConfigs.length === 0) {
    items.push({
      key: 'telephony.phone_config_exists',
      label: 'Phone configuration exists',
      status: 'fail',
      details: 'No phone configuration found.',
      suggestion: 'Set up a phone number in Admin → Phone Config.',
    });

    items.push({
      key: 'telephony.sms_number_present',
      label: 'SMS number configured',
      status: 'fail',
      details: 'No phone config row.',
    });

    items.push({
      key: 'telephony.ivr_mode_configured',
      label: 'IVR mode configured',
      status: 'fail',
      details: 'No phone config row.',
    });

    return {
      id: 'telephony',
      label: 'Telephony',
      items,
    };
  }

  const config = phoneConfigs[0];

  items.push({
    key: 'telephony.phone_config_exists',
    label: 'Phone configuration exists',
    status: 'pass',
    details: 'Phone config row found.',
  });

  const isE164 = config.phoneNumber && /^\+[1-9]\d{1,14}$/.test(config.phoneNumber);
  if (config.phoneNumber && isE164) {
    items.push({
      key: 'telephony.sms_number_present',
      label: 'SMS number configured',
      status: 'pass',
      details: config.phoneNumber,
    });
  } else if (config.phoneNumber) {
    items.push({
      key: 'telephony.sms_number_present',
      label: 'SMS number configured',
      status: 'warn',
      details: `Number "${config.phoneNumber}" may not be in E.164 format.`,
      suggestion: 'Verify the phone number format is +1XXXXXXXXXX.',
    });
  } else {
    items.push({
      key: 'telephony.sms_number_present',
      label: 'SMS number configured',
      status: 'warn',
      details: 'Phone config exists but no number set.',
      suggestion: 'Add an SMS-capable phone number.',
    });
  }

  const validIvrModes = ['simple', 'full_ivr', 'ai_concierge'];
  if (config.ivrMode && validIvrModes.includes(config.ivrMode)) {
    items.push({
      key: 'telephony.ivr_mode_configured',
      label: 'IVR mode configured',
      status: 'pass',
      details: `Mode: ${config.ivrMode}`,
    });
  } else if (config.ivrMode) {
    items.push({
      key: 'telephony.ivr_mode_configured',
      label: 'IVR mode configured',
      status: 'warn',
      details: `Mode "${config.ivrMode}" may be a placeholder.`,
      suggestion: 'Configure a valid IVR mode in Phone Settings.',
    });
  } else {
    items.push({
      key: 'telephony.ivr_mode_configured',
      label: 'IVR mode configured',
      status: 'warn',
      details: 'IVR mode not set.',
      suggestion: 'Set an IVR mode (simple, full_ivr, or ai_concierge).',
    });
  }

  if (config.messagingServiceSid) {
    items.push({
      key: 'telephony.messaging_service',
      label: 'Twilio Messaging Service configured',
      status: 'pass',
      details: 'MessagingServiceSid present.',
    });
  } else {
    items.push({
      key: 'telephony.messaging_service',
      label: 'Twilio Messaging Service configured',
      status: 'warn',
      details: 'No MessagingServiceSid.',
      suggestion: 'Configure a Twilio Messaging Service for better SMS deliverability.',
    });
  }

  return {
    id: 'telephony',
    label: 'Telephony',
    items,
  };
}

async function checkEmail(tenantId: string): Promise<ReadinessCategory> {
  const items: ReadinessItem[] = [];

  const hasGlobalConfig = hasGlobalSendGridConfig();

  if (hasGlobalConfig) {
    items.push({
      key: 'email.global_sendgrid_config_present',
      label: 'Platform SendGrid configured',
      status: 'pass',
      details: 'SENDGRID_API_KEY and SENDGRID_FROM_EMAIL are set.',
    });
  } else {
    items.push({
      key: 'email.global_sendgrid_config_present',
      label: 'Platform SendGrid configured',
      status: 'warn',
      details: 'Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL.',
      suggestion: 'Set SendGrid environment variables for email functionality.',
    });

    return {
      id: 'email',
      label: 'Email',
      items,
    };
  }

  const emailProfiles = await db
    .select({
      fromName: tenantEmailProfiles.fromName,
      replyToEmail: tenantEmailProfiles.replyToEmail,
      status: tenantEmailProfiles.status,
    })
    .from(tenantEmailProfiles)
    .where(eq(tenantEmailProfiles.tenantId, tenantId))
    .limit(1);

  if (!emailProfiles || emailProfiles.length === 0) {
    items.push({
      key: 'email.tenant_profile_exists',
      label: 'Tenant email profile exists',
      status: 'warn',
      details: 'No tenant-specific email profile.',
      suggestion: 'Create an email profile to customize reply-to addresses.',
    });

    items.push({
      key: 'email.reply_to_configured',
      label: 'Reply-to email configured',
      status: 'warn',
      details: 'Will use platform defaults.',
    });

    return {
      id: 'email',
      label: 'Email',
      items,
    };
  }

  const profile = emailProfiles[0];

  items.push({
    key: 'email.tenant_profile_exists',
    label: 'Tenant email profile exists',
    status: 'pass',
    details: profile.fromName ? `From name: ${profile.fromName}` : 'Profile exists.',
  });

  if (profile.replyToEmail) {
    items.push({
      key: 'email.reply_to_configured',
      label: 'Reply-to email configured',
      status: 'pass',
      details: profile.replyToEmail,
    });
  } else {
    items.push({
      key: 'email.reply_to_configured',
      label: 'Reply-to email configured',
      status: 'warn',
      details: 'No reply-to email set.',
      suggestion: 'Set a reply-to email so customer responses go to the right inbox.',
    });
  }

  if (profile.status === 'healthy') {
    items.push({
      key: 'email.status_healthy',
      label: 'Email status healthy',
      status: 'pass',
      details: 'Last email sent successfully.',
    });
  } else if (profile.status === 'error') {
    items.push({
      key: 'email.status_healthy',
      label: 'Email status healthy',
      status: 'warn',
      details: 'Last email send had an error.',
      suggestion: 'Check SendGrid dashboard and verify email settings.',
    });
  } else {
    items.push({
      key: 'email.status_healthy',
      label: 'Email status healthy',
      status: 'warn',
      details: `Status: ${profile.status || 'unknown'}`,
      suggestion: 'Send a test email to verify configuration.',
    });
  }

  return {
    id: 'email',
    label: 'Email',
    items,
  };
}

function checkAiBookingEngine(tenant: TenantData): ReadinessCategory {
  const items: ReadinessItem[] = [];

  const validPlans = ['free', 'starter', 'pro', 'elite', 'internal'];
  if (tenant.planTier && validPlans.includes(tenant.planTier)) {
    items.push({
      key: 'ai.plan_tier',
      label: 'Plan tier configured',
      status: 'pass',
      details: `Plan: ${tenant.planTier}`,
    });
  } else if (tenant.planTier) {
    items.push({
      key: 'ai.plan_tier',
      label: 'Plan tier configured',
      status: 'warn',
      details: `Plan "${tenant.planTier}" may be invalid.`,
      suggestion: 'Verify plan tier is one of: free, starter, pro, elite, internal.',
    });
  } else {
    items.push({
      key: 'ai.plan_tier',
      label: 'Plan tier configured',
      status: 'warn',
      details: 'No plan tier set.',
      suggestion: 'Set a plan tier for proper feature gating.',
    });
  }

  const aiEnabledPlans = ['pro', 'elite', 'internal'];
  const hasAiFeatures = aiEnabledPlans.includes(tenant.planTier || '');

  if (hasAiFeatures) {
    items.push({
      key: 'ai.booking_engine_enabled',
      label: 'AI booking engine enabled',
      status: 'pass',
      details: `AI features available on ${tenant.planTier} plan.`,
    });
  } else {
    items.push({
      key: 'ai.booking_engine_enabled',
      label: 'AI booking engine enabled',
      status: 'warn',
      details: `AI features not included in ${tenant.planTier || 'free'} plan.`,
      suggestion: 'Upgrade to Pro or higher for AI SMS and voice features.',
    });
  }

  if (tenant.industry || tenant.industryPackId) {
    items.push({
      key: 'ai.industry_configured',
      label: 'Industry pack configured',
      status: 'pass',
      details: tenant.industry || tenant.industryPackId || 'Set',
    });
  } else {
    items.push({
      key: 'ai.industry_configured',
      label: 'Industry pack configured',
      status: 'warn',
      details: 'No industry selected.',
      suggestion: 'Select an industry for optimized AI behavior and templates.',
    });
  }

  return {
    id: 'ai_booking',
    label: 'AI & Booking Engine',
    items,
  };
}

async function checkConversations(tenantId: string): Promise<ReadinessCategory> {
  const items: ReadinessItem[] = [];

  try {
    const conversationResults = await db
      .select({ cnt: count() })
      .from(conversations)
      .where(eq(conversations.tenantId, tenantId));

    const totalConversations = conversationResults[0]?.cnt ?? 0;

    items.push({
      key: 'conversations.schema_present',
      label: 'Conversations table accessible',
      status: 'pass',
      details: `${totalConversations} total conversation(s).`,
    });

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentConversations = await db
        .select({ cnt: count() })
        .from(conversations)
        .where(
          and(
            eq(conversations.tenantId, tenantId),
            gte(conversations.lastMessageAt, thirtyDaysAgo)
          )
        );

      const recentCount = recentConversations[0]?.cnt ?? 0;

      if (recentCount === 0 && totalConversations > 0) {
        items.push({
          key: 'conversations.any_recent_activity',
          label: 'Recent conversation activity',
          status: 'warn',
          details: 'No conversations in the last 30 days.',
          suggestion: 'This tenant may not be actively using messaging yet.',
        });
      } else if (recentCount === 0) {
        items.push({
          key: 'conversations.any_recent_activity',
          label: 'Recent conversation activity',
          status: 'warn',
          details: 'No conversations recorded yet.',
          suggestion: 'This is expected for new tenants or those not yet live.',
        });
      } else {
        items.push({
          key: 'conversations.any_recent_activity',
          label: 'Recent conversation activity',
          status: 'pass',
          details: `${recentCount} conversation(s) in the last 30 days.`,
        });
      }
    } catch {
      items.push({
        key: 'conversations.any_recent_activity',
        label: 'Recent conversation activity',
        status: 'warn',
        details: 'Could not check recent activity.',
        suggestion: 'Ensure lastMessageAt field is populated.',
      });
    }

  } catch (error) {
    items.push({
      key: 'conversations.schema_present',
      label: 'Conversations table accessible',
      status: 'warn',
      details: 'Error querying conversations table.',
      suggestion: 'Check database schema.',
    });
  }

  return {
    id: 'conversations',
    label: 'Night Ops / Conversations',
    items,
  };
}

export async function getTenantReadinessReportBySlug(identifier: string): Promise<TenantReadinessReport> {
  const tenant = await lookupTenantBySubdomainOrId(identifier);

  if (!tenant) {
    throw new Error(`Tenant not found: ${identifier}`);
  }

  const serviceResults = await db
    .select({ cnt: count() })
    .from(services)
    .where(eq(services.tenantId, tenant.id));

  const serviceCount = serviceResults[0]?.cnt ?? 0;

  const categories: ReadinessCategory[] = [];

  categories.push(checkBranding(tenant));
  categories.push(checkWebsiteBooking(tenant, serviceCount));
  categories.push(await checkTelephony(tenant.id));
  categories.push(await checkEmail(tenant.id));
  categories.push(checkAiBookingEngine(tenant));
  categories.push(await checkConversations(tenant.id));

  const overallStatus = computeOverallStatus(categories);
  const summary = computeSummary(categories);

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.subdomain || tenant.id,
    tenantName: tenant.businessName || tenant.name,
    generatedAt: new Date().toISOString(),
    overallStatus,
    categories,
    summary,
  };
}

export async function getTenantReadinessReportById(tenantId: string): Promise<TenantReadinessReport> {
  return getTenantReadinessReportBySlug(tenantId);
}
