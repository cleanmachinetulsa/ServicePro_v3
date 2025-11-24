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
      })
      .from(tenants)
      .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);

    if (!tenantRecords || tenantRecords.length === 0) {
      // Set cache headers for 404s (cache for 5 minutes to reduce load)
      res.set('Cache-Control', 'public, max-age=300');
      return res.status(404).json({
        success: false,
        message: 'Site not found',
      });
    }

    const tenant = tenantRecords[0];

    // Block suspended or cancelled tenants from showing public sites
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      res.set('Cache-Control', 'public, max-age=300');
      return res.status(404).json({
        success: false,
        message: 'Site not available',
      });
    }

    // Use wrapTenantDb for proper tenant isolation
    const tenantDb = wrapTenantDb(db, tenant.tenantId);

    // Fetch services for this tenant (with tenant isolation)
    const tenantServices = await tenantDb.db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        category: services.category,
        startingPrice: services.startingPrice,
        durationMinutes: services.durationMinutes,
        isAddon: services.isAddon,
        highlight: services.highlight,
      })
      .from(services)
      .where(tenantDb.filter(services));

    // Fetch FAQs for this tenant (with tenant isolation)
    const tenantFaqs = await tenantDb.db
      .select({
        question: faqEntries.question,
        answer: faqEntries.answer,
      })
      .from(faqEntries)
      .where(tenantDb.filter(faqEntries));

    // Get Industry Pack content if available
    const industryPack = tenant.industryPackId 
      ? getIndustryPack(tenant.industryPackId)
      : null;

    // Use business name from config if available, otherwise from tenant table
    const displayBusinessName = tenant.businessNameFromConfig || tenant.businessName;

    // Build website content with merge logic:
    // TODO Phase 23: Add website_config table for tenant-specific overrides
    // Priority: tenant override > industry pack seed > smart defaults
    const websiteContent = {
      heroHeadline: 
        industryPack?.websiteSeed?.heroHeadline 
        ?? `Welcome to ${displayBusinessName}`,
      heroSubheadline: 
        industryPack?.websiteSeed?.heroSubheadline 
        ?? `Professional ${tenant.industry || 'service'} you can trust`,
      primaryCtaLabel: 
        industryPack?.websiteSeed?.primaryCtaLabel 
        ?? 'Get Started',
      secondaryCtaLabel: 
        industryPack?.websiteSeed?.secondaryCtaLabel 
        ?? 'View Services',
      aboutBlurb: 
        industryPack?.websiteSeed?.aboutBlurb 
        ?? `${displayBusinessName} provides high-quality ${tenant.industry || 'services'} ${tenant.city ? `in ${tenant.city}` : ''}.`,
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
        primaryColor: tenant.colorPrimary,
        accentColor: tenant.colorAccent,
        logoUrl: tenant.logoUrl,
      },
      websiteContent,
      services: tenantServices,
      faqs: tenantFaqs,
      featureFlags,
    };

    // Set cache headers (cache for 10 minutes for public sites)
    res.set('Cache-Control', 'public, max-age=600');
    
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
