/**
 * API Routes - Service Limits
 * 
 * Handles daily capacity management for services
 */

import type { Express, Request, Response } from "express";
import { serviceLimits, services } from "@shared/schema";
import { eq, and, sql, or, desc } from "drizzle-orm";
import { requireAuth } from "./authMiddleware";
import { z } from "zod";

// Validation schemas
const createServiceLimitSchema = z.object({
  serviceId: z.number().int().positive(),
  dailyLimit: z.number().int().positive().min(1).max(50),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updateServiceLimitSchema = z.object({
  dailyLimit: z.number().int().positive().min(1).max(50).optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().optional(),
});

export function registerServiceLimitsRoutes(app: Express) {
  /**
   * GET /api/service-limits
   * Get all service limits with service details
   */
  app.get("/api/service-limits", requireAuth, async (req: Request, res: Response) => {
    try {
      const limits = await req.tenantDb!
        .select({
          id: serviceLimits.id,
          serviceId: serviceLimits.serviceId,
          serviceName: services.name,
          dailyLimit: serviceLimits.dailyLimit,
          effectiveFrom: serviceLimits.effectiveFrom,
          effectiveTo: serviceLimits.effectiveTo,
          isActive: serviceLimits.isActive,
          createdAt: serviceLimits.createdAt,
          updatedAt: serviceLimits.updatedAt,
        })
        .from(serviceLimits)
        .leftJoin(services, eq(serviceLimits.serviceId, services.id))
        .where(req.tenantDb!.withTenantFilter(serviceLimits))
        .orderBy(desc(serviceLimits.isActive), desc(serviceLimits.createdAt));

      res.json({ success: true, limits });
    } catch (error) {
      console.error("Error fetching service limits:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch service limits",
      });
    }
  });

  /**
   * GET /api/service-limits/active
   * Get currently active service limits
   */
  app.get("/api/service-limits/active", async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const activeLimits = await req.tenantDb!
        .select({
          id: serviceLimits.id,
          serviceId: serviceLimits.serviceId,
          serviceName: services.name,
          dailyLimit: serviceLimits.dailyLimit,
          effectiveFrom: serviceLimits.effectiveFrom,
          effectiveTo: serviceLimits.effectiveTo,
        })
        .from(serviceLimits)
        .leftJoin(services, eq(serviceLimits.serviceId, services.id))
        .where(req.tenantDb!.withTenantFilter(serviceLimits, 
          and(
            eq(serviceLimits.isActive, true),
            or(
              sql`${serviceLimits.effectiveFrom} IS NULL`,
              sql`${serviceLimits.effectiveFrom} <= ${today}`
            ),
            or(
              sql`${serviceLimits.effectiveTo} IS NULL`,
              sql`${serviceLimits.effectiveTo} >= ${today}`
            )
          )
        ));

      res.json({ success: true, limits: activeLimits });
    } catch (error) {
      console.error("Error fetching active service limits:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch active service limits",
      });
    }
  });

  /**
   * POST /api/service-limits
   * Create a new service limit
   */
  app.post("/api/service-limits", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = createServiceLimitSchema.parse(req.body);

      // Check for overlapping date ranges for the same service
      const overlapping = await req.tenantDb!
        .select()
        .from(serviceLimits)
        .where(req.tenantDb!.withTenantFilter(serviceLimits,
          and(
            eq(serviceLimits.serviceId, validatedData.serviceId),
            eq(serviceLimits.isActive, true),
            // Check for date range overlap
            or(
              // New range starts during existing range
              and(
                validatedData.effectiveFrom
                  ? sql`${serviceLimits.effectiveFrom} <= ${validatedData.effectiveFrom}`
                  : sql`1=1`,
                validatedData.effectiveFrom
                  ? or(
                      sql`${serviceLimits.effectiveTo} >= ${validatedData.effectiveFrom}`,
                      sql`${serviceLimits.effectiveTo} IS NULL`
                    )
                  : sql`1=1`
              ),
              // New range ends during existing range
              and(
                validatedData.effectiveTo
                  ? or(
                      sql`${serviceLimits.effectiveFrom} <= ${validatedData.effectiveTo}`,
                      sql`${serviceLimits.effectiveFrom} IS NULL`
                    )
                  : sql`1=1`,
                validatedData.effectiveTo
                  ? sql`${serviceLimits.effectiveTo} >= ${validatedData.effectiveTo}`
                  : sql`1=1`
              ),
              // New range completely contains existing range
              and(
                validatedData.effectiveFrom && validatedData.effectiveTo
                  ? sql`${serviceLimits.effectiveFrom} >= ${validatedData.effectiveFrom}`
                  : sql`1=1`,
                validatedData.effectiveFrom && validatedData.effectiveTo
                  ? sql`${serviceLimits.effectiveTo} <= ${validatedData.effectiveTo}`
                  : sql`1=1`
              )
            )
          )
        ));

      if (overlapping.length > 0) {
        return res.status(400).json({
          success: false,
          error: "A limit already exists for this service with overlapping dates. Please adjust the date range or deactivate the existing limit.",
        });
      }

      const userId = (req as any).session?.userId;
      const [newLimit] = await req.tenantDb!
        .insert(serviceLimits)
        .values({
          ...validatedData,
          updatedBy: userId,
        })
        .returning();

      res.json({ success: true, limit: newLimit });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid input data",
          details: error.errors,
        });
      }
      console.error("Error creating service limit:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create service limit",
      });
    }
  });

  /**
   * PUT /api/service-limits/:id
   * Update an existing service limit
   */
  app.put("/api/service-limits/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const limitId = parseInt(req.params.id);
      const validatedData = updateServiceLimitSchema.parse(req.body);
      const userId = (req as any).session?.userId;

      // Get the existing limit to check serviceId
      const [existingLimit] = await req.tenantDb!
        .select()
        .from(serviceLimits)
        .where(req.tenantDb!.withTenantFilter(serviceLimits, eq(serviceLimits.id, limitId)));

      if (!existingLimit) {
        return res.status(404).json({
          success: false,
          error: "Service limit not found",
        });
      }

      // Check for overlapping date ranges if dates or active status are being updated
      if (validatedData.effectiveFrom !== undefined || 
          validatedData.effectiveTo !== undefined || 
          validatedData.isActive !== undefined) {
        
        const effectiveFrom = validatedData.effectiveFrom ?? existingLimit.effectiveFrom;
        const effectiveTo = validatedData.effectiveTo ?? existingLimit.effectiveTo;
        const isActive = validatedData.isActive ?? existingLimit.isActive;

        // Only check for overlaps if the limit is being set to active
        if (isActive) {
          const overlapping = await req.tenantDb!
            .select()
            .from(serviceLimits)
            .where(req.tenantDb!.withTenantFilter(serviceLimits,
              and(
                eq(serviceLimits.serviceId, existingLimit.serviceId),
                eq(serviceLimits.isActive, true),
                sql`${serviceLimits.id} != ${limitId}`, // Exclude current record
                // Check for date range overlap
                or(
                  // New range starts during existing range
                  and(
                    effectiveFrom
                      ? sql`${serviceLimits.effectiveFrom} <= ${effectiveFrom}`
                      : sql`1=1`,
                    effectiveFrom
                      ? or(
                          sql`${serviceLimits.effectiveTo} >= ${effectiveFrom}`,
                          sql`${serviceLimits.effectiveTo} IS NULL`
                        )
                      : sql`1=1`
                  ),
                  // New range ends during existing range
                  and(
                    effectiveTo
                      ? or(
                          sql`${serviceLimits.effectiveFrom} <= ${effectiveTo}`,
                          sql`${serviceLimits.effectiveFrom} IS NULL`
                        )
                      : sql`1=1`,
                    effectiveTo
                      ? sql`${serviceLimits.effectiveTo} >= ${effectiveTo}`
                      : sql`1=1`
                  ),
                  // New range completely contains existing range
                  and(
                    effectiveFrom && effectiveTo
                      ? sql`${serviceLimits.effectiveFrom} >= ${effectiveFrom}`
                      : sql`1=1`,
                    effectiveFrom && effectiveTo
                      ? sql`${serviceLimits.effectiveTo} <= ${effectiveTo}`
                      : sql`1=1`
                  )
                )
              )
            ));

          if (overlapping.length > 0) {
            return res.status(400).json({
              success: false,
              error: "This update would create overlapping limits for the same service. Please adjust the date range or deactivate the conflicting limit first.",
            });
          }
        }
      }

      const [updatedLimit] = await req.tenantDb!
        .update(serviceLimits)
        .set({
          ...validatedData,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(req.tenantDb!.withTenantFilter(serviceLimits, eq(serviceLimits.id, limitId)))
        .returning();

      res.json({ success: true, limit: updatedLimit });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid input data",
          details: error.errors,
        });
      }
      console.error("Error updating service limit:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update service limit",
      });
    }
  });

  /**
   * DELETE /api/service-limits/:id
   * Delete a service limit (soft delete by marking inactive)
   */
  app.delete("/api/service-limits/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const limitId = parseInt(req.params.id);

      const [deletedLimit] = await req.tenantDb!
        .update(serviceLimits)
        .set({ isActive: false, updatedAt: new Date() })
        .where(req.tenantDb!.withTenantFilter(serviceLimits, eq(serviceLimits.id, limitId)))
        .returning();

      if (!deletedLimit) {
        return res.status(404).json({
          success: false,
          error: "Service limit not found",
        });
      }

      res.json({ success: true, limit: deletedLimit });
    } catch (error) {
      console.error("Error deleting service limit:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete service limit",
      });
    }
  });
}
