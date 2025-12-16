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
import { tenantConfig, tenants, users, phoneHistoryImports } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { bootstrapIndustryAiAndMessaging } from "./industryAiBootstrapService";
import { getBootstrapDataForIndustry, hasBootstrapData } from "./industryBootstrapData";
import { inviteCodeService } from "./services/inviteCodeService";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";

const SALT_ROUNDS = 10;

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
  // POST /api/onboarding/complete
  // Progressive onboarding: create tenant + user + save industry selection atomically
  app.post(
    "/api/onboarding/complete",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { username, password, email, industryId, industryName, featureFlags, rawSelection, inviteCode } = req.body;

        // Validate required fields
        if (!username || !password) {
          res.status(400).json({
            success: false,
            message: "Username and password are required",
          });
          return;
        }

        if (!industryId) {
          res.status(400).json({
            success: false,
            message: "Industry selection is required",
          });
          return;
        }

        // Validate username length
        if (username.length < 3) {
          res.status(400).json({
            success: false,
            message: "Username must be at least 3 characters",
          });
          return;
        }

        // Validate password length
        if (password.length < 6) {
          res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters",
          });
          return;
        }

        // Validate invite code if provided
        let inviteCodeData: { planTier: string; code: string } | null = null;
        if (inviteCode) {
          const validation = await inviteCodeService.validateCode(inviteCode);
          if (!validation.success) {
            res.status(400).json({
              success: false,
              message: validation.reason === 'not_found' ? 'Invalid invite code' :
                       validation.reason === 'inactive' ? 'This invite code is no longer active' :
                       validation.reason === 'expired' ? 'This invite code has expired' :
                       'This invite code has reached its maximum number of uses',
            });
            return;
          }
          inviteCodeData = { planTier: validation.invite.planTier, code: validation.invite.code };
        }

        // Check if username already exists in ANY tenant (global check)
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (existingUser && existingUser.length > 0) {
          res.status(400).json({
            success: false,
            message: "Username already exists",
          });
          return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Generate tenant ID from username
        const tenantId = `tenant_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${nanoid(6)}`;

        // Build industry config object
        const industryConfigData = {
          featureFlags: featureFlags ?? {},
          rawSelection: rawSelection ?? {},
          version: "v1",
          updatedAt: new Date().toISOString(),
        };

        // Create tenant + user atomically
        let newUser;
        try {
          await db.transaction(async (tx) => {
            // 1. Create tenant (with invite code data if provided)
            const tenantData: any = {
              id: tenantId,
              name: `${username}'s Business`,
              subdomain: null,
              isRoot: false,
              planTier: inviteCodeData ? inviteCodeData.planTier : "starter",
              status: inviteCodeData ? "active" : "trialing",
              billingComplimentary: inviteCodeData ? true : false,
              inviteCodeUsed: inviteCodeData ? inviteCodeData.code : null,
            };
            await tx.insert(tenants).values(tenantData);

            // 2. Create tenant config with industry selection
            await tx.insert(tenantConfig).values({
              tenantId,
              businessName: `${username}'s Business`,
              logoUrl: null,
              primaryColor: "#3b82f6",
              tier: inviteCodeData ? inviteCodeData.planTier : "starter",
              industry: industryId,
              industryConfig: industryConfigData,
            });

            // 3. Create user
            const [user] = await tx.insert(users).values({
              username,
              password: hashedPassword,
              email: email || null,
              role: "owner",
              tenantId,
            }).returning();

            newUser = user;
          });

          // Increment invite code usage count (outside transaction for atomicity)
          if (inviteCodeData) {
            try {
              await inviteCodeService.incrementUsage(inviteCodeData.code);
              console.log(`[ONBOARDING] Incremented usage for invite code ${inviteCodeData.code}`);
            } catch (codeErr) {
              console.error(`[ONBOARDING] Failed to increment invite code usage:`, codeErr);
            }
          }

          console.log(`[ONBOARDING] Created tenant ${tenantId} with user ${username} and industry ${industryId}${inviteCodeData ? ` (using invite code ${inviteCodeData.code})` : ''}`);

          // Bootstrap AI behavior rules, SMS templates, and FAQ entries if available
          let bootstrapResult = null;
          if (hasBootstrapData(industryId)) {
            console.log(`[ONBOARDING] Bootstrapping AI & messaging for industry: ${industryId}`);
            const bootstrapData = getBootstrapDataForIndustry(industryId);
            
            if (bootstrapData) {
              bootstrapResult = await bootstrapIndustryAiAndMessaging(
                tenantId,
                industryId,
                bootstrapData
              );

              if (bootstrapResult.success) {
                console.log(`[ONBOARDING] Bootstrap complete:`, bootstrapResult.summary);
              } else {
                console.error(`[ONBOARDING] Bootstrap failed:`, bootstrapResult.error);
              }
            }
          }

          // Create session (auto-login)
          req.session.regenerate((err) => {
            if (err) {
              console.error('[ONBOARDING] Session regeneration error:', err);
              res.status(500).json({
                success: false,
                message: 'Account created but login failed. Please try logging in manually.',
              });
              return;
            }

            // Store user ID, tenant ID, and role in session (required for tenant middleware)
            req.session.userId = newUser!.id;
            req.session.tenantId = tenantId;
            req.session.role = 'owner';
            req.session.twoFactorVerified = false;

            // Save session
            req.session.save((saveErr) => {
              if (saveErr) {
                console.error('[ONBOARDING] Session save error:', saveErr);
                return res.status(500).json({
                  success: false,
                  message: 'Account created but login failed. Please try logging in manually.',
                });
              }

              return res.json({
                success: true,
                message: "Account created successfully",
                user: {
                  id: newUser!.id,
                  username: newUser!.username,
                },
                tenant: {
                  id: tenantId,
                  industry: industryId,
                },
                bootstrap: bootstrapResult,
              });
            });
          });
        } catch (dbError: any) {
          console.error('[ONBOARDING] Transaction failed:', dbError);
          res.status(500).json({
            success: false,
            message: "Failed to create account. Please try again.",
          });
        }
      } catch (err) {
        console.error('[ONBOARDING] Error in /api/onboarding/complete:', err);
        res.status(500).json({
          success: false,
          message: "Unexpected error during account creation.",
        });
      }
    }
  );

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

          // Phase 8E: Bootstrap AI behavior rules, SMS templates, and FAQ entries
          let bootstrapResult = null;
          if (hasBootstrapData(body.industryId)) {
            console.log(`[ONBOARDING] Bootstrapping AI & messaging for industry: ${body.industryId}`);
            const bootstrapData = getBootstrapDataForIndustry(body.industryId);
            
            if (bootstrapData) {
              bootstrapResult = await bootstrapIndustryAiAndMessaging(
                tenantId,
                body.industryId,
                bootstrapData
              );

              if (bootstrapResult.success) {
                console.log(`[ONBOARDING] Bootstrap complete:`, bootstrapResult.summary);
              } else {
                console.error(`[ONBOARDING] Bootstrap failed:`, bootstrapResult.error);
              }
            }
          } else {
            console.log(`[ONBOARDING] No bootstrap data available for industry: ${body.industryId}`);
          }

          res.json({
            success: true,
            message: "Industry selection saved.",
            tenantId,
            industryId: body.industryId,
            persisted: true,
            bootstrap: bootstrapResult,
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

  // DEV/TEST ROUTE: Direct AI bootstrap testing (non-production only)
  if (process.env.NODE_ENV !== "production") {
    app.post(
      "/api/dev/test-ai-bootstrap",
      async (req: Request, res: Response): Promise<void> => {
        try {
          const { tenantId, industryId } = req.body;

          if (!tenantId || !industryId) {
            res.status(400).json({
              success: false,
              message: "Missing required fields: tenantId and industryId",
            });
            return;
          }

          if (!hasBootstrapData(industryId)) {
            res.status(404).json({
              success: false,
              message: `No bootstrap data found for industry: ${industryId}`,
            });
            return;
          }

          const bootstrapData = getBootstrapDataForIndustry(industryId);
          if (!bootstrapData) {
            res.status(404).json({
              success: false,
              message: `Failed to load bootstrap data for industry: ${industryId}`,
            });
            return;
          }

          console.log(`[DEV_BOOTSTRAP] Testing AI bootstrap for tenant ${tenantId}, industry ${industryId}`);

          const result = await bootstrapIndustryAiAndMessaging(
            tenantId,
            industryId,
            bootstrapData
          );

          res.json({
            success: true,
            tenantId,
            industryId,
            result,
          });
        } catch (error) {
          console.error("[DEV_BOOTSTRAP] Error:", error);
          res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    console.log("[ONBOARDING] DEV route registered: POST /api/dev/test-ai-bootstrap");
  }

  // GET /api/onboarding/progress
  // Returns current setup wizard progress for authenticated user's tenant
  app.get(
    "/api/onboarding/progress",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const tenantId = getTenantId(req);
        
        if (!tenantId) {
          res.status(401).json({
            success: false,
            message: "Authentication required",
          });
          return;
        }

        // Fetch tenant config for progress data
        const [config] = await db
          .select({
            businessName: tenantConfig.businessName,
            subdomain: tenantConfig.subdomain,
            industry: tenantConfig.industry,
            businessSetupDone: tenantConfig.onboardingBusinessSetupDone,
            phoneSetupDone: tenantConfig.onboardingPhoneSetupDone,
            phoneHistoryStepSeen: tenantConfig.onboardingPhoneHistoryStepSeen,
            sitePublished: tenantConfig.onboardingSitePublished,
            heroTitle: tenantConfig.heroTitle,
            heroSubtitle: tenantConfig.heroSubtitle,
            ctaButtonText: tenantConfig.ctaButtonText,
            twilioPhoneNumber: tenantConfig.twilioPhoneNumber,
          })
          .from(tenantConfig)
          .where(eq(tenantConfig.tenantId, tenantId))
          .limit(1);

        if (!config) {
          res.status(404).json({
            success: false,
            message: "Tenant configuration not found",
          });
          return;
        }

        // Check if there's a successful phone history import for auto-complete
        const [successfulImport] = await db
          .select({ id: phoneHistoryImports.id })
          .from(phoneHistoryImports)
          .where(
            and(
              eq(phoneHistoryImports.tenantId, tenantId),
              eq(phoneHistoryImports.status, "completed")
            )
          )
          .limit(1);

        const hasSuccessfulImport = !!successfulImport;

        // Build website URL if subdomain is set
        const websiteUrl = config.subdomain
          ? `https://${req.get("host")}/site/${config.subdomain}`
          : null;

        res.json({
          success: true,
          progress: {
            businessSetupDone: config.businessSetupDone ?? false,
            phoneSetupDone: config.phoneSetupDone ?? false,
            phoneHistoryStepSeen: config.phoneHistoryStepSeen ?? false,
            hasSuccessfulPhoneHistoryImport: hasSuccessfulImport,
            sitePublished: config.sitePublished ?? false,
            businessName: config.businessName || "Your Business",
            subdomain: config.subdomain,
            industry: config.industry,
            phoneConfigured: !!config.twilioPhoneNumber,
            phoneNumber: config.twilioPhoneNumber,
            websiteUrl,
            heroTitle: config.heroTitle,
            heroSubtitle: config.heroSubtitle,
            ctaButtonText: config.ctaButtonText,
          },
        });
      } catch (error) {
        console.error("[ONBOARDING_PROGRESS] Error fetching progress:", error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // POST /api/onboarding/progress
  // Updates setup wizard progress for authenticated user's tenant
  app.post(
    "/api/onboarding/progress",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const tenantId = getTenantId(req);
        
        if (!tenantId) {
          res.status(401).json({
            success: false,
            message: "Authentication required",
          });
          return;
        }

        const { businessSetupDone, phoneSetupDone, phoneHistoryStepSeen, sitePublished } = req.body;

        // Build update object with only provided fields
        const updates: Record<string, any> = {};
        if (typeof businessSetupDone === "boolean") {
          updates.onboardingBusinessSetupDone = businessSetupDone;
        }
        if (typeof phoneSetupDone === "boolean") {
          updates.onboardingPhoneSetupDone = phoneSetupDone;
        }
        if (typeof phoneHistoryStepSeen === "boolean") {
          updates.onboardingPhoneHistoryStepSeen = phoneHistoryStepSeen;
        }
        if (typeof sitePublished === "boolean") {
          updates.onboardingSitePublished = sitePublished;
        }

        if (Object.keys(updates).length === 0) {
          res.status(400).json({
            success: false,
            message: "No valid fields to update",
          });
          return;
        }

        // Update tenant config
        await db
          .update(tenantConfig)
          .set(updates)
          .where(eq(tenantConfig.tenantId, tenantId));

        console.log(`[ONBOARDING_PROGRESS] Updated progress for tenant ${tenantId}:`, updates);

        res.json({
          success: true,
          message: "Progress updated successfully",
        });
      } catch (error) {
        console.error("[ONBOARDING_PROGRESS] Error updating progress:", error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  console.log(
    "[ONBOARDING] Routes registered: POST /api/onboarding/industry (Phase 8C), GET/POST /api/onboarding/progress"
  );
}
