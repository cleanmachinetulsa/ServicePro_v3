/**
 * SP-15: Dashboard Preferences API Routes
 * 
 * GET  /api/settings/dashboard/preferences - Get tenant dashboard preferences
 * PUT  /api/settings/dashboard/preferences - Update tenant dashboard preferences
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { dashboardPreferencesService } from './services/dashboardPreferencesService';
import { updateDashboardPreferencesSchema, DASHBOARD_PANEL_IDS } from '@shared/schema';

const router = Router();

interface AuthenticatedRequest extends Request {
  session: {
    tenantId?: string;
    userId?: number;
    passport?: {
      user?: {
        id: number;
        username: string;
        role: string;
      };
    };
  } & Request['session'];
}

function getTenantId(req: AuthenticatedRequest): string | null {
  return req.session?.tenantId || 'root';
}

function isAuthenticated(req: AuthenticatedRequest): boolean {
  return !!(req.session?.passport?.user || req.session?.userId);
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    const preferences = await dashboardPreferencesService.getOrCreate(tenantId);

    return res.json({
      success: true,
      preferences: {
        mode: preferences.mode,
        simpleVisiblePanels: preferences.simpleVisiblePanels,
        updatedAt: preferences.updatedAt,
      },
      availablePanels: DASHBOARD_PANEL_IDS,
    });
  } catch (error) {
    console.error('[DASHBOARD PREFS] Error fetching preferences:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    const validationResult = updateDashboardPreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request body',
        details: validationResult.error.errors,
      });
    }

    const updates = validationResult.data;
    const preferences = await dashboardPreferencesService.update(tenantId, updates);

    console.log(`[DASHBOARD PREFS] Updated preferences for tenant ${tenantId}:`, {
      mode: preferences.mode,
      panelCount: preferences.simpleVisiblePanels?.length,
    });

    return res.json({
      success: true,
      preferences: {
        mode: preferences.mode,
        simpleVisiblePanels: preferences.simpleVisiblePanels,
        updatedAt: preferences.updatedAt,
      },
    });
  } catch (error) {
    console.error('[DASHBOARD PREFS] Error updating preferences:', error);
    return res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

router.put('/mode', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    const modeSchema = z.object({
      mode: z.enum(['simple', 'advanced']),
    });

    const validationResult = modeSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid mode. Must be "simple" or "advanced".',
      });
    }

    const preferences = await dashboardPreferencesService.setMode(tenantId, validationResult.data.mode);

    console.log(`[DASHBOARD PREFS] Mode changed for tenant ${tenantId}: ${preferences.mode}`);

    return res.json({
      success: true,
      preferences: {
        mode: preferences.mode,
        simpleVisiblePanels: preferences.simpleVisiblePanels,
        updatedAt: preferences.updatedAt,
      },
    });
  } catch (error) {
    console.error('[DASHBOARD PREFS] Error updating mode:', error);
    return res.status(500).json({ success: false, error: 'Failed to update mode' });
  }
});

export default router;
