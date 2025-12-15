/**
 * Portal PWA v2 - Admin API Routes
 * 
 * Provides endpoints for managing portal settings and actions.
 * All routes are tenant-scoped and require authentication.
 */

import { Router, Request, Response } from 'express';
import { 
  portalSettings, 
  portalActions, 
  portalInstallPromptLog,
  insertPortalSettingsSchema,
  insertPortalActionSchema,
  tenantConfig,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { getPortalActionsForIndustry, getPortalSettingsForIndustry } from '@shared/portalDefaults';
import type { IndustryPackId } from '@shared/industryPacks';

const router = Router();

// ============================================================
// PORTAL SETTINGS
// ============================================================

/**
 * GET /api/admin/portal/settings
 * Get portal settings for current tenant
 */
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    
    const [settings] = await req.tenantDb!
      .select()
      .from(portalSettings)
      .where(eq(portalSettings.tenantId, tenantId))
      .limit(1);

    // Get tenant config for industry pack defaults
    const [config] = await req.tenantDb!
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    const industryPackId = config?.industryPackId as IndustryPackId | null;
    const industryDefaults = getPortalSettingsForIndustry(industryPackId);

    res.json({
      success: true,
      settings: settings || null,
      defaults: industryDefaults,
      industryPackId,
    });
  } catch (error: any) {
    console.error('[PORTAL ADMIN] Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portal settings',
      error: error.message,
    });
  }
});

/**
 * PUT /api/admin/portal/settings
 * Create or update portal settings
 */
router.put('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    
    const [existing] = await req.tenantDb!
      .select()
      .from(portalSettings)
      .where(eq(portalSettings.tenantId, tenantId))
      .limit(1);

    const settingsData = {
      ...req.body,
      tenantId,
      updatedAt: new Date(),
    };

    const validated = insertPortalSettingsSchema.parse(settingsData);

    let result;
    if (!existing) {
      result = await req.tenantDb!
        .insert(portalSettings)
        .values(validated)
        .returning();
      console.log(`[PORTAL ADMIN] Created settings for tenant ${tenantId}`);
    } else {
      const { tenantId: _, ...updateData } = validated;
      result = await req.tenantDb!
        .update(portalSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(portalSettings.tenantId, tenantId))
        .returning();
      console.log(`[PORTAL ADMIN] Updated settings for tenant ${tenantId}`);
    }

    res.json({
      success: true,
      settings: result[0],
      message: 'Portal settings saved successfully',
    });
  } catch (error: any) {
    console.error('[PORTAL ADMIN] Error saving settings:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to save portal settings',
      error: error.message,
    });
  }
});

// ============================================================
// PORTAL ACTIONS
// ============================================================

/**
 * GET /api/admin/portal/actions
 * Get all portal actions for current tenant
 */
router.get('/actions', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    
    const actions = await req.tenantDb!
      .select()
      .from(portalActions)
      .where(eq(portalActions.tenantId, tenantId))
      .orderBy(portalActions.sortOrder);

    // Get industry pack defaults for comparison
    const [config] = await req.tenantDb!
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    const industryPackId = config?.industryPackId as IndustryPackId | null;
    const defaultActions = getPortalActionsForIndustry(industryPackId);

    res.json({
      success: true,
      actions,
      defaults: defaultActions,
      totalDefaultActions: defaultActions.length,
    });
  } catch (error: any) {
    console.error('[PORTAL ADMIN] Error fetching actions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portal actions',
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/portal/actions
 * Create a new portal action
 */
router.post('/actions', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    
    const actionData = {
      ...req.body,
      tenantId,
    };

    const validated = insertPortalActionSchema.parse(actionData);

    const result = await req.tenantDb!
      .insert(portalActions)
      .values(validated)
      .returning();

    console.log(`[PORTAL ADMIN] Created action ${validated.actionKey} for tenant ${tenantId}`);

    res.json({
      success: true,
      action: result[0],
      message: 'Portal action created successfully',
    });
  } catch (error: any) {
    console.error('[PORTAL ADMIN] Error creating action:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create portal action',
      error: error.message,
    });
  }
});

/**
 * PUT /api/admin/portal/actions/:id
 * Update an existing portal action
 */
