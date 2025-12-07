import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { sql } from 'drizzle-orm';
import { getParserImport, markImportApplied } from './parserIntegrationService';

const LOG_PREFIX = '[PARSER APPLY]';

export interface ApplyResult {
  success: boolean;
  created: { services: number; faqs: number };
  updated: { services: number; faqs: number };
  skipped: { services: number; faqs: number };
  toneApplied: boolean;
  error?: string;
}

export interface ApplyFlags {
  applyFaqs: boolean;
  applyServices: boolean;
  applyTone: boolean;
}

export async function applyParserKnowledge(
  importId: number,
  tenantId: string,
  flags: ApplyFlags
): Promise<ApplyResult> {
  const result: ApplyResult = {
    success: false,
    created: { services: 0, faqs: 0 },
    updated: { services: 0, faqs: 0 },
    skipped: { services: 0, faqs: 0 },
    toneApplied: false,
  };

  try {
    const importRecord = await getParserImport(importId, tenantId);
    if (!importRecord) {
      result.error = 'Import record not found';
      return result;
    }

    if (importRecord.status !== 'success') {
      result.error = 'Import is not in success status';
      return result;
    }

    const knowledgeJson = importRecord.knowledge_json || importRecord.knowledgeJson;
    if (!knowledgeJson) {
      result.error = 'No knowledge data in import';
      return result;
    }

    console.log(`${LOG_PREFIX} Applying knowledge for tenant ${tenantId}, import ${importId}`);

    const tenantDb = wrapTenantDb(db, tenantId);

    if (flags.applyServices) {
      const servicesResult = await applyServices(tenantDb, tenantId, knowledgeJson);
      result.created.services = servicesResult.created;
      result.updated.services = servicesResult.updated;
      result.skipped.services = servicesResult.skipped;
    }

    if (flags.applyFaqs) {
      const faqResult = await applyFaqs(tenantDb, tenantId, knowledgeJson);
      result.created.faqs = faqResult.created;
      result.updated.faqs = faqResult.updated;
      result.skipped.faqs = faqResult.skipped;
    }

    if (flags.applyTone) {
      const toneApplied = await applyToneProfile(tenantDb, tenantId, knowledgeJson);
      result.toneApplied = toneApplied;
    }

    await markImportApplied(importId, tenantId, {
      faqs: flags.applyFaqs,
      services: flags.applyServices,
      toneProfile: flags.applyTone,
    });

    result.success = true;
    console.log(`${LOG_PREFIX} Apply complete:`, result);
    return result;
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Apply error:`, error);
    result.error = error.message || 'Unknown error during apply';
    return result;
  }
}

async function applyServices(
  tenantDb: any,
  tenantId: string,
  knowledgeJson: any
): Promise<{ created: number; updated: number; skipped: number }> {
  const stats = { created: 0, updated: 0, skipped: 0 };

  const services = knowledgeJson?.onboarding?.services 
    || knowledgeJson?.ONBOARDING?.services 
    || [];

  if (!Array.isArray(services) || services.length === 0) {
    return stats;
  }

  for (const svc of services) {
    const name = svc.name?.trim();
    const category = svc.category?.trim() || 'General';
    
    if (!name) {
      stats.skipped++;
      continue;
    }

    try {
      const existingResult = await tenantDb.execute(sql`
        SELECT id FROM services
        WHERE tenant_id = ${tenantId}
          AND LOWER(name) = LOWER(${name})
        LIMIT 1
      `);

      if (existingResult.rows.length > 0) {
        const existingId = existingResult.rows[0].id;
        await tenantDb.execute(sql`
          UPDATE services
          SET category = COALESCE(${category}, category),
              description = COALESCE(${svc.description || null}, description),
              starting_price = COALESCE(${svc.price || svc.starting_price || null}, starting_price),
              duration_minutes = COALESCE(${svc.duration_minutes || svc.duration || null}, duration_minutes)
          WHERE id = ${existingId} AND tenant_id = ${tenantId}
        `);
        stats.updated++;
        continue;
      }

      await tenantDb.execute(sql`
        INSERT INTO services (tenant_id, name, category, description, starting_price, duration_minutes, is_active)
        VALUES (
          ${tenantId},
          ${name},
          ${category},
          ${svc.description || null},
          ${svc.price || svc.starting_price || null},
          ${svc.duration_minutes || svc.duration || null},
          true
        )
      `);
      stats.created++;
    } catch (error: any) {
      console.warn(`${LOG_PREFIX} Service upsert error for ${name}:`, error.message);
      stats.skipped++;
    }
  }

  return stats;
}

async function applyFaqs(
  tenantDb: any,
  tenantId: string,
  knowledgeJson: any
): Promise<{ created: number; updated: number; skipped: number }> {
  const stats = { created: 0, updated: 0, skipped: 0 };

  const faqs = knowledgeJson?.ai_training?.faqs 
    || knowledgeJson?.AI_TRAINING?.faqs 
    || [];

  if (!Array.isArray(faqs) || faqs.length === 0) {
    return stats;
  }

  for (const faq of faqs) {
    const question = faq.question?.trim() || faq.q?.trim();
    const answer = faq.answer?.trim() || faq.a?.trim();
    
    if (!question || !answer) {
      stats.skipped++;
      continue;
    }

    const normalizedQ = question.toLowerCase().replace(/[^\w\s]/g, '');

    try {
      const existingResult = await tenantDb.execute(sql`
        SELECT id FROM support_kb_articles
        WHERE tenant_id = ${tenantId}
          AND LOWER(REGEXP_REPLACE(title, '[^\w\s]', '', 'g')) = ${normalizedQ}
        LIMIT 1
      `);

      if (existingResult.rows.length > 0) {
        const existingId = existingResult.rows[0].id;
        await tenantDb.execute(sql`
          UPDATE support_kb_articles
          SET content = ${answer},
              category = COALESCE(${faq.category || null}, category)
          WHERE id = ${existingId} AND tenant_id = ${tenantId}
        `);
        stats.updated++;
        continue;
      }

      await tenantDb.execute(sql`
        INSERT INTO support_kb_articles (tenant_id, title, content, category, is_active)
        VALUES (
          ${tenantId},
          ${question},
          ${answer},
          ${faq.category || 'Imported FAQ'},
          true
        )
      `);
      stats.created++;
    } catch (error: any) {
      console.warn(`${LOG_PREFIX} FAQ upsert error:`, error.message);
      stats.skipped++;
    }
  }

  return stats;
}

async function applyToneProfile(
  tenantDb: any,
  tenantId: string,
  knowledgeJson: any
): Promise<boolean> {
  const styleProfile = knowledgeJson?.ai_training?.style_profile 
    || knowledgeJson?.AI_TRAINING?.style_profile;

  if (!styleProfile) {
    return false;
  }

  try {
    let toneDescription = '';
    
    if (styleProfile.description) {
      toneDescription = styleProfile.description;
    } else if (styleProfile.characteristics && Array.isArray(styleProfile.characteristics)) {
      toneDescription = `Communication style: ${styleProfile.characteristics.join(', ')}`;
    } else if (styleProfile.tone) {
      toneDescription = `Tone: ${styleProfile.tone}`;
    }

    if (!toneDescription) {
      return false;
    }

    const existingResult = await tenantDb.execute(sql`
      SELECT ai_persona_instructions FROM tenants WHERE id = ${tenantId}
    `);

    const existingInstructions = existingResult.rows[0]?.ai_persona_instructions || '';
    const separator = existingInstructions ? '\n\n--- Imported Tone Profile ---\n' : '';
    const newInstructions = `${existingInstructions}${separator}${toneDescription}`;

    await tenantDb.execute(sql`
      UPDATE tenants
      SET ai_persona_instructions = ${newInstructions}
      WHERE id = ${tenantId}
    `);

    return true;
  } catch (error: any) {
    console.warn(`${LOG_PREFIX} Tone profile apply error:`, error.message);
    return false;
  }
}
