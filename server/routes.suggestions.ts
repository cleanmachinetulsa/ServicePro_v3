/**
 * API Routes - Suggestion System
 * 
 * Two-level suggestion system:
 * 1. Platform Suggestions: Tenant owners → ServicePro platform (Jody)
 * 2. Customer Suggestions: Customers → Tenant business
 */

import type { Express } from "express";
import { 
  platformSuggestions, 
  customerSuggestions,
  insertPlatformSuggestionSchema,
  insertCustomerSuggestionSchema,
  tenantConfig
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";

export function registerSuggestionRoutes(app: Express) {
  // ========================================
  // PLATFORM SUGGESTIONS (Tenant → ServicePro)
  // ========================================

  /**
   * GET /api/platform-suggestions
   * Fetch all platform suggestions for the current tenant (admin only)
   */
  app.get("/api/platform-suggestions", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const tenantDb = (req as any).tenantDb!;
      const suggestions = await tenantDb
        .select()
        .from(platformSuggestions)
        .where(eq(platformSuggestions.tenantId, tenantDb.tenant.id))
        .orderBy(desc(platformSuggestions.createdAt));

      return res.json(suggestions);
    } catch (error) {
      console.error("[SUGGESTIONS] Error fetching platform suggestions:", error);
      return res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  });

  /**
   * POST /api/platform-suggestions
   * Submit a new platform suggestion (authenticated tenant users)
   */
  app.post("/api/platform-suggestions", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const tenantDb = (req as any).tenantDb!;
      
      const validatedData = insertPlatformSuggestionSchema.parse({
        ...req.body,
        tenantId: tenantDb.tenant.id,
        submittedByUserId: req.session.userId,
      });

      const [newSuggestion] = await tenantDb
        .insert(platformSuggestions)
        .values({
          ...validatedData,
          metadata: {
            source: "platform" as const,
            tags: [],
            userAgent: req.headers["user-agent"],
            submitterEmail: req.session.userEmail,
            submitterName: req.session.userName,
          },
        })
        .returning();

      console.log(`[SUGGESTIONS] Platform suggestion submitted: "${newSuggestion.title}" by tenant ${tenantDb.tenant.id}`);
      return res.status(201).json(newSuggestion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[SUGGESTIONS] Error creating platform suggestion:", error);
      return res.status(500).json({ error: "Failed to submit suggestion" });
    }
  });

  // ========================================
  // CUSTOMER SUGGESTIONS (Customer → Tenant)
  // ========================================

  /**
   * GET /api/customer-suggestions
   * Fetch all customer suggestions for the tenant (admin only)
   */
  app.get("/api/customer-suggestions", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const tenantDb = (req as any).tenantDb!;
      const suggestions = await tenantDb
        .select()
        .from(customerSuggestions)
        .where(eq(customerSuggestions.tenantId, tenantDb.tenant.id))
        .orderBy(desc(customerSuggestions.createdAt));

      return res.json(suggestions);
    } catch (error) {
      console.error("[SUGGESTIONS] Error fetching customer suggestions:", error);
      return res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  });

  /**
   * POST /api/public/customer-suggestions
   * Submit a customer suggestion (PUBLIC - no auth required)
   * Used on the tenant's public website
   */
  app.post("/api/public/customer-suggestions", async (req, res) => {
    try {
      const tenantDb = (req as any).tenantDb;
      
      if (!tenantDb) {
        return res.status(400).json({ error: "Tenant context required" });
      }

      // Check if suggestions box is enabled for this tenant
      const [config] = await tenantDb
        .select({ suggestionsBoxEnabled: tenantConfig.suggestionsBoxEnabled })
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantDb.tenant.id))
        .limit(1);

      if (config && config.suggestionsBoxEnabled === false) {
        return res.status(403).json({ error: "Suggestion box is disabled for this business" });
      }

      const validatedData = insertCustomerSuggestionSchema.parse({
        ...req.body,
        tenantId: tenantDb.tenant.id,
      });

      const [newSuggestion] = await tenantDb
        .insert(customerSuggestions)
        .values({
          ...validatedData,
          metadata: {
            source: "customer" as const,
            tags: [],
            userAgent: req.headers["user-agent"],
            ipAddress: req.ip,
          },
        })
        .returning();

      console.log(`[SUGGESTIONS] Customer suggestion submitted for tenant ${tenantDb.tenant.id}`);
      return res.status(201).json({ 
        success: true,
        message: "Thank you for your feedback!" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[SUGGESTIONS] Error creating customer suggestion:", error);
      return res.status(500).json({ error: "Failed to submit suggestion" });
    }
  });

  /**
   * DELETE /api/customer-suggestions/:id
   * Delete a customer suggestion (admin only)
   */
  app.delete("/api/customer-suggestions/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const suggestionId = parseInt(req.params.id);
      if (isNaN(suggestionId)) {
        return res.status(400).json({ error: "Invalid suggestion ID" });
      }

      const tenantDb = (req as any).tenantDb!;
      const [deleted] = await tenantDb
        .delete(customerSuggestions)
        .where(
          and(
            eq(customerSuggestions.tenantId, tenantDb.tenant.id),
            eq(customerSuggestions.id, suggestionId)
          )
        )
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Suggestion not found" });
      }

      console.log(`[SUGGESTIONS] Customer suggestion deleted: ID ${suggestionId}`);
      return res.json({ success: true });
    } catch (error) {
      console.error("[SUGGESTIONS] Error deleting customer suggestion:", error);
      return res.status(500).json({ error: "Failed to delete suggestion" });
    }
  });

  // ========================================
  // ADMIN: All Platform Suggestions (Root tenant only)
  // ========================================

  /**
   * GET /api/admin/platform-suggestions
   * Fetch ALL platform suggestions from ALL tenants (super admin only)
   */
  app.get("/api/admin/platform-suggestions", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is from root tenant (ServicePro admin)
    const tenantDb = (req as any).tenantDb;
    if (!tenantDb || tenantDb.tenant.id !== "root") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const suggestions = await db
        .select()
        .from(platformSuggestions)
        .orderBy(desc(platformSuggestions.createdAt));

      return res.json(suggestions);
    } catch (error) {
      console.error("[SUGGESTIONS] Error fetching all platform suggestions:", error);
      return res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  });

  /**
   * PATCH /api/admin/platform-suggestions/:id/status
   * Update the status of a platform suggestion (super admin only)
   */
  app.patch("/api/admin/platform-suggestions/:id/status", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is from root tenant (ServicePro admin)
    const tenantDb = (req as any).tenantDb;
    if (!tenantDb || tenantDb.tenant.id !== "root") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const suggestionId = parseInt(req.params.id);
      if (isNaN(suggestionId)) {
        return res.status(400).json({ error: "Invalid suggestion ID" });
      }

      const { status } = req.body;
      const validStatuses = ["new", "reviewing", "planned", "completed", "declined"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const [updated] = await db
        .update(platformSuggestions)
        .set({ 
          status,
          updatedAt: new Date(),
        })
        .where(eq(platformSuggestions.id, suggestionId))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Suggestion not found" });
      }

      console.log(`[SUGGESTIONS] Platform suggestion ${suggestionId} status updated to ${status}`);
      return res.json(updated);
    } catch (error) {
      console.error("[SUGGESTIONS] Error updating platform suggestion status:", error);
      return res.status(500).json({ error: "Failed to update suggestion" });
    }
  });

  // ========================================
  // SETTINGS: Suggestion Box Toggle
  // ========================================

  /**
   * GET /api/settings/suggestions-box
   * Get the suggestions box enabled status
   */
  app.get("/api/settings/suggestions-box", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const tenantDb = (req as any).tenantDb!;
      const [config] = await tenantDb
        .select({ suggestionsBoxEnabled: tenantConfig.suggestionsBoxEnabled })
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantDb.tenant.id))
        .limit(1);

      return res.json({ 
        enabled: config?.suggestionsBoxEnabled ?? true 
      });
    } catch (error) {
      console.error("[SUGGESTIONS] Error fetching suggestions box setting:", error);
      return res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  /**
   * PATCH /api/settings/suggestions-box
   * Toggle the suggestions box enabled status
   */
  app.patch("/api/settings/suggestions-box", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Invalid 'enabled' value" });
      }

      const tenantDb = (req as any).tenantDb!;
      
      // Upsert: update if exists, insert if not
      await tenantDb
        .update(tenantConfig)
        .set({ 
          suggestionsBoxEnabled: enabled,
          updatedAt: new Date(),
        })
        .where(eq(tenantConfig.tenantId, tenantDb.tenant.id));

      console.log(`[SUGGESTIONS] Suggestions box ${enabled ? "enabled" : "disabled"} for tenant ${tenantDb.tenant.id}`);
      return res.json({ success: true, enabled });
    } catch (error) {
      console.error("[SUGGESTIONS] Error updating suggestions box setting:", error);
      return res.status(500).json({ error: "Failed to update setting" });
    }
  });
}
