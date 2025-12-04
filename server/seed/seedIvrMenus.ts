/**
 * Seed IVR Menus for All Tenants
 * 
 * Phase 3: Initialize default IVR menus for tenants on startup
 * - Ensures Clean Machine (root) has proper IVR config
 * - Seeds other tenants with generic defaults
 * - Non-destructive: only seeds if no menu exists
 */

import { eq, and } from "drizzle-orm";
import { ivrMenus, tenantConfig } from "../../shared/schema";
import type { DB } from "../db";
import { getOrCreateDefaultMenuForTenant } from "../services/ivrConfigService";

export async function seedIvrMenus(db: DB) {
  console.log("[SEED IVR] Checking IVR menus...");
  
  try {
    const tenants = await db.select().from(tenantConfig);
    
    if (tenants.length === 0) {
      console.log("[SEED IVR] No tenants found, skipping IVR seeding");
      return;
    }
    
    let seeded = 0;
    let skipped = 0;
    
    for (const tenant of tenants) {
      const existing = await db
        .select()
        .from(ivrMenus)
        .where(and(
          eq(ivrMenus.tenantId, tenant.tenantId),
          eq(ivrMenus.isActive, true)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      await getOrCreateDefaultMenuForTenant(tenant.tenantId);
      seeded++;
    }
    
    if (seeded > 0) {
      console.log(`[SEED IVR] ✅ Seeded ${seeded} IVR menus`);
    }
    if (skipped > 0) {
      console.log(`[SEED IVR] Skipped ${skipped} tenants (already have IVR menus)`);
    }
    
  } catch (error) {
    console.error("[SEED IVR] Error seeding IVR menus:", error);
  }
}
