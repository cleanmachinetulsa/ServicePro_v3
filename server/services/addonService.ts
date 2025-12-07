/**
 * SP-16: Add-On Service
 * 
 * Manages tenant add-ons including activation, cancellation, and status queries.
 * Works with the tenant_addons table and ADDONS_CATALOG for metadata.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { tenantAddons, type TenantAddon, type InsertTenantAddon } from '@shared/schema';
import { 
  ADDONS_CATALOG, 
  type AddonKey, 
  type AddonDefinition,
  getAddonByKey,
  getAddonsForTier,
} from '@shared/addonsConfig';
import { eq, and, sql } from 'drizzle-orm';

export interface TenantAddonWithMeta extends TenantAddon {
  definition: AddonDefinition;
}

export interface AddonCatalogItem extends AddonDefinition {
  currentStatus: 'active' | 'pending_cancel' | 'available' | 'unavailable';
  quantity?: number;
  activatedAt?: Date;
}

/**
 * Get all add-ons for a tenant with their catalog metadata
 */
export async function getTenantAddons(tenantId: string): Promise<TenantAddonWithMeta[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const addons = await rootDb
    .select()
    .from(tenantAddons)
    .where(eq(tenantAddons.tenantId, tenantId));
  
  return addons
    .map(addon => {
      const definition = getAddonByKey(addon.addonKey as AddonKey);
      if (!definition) return null;
      return {
        ...addon,
        definition,
      };
    })
    .filter((addon): addon is TenantAddonWithMeta => addon !== null);
}

/**
 * Check if a specific add-on is active for a tenant
 */
export async function isAddonActive(tenantId: string, key: AddonKey): Promise<boolean> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const result = await rootDb
    .select()
    .from(tenantAddons)
    .where(
      and(
        eq(tenantAddons.tenantId, tenantId),
        eq(tenantAddons.addonKey, key),
        eq(tenantAddons.status, 'active')
      )
    )
    .limit(1);
  
  return result.length > 0;
}

/**
 * Get all active add-ons for a tenant (just the keys)
 */
export async function getActiveAddonKeys(tenantId: string): Promise<AddonKey[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const addons = await rootDb
    .select({ addonKey: tenantAddons.addonKey })
    .from(tenantAddons)
    .where(
      and(
        eq(tenantAddons.tenantId, tenantId),
        eq(tenantAddons.status, 'active')
      )
    );
  
  return addons.map(a => a.addonKey as AddonKey);
}

/**
 * Set the status of an add-on for a tenant
 */
export async function setAddonStatus(args: {
  tenantId: string;
  addonKey: AddonKey;
  status: 'active' | 'pending_cancel' | 'canceled';
  quantity?: number;
}): Promise<void> {
  const { tenantId, addonKey, status, quantity } = args;
  const rootDb = wrapTenantDb(db, 'root');
  
  const existing = await rootDb
    .select()
    .from(tenantAddons)
    .where(
      and(
        eq(tenantAddons.tenantId, tenantId),
        eq(tenantAddons.addonKey, addonKey)
      )
    )
    .limit(1);
  
  const now = new Date();
  
  if (existing.length > 0) {
    const updates: Partial<TenantAddon> = { status };
    if (quantity !== undefined) {
      updates.quantity = quantity;
    }
    if (status === 'canceled') {
      updates.canceledAt = now;
    }
    
    await rootDb
      .update(tenantAddons)
      .set(updates)
      .where(
        and(
          eq(tenantAddons.tenantId, tenantId),
          eq(tenantAddons.addonKey, addonKey)
        )
      );
    
    console.log(`[ADDON SERVICE] Updated addon ${addonKey} for tenant ${tenantId}: status=${status}`);
  } else if (status === 'active') {
    await rootDb.insert(tenantAddons).values({
      tenantId,
      addonKey,
      status: 'active',
      quantity: quantity ?? 1,
      activatedAt: now,
    });
    
    console.log(`[ADDON SERVICE] Activated addon ${addonKey} for tenant ${tenantId}`);
  }
}

/**
 * Activate an add-on for a tenant
 */
export async function activateAddon(tenantId: string, addonKey: AddonKey, quantity: number = 1): Promise<void> {
  await setAddonStatus({ tenantId, addonKey, status: 'active', quantity });
}

/**
 * Cancel an add-on for a tenant (sets to pending_cancel)
 */
export async function cancelAddon(tenantId: string, addonKey: AddonKey): Promise<void> {
  await setAddonStatus({ tenantId, addonKey, status: 'pending_cancel' });
}

/**
 * Get full catalog with current status for a tenant
 */
export async function getAddonCatalogForTenant(
  tenantId: string, 
  planTier: string
): Promise<AddonCatalogItem[]> {
  const tenantAddonsData = await getTenantAddons(tenantId);
  const availableAddons = getAddonsForTier(planTier);
  
  const tenantAddonMap = new Map(
    tenantAddonsData.map(a => [a.addonKey, a])
  );
  
  return ADDONS_CATALOG.filter(addon => addon.isVisible).map(addon => {
    const tenantAddon = tenantAddonMap.get(addon.key);
    const isAvailable = availableAddons.some(a => a.key === addon.key);
    
    let currentStatus: 'active' | 'pending_cancel' | 'available' | 'unavailable';
    if (tenantAddon) {
      currentStatus = tenantAddon.status === 'canceled' ? 'available' : tenantAddon.status;
    } else {
      currentStatus = isAvailable ? 'available' : 'unavailable';
    }
    
    return {
      ...addon,
      currentStatus,
      quantity: tenantAddon?.quantity,
      activatedAt: tenantAddon?.activatedAt,
    };
  });
}

/**
 * Check if a tenant has a feature flag via any active add-on
 */
export async function hasAddonFeatureFlag(tenantId: string, featureFlag: string): Promise<boolean> {
  const activeAddons = await getTenantAddons(tenantId);
  
  for (const addon of activeAddons) {
    if (addon.status === 'active' && addon.definition.featureFlags.includes(featureFlag)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get all feature flags granted by active add-ons for a tenant
 */
export async function getAddonFeatureFlags(tenantId: string): Promise<string[]> {
  const activeAddons = await getTenantAddons(tenantId);
  
  const flags = new Set<string>();
  for (const addon of activeAddons) {
    if (addon.status === 'active') {
      for (const flag of addon.definition.featureFlags) {
        flags.add(flag);
      }
    }
  }
  
  return Array.from(flags);
}
