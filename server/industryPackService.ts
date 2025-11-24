/**
 * Phase 8 - Industry Pack Application Service
 * 
 * Applies industry pack seed data to tenant databases:
 * - Updates tenant_config with pack selection
 * - Seeds services into tenant services table
 * - Seeds FAQs into tenant FAQ table
 * - Prepares website defaults (for Phase 9)
 */

import { eq, and } from 'drizzle-orm';
import type { TenantDb } from './tenantDb';
import { 
  INDUSTRY_PACK_BY_ID, 
  type IndustryPackId, 
  type IndustryServiceSeed,
  type IndustryFaqSeed 
} from '../shared/industryPacks';
import { tenantConfig, services, faqEntries } from '@shared/schema';

export interface ApplyPackOptions {
  tenantId: string;
  packId: IndustryPackId;
  overwriteExisting?: boolean; // Default false - only fill empty fields
}

export interface ApplyPackResult {
  success: boolean;
  packApplied: string;
  servicesCreated: number;
  faqsCreated: number;
  error?: string;
}

/**
 * Apply an industry pack to a tenant
 * 
 * This function:
 * 1. Updates tenant_config with industry and industryPackId
 * 2. Creates services based on pack seeds
 * 3. Creates FAQ entries based on pack seeds
 * 4. Does NOT duplicate existing data (idempotent)
 * 
 * @param db - Tenant-scoped database instance
 * @param options - Pack application options
 * @returns Result with counts of created records
 */
export async function applyIndustryPackToTenant(
  db: TenantDb,
  options: ApplyPackOptions
): Promise<ApplyPackResult> {
  const { tenantId, packId, overwriteExisting = false } = options;

  // Validate pack exists
  const pack = INDUSTRY_PACK_BY_ID[packId];
  if (!pack) {
    return {
      success: false,
      packApplied: '',
      servicesCreated: 0,
      faqsCreated: 0,
      error: `Unknown industry pack: ${packId}`,
    };
  }

  console.log(`[INDUSTRY PACK] Applying pack "${pack.name}" to tenant ${tenantId}`);

  let servicesCreated = 0;
  let faqsCreated = 0;

  try {
    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Step 1: Update tenant_config with industry and pack ID
      await tx
        .update(tenantConfig)
        .set({
          industry: pack.name,
          industryPackId: packId,
          updatedAt: new Date(),
        })
        .where(eq(tenantConfig.tenantId, tenantId));

      console.log(`[INDUSTRY PACK] Updated tenant_config for ${tenantId}`);

      // Step 2: Seed services
      if (pack.services && pack.services.length > 0) {
        for (const serviceSeed of pack.services) {
          // Check if service with same name already exists
          const existing = await tx
            .select()
            .from(services)
            .where(
              and(
                eq(services.tenantId, tenantId),
                eq(services.name, serviceSeed.name)
              )
            )
            .limit(1);

          // Only insert if doesn't exist OR overwrite is enabled
          if (existing.length === 0) {
            await tx.insert(services).values({
              tenantId,
              name: serviceSeed.name,
              priceRange: serviceSeed.priceRange || 'Contact for quote',
              overview: serviceSeed.overview || serviceSeed.description || serviceSeed.name,
              detailedDescription: serviceSeed.detailedDescription || serviceSeed.description || `Professional ${serviceSeed.name.toLowerCase()} service.`,
              duration: formatDuration(serviceSeed.defaultDurationMinutes),
              durationHours: serviceSeed.defaultDurationMinutes 
                ? String((serviceSeed.defaultDurationMinutes / 60).toFixed(1))
                : '2', // Fallback average
              minDurationHours: serviceSeed.minDurationHours 
                ? String(serviceSeed.minDurationHours)
                : String(((serviceSeed.defaultDurationMinutes || 120) / 60) * 0.75), // 75% of default
              maxDurationHours: serviceSeed.maxDurationHours
                ? String(serviceSeed.maxDurationHours)
                : String(((serviceSeed.defaultDurationMinutes || 120) / 60) * 1.25), // 125% of default
              imageUrl: null, // Tenant can upload later
            });
            servicesCreated++;
          } else if (overwriteExisting) {
            // Update existing service if overwrite enabled
            await tx
              .update(services)
              .set({
                priceRange: serviceSeed.priceRange || existing[0].priceRange,
                overview: serviceSeed.overview || existing[0].overview,
                detailedDescription: serviceSeed.detailedDescription || existing[0].detailedDescription,
                duration: formatDuration(serviceSeed.defaultDurationMinutes) || existing[0].duration,
              })
              .where(
                and(
                  eq(services.tenantId, tenantId),
                  eq(services.name, serviceSeed.name)
                )
              );
          }
        }
        console.log(`[INDUSTRY PACK] Created ${servicesCreated} services`);
      }

      // Step 3: Seed FAQs
      if (pack.faqs && pack.faqs.length > 0) {
        for (const faqSeed of pack.faqs) {
          // Check if FAQ with same question already exists
          const existing = await tx
            .select()
            .from(faqEntries)
            .where(
              and(
                eq(faqEntries.tenantId, tenantId),
                eq(faqEntries.question, faqSeed.question)
              )
            )
            .limit(1);

          // Only insert if doesn't exist
          if (existing.length === 0) {
            await tx.insert(faqEntries).values({
              tenantId,
              category: faqSeed.category,
              question: faqSeed.question,
              answer: faqSeed.answer,
              keywords: faqSeed.keywords || [],
              displayOrder: 0, // Can be reordered later
              enabled: true,
            });
            faqsCreated++;
          }
        }
        console.log(`[INDUSTRY PACK] Created ${faqsCreated} FAQs`);
      }

      // TODO Phase 9: Use pack.websiteSeed to pre-populate website templates
      // TODO Phase 10/14: Use pack.aiStyleNotes to configure AI agent tone

      // Step 4: Store website seed hints in tenant_config.industryConfig for later use
      if (pack.websiteSeed || pack.aiStyleNotes) {
        const industryConfig = {
          websiteSeed: pack.websiteSeed,
          aiStyleNotes: pack.aiStyleNotes,
          packVersion: '1.0',
          appliedAt: new Date().toISOString(),
        };

        await tx
          .update(tenantConfig)
          .set({
            industryConfig: industryConfig as any,
          })
          .where(eq(tenantConfig.tenantId, tenantId));
      }
    });

    console.log(`[INDUSTRY PACK] Successfully applied "${pack.name}" to tenant ${tenantId}`);

    return {
      success: true,
      packApplied: pack.name,
      servicesCreated,
      faqsCreated,
    };
  } catch (error: any) {
    console.error('[INDUSTRY PACK] Error applying pack:', error);
    return {
      success: false,
      packApplied: pack.name,
      servicesCreated: 0,
      faqsCreated: 0,
      error: error.message || 'Failed to apply industry pack',
    };
  }
}

/**
 * Helper to format duration in minutes to human-readable string
 */
function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '1-2 hours';
  
  const hours = minutes / 60;
  
  if (hours < 1) {
    return `${minutes} minutes`;
  } else if (hours === 1) {
    return '1 hour';
  } else if (hours % 1 === 0) {
    return `${hours} hours`;
  } else {
    return `${hours.toFixed(1)} hours`;
  }
}
