/**
 * Tenant-safe backfill for legacy phoneLines rows.
 *
 * This version:
 * - Uses raw `db` only to FIND legacy rows with NULL tenantId.
 * - Uses tenant-aware `tenantDb('root')` for UPDATEs.
 * - Does NOT use withTenantFilter() on legacy rows (they don't have tenantId yet).
 * - Is idempotent: safe to run multiple times.
 */

import { db } from "./db";
import { wrapTenantDb } from "./tenantDb";
import { phoneLines } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";

export async function backfillPhoneLines() {
  console.log("[backfillPhoneLines] Starting backfill...");

  // 1) Select legacy rows directly from base db (NO tenant filter yet).
  const legacyLines = await db
    .select()
    .from(phoneLines)
    .where(isNull(phoneLines.tenantId));

  if (legacyLines.length === 0) {
    console.log("[backfillPhoneLines] No legacy rows found. Nothing to do.");
    return;
  }

  console.log(
    `[backfillPhoneLines] Found ${legacyLines.length} legacy phone lines needing backfill`
  );

  // 2) Use tenant-aware wrapper for updates (root tenant).
  const tenantDb = wrapTenantDb(db, "root");

  for (const line of legacyLines) {
    try {
      await tenantDb
        .update(phoneLines)
        .set({
          tenantId: "root",
        })
        // IMPORTANT: do NOT use withTenantFilter() here.
        // These rows don't have tenantId yet; we're assigning it.
        .where(eq(phoneLines.id, line.id));

      console.log(
        `[backfillPhoneLines] Updated phoneLine ${line.id} → tenant=root`
      );
    } catch (err) {
      console.error(
        `[backfillPhoneLines] ERROR updating phoneLine ${line.id}:`,
        err
      );
    }
  }

  console.log("[backfillPhoneLines] Backfill complete.");
}
