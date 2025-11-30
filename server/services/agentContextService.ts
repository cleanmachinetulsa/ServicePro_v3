/**
 * Phase 10 - Agent Context Service
 * 
 * Builds a structured context snapshot for the AI setup/support agent.
 * This service gathers tenant configuration, feature flags, telephony status,
 * email status, website status, and identifies configuration gaps.
 */

import { db } from '../db';
import { type TenantDb } from '../tenantDb';
import { tenants, tenantConfig, tenantPhoneConfig, services, customers, appointments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { 
  getEnabledFeatures, 
  getDisabledFeatures,
  hasFeature 
} from '@shared/features';
import { getIndustryPack } from '@shared/industryPacks';
import type { 
  AgentContext,
  AgentTenantProfileContext,
  AgentFeatureGateContext,
  AgentTelephonyContext,
  AgentTelephonyHealthStatus,
  AgentEmailContext,
  AgentEmailHealthStatus,
  AgentWebsiteContext,
  AgentWebsiteHealthStatus,
  AgentConfigGap,
} from '@shared/agentContext';
import { getPlanDescription, showsPoweredByWatermark } from '@shared/agentContext';

interface BuildAgentContextParams {
  tenantId: string;
  tenantDb: TenantDb;
}

/**
 * Builds a complete AgentContext for the given tenant
 */
export async function buildAgentContext(params: BuildAgentContextParams): Promise<AgentContext> {
  const { tenantId, tenantDb } = params;
  
  const gaps: AgentConfigGap[] = [];
  
  // 1. Fetch core tenant info
  const tenantProfile = await buildTenantProfile(tenantId, gaps);
  
  // 2. Build feature context
  const features = buildFeatureContext(tenantProfile.planKey);
  
  // 3. Build telephony context (pass tenantDb for multi-tenant safety)
  const telephony = await buildTelephonyContext(tenantId, tenantDb, gaps);
  
  // 4. Build email context
  const email = buildEmailContext(tenantProfile, gaps);
  
  // 5. Build website context
  const website = buildWebsiteContext(tenantProfile, gaps);
  
  // 6. Check for additional gaps
  await checkAdditionalGaps(tenantId, tenantDb, tenantProfile, gaps);
  
  return {
    tenant: tenantProfile,
    features,
    telephony,
    email,
    website,
    gaps,
  };
}

/**
 * Build tenant profile context
 */
async function buildTenantProfile(
  tenantId: string, 
  gaps: AgentConfigGap[]
): Promise<AgentTenantProfileContext> {
  // Use global db since we need to query by tenantId which is the primary key
  const result = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      planTier: tenants.planTier,
      status: tenants.status,
      subdomain: tenants.subdomain,
      businessName: tenantConfig.businessName,
      industry: tenantConfig.industry,
      industryPackId: tenantConfig.industryPackId,
      primaryCity: tenantConfig.primaryCity,
      primaryColor: tenantConfig.primaryColor,
      accentColor: tenantConfig.accentColor,
      logoUrl: tenantConfig.logoUrl,
    })
    .from(tenants)
    .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
    .where(eq(tenants.id, tenantId))
    .limit(1);
    
  if (!result || result.length === 0) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }
  
  const tenant = result[0];
  const displayName = tenant.businessName || tenant.tenantName;
  const planKey = tenant.planTier as AgentTenantProfileContext['planKey'];
  
  // Check for branding gaps
  if (!tenant.logoUrl) {
    gaps.push({
      key: 'branding.no_logo',
      severity: 'info',
      area: 'branding',
      message: 'No logo has been uploaded for this business.',
      suggestion: 'Upload a logo to enhance your professional appearance.',
    });
  }
  
  if (!tenant.primaryColor || tenant.primaryColor === '#3b82f6') {
    gaps.push({
      key: 'branding.default_colors',
      severity: 'info',
      area: 'branding',
      message: 'Using default brand colors.',
      suggestion: 'Customize your brand colors to match your business identity.',
    });
  }
  
  return {
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    planKey,
    status: tenant.status as AgentTenantProfileContext['status'],
    industryKey: tenant.industry,
    industryPackId: tenant.industryPackId,
    subdomain: tenant.subdomain,
    customDomain: null, // TODO: Add custom domain field to schema when available
    city: tenant.primaryCity,
    branding: {
      displayName,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      logoUrl: tenant.logoUrl,
      poweredByServicePro: showsPoweredByWatermark(planKey),
    },
  };
}

/**
 * Build feature gate context
 */
function buildFeatureContext(planKey: string): AgentFeatureGateContext {
  const planTenant = { planTier: planKey };
  
  return {
    enabledFeatures: getEnabledFeatures(planTenant),
    disabledFeatures: getDisabledFeatures(planTenant),
    planDescription: getPlanDescription(planKey),
  };
}

