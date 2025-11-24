// server/routes.publicSite.ts
// ======================================================================
// Public Website API - Phase 9
// Provides read-only tenant data for public-facing marketing sites
// ======================================================================

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { tenants, tenantConfig, services, faq } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getIndustryPack } from '@shared/industryPacks';

const router = Router();

/**
 * GET /api/public/site/:slug
 * 
 * Returns public website data for a given tenant
 * - Tenant metadata (business name, city, plan tier, status)
 * - Branding (colors, logo)
 * - Website content (hero text, CTAs) from Industry Pack or custom config
 * - Services catalog
 * - FAQ entries
 * - Feature flags (watermark, booking, advanced features)
 * 
 * This endpoint is PUBLIC and does not require authentication
 */
router.get('/site/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Lookup tenant by slug
    const tenantRecords = await db
      .select({
        // Tenant basic info
        tenantId: tenants.id,
        slug: tenants.slug,
        businessName: tenants.businessName,
        status: tenants.status,
        planTier: tenants.planTier,
        // Config fields
        industry: tenantConfig.industry,
        industryPackId: tenantConfig.industryPackId,
        city: tenantConfig.city,
        websiteUrl: tenantConfig.websiteUrl,
        colorPrimary: tenantConfig.colorPrimary,
        colorAccent: tenantConfig.colorAccent,
        logoUrl: tenantConfig.logoUrl,
      })
      .from(tenants)
      .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (!tenantRecords || tenantRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site not found',
      });
    }

    const tenant = tenantRecords[0];

    // Block suspended or cancelled tenants from showing public sites
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      return res.status(404).json({
        success: false,
        message: 'Site not available',
      });
    }

    // Fetch services for this tenant
    const tenantServices = await db
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
      .where(eq(services.tenantId, tenant.tenantId));

    // Fetch FAQs for this tenant
    const tenantFaqs = await db
      .select({
        question: faq.question,
        answer: faq.answer,
      })
      .from(faq)
      .where(eq(faq.tenantId, tenant.tenantId));

    // Get Industry Pack content if available
    const industryPack = tenant.industryPackId 
      ? getIndustryPack(tenant.industryPackId)
      : null;

    // Build website content with merge logic:
    // TODO Phase 23: Add website_config table for tenant-specific overrides
    // Priority: tenant override > industry pack seed > smart defaults
    const websiteContent = {
      heroHeadline: 
        industryPack?.websiteSeed?.heroHeadline 
        ?? `Welcome to ${tenant.businessName}`,
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
        ?? `${tenant.businessName} provides high-quality ${tenant.industry || 'services'} ${tenant.city ? `in ${tenant.city}` : ''}.`,
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
        slug: tenant.slug || '',
        businessName: tenant.businessName,
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
