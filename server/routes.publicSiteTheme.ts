/**
 * SP-24: Public Site Theme Routes
 * Admin endpoints for managing public site themes and layout configurations
 */

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { 
  PUBLIC_SITE_THEMES, 
  DEFAULT_THEME_CONFIG,
  type PublicSiteThemeKey,
  type HeroLayoutKey,
  type CtaStyleKey,
  type ServicesLayoutKey,
  type TestimonialsLayoutKey,
} from '@shared/publicSiteThemes';

const router = Router();

const themeKeys: PublicSiteThemeKey[] = ["clean-glass", "bold-gradient", "minimal-light", "dark-professional", "warm-friendly"];
const heroLayoutKeys: HeroLayoutKey[] = ["centered", "image-left", "image-right", "full-width-bg"];
const ctaStyleKeys: CtaStyleKey[] = ["full-width-bar", "centered-buttons", "floating-sticky"];
const servicesLayoutKeys: ServicesLayoutKey[] = ["grid-3", "grid-2", "list"];
const testimonialsLayoutKeys: TestimonialsLayoutKey[] = ["carousel", "stacked"];

const themeConfigSchema = z.object({
  themeKey: z.enum(themeKeys as [string, ...string[]]).optional(),
  heroLayout: z.enum(heroLayoutKeys as [string, ...string[]]).optional(),
  servicesLayout: z.enum(servicesLayoutKeys as [string, ...string[]]).optional(),
  testimonialsLayout: z.enum(testimonialsLayoutKeys as [string, ...string[]]).optional(),
  ctaStyle: z.enum(ctaStyleKeys as [string, ...string[]]).optional(),
  showTestimonials: z.boolean().optional(),
  showFaq: z.boolean().optional(),
  showGallery: z.boolean().optional(),
  showWhyChooseUs: z.boolean().optional(),
  showAbout: z.boolean().optional(),
  showRewards: z.boolean().optional(),
});

/**
 * GET /api/admin/public-site-theme
 * Get the current theme configuration for the tenant
 */
router.get('/public-site-theme', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
    
    const [config] = await db
      .select({
        publicSiteSettings: tenantConfig.publicSiteSettings,
        businessName: tenantConfig.businessName,
        primaryColor: tenantConfig.primaryColor,
        accentColor: tenantConfig.accentColor,
      })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Tenant configuration not found',
      });
    }
    
    const storedSettings = config.publicSiteSettings || {};
    
    const themeConfig = {
      themeKey: storedSettings.themeKey || DEFAULT_THEME_CONFIG.themeKey,
      heroLayout: storedSettings.heroLayout || DEFAULT_THEME_CONFIG.heroLayout,
      servicesLayout: storedSettings.servicesLayout || DEFAULT_THEME_CONFIG.servicesLayout,
      testimonialsLayout: storedSettings.testimonialsLayout || DEFAULT_THEME_CONFIG.testimonialsLayout,
      ctaStyle: storedSettings.ctaStyle || DEFAULT_THEME_CONFIG.ctaStyle,
      showTestimonials: storedSettings.showTestimonials ?? DEFAULT_THEME_CONFIG.showTestimonials,
      showFaq: storedSettings.showFaq ?? DEFAULT_THEME_CONFIG.showFaq,
      showGallery: storedSettings.showGallery ?? DEFAULT_THEME_CONFIG.showGallery,
      showWhyChooseUs: storedSettings.showWhyChooseUs ?? DEFAULT_THEME_CONFIG.showWhyChooseUs,
      showAbout: storedSettings.showAbout ?? DEFAULT_THEME_CONFIG.showAbout,
      showRewards: storedSettings.showRewards ?? DEFAULT_THEME_CONFIG.showRewards,
    };
    
    return res.json({
      success: true,
      themeConfig,
      availableThemes: PUBLIC_SITE_THEMES,
      tenantInfo: {
        businessName: config.businessName,
        primaryColor: config.primaryColor || '#6366f1',
        accentColor: config.accentColor || '#a855f7',
      },
    });
  } catch (error) {
    console.error('[PUBLIC SITE THEME] Error fetching theme config:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load theme configuration',
    });
  }
});

/**
 * PUT /api/admin/public-site-theme
 * Update theme configuration for the tenant
 */
router.put('/public-site-theme', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
    
    const parseResult = themeConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theme configuration',
        errors: parseResult.error.errors,
      });
    }
    
    const themeData = parseResult.data;
    
    const [existing] = await db
      .select({
        publicSiteSettings: tenantConfig.publicSiteSettings,
      })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Tenant configuration not found',
      });
    }
    
    const existingSettings = existing.publicSiteSettings || {};
    
    const updatedSettings = {
      ...existingSettings,
      themeKey: themeData.themeKey ?? existingSettings.themeKey,
      heroLayout: themeData.heroLayout ?? existingSettings.heroLayout,
      servicesLayout: themeData.servicesLayout ?? existingSettings.servicesLayout,
      testimonialsLayout: themeData.testimonialsLayout ?? existingSettings.testimonialsLayout,
      ctaStyle: themeData.ctaStyle ?? existingSettings.ctaStyle,
      showTestimonials: themeData.showTestimonials ?? existingSettings.showTestimonials,
      showFaq: themeData.showFaq ?? existingSettings.showFaq,
      showGallery: themeData.showGallery ?? existingSettings.showGallery,
      showWhyChooseUs: themeData.showWhyChooseUs ?? existingSettings.showWhyChooseUs,
      showAbout: themeData.showAbout ?? existingSettings.showAbout,
      showRewards: themeData.showRewards ?? existingSettings.showRewards,
    };
    
    await db
      .update(tenantConfig)
      .set({ 
        publicSiteSettings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(tenantConfig.tenantId, tenantId));
    
    console.log(`[PUBLIC SITE THEME] Updated theme config for tenant ${tenantId}:`, themeData);
    
    return res.json({
      success: true,
      message: 'Theme configuration updated successfully',
      themeConfig: updatedSettings,
    });
  } catch (error) {
    console.error('[PUBLIC SITE THEME] Error updating theme config:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update theme configuration',
    });
  }
});

export default router;
