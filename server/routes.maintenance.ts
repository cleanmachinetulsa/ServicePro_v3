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
import { 
  sendMaintenanceEnabledNotifications, 
  sendMaintenanceDisabledNotifications 
} from "./maintenanceNotifications";

// Validation schema
const updateMaintenanceSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().optional(),
  backupEmail: z.string().email().optional().nullable(),
  alertPhone: z.string().optional().nullable(),
  autoFailoverThreshold: z.number().int().min(1).max(20).optional(),
  smsFallbackEnabled: z.boolean().optional(),
  smsFallbackPhone: z.string().optional().nullable(),
  smsFallbackAutoReply: z.string().max(160, "Auto-reply message must be 160 characters or less").optional().nullable(),
}).refine((data) => {
  // If SMS fallback is enabled, require fallback phone
  if (data.smsFallbackEnabled === true && !data.smsFallbackPhone) {
    return false;
  }
  return true;
}, {
  message: "Fallback phone number is required when SMS fallback is enabled",
  path: ["smsFallbackPhone"],
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
            smsFallbackEnabled: false,
            smsFallbackPhone: null,
            smsFallbackAutoReply: "Thanks for your message! Our automated system is currently offline. You'll receive a personal response shortly.",
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
          smsFallbackEnabled: settings.smsFallbackEnabled,
          smsFallbackPhone: settings.smsFallbackPhone,
          smsFallbackAutoReply: settings.smsFallbackAutoReply,
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

      // CRITICAL VALIDATION: Prevent enabling SMS fallback without phone number
      if (validatedData.smsFallbackEnabled) {
        // Require phone number when enabling
        const phoneToUse = validatedData.smsFallbackPhone || existingSettings?.smsFallbackPhone;
        
        if (!phoneToUse || phoneToUse.trim() === '') {
          return res.status(400).json({
            success: false,
            error: 'SMS fallback phone number is required when enabling the fallback system',
          });
        }
      }

      // MIGRATION SAFETY: Auto-disable fallback if phone is missing (fixes broken existing installations)
      let updateData = { ...validatedData };
      if (existingSettings && existingSettings.smsFallbackEnabled && !existingSettings.smsFallbackPhone) {
        console.warn('[MAINTENANCE] Auto-disabling SMS fallback - no phone number configured (migration safety)');
        updateData.smsFallbackEnabled = false;
      }

      let updatedSettings;
      if (existingSettings) {
        // Update existing settings
        [updatedSettings] = await db
          .update(businessSettings)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(businessSettings.id, existingSettings.id))
          .returning();
      } else {
        // Create new settings record - validate phone requirement
        if (validatedData.smsFallbackEnabled && !validatedData.smsFallbackPhone) {
          return res.status(400).json({
            success: false,
            error: 'SMS fallback phone number is required when enabling the fallback system',
          });
        }
        
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

      // Send notifications if maintenance mode was toggled
      // Works for both first-time creation (insert) and updates
      if (validatedData.maintenanceMode !== undefined && updatedSettings) {
        // Default to false if no existing settings (first-time creation)
        const previousMode = existingSettings?.maintenanceMode ?? false;
        const wasToggled = validatedData.maintenanceMode !== previousMode;
        
        if (wasToggled) {
          console.log(`[MAINTENANCE] Maintenance mode toggled: ${previousMode} → ${validatedData.maintenanceMode}`);
          
          // Don't await notifications - send async to avoid blocking the response
          // Errors in notifications won't break the main toggle functionality
          if (validatedData.maintenanceMode === true) {
            // ENABLED - send critical alerts
            sendMaintenanceEnabledNotifications(
              updatedSettings, 
              'Manual activation via admin dashboard'
            ).catch(error => {
              console.error('[MAINTENANCE] Failed to send enabled notifications:', error);
            });
          } else {
            // DISABLED - send recovery notifications
            sendMaintenanceDisabledNotifications(updatedSettings).catch(error => {
              console.error('[MAINTENANCE] Failed to send disabled notifications:', error);
            });
          }
        }
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

      // Invalidate cache to apply changes immediately
      try {
        invalidateMaintenanceCache();
        console.log('[MAINTENANCE] Cache invalidated after manual failover trigger');
      } catch (cacheError) {
        console.error('[MAINTENANCE] Failed to invalidate cache:', cacheError);
      }

      // Send critical alerts - manual failover trigger
      // Don't await to avoid blocking the response
      sendMaintenanceEnabledNotifications(
        updatedSettings, 
        'Manual failover triggered via admin dashboard'
      ).catch(error => {
        console.error('[MAINTENANCE] Failed to send failover notifications:', error);
      });

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
