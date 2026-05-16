/**
 * CM-4: Public Site Admin Routes
 * Admin endpoints for managing public site settings (hero text, colors, CTA toggles)
 */

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getIndustryPack } from '@shared/industryPacks';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';

const router = Router();

router.use(requireAuth, requireRole('manager'));

const publicSiteSettingsSchema = z.object({
  heroTitle: z.string().optional().nullable(),
  heroSubtitle: z.string().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  showRewardsCTA: z.boolean().optional(),
  showBookingCTA: z.boolean().optional(),
  showGiftCardCTA: z.boolean().optional(),
  useCustomHomepage: z.boolean().optional(),
  customHomepageTemplateId: z.string().max(50).optional().nullable(),
});

// Whitelist of design templates the tenant can pick for their custom homepage.
// Must match TEMPLATE_COMPONENTS in client/src/pages/home.tsx.
const ALLOWED_HOMEPAGE_TEMPLATE_IDS = new Set([
  'current',
  'luminous_concierge',
  'dynamic_spotlight',
  'prestige_grid',
  'night_drive_neon',
  'executive_minimal',
  'quantum_concierge',
]);

/**
 * GET /api/admin/public-site-settings
 * Get the current public site settings for the tenant
 * Priority: tenant publicSiteSettings > industry pack > tenantConfig > defaults
 */
router.get('/public-site-settings', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
    
    const [config] = await db
      .select({
        publicSiteSettings: tenantConfig.publicSiteSettings,
        businessName: tenantConfig.businessName,
        primaryColor: tenantConfig.primaryColor,
        accentColor: tenantConfig.accentColor,
        industryPackId: tenantConfig.industryPackId,
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
    const industryPack = config.industryPackId ? getIndustryPack(config.industryPackId) : null;
    
    const settings = {
      heroTitle: storedSettings.heroTitle || '',
      heroSubtitle: storedSettings.heroSubtitle || '',
      primaryColor: storedSettings.primaryColor || config.primaryColor || '#6366f1',
      secondaryColor: storedSettings.secondaryColor || config.accentColor || '#a855f7',
      showRewardsCTA: storedSettings.showRewardsCTA ?? true,
      showBookingCTA: storedSettings.showBookingCTA ?? true,
      showGiftCardCTA: storedSettings.showGiftCardCTA ?? false,
      useCustomHomepage: storedSettings.useCustomHomepage ?? false,
      customHomepageTemplateId: storedSettings.customHomepageTemplateId || 'luminous_concierge',
    };
    
    const defaults = {
      heroTitle: industryPack?.websiteSeed?.heroHeadline || `Welcome to ${config.businessName}`,
      heroSubtitle: industryPack?.websiteSeed?.heroSubheadline || 'Professional service you can trust',
      primaryColor: config.primaryColor || '#6366f1',
      secondaryColor: config.accentColor || '#a855f7',
    };
    
    return res.json({
      success: true,
      settings,
      defaults,
    });
  } catch (error) {
    console.error('[PUBLIC SITE ADMIN] Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load public site settings',
    });
  }
});

/**
 * PUT /api/admin/public-site-settings
 * Update public site settings for the tenant
 */
router.put('/public-site-settings', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.session as any)?.tenantId || 'root';
    
    const parseResult = publicSiteSettingsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid settings data',
        errors: parseResult.error.errors,
      });
    }
    
    const { 
      heroTitle, 
      heroSubtitle, 
      primaryColor, 
      secondaryColor,
      showRewardsCTA,
      showBookingCTA,
      showGiftCardCTA,
      useCustomHomepage,
      customHomepageTemplateId,
    } = parseResult.data;

    // Preserve any existing settings keys we don't manage in this endpoint
    // (e.g. theme/layout fields written by routes.publicSiteTheme.ts).
    const [existing] = await db
      .select({ publicSiteSettings: tenantConfig.publicSiteSettings })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    const publicSiteSettings: Record<string, any> = {
      ...(existing?.publicSiteSettings || {}),
    };
    
    // For text/color fields: treat undefined as "leave as-is",
    // empty string as "clear this field" (so the UI can restore defaults),
    // and a non-empty value as "set to this".
    const applyOptionalString = (key: string, value: string | null | undefined) => {
      if (value === undefined) return;
      const trimmed = (value ?? '').trim();
      if (trimmed === '') {
        delete publicSiteSettings[key];
      } else {
        publicSiteSettings[key] = trimmed;
      }
    };
    applyOptionalString('heroTitle', heroTitle);
    applyOptionalString('heroSubtitle', heroSubtitle);
    applyOptionalString('primaryColor', primaryColor);
    applyOptionalString('secondaryColor', secondaryColor);
    
    if (typeof showRewardsCTA === 'boolean') {
      publicSiteSettings.showRewardsCTA = showRewardsCTA;
    }
    if (typeof showBookingCTA === 'boolean') {
      publicSiteSettings.showBookingCTA = showBookingCTA;
    }
    if (typeof showGiftCardCTA === 'boolean') {
      publicSiteSettings.showGiftCardCTA = showGiftCardCTA;
    }

    if (typeof useCustomHomepage === 'boolean') {
      publicSiteSettings.useCustomHomepage = useCustomHomepage;
    }
    if (typeof customHomepageTemplateId === 'string' && customHomepageTemplateId.trim() !== '') {
      const requested = customHomepageTemplateId.trim();
      if (!ALLOWED_HOMEPAGE_TEMPLATE_IDS.has(requested)) {
        return res.status(400).json({
          success: false,
          message: `Invalid homepage template '${requested}'`,
        });
      }
      publicSiteSettings.customHomepageTemplateId = requested;
    }
    
    await db
      .update(tenantConfig)
      .set({
        publicSiteSettings: Object.keys(publicSiteSettings).length > 0 ? publicSiteSettings : null,
        updatedAt: new Date(),
      })
      .where(eq(tenantConfig.tenantId, tenantId));
    
    console.log(`[PUBLIC SITE ADMIN] Updated settings for tenant ${tenantId}:`, publicSiteSettings);
    
    return res.json({
      success: true,
      message: 'Public site settings updated successfully',
      settings: publicSiteSettings,
    });
  } catch (error) {
    console.error('[PUBLIC SITE ADMIN] Error updating settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update public site settings',
    });
  }
});

export default router;
