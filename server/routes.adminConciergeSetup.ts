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

// Validation schema for onboarding request (Phase 5 - Full Spec)
const onboardTenantSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(255),
  slug: z.string().max(100).optional().or(z.literal('')),
  contactName: z.string().max(255).optional().or(z.literal('')),
  contactEmail: z.string().email().optional().or(z.literal('')),
  primaryCity: z.string().max(100).optional().or(z.literal('')),
  planTier: z.enum(['starter', 'pro', 'elite', 'internal'], {
    required_error: 'Plan tier is required',
  }),
  status: z.enum(['trialing', 'active', 'past_due', 'suspended', 'cancelled'], {
    required_error: 'Status is required',
  }),
  industry: z.string().max(100).optional().or(z.literal('')),
  phoneNumber: z.string().min(1, 'Phone number is required').max(50),
  messagingServiceSid: z.string().max(255).optional().or(z.literal('')).nullable(),
  ivrMode: z.enum(['simple', 'ivr', 'ai-voice'], {
    required_error: 'IVR mode is required',
  }),
  websiteUrl: z.string().max(500).optional().or(z.literal('')).nullable(),
  primaryColor: z.string().max(20).optional().or(z.literal('')).nullable(),
  accentColor: z.string().max(20).optional().or(z.literal('')).nullable(),
  internalNotes: z.string().optional().or(z.literal('')),
  sendWelcomeEmail: z.boolean().optional().default(false),
  sendWelcomeSms: z.boolean().optional().default(false),
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

        // Auto-generate slug if not provided
        const finalSlug = data.slug || 
          data.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50);

        // Normalize phone number to E.164 format if needed
        let normalizedPhone = data.phoneNumber.trim();
        if (!normalizedPhone.startsWith('+')) {
          // If it's a 10-digit US number, add +1
          if (/^\d{10}$/.test(normalizedPhone)) {
            normalizedPhone = `+1${normalizedPhone}`;
          }
        }

        // Create tenant + config + phone in transaction
        await db.transaction(async (tx) => {
          // Insert tenant with plan tier and status
          await tx.insert(tenants).values({
            id: tenantId,
            name: data.businessName,
            subdomain: finalSlug,
            isRoot: false,
            planTier: data.planTier,
            status: data.status,
          });

          // Insert tenant config with all concierge setup fields
          await tx.insert(tenantConfig).values({
            tenantId,
            businessName: data.businessName,
            logoUrl: null,
            primaryColor: data.primaryColor || '#3b82f6', // Default blue
            accentColor: data.accentColor || null,
            tier: data.planTier, // Keep in sync with tenants.planTier
            industry: data.industry || null,
            primaryContactName: data.contactName || null,
            primaryContactEmail: data.contactEmail || null,
            primaryCity: data.primaryCity || null,
            websiteUrl: data.websiteUrl || null,
            internalNotes: data.internalNotes || null,
          });

          // Create phone config with actual phone number and IVR mode
          phoneConfigId = nanoid();
          await tx.insert(tenantPhoneConfig).values({
            id: phoneConfigId,
            tenantId,
            phoneNumber: normalizedPhone,
            ivrMode: data.ivrMode,
            messagingServiceSid: data.messagingServiceSid || null,
            sipDomain: null, // Can be configured later
            sipUsername: null,
            sipPasswordEncrypted: null,
          });
        });

        console.log('[CONCIERGE SETUP] Successfully created tenant:', tenantId);

        // TODO: Phase 5 - Welcome messaging
        // if (data.sendWelcomeEmail && data.contactEmail) {
        //   await sendWelcomeEmail(data.contactEmail, data.businessName);
        // }
        // if (data.sendWelcomeSms && data.contactName) {
        //   await sendWelcomeSms(normalizedPhone, data.contactName, data.businessName);
        // }

        // Return success response with full tenant details
        res.status(201).json({
          success: true,
          tenant: {
            tenantId,
            businessName: data.businessName,
            slug: finalSlug,
            planTier: data.planTier,
            status: data.status,
            industry: data.industry || null,
            phoneNumber: normalizedPhone,
            ivrMode: data.ivrMode,
            hasPhoneConfig: !!phoneConfigId,
            websiteUrl: data.websiteUrl || null,
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
