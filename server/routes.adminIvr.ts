/**
 * Admin IVR Configuration Routes
 * 
 * Provides API endpoints for managing IVR menus:
 * - GET /api/admin/ivr/menu - Get current tenant's IVR menu
 * - PUT /api/admin/ivr/menu - Update tenant's IVR menu
 * - POST /api/admin/ivr/menu/reset - Reset to default configuration
 * 
 * Multi-tenant safety:
 * - Uses session.tenantId (defaults to 'root')
 * - Each tenant can only manage their own IVR config
 * - No cross-tenant access or fallback
 */

import type { Express, Request, Response } from 'express';
import { db } from './db';
import { 
  ivrMenus, 
  ivrMenuItems, 
  insertIvrMenuSchema, 
  insertIvrMenuItemSchema,
  IvrMenuWithItems,
  IvrMenuItem,
  IvrActionType
} from '../shared/schema';
import { eq, and, asc } from 'drizzle-orm';
import { 
  getOrCreateDefaultMenuForTenant, 
  getActiveMenuForTenant, 
  updateMenuForTenant 
} from './services/ivrConfigService';
import { z } from 'zod';

const VALID_ACTION_TYPES: IvrActionType[] = [
  'PLAY_MESSAGE',
  'SMS_INFO',
  'FORWARD_SIP',
  'FORWARD_PHONE',
  'VOICEMAIL',
  'SUBMENU',
  'REPLAY_MENU',
  'EASTER_EGG'
];

const menuItemSchema = z.object({
  id: z.number().optional(),
  digit: z.string().min(1).max(1),
  label: z.string().min(1).max(100),
  actionType: z.enum(VALID_ACTION_TYPES as [IvrActionType, ...IvrActionType[]]),
  actionPayload: z.record(z.any()).optional().default({}),
  orderIndex: z.number().min(0).max(20),
  isHidden: z.boolean().optional().default(false),
});

const updateMenuSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  greetingText: z.string().min(1).max(500),
  noInputMessage: z.string().min(1).max(200).optional(),
  invalidInputMessage: z.string().min(1).max(200).optional(),
  voiceName: z.string().optional().default('alice'),
  maxAttempts: z.number().min(1).max(5).optional().default(3),
  items: z.array(menuItemSchema).min(1).max(12),
});