router.put('/actions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    const actionId = parseInt(req.params.id);

    if (isNaN(actionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action ID',
      });
    }

    // Verify action belongs to tenant
    const [existing] = await req.tenantDb!
      .select()
      .from(portalActions)
      .where(and(
        eq(portalActions.id, actionId),
        eq(portalActions.tenantId, tenantId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Action not found',
      });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.tenantId;
    delete updateData.createdAt;

    const result = await req.tenantDb!
      .update(portalActions)
      .set(updateData)
      .where(eq(portalActions.id, actionId))
      .returning();

    console.log(`[PORTAL ADMIN] Updated action ${actionId} for tenant ${tenantId}`);

    res.json({
      success: true,
      action: result[0],
      message: 'Portal action updated successfully',
    });
  } catch (error: any) {
    console.error('[PORTAL ADMIN] Error updating action:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update portal action',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/admin/portal/actions/:id
 * Delete a portal action
 */
router.delete('/actions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    const actionId = parseInt(req.params.id);

    if (isNaN(actionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action ID',
      });
    }

    // Verify action belongs to tenant
    const [existing] = await req.tenantDb!
      .select()
      .from(portalActions)
      .where(and(
        eq(portalActions.id, actionId),
        eq(portalActions.tenantId, tenantId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Action not found',
      });
    }

    await req.tenantDb!
      .delete(portalActions)
      .where(eq(portalActions.id, actionId));

    console.log(`[PORTAL ADMIN] Deleted action ${actionId} for tenant ${tenantId}`);

    res.json({
      success: true,
      message: 'Portal action deleted successfully',
    });
  } catch (error: any) {
    console.error('[PORTAL ADMIN] Error deleting action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete portal action',
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/portal/actions/seed
 * Seed default actions from industry pack
 */
router.post('/actions/seed', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    
    // Get tenant's industry pack
    const [config] = await req.tenantDb!
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    const industryPackId = config?.industryPackId as IndustryPackId | null;
    const defaultActions = getPortalActionsForIndustry(industryPackId);

    // Get existing actions to avoid duplicates
    const existingActions = await req.tenantDb!
      .select()
      .from(portalActions)
      .where(eq(portalActions.tenantId, tenantId));

    const existingKeys = new Set(existingActions.map(a => a.actionKey));

    // Insert only new actions
    const newActions = defaultActions.filter(a => !existingKeys.has(a.actionKey));

    if (newActions.length === 0) {
      return res.json({
        success: true,
        message: 'All default actions already exist',
        seeded: 0,
      });
    }

    const toInsert = newActions.map(action => ({
      tenantId,
      actionKey: action.actionKey,
      displayName: action.displayName,
      description: action.description,
      icon: action.icon,
      category: action.category,
      actionType: action.actionType as any,
      actionConfig: action.actionConfig,
      showOnHome: action.showOnHome,
      showInNav: action.showInNav,
      sortOrder: action.sortOrder,
      isFromIndustryPack: true,
      industryPackId,
    }));

    await req.tenantDb!.insert(portalActions).values(toInsert);

    console.log(`[PORTAL ADMIN] Seeded ${newActions.length} actions for tenant ${tenantId}`);

    res.json({
      success: true,
      message: `Seeded ${newActions.length} default actions`,
      seeded: newActions.length,
    });
  } catch (error: any) {
    console.error('[PORTAL ADMIN] Error seeding actions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed portal actions',
      error: error.message,
    });
  }
});

// ============================================================
// INSTALL PROMPT LOGS
// ============================================================

/**
 * GET /api/admin/portal/install-logs
 * Get install prompt event logs
 */
router.get('/install-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'root';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const logs = await req.tenantDb!
      .select()
      .from(portalInstallPromptLog)
      .where(eq(portalInstallPromptLog.tenantId, tenantId))
      .orderBy(desc(portalInstallPromptLog.createdAt))
      .limit(limit);

    // Calculate stats
    const stats = {
      totalShown: logs.filter(l => l.event === 'shown').length,
      totalDismissed: logs.filter(l => l.event === 'dismissed').length,
      totalAccepted: logs.filter(l => l.event === 'accepted').length,
      totalInstalled: logs.filter(l => l.event === 'installed').length,
    };

    res.json({
      success: true,
      logs,
      stats,
    });
  } catch (error: any) {
    console.error('[PORTAL ADMIN] Error fetching install logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch install logs',
      error: error.message,
    });
  }
});

export default router;
