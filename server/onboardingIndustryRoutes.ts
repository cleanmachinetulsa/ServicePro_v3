// server/onboardingIndustryRoutes.ts
// ======================================================================
// Industry Onboarding Routes - Phase 8B
//
// Safe stub:
// - Accepts industry onboarding payload from the frontend
// - Attaches tenantId if available
// - Logs everything in a clear, structured way
// - Always responds with success (unless something truly unexpected happens)
// - NO hard dependency on DB or other services yet
// ======================================================================

import type { Express, Request, Response } from "express";

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

        // For Phase 8B we just log it clearly.
        // 8C will actually persist this + bootstrap services.
        console.log("=== [ONBOARDING] Industry selection received ===");
        console.log(JSON.stringify(payload, null, 2));
        console.log("=== [/ONBOARDING] =================================");

        res.json({
          success: true,
          message: "Industry selection received (Phase 8B stub).",
          tenantId,
        });
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
    "[ONBOARDING] Routes registered: POST /api/onboarding/industry (Phase 8B)"
  );
}
