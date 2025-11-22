import { Express, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { db } from './db';
import { tenants, tenantConfig, tenantPhoneConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';
import { z } from 'zod';

/**
 * Concierge Setup Routes (Phase 5)
 * 
 * Owner-only routes for streamlined tenant onboarding with:
 * - Business information collection
 * - Industry and plan tier selection
 * - Optional stub phone config creation
 * 
 * This is an internal setup tool - no self-serve or Twilio provisioning yet.
 */

// Validation schema for onboarding request
const onboardTenantSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(255),
  contactEmail: z.string().email().optional().or(z.literal('')),
  primaryCity: z.string().max(100).optional().or(z.literal('')),
  planTier: z.enum(['starter', 'pro', 'elite'], {
    required_error: 'Plan tier is required',
  }),
  industry: z.string().max(100).optional().or(z.literal('')),
  internalNotes: z.string().optional().or(z.literal('')),
  createPhoneConfigStub: z.boolean().optional().default(false),
});

type OnboardTenantRequest = z.infer<typeof onboardTenantSchema>;

export function registerAdminConciergeSetupRoutes(app: Express) {
  /**
   * POST /api/admin/concierge/onboard-tenant
   * 
   * Create a new tenant with business configuration via concierge onboarding
   * Owner-only endpoint
   */
  app.post(
    '/api/admin/concierge/onboard-tenant',
    requireAuth,
    requireRole('owner'),
    async (req: Request, res: Response) => {
      try {
        // Validate request body
        const data = onboardTenantSchema.parse(req.body);

        // Generate tenant ID
        const tenantId = `tenant-${nanoid(10)}`;

        console.log('[CONCIERGE SETUP] Creating new tenant:', tenantId, data.businessName);

        // Check if tenant with same business name already exists
        const existingTenants = await db
          .select()
          .from(tenants)
          .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
          .where(eq(tenantConfig.businessName, data.businessName))
          .limit(1);

        if (existingTenants.length > 0) {
          return res.status(409).json({
            success: false,
            error: `A tenant with business name "${data.businessName}" already exists. Please use a different name.`,
          });
        }

        let phoneConfigId: string | null = null;

        // Create tenant + config in transaction
        await db.transaction(async (tx) => {
          // Insert tenant
          await tx.insert(tenants).values({
            id: tenantId,
            name: data.businessName,
            subdomain: null,
            isRoot: false,
          });

          // Insert tenant config with concierge setup fields
          await tx.insert(tenantConfig).values({
            tenantId,
            businessName: data.businessName,
            logoUrl: null,
            primaryColor: '#3b82f6', // Default blue
            tier: data.planTier,
            industry: data.industry || null,
            primaryContactEmail: data.contactEmail || null,
            primaryCity: data.primaryCity || null,
            internalNotes: data.internalNotes || null,
          });

          // Optionally create stub phone config
          if (data.createPhoneConfigStub) {
            phoneConfigId = nanoid();
            await tx.insert(tenantPhoneConfig).values({
              id: phoneConfigId,
              tenantId,
              phoneNumber: `+1555${nanoid(7)}`, // Placeholder, will be updated in Phone Config admin
              ivrMode: 'simple',
              messagingServiceSid: null,
              sipDomain: null,
              sipUsername: null,
              sipPasswordEncrypted: null,
            });
          }
        });

        console.log('[CONCIERGE SETUP] Successfully created tenant:', tenantId);

        // Return success response
        res.status(201).json({
          success: true,
          tenant: {
            tenantId,
            businessName: data.businessName,
            planTier: data.planTier,
            industry: data.industry || null,
            hasPhoneConfigStub: !!phoneConfigId,
          },
        });
      } catch (error: any) {
        console.error('[CONCIERGE SETUP] Error onboarding tenant:', error);
        
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: error.errors,
          });
        }

        res.status(500).json({
          success: false,
          error: error.message || 'Failed to create tenant',
        });
      }
    }
  );
}