/**
 * Build telephony context
 * 
 * SECURITY: Uses tenantDb.raw with explicit tenantId filter to ensure
 * proper multi-tenant isolation. tenantPhoneConfig is NOT in TABLE_METADATA
 * so we use raw but with explicit where clause on tenantId.
 */
async function buildTelephonyContext(
  tenantId: string,
  tenantDb: TenantDb,
  gaps: AgentConfigGap[]
): Promise<AgentTelephonyContext> {
  let status: AgentTelephonyHealthStatus = 'not_configured';
  const notes: string[] = [];
  const phoneNumbers: AgentTelephonyContext['phoneNumbers'] = [];
  let ivrMode: AgentTelephonyContext['ivrMode'] = null;
  let messagingServiceConfigured = false;
  
  try {
    // Fetch phone config for this tenant using tenantDb.raw with explicit filter
    // tenantPhoneConfig is not in TABLE_METADATA, so we use raw with explicit tenantId check
    const phoneConfigs = await tenantDb.raw
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.tenantId, tenantId));
    
    if (!phoneConfigs || phoneConfigs.length === 0) {
      status = 'not_configured';
      notes.push('No phone number is configured for this tenant.');
      
      gaps.push({
        key: 'telephony.missing_number',
        severity: 'critical',
        area: 'telephony',
        message: 'No phone number is configured for this business.',
        suggestion: 'Set up a dedicated phone number to enable SMS and voice features.',
      });
    } else {
      const config = phoneConfigs[0];
      
      // Build phone number list
      phoneNumbers.push({
        friendlyName: config.phoneNumber,
        phoneNumber: config.phoneNumber,
        isTrialNumber: false, // TODO: Detect trial numbers if tracked
      });
      
      ivrMode = config.ivrMode as AgentTelephonyContext['ivrMode'];
      messagingServiceConfigured = !!config.messagingServiceSid;
      
      if (messagingServiceConfigured) {
        status = 'configured';
        notes.push('Phone number and messaging service are configured.');
      } else {
        status = 'misconfigured';
        notes.push('Phone number exists but messaging service is not configured.');
        
        gaps.push({
          key: 'telephony.missing_messaging_service',
          severity: 'warning',
          area: 'telephony',
          message: 'Messaging service is not configured for this phone number.',
          suggestion: 'Configure a Twilio Messaging Service for reliable SMS delivery.',
        });
      }
      
      // Check for A2P campaign (placeholder - would need actual A2P tracking)
      // For now, add an informational gap about A2P compliance
      gaps.push({
        key: 'telephony.a2p_compliance',
        severity: 'info',
        area: 'telephony',
        message: 'A2P 10DLC campaign registration is required for high-volume SMS.',
        suggestion: 'Ensure your Twilio account has an approved A2P campaign for better deliverability.',
      });
    }
  } catch (error) {
    console.error('[AGENT CONTEXT] Error fetching telephony config:', error);
    status = 'error';
    notes.push('Failed to fetch telephony configuration.');
  }
  
  return {
    status,
    phoneNumbers,
    ivrMode,
    messagingServiceConfigured,
    a2pCampaignStatus: null, // TODO: Fetch from actual A2P tracking if available
    notes,
  };
}

/**
 * Build email context
 * 
 * Note: Currently ServicePro uses a shared SendGrid configuration.
 * In the future, tenants may have individual sender identities.
 */
function buildEmailContext(
  tenantProfile: AgentTenantProfileContext,
  gaps: AgentConfigGap[]
): AgentEmailContext {
  let status: AgentEmailHealthStatus = 'not_configured';
  const notes: string[] = [];
  
  // Check if SendGrid is configured at the platform level
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  
  if (!sendgridApiKey) {
    status = 'not_configured';
    notes.push('Email service is not configured at the platform level.');
    
    gaps.push({
      key: 'email.not_configured',
      severity: 'critical',
      area: 'email',
      message: 'Email service is not configured.',
      suggestion: 'Configure SendGrid API key to enable email notifications.',
    });
  } else {
    // SendGrid is configured, assume sender is verified
    status = 'sender_verified';
    notes.push('SendGrid is configured and ready for sending emails.');
    
    // Check if tenant has a valid business name for email display
    if (!tenantProfile.branding.displayName || tenantProfile.branding.displayName === tenantProfile.tenantName) {
      notes.push('Using tenant name as email display name. Consider setting a business name.');
    }
  }
  
  // TODO: In future, fetch tenant-specific email configuration
  // For now, use platform-level from address
  const fromAddress = process.env.SENDGRID_FROM_EMAIL || 'noreply@servicepro.app';
  
  return {
    status,
    fromAddress,
    displayName: tenantProfile.branding.displayName,
    replyToAddress: null, // TODO: Support tenant-specific reply-to
    notes,
  };
}

/**
 * Build website context
 */
