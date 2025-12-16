import type { Express, Request, Response } from "express";
import { inviteCodeService } from "./services/inviteCodeService";
import { requireRole } from "./rbacMiddleware";
import { z } from "zod";

const createInviteCodeSchema = z.object({
  label: z.string().min(1, "Label is required"),
  description: z.string().optional(),
  planTier: z.enum(["starter", "pro", "elite"]),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateInviteCodeSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

export default function registerAdminInviteCodeRoutes(app: Express) {
  app.get(
    "/api/admin/invite-codes",
    requireRole("root"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const codes = await inviteCodeService.listCodes();
        res.json({ success: true, codes });
      } catch (error: any) {
        console.error("[ADMIN INVITE CODES] List error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  app.get(
    "/api/admin/invite-codes/:id",
    requireRole("root"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ success: false, error: "Invalid ID" });
          return;
        }
        
        const code = await inviteCodeService.getCodeById(id);
        if (!code) {
          res.status(404).json({ success: false, error: "Invite code not found" });
          return;
        }
        
        res.json({ success: true, code });
      } catch (error: any) {
        console.error("[ADMIN INVITE CODES] Get error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  app.post(
    "/api/admin/invite-codes",
    requireRole("root"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = createInviteCodeSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ 
            success: false, 
            error: "Validation failed",
            details: parsed.error.flatten(),
          });
          return;
        }

        const { label, description, planTier, maxRedemptions, expiresAt, isActive } = parsed.data;
        
        const code = await inviteCodeService.createCode({
          label,
          description: description || null,
          planTier,
          maxRedemptions: maxRedemptions ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isActive,
          createdByUserId: (req as any).session?.userId || null,
        });

        res.status(201).json({ success: true, code });
      } catch (error: any) {
        console.error("[ADMIN INVITE CODES] Create error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  app.patch(
    "/api/admin/invite-codes/:id",
    requireRole("root"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ success: false, error: "Invalid ID" });
          return;
        }

        const parsed = updateInviteCodeSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ 
            success: false, 
            error: "Validation failed",
            details: parsed.error.flatten(),
          });
          return;
        }

        const updates: any = {};
        if (parsed.data.label !== undefined) updates.label = parsed.data.label;
        if (parsed.data.description !== undefined) updates.description = parsed.data.description;
        if (parsed.data.maxRedemptions !== undefined) updates.maxRedemptions = parsed.data.maxRedemptions;
        if (parsed.data.expiresAt !== undefined) updates.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
        if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

        const updatedCode = await inviteCodeService.updateCode(id, updates);
        if (!updatedCode) {
          res.status(404).json({ success: false, error: "Invite code not found" });
          return;
        }

        res.json({ success: true, code: updatedCode });
      } catch (error: any) {
        console.error("[ADMIN INVITE CODES] Update error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  app.get(
    "/api/public/invite-codes/validate",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const code = req.query.code as string;
        if (!code) {
          res.status(400).json({ success: false, valid: false, error: "Code is required" });
          return;
        }

        const result = await inviteCodeService.validateCode(code);
        
        if (result.success) {
          res.json({
            success: true,
            valid: true,
            planTier: result.invite.planTier,
            label: result.invite.label,
          });
        } else {
          res.json({
            success: true,
            valid: false,
            reason: result.reason,
          });
        }
      } catch (error: any) {
        console.error("[INVITE CODES] Validate error:", error);
        res.status(500).json({ success: false, valid: false, error: error.message });
      }
    }
  );
}
