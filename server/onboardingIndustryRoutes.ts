// server/onboardingIndustryRoutes.ts
// ======================================================================
// Industry Onboarding Routes - Phase 8C
//
// Upgraded from Phase 8B to persist industry selection to database:
// - Accepts industry onboarding payload from the frontend
// - Attaches tenantId if available
// - Persists industry + industryConfig to tenant_config table
// - Logs everything in a clear, structured way
// - Gracefully handles missing tenant context
// ======================================================================

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { tenantConfig } from "@shared/schema";
import { eq } from "drizzle-orm";

interface IndustryOnboardingPayload {
  industryId: string;
  industryName?: string;
  // generic feature flags / options
  featureFlags?: Record<string, boolean>;
  // Whatever else we decide to send from the UI
  rawSelection?: any;
}

/**
 * Helper: pull tenantId off the request if your middleware attaches it.
 */
function getTenantId(req: Request): string | null {
  return (
    (req as any)?.tenantId ||
    (req as any)?.tenant_id ||
    (req as any)?.user?.tenantId ||
    null
  );
}

/**
 * Register the onboarding routes on the given Express app.
 */
export default function registerOnboardingIndustryRoutes(app: Express) {
  // POST /api/onboarding/industry
  app.post(
    "/api/onboarding/industry",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const body = req.body as Partial<IndustryOnboardingPayload> | undefined;

        if (!body || !body.industryId) {
          res.status(400).json({
            success: false,
            message: "Missing required field: industryId",
          });
          return;
        }

        const tenantId = getTenantId(req);

        const payload: IndustryOnboardingPayload & {
          tenantId: string | null;
          receivedAt: string;
          ip: string | undefined;
          userAgent: string | undefined;
        } = {
          industryId: body.industryId,
          industryName: body.industryName,
          featureFlags: body.featureFlags ?? {},
          rawSelection: body.rawSelection ?? {},
          tenantId,
          receivedAt: new Date().toISOString(),
          ip: req.ip,
          userAgent: req.headers["user-agent"] as string | undefined,
        };

        // Phase 8B logging - keep for debugging
        console.log("=== [ONBOARDING] Industry selection received ===");
        console.log(JSON.stringify(payload, null, 2));
        console.log("=== [/ONBOARDING] =================================");

        // Phase 8C: Persist to database if tenant context is available
        if (!tenantId) {
          console.log("[ONBOARDING] No tenant context – industry selection logged only.");
          res.json({
            success: true,
            message: "Industry selection received (no tenant context – logged only).",
            tenantId: null,
            persisted: false,
          });
          return;
        }

        // Check if tenant config exists
        const [existing] = await db
          .select()
          .from(tenantConfig)
          .where(eq(tenantConfig.tenantId, tenantId))
          .limit(1);

        if (!existing) {
          console.error(`[ONBOARDING] Tenant config not found for tenant: ${tenantId}`);
          res.status(404).json({
            success: false,
            message: "Tenant configuration not found.",
          });
          return;
        }

        // Build industry config object
        const industryConfigData = {
          featureFlags: body.featureFlags ?? {},
          rawSelection: body.rawSelection ?? {},
          version: "v1",
          updatedAt: new Date().toISOString(),
        };

        // Update tenant config with industry data
        try {
          await db
            .update(tenantConfig)
            .set({
              industry: body.industryId,
              industryConfig: industryConfigData,
              updatedAt: new Date(),
            })
            .where(eq(tenantConfig.tenantId, tenantId));

          console.log(`[ONBOARDING] Industry selection saved for tenant ${tenantId}: ${body.industryId}`);

          res.json({
            success: true,
            message: "Industry selection saved.",
            tenantId,
            industryId: body.industryId,
            persisted: true,
          });
        } catch (dbError: any) {
          console.error(`[ONBOARDING] Failed to persist industry selection for tenant ${tenantId}:`, dbError);
          res.status(500).json({
            success: false,
            message: "Failed to persist industry onboarding settings.",
          });
        }
      } catch (err) {
        console.error("[ONBOARDING] Error handling industry payload:", err);
        res.status(500).json({
          success: false,
          message: "Unexpected error handling industry onboarding.",
        });
      }
    }
  );

  console.log(
    "[ONBOARDING] Routes registered: POST /api/onboarding/industry (Phase 8C)"
  );
}
