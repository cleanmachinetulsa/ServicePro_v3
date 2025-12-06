/**
 * Telephony Settings API Routes
 * 
 * Phase: Telephony Mode Selector
 * Provides GET/PUT endpoints for tenant owners to configure call handling mode
 * 
 * Routes:
 * - GET /api/admin/telephony-settings - Get current telephony settings
 * - PUT /api/admin/telephony-settings - Update telephony settings
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { 
  getTelephonySettings, 
  updateTelephonySettings 
} from './services/telephonySettingsService';

const router = Router();

const VALID_TELEPHONY_MODES = ['FORWARD_ALL_CALLS', 'AI_FIRST', 'AI_ONLY', 'TEXT_ONLY_BUSINESS'] as const;

const telephonySettingsUpdateSchema = z.object({
  telephonyMode: z.enum(VALID_TELEPHONY_MODES).optional(),
  forwardingNumber: z.string().nullable().optional(),
  allowVoicemailInTextOnly: z.boolean().optional(),
});

/**
 * GET /api/admin/telephony-settings
 * Returns current telephony mode and related settings for the authenticated tenant
 */
router.get('/telephony-settings', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated or tenant not found' 
      });
    }

    const settings = await getTelephonySettings(tenantId);

    if (!settings) {
      return res.status(404).json({ 
        success: false, 
        error: 'No phone configuration found for this tenant. Please set up a phone number first.' 
      });
    }

    return res.json({
      success: true,
      settings: {
        telephonyMode: settings.telephonyMode,
        forwardingNumber: settings.forwardingNumber,
        allowVoicemailInTextOnly: settings.allowVoicemailInTextOnly,
        ivrMode: settings.ivrMode,
      },
      modeDescriptions: {
        FORWARD_ALL_CALLS: 'Your calls will ring your number directly. Best if you answer most calls yourself.',
        AI_FIRST: 'AI or IVR answers first, then forwards to you as needed. Recommended.',
        AI_ONLY: 'AI handles calls entirely. You\'ll see bookings and messages but your phone won\'t ring.',
        TEXT_ONLY_BUSINESS: 'We don\'t answer calls. Callers get a quick message and a text with a link.',
      }
    });
  } catch (error: any) {
    console.error('[TELEPHONY SETTINGS API] Error getting settings:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to get telephony settings' 
    });
  }
});

/**
 * PUT /api/admin/telephony-settings
 * Updates telephony mode and related settings for the authenticated tenant
 */
router.put('/telephony-settings', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated or tenant not found' 
      });
    }

    const parsed = telephonySettingsUpdateSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request body',
        details: parsed.error.errors 
      });
    }

    const { telephonyMode, forwardingNumber, allowVoicemailInTextOnly } = parsed.data;

    if (telephonyMode === 'FORWARD_ALL_CALLS' && !forwardingNumber) {
      const existingSettings = await getTelephonySettings(tenantId);
      if (!existingSettings?.forwardingNumber) {
        return res.status(400).json({ 
          success: false, 
          error: 'A forwarding number is required for "Forward All Calls" mode. Please provide a phone number.' 
        });
      }
    }

    const updatedSettings = await updateTelephonySettings(tenantId, {
      telephonyMode,
      forwardingNumber,
      allowVoicemailInTextOnly,
    });

    if (!updatedSettings) {
      return res.status(404).json({ 
        success: false, 
        error: 'No phone configuration found for this tenant' 
      });
    }

    console.log(`[TELEPHONY SETTINGS API] Updated settings for tenant ${tenantId}:`, {
      telephonyMode: updatedSettings.telephonyMode,
      forwardingNumber: updatedSettings.forwardingNumber ? '***' : null,
      allowVoicemailInTextOnly: updatedSettings.allowVoicemailInTextOnly,
    });

    return res.json({
      success: true,
      settings: updatedSettings,
      message: 'Telephony settings updated successfully',
    });
  } catch (error: any) {
    console.error('[TELEPHONY SETTINGS API] Error updating settings:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to update telephony settings' 
    });
  }
});

export function registerTelephonySettingsRoutes(app: any) {
  app.use('/api/admin', router);
  console.log('[TELEPHONY SETTINGS] Routes registered: GET/PUT /api/admin/telephony-settings');
}

export default router;
