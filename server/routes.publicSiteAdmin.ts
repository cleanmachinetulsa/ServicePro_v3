/**
 * CM-4: Public Site Admin Routes
 * Admin endpoints for managing public site settings (hero text, colors, CTA toggles)
 */

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/admin/public-site-settings
 * Get the current public site settings for the tenant
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
    
    // Merge with defaults
    const settings = {
      heroTitle: config.publicSiteSettings?.heroTitle || '',
      heroSubtitle: config.publicSiteSettings?.heroSubtitle || '',
      primaryColor: config.publicSiteSettings?.primaryColor || config.primaryColor || '#6366f1',
      secondaryColor: config.publicSiteSettings?.secondaryColor || config.accentColor || '#a855f7',
      showRewardsCTA: config.publicSiteSettings?.showRewardsCTA ?? true,
      showBookingCTA: config.publicSiteSettings?.showBookingCTA ?? true,
      showGiftCardCTA: config.publicSiteSettings?.showGiftCardCTA ?? false,
    };
    
    return res.json({
      success: true,
      settings,
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
    const { 
      heroTitle, 
      heroSubtitle, 
      primaryColor, 
      secondaryColor,
      showRewardsCTA,
      showBookingCTA,
      showGiftCardCTA,
    } = req.body;
    
    // Build the settings object
    const publicSiteSettings = {
      heroTitle: heroTitle || undefined,
      heroSubtitle: heroSubtitle || undefined,
      primaryColor: primaryColor || undefined,
      secondaryColor: secondaryColor || undefined,
      showRewardsCTA: showRewardsCTA ?? true,
      showBookingCTA: showBookingCTA ?? true,
      showGiftCardCTA: showGiftCardCTA ?? false,
    };
    
    await db
      .update(tenantConfig)
      .set({
        publicSiteSettings,
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
