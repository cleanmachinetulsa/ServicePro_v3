/**
 * API Routes - Banner Management
 * 
 * CRUD operations for marketing banners with scheduling and targeting
 */

import type { Express } from "express";
import { db } from "./db";
import { banners, insertBannerSchema, type InsertBanner } from "@shared/schema";
import { eq, and, desc, or, isNull, lte, gte, sql } from "drizzle-orm";
import { z } from "zod";

export function registerBannerRoutes(app: Express) {
  /**
   * GET /api/banners
   * Fetch all banners (admin only)
   */
  app.get("/api/banners", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const allBanners = await db
        .select()
        .from(banners)
        .orderBy(desc(banners.updatedAt));

      return res.json(allBanners);
    } catch (error) {
      console.error("[BANNERS] Error fetching banners:", error);
      return res.status(500).json({ error: "Failed to fetch banners" });
    }
  });

  /**
   * GET /api/banners/active
   * Fetch active banners for current time (public endpoint)
   */
  app.get("/api/banners/active", async (req, res) => {
    try {
      const now = new Date();
      const activeBanners = await db
        .select()
        .from(banners)
        .where(
          and(
            eq(banners.isActive, true),
            or(isNull(banners.scheduleStart), lte(banners.scheduleStart, now)),
            or(isNull(banners.scheduleEnd), gte(banners.scheduleEnd, now))
          )
        )
        .orderBy(desc(banners.priority), desc(banners.createdAt));

      return res.json(activeBanners);
    } catch (error) {
      console.error("[BANNERS] Error fetching active banners:", error);
      return res.status(500).json({ error: "Failed to fetch active banners" });
    }
  });

  /**
   * GET /api/banners/:id
   * Fetch a single banner by ID
   */
  app.get("/api/banners/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const bannerId = parseInt(req.params.id);
      if (isNaN(bannerId)) {
        return res.status(400).json({ error: "Invalid banner ID" });
      }

      const [banner] = await db
        .select()
        .from(banners)
        .where(eq(banners.id, bannerId))
        .limit(1);

      if (!banner) {
        return res.status(404).json({ error: "Banner not found" });
      }

      return res.json(banner);
    } catch (error) {
      console.error("[BANNERS] Error fetching banner:", error);
      return res.status(500).json({ error: "Failed to fetch banner" });
    }
  });

  /**
   * POST /api/banners
   * Create a new banner
   */
  app.post("/api/banners", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const validatedData = insertBannerSchema.parse(req.body);

      const [newBanner] = await db
        .insert(banners)
        .values({
          ...validatedData,
          createdBy: req.session.userId,
        })
        .returning();

      console.log(`[BANNERS] Created banner: ${newBanner.title} (ID: ${newBanner.id})`);
      return res.status(201).json(newBanner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[BANNERS] Validation error:', error.errors);
        return res.status(400).json({ 
          error: "Invalid banner data", 
          details: error.errors 
        });
      }

      console.error("[BANNERS] Error creating banner:", error);
      return res.status(500).json({ error: "Failed to create banner" });
    }
  });

  /**
   * PATCH /api/banners/:id
   * Update an existing banner
   */
  app.patch("/api/banners/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const bannerId = parseInt(req.params.id);
      if (isNaN(bannerId)) {
        return res.status(400).json({ error: "Invalid banner ID" });
      }

      const validatedData = insertBannerSchema.partial().parse(req.body);

      const [updatedBanner] = await db
        .update(banners)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(banners.id, bannerId))
        .returning();

      if (!updatedBanner) {
        return res.status(404).json({ error: "Banner not found" });
      }

      console.log(`[BANNERS] Updated banner: ${updatedBanner.title} (ID: ${bannerId})`);
      return res.json(updatedBanner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[BANNERS] Validation error:', error.errors);
        return res.status(400).json({ 
          error: "Invalid banner data", 
          details: error.errors 
        });
      }

      console.error("[BANNERS] Error updating banner:", error);
      return res.status(500).json({ error: "Failed to update banner" });
    }
  });

  /**
   * DELETE /api/banners/:id
   * Delete a banner
   */
  app.delete("/api/banners/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const bannerId = parseInt(req.params.id);
      if (isNaN(bannerId)) {
        return res.status(400).json({ error: "Invalid banner ID" });
      }

      const [deletedBanner] = await db
        .delete(banners)
        .where(eq(banners.id, bannerId))
        .returning();

      if (!deletedBanner) {
        return res.status(404).json({ error: "Banner not found" });
      }

      console.log(`[BANNERS] Deleted banner: ${deletedBanner.title} (ID: ${bannerId})`);
      return res.json({ success: true, message: "Banner deleted" });
    } catch (error) {
      console.error("[BANNERS] Error deleting banner:", error);
      return res.status(500).json({ error: "Failed to delete banner" });
    }
  });
}
