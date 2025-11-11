/**
 * API Routes - Maintenance Mode
 * 
 * Handles system maintenance controls and failover settings
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { businessSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "./authMiddleware";
import { z } from "zod";
import { invalidateMaintenanceCache } from "./maintenanceMode";

// Validation schema
const updateMaintenanceSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().optional(),
  backupEmail: z.string().email().optional().nullable(),
  alertPhone: z.string().optional().nullable(),
  autoFailoverThreshold: z.number().int().min(1).max(20).optional(),
});

export function registerMaintenanceRoutes(app: Express) {
  /**
   * GET /api/maintenance/settings
   * Get current maintenance mode settings
   */
  app.get("/api/maintenance/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const [settings] = await db.select().from(businessSettings).limit(1);

      if (!settings) {
        // Return default values if no settings exist yet
        return res.json({
          success: true,
          settings: {
            maintenanceMode: false,
            maintenanceMessage: "We're currently performing maintenance. Please check back soon or contact us directly.",
            backupEmail: null,
            alertPhone: null,
            autoFailoverThreshold: 5,
            lastFailoverAt: null,
          },
        });
      }

      res.json({
        success: true,
        settings: {
          maintenanceMode: settings.maintenanceMode,
          maintenanceMessage: settings.maintenanceMessage,
          backupEmail: settings.backupEmail,
          alertPhone: settings.alertPhone,
          autoFailoverThreshold: settings.autoFailoverThreshold,
          lastFailoverAt: settings.lastFailoverAt,
        },
      });
    } catch (error) {
      console.error("Error fetching maintenance settings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch maintenance settings",
      });
    }
  });

  /**
   * PUT /api/maintenance/settings
   * Update maintenance mode settings
   */
  app.put("/api/maintenance/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = updateMaintenanceSchema.parse(req.body);

      // Get existing settings
      const [existingSettings] = await db.select().from(businessSettings).limit(1);

      let updatedSettings;
      if (existingSettings) {
        // Update existing settings
        [updatedSettings] = await db
          .update(businessSettings)
          .set({
            ...validatedData,
            updatedAt: new Date(),
          })
          .where(eq(businessSettings.id, existingSettings.id))
          .returning();
      } else {
        // Create new settings record
        [updatedSettings] = await db
          .insert(businessSettings)
          .values({
            ...validatedData,
            // Include default values for required fields
            startHour: 9,
            startMinute: 0,
            endHour: 15,
            endMinute: 0,
            lunchHour: 12,
            lunchMinute: 0,
            daysOfWeek: [1, 2, 3, 4, 5],
            enableLunchBreak: true,
            allowWeekendBookings: false,
            halfHourIncrements: true,
            minimumNoticeHours: 24,
            maxDriveTimeMinutes: 26,
            etaPadding: 15,
          })
          .returning();
      }

      // Invalidate maintenance mode cache after successful DB write
      // This ensures middleware sees updated settings immediately on next request
      try {
        invalidateMaintenanceCache();
        console.log('[MAINTENANCE] Cache invalidated after settings update');
      } catch (cacheError) {
        // Log but don't fail the request if cache invalidation fails
        console.error('[MAINTENANCE] Failed to invalidate cache:', cacheError);
      }

      res.json({ success: true, settings: updatedSettings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid input data",
          details: error.errors,
        });
      }
      console.error("Error updating maintenance settings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update maintenance settings",
      });
    }
  });

  /**
   * POST /api/maintenance/trigger-failover
   * Manually trigger failover (for testing or emergency)
   */
  app.post("/api/maintenance/trigger-failover", requireAuth, async (req: Request, res: Response) => {
    try {
      const [settings] = await db.select().from(businessSettings).limit(1);

      if (!settings) {
        return res.status(404).json({
          success: false,
          error: "Business settings not found",
        });
      }

      // Update failover timestamp
      const [updatedSettings] = await db
        .update(businessSettings)
        .set({
          lastFailoverAt: new Date(),
          maintenanceMode: true,
          updatedAt: new Date(),
        })
        .where(eq(businessSettings.id, settings.id))
        .returning();

      // TODO: Send alerts via email/SMS to configured contacts
      // This would be implemented in a separate alerting service

      res.json({
        success: true,
        message: "Failover triggered successfully",
        settings: updatedSettings,
      });
    } catch (error) {
      console.error("Error triggering failover:", error);
      res.status(500).json({
        success: false,
        error: "Failed to trigger failover",
      });
    }
  });

  /**
   * GET /api/maintenance/status
   * Public endpoint to check if system is in maintenance mode
   */
  app.get("/api/maintenance/status", async (req: Request, res: Response) => {
    try {
      const [settings] = await db.select().from(businessSettings).limit(1);

      if (!settings || !settings.maintenanceMode) {
        return res.json({
          success: true,
          maintenanceMode: false,
        });
      }

      res.json({
        success: true,
        maintenanceMode: true,
        message: settings.maintenanceMessage || "System is currently under maintenance",
      });
    } catch (error) {
      console.error("Error checking maintenance status:", error);
      // On error, assume system is up to avoid unnecessary downtime
      res.json({
        success: true,
        maintenanceMode: false,
      });
    }
  });
}
