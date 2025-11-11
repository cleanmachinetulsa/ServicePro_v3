/**
 * API Routes - Backup Booking Intake
 * 
 * Handles booking requests during maintenance mode or system failures
 * This endpoint is exempt from maintenance middleware to allow submissions during downtime
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { forwardBookingToBackup } from "./autoFailover";

// Validation schema for backup booking submissions
const backupBookingSchema = z.object({
  customerName: z.string().min(1, "Name is required"),
  customerPhone: z.string().min(10, "Valid phone number is required"),
  customerEmail: z.string().email().optional(),
  service: z.string().min(1, "Service is required"),
  addOns: z.array(z.string()).optional(),
  scheduledTime: z.string().min(1, "Appointment time is required"),
  address: z.string().min(1, "Address is required"),
  vehicleInfo: z.string().optional(),
  notes: z.string().optional(),
});

export function registerBackupBookingRoutes(app: Express) {
  /**
   * POST /api/backup/bookings
   * Submit a booking request during maintenance mode or system failures
   * 
   * This endpoint is EXEMPT from maintenance middleware checks
   * Validates input and forwards booking details to backup email
   */
  app.post("/api/backup/bookings", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = backupBookingSchema.parse(req.body);

      console.log(`[BACKUP BOOKING] Received request from ${validatedData.customerName} (${validatedData.customerPhone})`);

      // Forward booking details to backup email
      const result = await forwardBookingToBackup(validatedData);

      if (result.success) {
        console.log(`[BACKUP BOOKING] Successfully forwarded to backup email`);
        return res.json({
          success: true,
          message: "Thank you! Your booking request has been received. We'll contact you shortly to confirm your appointment.",
        });
      } else {
        console.error(`[BACKUP BOOKING] Failed to forward: ${result.error}`);
        return res.status(500).json({
          success: false,
          message: "We received your request but encountered an issue forwarding it. Please call us directly to confirm your booking.",
          error: "Failed to process backup booking",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[BACKUP BOOKING] Validation error:', error.errors);
        return res.status(400).json({
          success: false,
          message: "Invalid booking information. Please check your details and try again.",
          errors: error.errors,
        });
      }

      console.error('[BACKUP BOOKING] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        message: "An unexpected error occurred. Please try again or contact us directly.",
        error: "Internal server error",
      });
    }
  });
}
