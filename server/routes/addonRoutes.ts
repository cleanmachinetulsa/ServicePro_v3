/**
 * SP-16/SP-20: Add-Ons API Routes
 * 
 * Routes for managing tenant add-ons:
 * - GET /api/billing/addons/my - Get catalog with current tenant status
 * - POST /api/billing/addons/my/toggle - Activate or cancel an add-on
 * - GET /api/admin/addons/catalog - Get full catalog (admin only)
 * - PUT /api/admin/addons/catalog/:key - Update catalog entry (root admin only)
 * 
 * SP-20 adds:
 * - Stripe billing integration for add-ons
 * - Clean Machine tenant protection
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
  getAddonCatalogForTenant, 
  activateAddon, 
  cancelAddon,
  getTenantAddons,
  setAddonStripeSubscriptionItemId,
} from '../services/addonService';
import { ADDONS_CATALOG, getAddonByKey, type AddonKey } from '@shared/addonsConfig';
import { ADDON_KEYS, tenants } from '@shared/schema';
import { requireAuth } from '../authMiddleware';
import { getRootDb } from '../tenantDb';
import { eq } from 'drizzle-orm';
import { isCleanMachineTenant } from '../services/tenantGuards';
import { 
  attachAddonPriceToSubscription, 
  detachAddonPriceFromSubscription,
  getTenantBillingInfo,
} from '../services/stripeBillingService';

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
    
    // SP-20: Clean Machine tenant protection - hide add-ons for protected tenant
    const isProtectedTenant = isCleanMachineTenant(tenantId);
    
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
      isProtectedTenant, // SP-20: Clean Machine tenant protection flag
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
    
    // SP-20: Clean Machine tenant protection
    if (isCleanMachineTenant(tenantId)) {
      console.warn(`[ADDON ROUTES] Blocked add-on toggle for Clean Machine tenant: ${tenantId}`);
      return res.status(403).json({ 
        error: 'Add-on management is not available for this tenant',
        reason: 'protected_tenant',
      });
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
    
    // Check if tenant is suspended
    if (tenant.status === 'suspended') {
      return res.status(403).json({ 
        error: 'You must resolve billing issues before changing add-ons',
        reason: 'account_suspended',
      });
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
    
    // SP-20: Get Stripe price ID from addon config
    const stripePriceId = getAddonStripePriceId(addonKey);
    
    if (action === 'activate') {
      // SP-20: Attempt to attach add-on to Stripe subscription
      let stripeSubscriptionItemId: string | undefined;
      
      if (tenant.stripeSubscriptionId && stripePriceId) {
        const stripeResult = await attachAddonPriceToSubscription(
          tenant.stripeSubscriptionId,
          stripePriceId,
          addonKey
        );
        
        if (!stripeResult.success) {
          console.warn(`[ADDON ROUTES] Stripe attachment failed for ${addonKey}: ${stripeResult.error}`);
          // Continue anyway - billing will be handled manually or add-on works without Stripe
        } else {
          stripeSubscriptionItemId = stripeResult.subscriptionItemId;
        }
      }
      
      await activateAddon(tenantId, addonKey as AddonKey);
      
      // Store Stripe subscription item ID if we got one
      if (stripeSubscriptionItemId) {
        await setAddonStripeSubscriptionItemId(tenantId, addonKey as AddonKey, stripeSubscriptionItemId);
      }
      
      console.log(`[ADDON] Tenant ${tenantId} activated addon: ${addonKey}${stripeSubscriptionItemId ? ` (Stripe: ${stripeSubscriptionItemId})` : ''}`);
    } else {
      // Get current addon to find Stripe subscription item ID
      const currentAddons = await getTenantAddons(tenantId);
      const currentAddon = currentAddons.find(a => a.addonKey === addonKey);
      
      // SP-20: Attempt to detach add-on from Stripe subscription
      // Uses externalSubscriptionId field which stores the Stripe subscription item ID
      if (currentAddon?.externalSubscriptionId) {
        const detachResult = await detachAddonPriceFromSubscription(
          currentAddon.externalSubscriptionId,
          addonKey
        );
        
        if (!detachResult.success) {
          console.warn(`[ADDON ROUTES] Stripe detachment failed for ${addonKey}: ${detachResult.error}`);
          // Continue anyway - mark as canceled in our system
        }
      }
      
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

/**
 * SP-20: Get Stripe Price ID for an add-on
 * Maps addon keys to environment variable price IDs
 */
function getAddonStripePriceId(addonKey: string): string | null {
  const priceIdMap: Record<string, string | undefined> = {
    extra_phone_number: process.env.STRIPE_PRICE_ADDON_EXTRA_NUMBER,
    extra_user_seats: process.env.STRIPE_PRICE_ADDON_EXTRA_SEATS,
    ai_power_pack: process.env.STRIPE_PRICE_ADDON_AI_POWER,
    priority_support: process.env.STRIPE_PRICE_ADDON_PRIORITY_SUPPORT,
    multi_location: process.env.STRIPE_PRICE_ADDON_MULTI_LOCATION,
    white_label_plus: process.env.STRIPE_PRICE_ADDON_WHITE_LABEL,
  };
  
  return priceIdMap[addonKey] || null;
}

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