function buildWebsiteContext(
  tenantProfile: AgentTenantProfileContext,
  gaps: AgentConfigGap[]
): AgentWebsiteContext {
  let status: AgentWebsiteHealthStatus = 'not_configured';
  const notes: string[] = [];
  let bookingUrl: string | null = null;
  
  const hasSubdomain = !!tenantProfile.subdomain;
  const hasCustomDomain = !!tenantProfile.customDomain;
  
  if (!hasSubdomain && !hasCustomDomain) {
    status = 'not_configured';
    notes.push('No public website is configured for this tenant.');
    
    gaps.push({
      key: 'website.not_configured',
      severity: 'warning',
      area: 'website',
      message: 'No public website or booking page is set up.',
      suggestion: 'Configure a subdomain to enable your public website and booking page.',
    });
  } else if (hasCustomDomain) {
    status = 'live_custom_domain';
    bookingUrl = `https://${tenantProfile.customDomain}`;
    notes.push(`Public website is live at custom domain: ${tenantProfile.customDomain}`);
  } else if (hasSubdomain) {
    status = 'live_default_domain';
    // Construct the default ServicePro subdomain URL
    bookingUrl = `https://${tenantProfile.subdomain}.serviceproapp.com`;
    notes.push(`Public website is live at: ${bookingUrl}`);
    
    // Check if tenant could benefit from custom domain
    if (!hasFeature({ planTier: tenantProfile.planKey }, 'customDomain')) {
      gaps.push({
        key: 'website.no_custom_domain_access',
        severity: 'info',
        area: 'website',
        message: 'Custom domain feature is not available on your current plan.',
        suggestion: 'Upgrade to Starter or higher to use your own domain name.',
      });
    } else {
      gaps.push({
        key: 'website.custom_domain_available',
        severity: 'info',
        area: 'website',
        message: 'You can use a custom domain with your current plan.',
        suggestion: 'Connect your own domain for a more professional appearance.',
      });
    }
  }
  
  // Check for watermark
  if (showsPoweredByWatermark(tenantProfile.planKey)) {
    notes.push('Website shows "Powered by ServicePro" watermark on free tier.');
    
    gaps.push({
      key: 'website.has_watermark',
      severity: 'info',
      area: 'website',
      message: 'Your website displays a "Powered by ServicePro" watermark.',
      suggestion: 'Upgrade to Starter or higher to remove the watermark.',
    });
  }
  
  return {
    status,
    bookingUrl,
    hasCustomDomain,
    customDomain: tenantProfile.customDomain,
    subdomain: tenantProfile.subdomain,
    notes,
  };
}

/**
 * Check for additional configuration gaps
 */
async function checkAdditionalGaps(
  tenantId: string,
  tenantDb: TenantDb,
  tenantProfile: AgentTenantProfileContext,
  gaps: AgentConfigGap[]
): Promise<void> {
  try {
    // Check if industry is set
    if (!tenantProfile.industryKey && !tenantProfile.industryPackId) {
      gaps.push({
        key: 'industry.not_set',
        severity: 'warning',
        area: 'industry',
        message: 'No industry has been selected for this business.',
        suggestion: 'Select an industry to get pre-configured services, FAQs, and AI behavior.',
      });
    }
    
    // Count services
    const serviceCount = await tenantDb.raw
      .select({ count: services.id })
      .from(services)
      .where(eq(services.tenantId, tenantId));
    
    const servicesTotal = serviceCount[0]?.count ?? 0;
    
    if (servicesTotal === 0) {
      gaps.push({
        key: 'services.none_configured',
        severity: 'critical',
        area: 'other',
        message: 'No services have been added to your business.',
        suggestion: 'Add services so customers can see what you offer and book appointments.',
      });
    } else if (servicesTotal < 3) {
      gaps.push({
        key: 'services.few_configured',
        severity: 'info',
        area: 'other',
        message: `Only ${servicesTotal} service(s) configured. Consider adding more.`,
        suggestion: 'Add more services to give customers a complete picture of your offerings.',
      });
    }
    
    // Count customers
    const customerCount = await tenantDb.raw
      .select({ count: customers.id })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));
    
    const customersTotal = customerCount[0]?.count ?? 0;
    
    if (customersTotal === 0) {
      gaps.push({
        key: 'customers.none_added',
        severity: 'info',
        area: 'other',
        message: 'No customers have been added yet.',
        suggestion: 'Start adding customers to track appointments and build relationships.',
      });
    }
    
    // Check billing status
    if (tenantProfile.status === 'past_due') {
      gaps.push({
        key: 'billing.past_due',
        severity: 'critical',
        area: 'billing',
        message: 'Your subscription payment is past due.',
        suggestion: 'Update your payment method to avoid service interruption.',
      });
    } else if (tenantProfile.status === 'trialing') {
      gaps.push({
        key: 'billing.in_trial',
        severity: 'info',
        area: 'billing',
        message: 'You are currently in a trial period.',
        suggestion: 'Subscribe to a plan before your trial ends to keep access to features.',
      });
    }
    
  } catch (error) {
    console.error('[AGENT CONTEXT] Error checking additional gaps:', error);
  }
}