export function registerAdminIvrRoutes(app: Express) {
  /**
   * GET /api/admin/ivr/menu
   * Fetch the current tenant's IVR menu configuration
   */
  app.get('/api/admin/ivr/menu', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
      
      console.log(`[ADMIN IVR] GET menu for tenant=${tenantId}`);
      
      const menu = await getOrCreateDefaultMenuForTenant(tenantId);
      
      res.json({ 
        success: true, 
        menu,
        tenantId,
      });
      
    } catch (error) {
      console.error('[ADMIN IVR] Error fetching menu:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to load IVR configuration' 
      });
    }
  });
  
  /**
   * PUT /api/admin/ivr/menu
   * Update the current tenant's IVR menu configuration
   */
  app.put('/api/admin/ivr/menu', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
      
      console.log(`[ADMIN IVR] PUT menu for tenant=${tenantId}`);
      
      const validationResult = updateMenuSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.warn('[ADMIN IVR] Validation failed:', validationResult.error.errors);
        return res.status(400).json({
          success: false,
          error: 'Invalid menu configuration',
          details: validationResult.error.errors,
        });
      }
      
      const menuData = validationResult.data;
      
      const updatedMenu = await updateMenuForTenant(tenantId, {
        name: menuData.name,
        greetingText: menuData.greetingText,
        noInputMessage: menuData.noInputMessage,
        invalidInputMessage: menuData.invalidInputMessage,
        voiceName: menuData.voiceName,
        maxAttempts: menuData.maxAttempts,
        items: menuData.items.map((item, index) => ({
          digit: item.digit,
          label: item.label,
          actionType: item.actionType,
          actionPayload: item.actionPayload || {},
          orderIndex: item.orderIndex ?? index,
          isHidden: item.isHidden ?? false,
        })),
      });
      
      console.log(`[ADMIN IVR] Updated menu for tenant=${tenantId}, items=${updatedMenu.items.length}`);
      
      res.json({
        success: true,
        menu: updatedMenu,
        message: 'IVR menu updated successfully',
      });
      
    } catch (error) {
      console.error('[ADMIN IVR] Error updating menu:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update IVR configuration',
      });
    }
  });
  
  /**
   * POST /api/admin/ivr/menu/reset
   * Reset the current tenant's IVR menu to default configuration
   */
  app.post('/api/admin/ivr/menu/reset', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
      
      console.log(`[ADMIN IVR] POST reset menu for tenant=${tenantId}`);
      
      const existingMenus = await db
        .select()
        .from(ivrMenus)
        .where(and(
          eq(ivrMenus.tenantId, tenantId),
          eq(ivrMenus.isActive, true)
        ));
      
      for (const menu of existingMenus) {
        await db.delete(ivrMenuItems).where(eq(ivrMenuItems.menuId, menu.id));
        await db.delete(ivrMenus).where(eq(ivrMenus.id, menu.id));
      }
      
      console.log(`[ADMIN IVR] Deleted ${existingMenus.length} existing menus for tenant=${tenantId}`);
      
      const newMenu = await getOrCreateDefaultMenuForTenant(tenantId);
      
      console.log(`[ADMIN IVR] Reset to default menu for tenant=${tenantId}`);
      
      res.json({
        success: true,
        menu: newMenu,
        message: 'IVR menu reset to default configuration',
      });
      
    } catch (error) {
      console.error('[ADMIN IVR] Error resetting menu:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset IVR configuration',
      });
    }
  });
  
  /**
   * GET /api/admin/ivr/action-types
   * Get list of available IVR action types with descriptions
   */
  app.get('/api/admin/ivr/action-types', async (req: Request, res: Response) => {
    const actionTypes = [
      {
        type: 'PLAY_MESSAGE',
        label: 'Play Message',
        description: 'Play a voice message to the caller',
        payloadFields: [
          { name: 'message', type: 'text', required: true, description: 'The message to speak' },
          { name: 'hangupAfter', type: 'boolean', required: false, description: 'Hang up after message (default: true)' },
        ],
      },
      {
        type: 'SMS_INFO',
        label: 'Send SMS Info',
        description: 'Send an SMS to the caller with business information',
        payloadFields: [
          { name: 'smsText', type: 'text', required: true, description: 'The SMS text to send' },
        ],
      },
      {
        type: 'FORWARD_SIP',
        label: 'Forward to SIP',
        description: 'Forward the call to a SIP endpoint (Twilio or other VoIP)',
        payloadFields: [
          { name: 'sipUri', type: 'text', required: true, description: 'SIP URI (e.g., jody@company.sip.twilio.com)' },
        ],
      },
      {
        type: 'FORWARD_PHONE',
        label: 'Forward to Phone',
        description: 'Forward the call to a phone number',
        payloadFields: [
          { name: 'phoneNumber', type: 'tel', required: true, description: 'Phone number in E.164 format' },
        ],
      },
      {
        type: 'VOICEMAIL',
        label: 'Voicemail',
        description: 'Send caller to voicemail',
        payloadFields: [],
      },
      {
        type: 'SUBMENU',
        label: 'Go to Submenu',
        description: 'Navigate to another IVR menu (for complex IVR trees)',
        payloadFields: [
          { name: 'submenuId', type: 'number', required: true, description: 'The ID of the submenu to navigate to' },
        ],
      },
      {
        type: 'REPLAY_MENU',
        label: 'Replay Menu',
        description: 'Replay the current menu options',
        payloadFields: [],
      },
      {
        type: 'EASTER_EGG',
        label: 'Easter Egg',
        description: 'Hidden fun message (not announced in menu prompt)',
        payloadFields: [
          { name: 'message', type: 'text', required: true, description: 'The fun message to play' },
          { name: 'hangupAfter', type: 'boolean', required: false, description: 'Hang up after message (default: true)' },
        ],
      },
    ];
    
    res.json({ success: true, actionTypes });
  });
  
  console.log('[ADMIN IVR ROUTES] Registered: GET/PUT /api/admin/ivr/menu, POST /api/admin/ivr/menu/reset, GET /api/admin/ivr/action-types');
}
