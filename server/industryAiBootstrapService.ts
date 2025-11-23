import { db } from './db';
import { aiBehaviorRules, smsTemplates, faqEntries } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { wrapTenantDb } from './tenantDb';

/**
 * Bootstrap industry-specific AI behavior rules, SMS templates, and FAQ entries for a tenant.
 * This is idempotent - safe to run multiple times without creating duplicates.
 * 
 * @param tenantId - The tenant ID to bootstrap
 * @param industryId - The industry pack ID (e.g., 'auto_detailing_mobile')
 * @param bootstrapData - The bootstrap data containing AI rules, SMS templates, and FAQ entries
 */
export async function bootstrapIndustryAiAndMessaging(
  tenantId: string,
  industryId: string,
  bootstrapData: {
    aiRules: Array<{
      ruleKey: string;
      category: string;
      name: string;
      description?: string;
      content: string;
      priority?: number;
      enabled?: boolean;
    }>;
    smsTemplates: Array<{
      templateKey: string;
      category: string;
      name: string;
      description?: string;
      body: string;
      variables: Array<{
        name: string;
        description: string;
        sample: string;
        required: boolean;
      }>;
      defaultPayload?: Record<string, any>;
      enabled?: boolean;
    }>;
    faqEntries: Array<{
      category: string;
      question: string;
      answer: string;
      keywords?: string[];
      displayOrder?: number;
      enabled?: boolean;
    }>;
  }
) {
  try {
    console.log(`[INDUSTRY AI BOOTSTRAP] Starting bootstrap for tenant ${tenantId} with industry ${industryId}...`);

    const tenantDb = wrapTenantDb(db, tenantId);

    let rulesCreated = 0;
    let rulesUpdated = 0;
    let templatesCreated = 0;
    let templatesUpdated = 0;
    let faqCreated = 0;
    let faqUpdated = 0;

    // =======================================
    // 1. Bootstrap AI Behavior Rules
    // =======================================
    console.log(`[INDUSTRY AI BOOTSTRAP] Bootstrapping ${bootstrapData.aiRules.length} AI behavior rules...`);
    
    for (const rule of bootstrapData.aiRules) {
      // Check if rule already exists (must filter by both tenantId AND ruleKey)
      const [existing] = await tenantDb
        .select()
        .from(aiBehaviorRules)
        .where(
          and(
            eq(aiBehaviorRules.tenantId, tenantId),
            eq(aiBehaviorRules.ruleKey, rule.ruleKey)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing rule (preserves enabled status if user toggled it)
        await tenantDb
          .update(aiBehaviorRules)
          .set({
            category: rule.category,
            name: rule.name,
            description: rule.description,
            content: rule.content,
            priority: rule.priority ?? 100,
            updatedAt: new Date(),
          })
          .where(eq(aiBehaviorRules.id, existing.id));
        rulesUpdated++;
      } else {
        // Insert new rule
        await tenantDb.insert(aiBehaviorRules).values({
          tenantId,
          ruleKey: rule.ruleKey,
          category: rule.category,
          name: rule.name,
          description: rule.description,
          content: rule.content,
          priority: rule.priority ?? 100,
          enabled: rule.enabled ?? true,
        });
        rulesCreated++;
      }
    }

    console.log(`[INDUSTRY AI BOOTSTRAP] AI behavior rules: ${rulesCreated} created, ${rulesUpdated} updated`);

    // =======================================
    // 2. Bootstrap SMS Templates
    // =======================================
    console.log(`[INDUSTRY AI BOOTSTRAP] Bootstrapping ${bootstrapData.smsTemplates.length} SMS templates...`);

    for (const template of bootstrapData.smsTemplates) {
      // Check if template already exists
      const [existing] = await tenantDb
        .select()
        .from(smsTemplates)
        .where(
          and(
            eq(smsTemplates.templateKey, template.templateKey),
            eq(smsTemplates.language, 'en')
          )
        )
        .limit(1);

      if (existing) {
        // Only update if version is still 1 (hasn't been customized)
        if (existing.version === 1) {
          await tenantDb
            .update(smsTemplates)
            .set({
              category: template.category,
              name: template.name,
              description: template.description,
              body: template.body,
              variables: template.variables,
              defaultPayload: template.defaultPayload,
              updatedAt: new Date(),
            })
            .where(eq(smsTemplates.id, existing.id));
          templatesUpdated++;
        }
      } else {
        // Insert new template
        await tenantDb.insert(smsTemplates).values({
          tenantId,
          templateKey: template.templateKey,
          category: template.category,
          channel: 'sms',
          language: 'en',
          name: template.name,
          description: template.description,
          body: template.body,
          variables: template.variables,
          defaultPayload: template.defaultPayload,
          enabled: template.enabled ?? true,
          version: 1,
        });
        templatesCreated++;
      }
    }

    console.log(`[INDUSTRY AI BOOTSTRAP] SMS templates: ${templatesCreated} created, ${templatesUpdated} updated`);

    // =======================================
    // 3. Bootstrap FAQ Entries
    // =======================================
    console.log(`[INDUSTRY AI BOOTSTRAP] Bootstrapping ${bootstrapData.faqEntries.length} FAQ entries...`);

    for (const faq of bootstrapData.faqEntries) {
      // Check if FAQ already exists (must filter by tenantId, category, AND question)
      const [existing] = await tenantDb
        .select()
        .from(faqEntries)
        .where(
          and(
            eq(faqEntries.tenantId, tenantId),
            eq(faqEntries.category, faq.category),
            eq(faqEntries.question, faq.question)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing FAQ
        await tenantDb
          .update(faqEntries)
          .set({
            answer: faq.answer,
            keywords: faq.keywords,
            displayOrder: faq.displayOrder ?? 0,
            updatedAt: new Date(),
          })
          .where(eq(faqEntries.id, existing.id));
        faqUpdated++;
      } else {
        // Insert new FAQ
        await tenantDb.insert(faqEntries).values({
          tenantId,
          category: faq.category,
          question: faq.question,
          answer: faq.answer,
          keywords: faq.keywords,
          displayOrder: faq.displayOrder ?? 0,
          enabled: faq.enabled ?? true,
        });
        faqCreated++;
      }
    }

    console.log(`[INDUSTRY AI BOOTSTRAP] FAQ entries: ${faqCreated} created, ${faqUpdated} updated`);

    const result = {
      success: true,
      summary: {
        aiRules: { created: rulesCreated, updated: rulesUpdated },
        smsTemplates: { created: templatesCreated, updated: templatesUpdated },
        faqEntries: { created: faqCreated, updated: faqUpdated },
      },
    };

    console.log('[INDUSTRY AI BOOTSTRAP] Bootstrap complete:', JSON.stringify(result.summary));
    return result;

  } catch (error) {
    console.error('[INDUSTRY AI BOOTSTRAP] Error during bootstrap:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
