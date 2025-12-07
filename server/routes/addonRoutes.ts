/**
 * SP-16: Add-Ons API Routes
 * 
 * Routes for managing tenant add-ons:
 * - GET /api/billing/addons/my - Get catalog with current tenant status
 * - POST /api/billing/addons/my/toggle - Activate or cancel an add-on
 * - GET /api/admin/addons/catalog - Get full catalog (admin only)
 * - PUT /api/admin/addons/catalog/:key - Update catalog entry (root admin only)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
  getAddonCatalogForTenant, 
  activateAddon, 
  cancelAddon,
  getTenantAddons,
} from '../services/addonService';
import { ADDONS_CATALOG, getAddonByKey, type AddonKey } from '@shared/addonsConfig';
import { ADDON_KEYS, tenants } from '@shared/schema';
import { requireAuth } from '../authMiddleware';
import { getRootDb } from '../tenantDb';
import { eq } from 'drizzle-orm';

const router = Router();

router.use(requireAuth);

function getTenantId(req: Request): string | null {
  const session = req.session as any;
  const user = (req as any).user;
  
  if (session?.impersonatedTenantId) {
    return session.impersonatedTenantId;
  }
  if (session?.tenantId) {
    return session.tenantId;
  }
  if (user?.tenantId) {
    return user.tenantId;
  }
  return null;
}

function isOwner(req: Request): boolean {
  const user = (req as any).user;
  return user?.role === 'owner' || user?.role === 'admin' || user?.role === 'root_admin';
}

function isRootAdmin(req: Request): boolean {
  const user = (req as any).user;
  return user?.role === 'root_admin' || user?.username === 'admin';
}

function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!isOwner(req)) {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

function requireRootAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isRootAdmin(req)) {
    return res.status(403).json({ error: 'Root admin access required' });
  }
  next();
}

const toggleSchema = z.object({
  addonKey: z.enum(ADDON_KEYS as unknown as [string, ...string[]]),
  action: z.enum(['activate', 'cancel']),
});

router.get('/my', requireOwner, async (req: Request, res: Response) => {
  try {
    let tenantId = getTenantId(req);
    if (!tenantId) {
      const user = (req as any).user;
      if (user?.username === 'admin' || user?.role === 'root_admin') {
        tenantId = 'root';
      } else {
        return res.status(400).json({ error: 'Tenant ID required' });
      }
    }
    
    const rootDb = getRootDb();
    const [tenant] = await rootDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const catalog = await getAddonCatalogForTenant(tenantId, tenant.planTier);
    const activeAddons = await getTenantAddons(tenantId);
    
    res.json({
      tenantId,
      planTier: tenant.planTier,
      catalog,
      activeAddons: activeAddons.filter(a => a.status === 'active' || a.status === 'pending_cancel'),
      billingNote: 'Changes to add-ons will reflect on your next invoice. Billing automation is in beta.',
    });
  } catch (error) {
    console.error('[ADDON ROUTES] Error fetching addon catalog:', error);
    res.status(500).json({ error: 'Failed to fetch add-on catalog' });
  }
});

router.post('/my/toggle', requireOwner, async (req: Request, res: Response) => {
  try {
    let tenantId = getTenantId(req);
    if (!tenantId) {
      const user = (req as any).user;
      if (user?.username === 'admin' || user?.role === 'root_admin') {
        tenantId = 'root';
      } else {
        return res.status(400).json({ error: 'Tenant ID required' });
      }
    }
    
    const parseResult = toggleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: parseResult.error.flatten(),
      });
    }
    
    const { addonKey, action } = parseResult.data;
    
    const addonDef = getAddonByKey(addonKey as AddonKey);
    if (!addonDef) {
      return res.status(404).json({ error: 'Add-on not found' });
    }
    
    const rootDb = getRootDb();
    const [tenant] = await rootDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tierOrder: Record<string, number> = {
      free: 0,
      starter: 1,
      pro: 2,
      elite: 3,
      internal: 4,
    };
    const currentTierLevel = tierOrder[tenant.planTier] ?? 0;
    const minTierLevel = tierOrder[addonDef.minTier] ?? 0;
    
    if (action === 'activate' && currentTierLevel < minTierLevel) {
      return res.status(400).json({ 
        error: `This add-on requires at least ${addonDef.minTier} plan`,
      });
    }
    
    if (action === 'activate') {
      await activateAddon(tenantId, addonKey as AddonKey);
      console.log(`[ADDON] Tenant ${tenantId} activated addon: ${addonKey}`);
    } else {
      await cancelAddon(tenantId, addonKey as AddonKey);
      console.log(`[ADDON] Tenant ${tenantId} set addon to pending_cancel: ${addonKey}`);
    }
    
    const updatedCatalog = await getAddonCatalogForTenant(tenantId, tenant.planTier);
    
    res.json({
      success: true,
      message: action === 'activate' 
        ? `${addonDef.name} has been activated` 
        : `${addonDef.name} will be canceled at the end of the billing period`,
      catalog: updatedCatalog,
    });
  } catch (error) {
    console.error('[ADDON ROUTES] Error toggling addon:', error);
    res.status(500).json({ error: 'Failed to update add-on' });
  }
});

router.get('/catalog', requireRootAdmin, async (req: Request, res: Response) => {
  try {
    res.json({
      catalog: ADDONS_CATALOG,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ADDON ROUTES] Error fetching catalog:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

export default router;
