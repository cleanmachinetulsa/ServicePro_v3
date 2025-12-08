// server/routes.publicSite.ts
// ======================================================================
// Public Website API - Phase 9
// Provides read-only tenant data for public-facing marketing sites
// ======================================================================

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { tenants, tenantConfig, services, faqEntries } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getIndustryPack } from '@shared/industryPacks';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for public site endpoint (100 requests per 15 minutes per IP)
const publicSiteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * GET /api/public/site/:subdomain
 * 
 * Returns public website data for a given tenant
 * - Tenant metadata (business name, city, plan tier, status)
 * - Branding (colors, logo)
 * - Website content (hero text, CTAs) from Industry Pack or custom config
 * - Services catalog
 * - FAQ entries
 * - Feature flags (watermark, booking, advanced features)
 * 
 * SECURITY NOTE: This endpoint is PUBLIC and does not require authentication.
 * - Rate limited to 100 requests per 15 minutes per IP
 * - Cached for 10 minutes (success) or 5 minutes (404/errors)
 * - Initial tenant lookup uses global db (necessary to resolve subdomain → tenant ID)
 * - Subdomain is globally unique (enforced by database constraint)
 * - Suspended/cancelled tenants return 404 before exposing any data
 * - All secondary queries (services/FAQs) use wrapTenantDb for proper isolation
 */
