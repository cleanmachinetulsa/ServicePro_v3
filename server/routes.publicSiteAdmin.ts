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

const router = Router();

const publicSiteSettingsSchema = z.object({
  heroTitle: z.string().optional().nullable(),
  heroSubtitle: z.string().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  showRewardsCTA: z.boolean().optional(),
  showBookingCTA: z.boolean().optional(),
  showGiftCardCTA: z.boolean().optional(),
});

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
    } = parseResult.data;
    
    const publicSiteSettings: Record<string, any> = {};
    
    if (heroTitle && heroTitle.trim() !== '') {
      publicSiteSettings.heroTitle = heroTitle.trim();
    }
    if (heroSubtitle && heroSubtitle.trim() !== '') {
      publicSiteSettings.heroSubtitle = heroSubtitle.trim();
    }
    if (primaryColor && primaryColor.trim() !== '') {
      publicSiteSettings.primaryColor = primaryColor.trim();
    }
    if (secondaryColor && secondaryColor.trim() !== '') {
      publicSiteSettings.secondaryColor = secondaryColor.trim();
    }
    
    if (typeof showRewardsCTA === 'boolean') {
      publicSiteSettings.showRewardsCTA = showRewardsCTA;
    }
    if (typeof showBookingCTA === 'boolean') {
      publicSiteSettings.showBookingCTA = showBookingCTA;
    }
    if (typeof showGiftCardCTA === 'boolean') {
      publicSiteSettings.showGiftCardCTA = showGiftCardCTA;
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
