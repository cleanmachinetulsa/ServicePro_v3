import express, { Request, Response } from 'express';
import { tenantConfig } from '@shared/schema';
import type { UiExperienceMode } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';
import { z } from 'zod';

const router = express.Router();

const UiModeUpdateSchema = z.object({
  mode: z.enum(['simple', 'advanced']),
});

router.get('/api/settings/ui-mode', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.session?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context required',
      });
    }

    const { db } = await import('./db');
    const [config] = await db.select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    const mode: UiExperienceMode = (config?.uiExperienceMode as UiExperienceMode) ?? 'simple';

    res.json({
      success: true,
      mode,
    });
  } catch (error: any) {
    console.error('[UI MODE] Error fetching UI experience mode:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch UI mode',
    });
  }
});

router.put('/api/settings/ui-mode', requireAuth, requireRole(['owner', 'admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const parseResult = UiModeUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload. Mode must be "simple" or "advanced".',
      });
    }

    const tenantId = req.session?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context required',
      });
    }

    const { mode } = parseResult.data;
    const { db } = await import('./db');

    const [existingConfig] = await db.select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    if (existingConfig) {
      await db.update(tenantConfig)
        .set({ 
          uiExperienceMode: mode,
          updatedAt: new Date(),
        })
        .where(eq(tenantConfig.tenantId, tenantId));
    } else {
      return res.status(404).json({
        success: false,
        error: 'Tenant configuration not found. Please contact support.',
      });
    }

    console.log(`[UI MODE] Tenant ${tenantId}: Updated to "${mode}" by user ${req.session?.userId}`);

    res.json({
      success: true,
      mode,
    });
  } catch (error: any) {
    console.error('[UI MODE] Error updating UI experience mode:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update UI mode',
    });
  }
});

export function registerUiModeRoutes(app: express.Application) {
  app.use(router);
  console.log('[UI MODE] Routes registered: GET/PUT /api/settings/ui-mode');
}

export default router;
