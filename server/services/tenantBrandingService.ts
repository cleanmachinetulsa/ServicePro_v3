/**
 * TENANT BRANDING SERVICE
 * 
 * Provides SAFE, white-label multi-tenant branding with proper data isolation.
 * 
 * CRITICAL RULES:
 * - Root tenant (ONLY when tenantId === "root"): Uses Clean Machine branding
 * - Non-root tenants (including null/undefined): Use their OWN tenant-configured branding ONLY
 *   - Fall back to NEUTRAL system defaults (no-reply@servicepro.app, "Your Business")
 *   - NEVER inherit Clean Machine data (phone, email, logo, city, URL)
 * - Passing null/undefined tenantId returns NEUTRAL branding (NOT Clean Machine)
 *   - This prevents accidental data leakage when tenant context is missing
 * 
 * This prevents data leaks between tenants and ensures proper white-labeling.
 */

import { phoneConfig, formatPhoneForDisplay } from '../config/phoneConfig';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { tenantConfig, tenantPhoneConfig } from '../../shared/schema';

export interface TenantBranding {
  businessName: string;
  publicPhone: string | null;
  publicPhoneDisplay: string;
  supportEmail: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  city: string | null;
  industry: string | null;
  // Stage 1C-a: Per-tenant public review URLs (null when not configured — callers must omit the review block rather than render a broken link)
  googleReviewUrl: string | null;
  facebookReviewUrl: string | null;
}

const DEFAULT_SYSTEM_EMAIL = process.env.DEFAULT_SYSTEM_EMAIL || 'no-reply@servicepro.app';
const DEFAULT_BUSINESS_NAME = 'Your Business';

/**
 * Get Clean Machine (root tenant) branding
 * Called dynamically to ensure phoneConfig is populated
 */
function getCleanMachineBranding(): TenantBranding {
  return {
    businessName: 'Clean Machine Auto Detail',
    publicPhone: phoneConfig.twilioMain,
    publicPhoneDisplay: formatPhoneForDisplay(phoneConfig.twilioMain),
    supportEmail: process.env.CM_EMAIL || 'info@cleanmachinetulsa.com',
    websiteUrl: 'https://cleanmachinetulsa.com',
    logoUrl: process.env.CM_LOGO_URL || null,
    city: 'Tulsa, OK',
    industry: 'auto_detailing',
    // Root-tenant defaults — real values live in tenant_config; these are the
    // hard fallback if the row is missing during boot.
    googleReviewUrl: 'https://g.page/r/CQo53O2yXrN8EBM/review',
    facebookReviewUrl: 'https://www.facebook.com/CLEANMACHINETULSA',
  };
}

// Neutral fallback for non-root tenants missing configuration
const NEUTRAL_BRANDING: TenantBranding = {
  businessName: DEFAULT_BUSINESS_NAME,
  publicPhone: null,
  publicPhoneDisplay: '',
  supportEmail: null,
  websiteUrl: null,
  logoUrl: null,
  city: null,
  industry: null,
  googleReviewUrl: null,
  facebookReviewUrl: null,
};

/**
 * Get tenant branding with SAFE fallback logic
 * 
 * CRITICAL: tenantId must be explicitly 'root' to get Clean Machine branding.
 * Passing null/undefined returns NEUTRAL branding to prevent data leakage.
 * 
 * @param tenantId - The tenant ID (ONLY 'root' = Clean Machine)
 * @returns TenantBranding object
 */
export async function getTenantBranding(
  tenantId: string | null | undefined
): Promise<TenantBranding> {
  // If tenantId is null/undefined, return neutral branding immediately to
  // prevent any cross-tenant data leakage.
  if (!tenantId) {
    return { ...NEUTRAL_BRANDING };
  }

  // Stage 1C-a: ALL tenants (including 'root') now read from tenant_config so
  // the seeded google_review_url / facebook_review_url actually drive output
  // instead of the hardcoded constants in getCleanMachineBranding(). For root
  // specifically, getCleanMachineBranding() remains the hard fallback if the
  // DB row is missing or the query fails (e.g. during boot before migrations).
  const isRoot = tenantId === 'root';
  try {
    const [tenant] = await db
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    // Also fetch phone number from tenantPhoneConfig
    const [phoneConfigRow] = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.tenantId, tenantId))
      .limit(1);

    if (tenant) {
      // For root, use Clean Machine constants as field-level fallback when a
      // tenant_config column is null. For non-root, NEVER fall back to Clean
      // Machine — emit null and let callers omit the line.
      const cm = isRoot ? getCleanMachineBranding() : null;
      const publicPhone = phoneConfigRow?.phoneNumber || (cm?.publicPhone ?? null);
      return {
        businessName: tenant.businessName || (cm?.businessName ?? DEFAULT_BUSINESS_NAME),
        publicPhone,
        publicPhoneDisplay: formatPhoneForDisplay(publicPhone),
        supportEmail: tenant.primaryContactEmail || (cm?.supportEmail ?? null),
        websiteUrl: tenant.websiteUrl || (cm?.websiteUrl ?? null),
        logoUrl: tenant.logoUrl || (cm?.logoUrl ?? null),
        city: tenant.primaryCity || (cm?.city ?? null),
        industry: tenant.industryPackId || tenant.industry || (cm?.industry ?? null),
        // Stage 1C-a: tenant_config.google_review_url / facebook_review_url
        googleReviewUrl: tenant.googleReviewUrl || (cm?.googleReviewUrl ?? null),
        facebookReviewUrl: tenant.facebookReviewUrl || (cm?.facebookReviewUrl ?? null),
      };
    }
  } catch (err) {
    console.error(`[BRANDING] Failed to fetch tenant config for '${tenantId}':`, err);
  }

  // No tenant_config row found. For root, fall back to hardcoded Clean Machine
  // defaults so live production output never breaks during boot or migration
  // edge cases. For other tenants, fall back to neutral (NOT Clean Machine).
  return isRoot ? getCleanMachineBranding() : { ...NEUTRAL_BRANDING };
}

/**
 * Get email sender info for a tenant
 * 
 * @param tenantId - The tenant ID (null/undefined = neutral sender)
 * @returns { email, name } for email sending
 */
export async function getTenantFromEmail(
  tenantId: string | null | undefined
): Promise<{ email: string; name: string }> {
  const branding = await getTenantBranding(tenantId);

  return {
    email: branding.supportEmail || DEFAULT_SYSTEM_EMAIL,
    name: branding.businessName,
  };
}

/**
 * Check if a tenant has complete branding configured
 * (useful for showing "Configure branding to publish" messages)
 */
export async function isTenantBrandingComplete(
  tenantId: string | null | undefined
): Promise<boolean> {
  const branding = await getTenantBranding(tenantId);
  
  // Check minimum required fields
  return !!(
    branding.businessName &&
    branding.businessName !== DEFAULT_BUSINESS_NAME &&
    branding.publicPhone &&
    branding.supportEmail
  );
}

/**
 * Get display-ready phone number for customer-facing UI
 * Returns formatted phone or empty string if not configured
 */
export async function getPublicPhoneDisplay(
  tenantId: string | null | undefined
): Promise<string> {
  const branding = await getTenantBranding(tenantId);
  return branding.publicPhoneDisplay;
}

/**
 * Get tel: link phone number for customer-facing UI
 * Returns E.164 format or empty string if not configured
 */
export async function getPublicPhoneTel(
  tenantId: string | null | undefined
): Promise<string> {
  const branding = await getTenantBranding(tenantId);
  return branding.publicPhone || '';
}