router.get('/site/:subdomain', publicSiteLimiter, async (req: Request, res: Response) => {
  try {
    const { subdomain } = req.params;

    // SECURITY: Initial tenant lookup must use global db to resolve subdomain to tenant ID.
    // This is safe because:
    // 1. Subdomain is globally unique (database constraint)
    // 2. We immediately filter out suspended/cancelled tenants (return 404)
    // 3. All subsequent queries use wrapTenantDb for proper multi-tenant isolation
    const tenantRecords = await db
      .select({
        // Tenant basic info
        tenantId: tenants.id,
        subdomain: tenants.subdomain,
        businessName: tenants.name,
        status: tenants.status,
        planTier: tenants.planTier,
        // Config fields
        industry: tenantConfig.industry,
        industryPackId: tenantConfig.industryPackId,
        city: tenantConfig.primaryCity,
        websiteUrl: tenantConfig.websiteUrl,
        colorPrimary: tenantConfig.primaryColor,
        colorAccent: tenantConfig.accentColor,
        logoUrl: tenantConfig.logoUrl,
        businessNameFromConfig: tenantConfig.businessName,
        // CM-4: Public site settings
        publicSiteSettings: tenantConfig.publicSiteSettings,
      })
      .from(tenants)
      .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);

    if (!tenantRecords || tenantRecords.length === 0) {
      console.log(`[PUBLIC SITE] site_not_found: subdomain=${subdomain}`);
      // Set cache headers for 404s (cache for 5 minutes to reduce load)
      res.set('Cache-Control', 'public, max-age=300');
      return res.status(404).json({
        success: false,
        error: 'site_not_found',
        message: 'Site not found',
      });
    }

    const tenant = tenantRecords[0];

    // Block suspended or cancelled tenants from showing public sites
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      console.log(`[PUBLIC SITE] site_not_found (${tenant.status}): subdomain=${subdomain}`);
      res.set('Cache-Control', 'public, max-age=300');
      return res.status(404).json({
        success: false,
        error: 'site_not_found',
        message: 'Site not available',
      });
    }

    // Use wrapTenantDb for proper tenant isolation
    const tenantDb = wrapTenantDb(db, tenant.tenantId);

    // Fetch services for this tenant (with tenant isolation)
    const tenantServices = await tenantDb
      .select({
        id: services.id,
        name: services.name,
        overview: services.overview,
        priceRange: services.priceRange,
        duration: services.duration,
        detailedDescription: services.detailedDescription,
        imageUrl: services.imageUrl,
      })
      .from(services)
      .where(tenantDb.withTenantFilter(services));

    // Fetch FAQs for this tenant (with tenant isolation)
    const tenantFaqs = await tenantDb
      .select({
        question: faqEntries.question,
        answer: faqEntries.answer,
      })
      .from(faqEntries)
      .where(tenantDb.withTenantFilter(faqEntries));

    // Get Industry Pack content if available
    const industryPack = tenant.industryPackId 
      ? getIndustryPack(tenant.industryPackId)
      : null;

    // Use business name from config if available, otherwise from tenant table
    const displayBusinessName = tenant.businessNameFromConfig || tenant.businessName;

    // CM-4: Get public site settings with defaults
    const siteSettings = tenant.publicSiteSettings || {};
    
    // Build website content with merge logic:
    // Priority: tenant publicSiteSettings > industry pack seed > smart defaults
    const websiteContent = {
      heroHeadline: 
        siteSettings.heroTitle ||
        (industryPack?.websiteSeed?.heroHeadline 
        ?? `Welcome to ${displayBusinessName}`),
      heroSubheadline: 
        siteSettings.heroSubtitle ||
        (industryPack?.websiteSeed?.heroSubheadline 
        ?? `Professional ${tenant.industry || 'service'} you can trust`),
      primaryCtaLabel: 
        industryPack?.websiteSeed?.primaryCtaLabel 
        ?? 'Book Now',
      secondaryCtaLabel: 
        industryPack?.websiteSeed?.secondaryCtaLabel 
        ?? 'Check My Rewards',
      aboutBlurb: 
        industryPack?.websiteSeed?.aboutBlurb 
        ?? `${displayBusinessName} provides high-quality ${tenant.industry || 'services'} ${tenant.city ? `in ${tenant.city}` : ''}.`,
      // CM-4: CTA visibility flags
      showRewardsCTA: siteSettings.showRewardsCTA !== false, // default true
      showBookingCTA: siteSettings.showBookingCTA !== false, // default true
      showGiftCardCTA: siteSettings.showGiftCardCTA ?? false, // default false (future)
    };

    // Feature flags based on plan tier
    const planTier = tenant.planTier || 'free';
    const featureFlags = {
      // Free tier shows watermark
      showWatermark: planTier === 'free',
      // Free tier gets contact form only, paid tiers get booking
      canShowBookingForm: ['starter', 'pro', 'elite', 'internal'].includes(planTier),
      // Advanced features for pro+ tiers
      canShowAdvancedSections: ['pro', 'elite', 'internal'].includes(planTier),
    };

    // SP-24: Extract theme configuration from publicSiteSettings
    // Uses correct layout keys from shared/publicSiteThemes.ts
    // Read themeKey (from admin route) or fallback to selectedTheme (legacy) or default
    const themeConfig = {
      themeKey: siteSettings.themeKey || siteSettings.selectedTheme || 'clean-glass',
      heroLayout: siteSettings.heroLayout || 'centered',
      servicesLayout: siteSettings.servicesLayout || 'grid-3',
      testimonialsLayout: siteSettings.testimonialsLayout || 'carousel',
      ctaStyle: siteSettings.ctaStyle || 'centered-buttons',
      showRewards: siteSettings.showRewards !== false,
      showFaq: siteSettings.showFaq !== false,
      showTestimonials: siteSettings.showTestimonials !== false,
      showAbout: siteSettings.showAbout !== false,
      showGallery: siteSettings.showGallery ?? false,
      showWhyChooseUs: siteSettings.showWhyChooseUs ?? true,
    };

    // Compose public site payload
    const siteData = {
      tenant: {
        id: tenant.tenantId,
        subdomain: tenant.subdomain || '',
        businessName: displayBusinessName,
        city: tenant.city,
        planTier: tenant.planTier,
        status: tenant.status,
        industry: tenant.industry,
        industryPackId: tenant.industryPackId,
      },
      branding: {
        // CM-4: Priority: publicSiteSettings colors > tenantConfig colors
        primaryColor: siteSettings.primaryColor || tenant.colorPrimary || '#6366f1',
        accentColor: siteSettings.secondaryColor || tenant.colorAccent || '#a855f7',
        logoUrl: tenant.logoUrl,
      },
      websiteContent,
      services: tenantServices,
      faqs: tenantFaqs,
      featureFlags,
      themeConfig,
    };

    // Set cache headers (cache for 10 minutes for public sites)
    res.set('Cache-Control', 'public, max-age=600');
    
    console.log(`[PUBLIC SITE] public site ok: subdomain=${subdomain} tenantId=${tenant.tenantId}`);
    
    return res.json({
      success: true,
      data: siteData,
    });

  } catch (error) {
    console.error('[PUBLIC SITE] Error fetching site data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load site',
    });
  }
});

export default router;
