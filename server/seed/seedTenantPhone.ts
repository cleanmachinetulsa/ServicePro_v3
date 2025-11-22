/**
 * Seed root tenant phone configuration
 * 
 * Phase 2.2: Populate tenantPhoneConfig table with Clean Machine's phone setup
 */

import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { tenantPhoneConfig } from "../../shared/schema";
import type { DB } from "../db";

export async function seedTenantPhone(db: DB) {
  console.log("[SEED] Checking tenant phone config...");
  
  try {
    // Check if root tenant already has phone config
    const existing = await db.query.tenantPhoneConfig.findFirst({
      where: eq(tenantPhoneConfig.tenantId, "root"),
    });

    if (existing) {
      console.log("[SEED] Root tenant phone config already exists, skipping...");
      return;
    }

    // Insert Clean Machine's phone configuration
    await db.insert(tenantPhoneConfig).values({
      id: nanoid(),
      tenantId: "root",
      phoneNumber: "+19188565304",  // Main business line
      sipDomain: "cleanmachinetulsa.sip.twilio.com",
      sipUsername: "jody",
      ivrMode: "simple",  // Simple SIP forwarding mode
    });

    console.log("[SEED] ✅ Root tenant phone config created: +19188565304 → jody@cleanmachinetulsa.sip.twilio.com");
  } catch (error) {
    console.error("[SEED] Error seeding tenant phone config:", error);
    // Don't throw - allow server to continue even if seeding fails
  }
}
