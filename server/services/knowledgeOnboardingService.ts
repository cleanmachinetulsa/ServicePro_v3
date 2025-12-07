import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const LOG_PREFIX = '[KNOWLEDGE ONBOARDING]';

const KnowledgeJsonSchema = z.object({
  meta: z.object({
    parser_version: z.string().optional(),
    spec_version: z.string().optional(),
    source: z.string().optional(),
  }).optional(),
  business_profile_guess: z.object({
    business_name: z.string().optional(),
    short_description: z.string().optional(),
    tagline: z.string().optional(),
    industry: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional().nullable(),
    typical_service_radius_miles: z.number().optional().nullable(),
    operating_hours: z.record(z.any()).optional(),
  }).optional(),
  onboarding: z.object({
    services: z.array(z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      price: z.union([z.string(), z.number()]).optional(),
      price_hint: z.string().optional(),
      starting_price: z.union([z.string(), z.number()]).optional(),
      duration_minutes: z.number().optional(),
      duration_hint_minutes: z.number().optional(),
      tags: z.array(z.string()).optional(),
    })).optional(),
  }).optional(),
  ONBOARDING: z.object({
    services: z.array(z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      price: z.union([z.string(), z.number()]).optional(),
      price_hint: z.string().optional(),
      starting_price: z.union([z.string(), z.number()]).optional(),
      duration_minutes: z.number().optional(),
      duration_hint_minutes: z.number().optional(),
      tags: z.array(z.string()).optional(),
    })).optional(),
  }).optional(),
  ai_training: z.object({
    faqs: z.array(z.object({
      question: z.string().optional(),
      q: z.string().optional(),
      answer: z.string().optional(),
      a: z.string().optional(),
      category: z.string().optional(),
      confidence: z.number().optional(),
    })).optional(),
    style_profile: z.object({
      tone_words: z.array(z.string()).optional(),
      typical_greetings: z.array(z.string()).optional(),
      typical_signoffs: z.array(z.string()).optional(),
      formality: z.string().optional(),
      emojis_allowed: z.boolean().optional(),
      example_responses: z.array(z.string()).optional(),
      description: z.string().optional(),
    }).optional(),
  }).optional(),
  AI_TRAINING: z.object({
    faqs: z.array(z.object({
      question: z.string().optional(),
      q: z.string().optional(),
      answer: z.string().optional(),
      a: z.string().optional(),
      category: z.string().optional(),
      confidence: z.number().optional(),
    })).optional(),
    style_profile: z.object({
      tone_words: z.array(z.string()).optional(),
      typical_greetings: z.array(z.string()).optional(),
      typical_signoffs: z.array(z.string()).optional(),
      formality: z.string().optional(),
      emojis_allowed: z.boolean().optional(),
      example_responses: z.array(z.string()).optional(),
      description: z.string().optional(),
    }).optional(),
  }).optional(),
  style_profile: z.object({
    tone_words: z.array(z.string()).optional(),
    typical_greetings: z.array(z.string()).optional(),
    typical_signoffs: z.array(z.string()).optional(),
    formality: z.string().optional(),
    emojis_allowed: z.boolean().optional(),
  }).optional(),
}).passthrough();

export type KnowledgeJson = z.infer<typeof KnowledgeJsonSchema>;

export interface PersonaResult {
  title: string;
  systemPrompt: string;
  toneWords: string[];
  formality: string;
  emojisAllowed: boolean;
  sampleGreeting?: string;
  sampleSignoff?: string;
}

export interface OnboardingApplyResult {
  persona: PersonaResult;
  personaApplied: {
    agentPreferencesUpdated: boolean;
    behaviorRulesUpdated: boolean;
  };
  services: {
    created: number;
    updated: number;
    skipped: number;
  };
  faqs: {
    created: number;
    updated: number;
    skipped: number;
  };
  tenantProfile: {
    appliedBusinessName?: string;
    appliedTagline?: string;
    appliedIndustry?: string;
    notes: string[];
  };
  warnings: string[];
}

function getServices(parsed: KnowledgeJson): any[] {
  return parsed?.onboarding?.services || parsed?.ONBOARDING?.services || [];
}

function getFaqs(parsed: KnowledgeJson): any[] {
  return parsed?.ai_training?.faqs || parsed?.AI_TRAINING?.faqs || [];
}

function getStyleProfile(parsed: KnowledgeJson): any {
  return parsed?.ai_training?.style_profile 
    || parsed?.AI_TRAINING?.style_profile 
    || parsed?.style_profile 
    || {};
}

function getBusinessProfile(parsed: KnowledgeJson): any {
  return parsed?.business_profile_guess || {};
}

function buildPersonaFromStyleProfile(parsed: KnowledgeJson): PersonaResult {
  const style = getStyleProfile(parsed);
  const business = getBusinessProfile(parsed);
  
  const toneWords = style.tone_words ?? ['friendly', 'professional'];
  const formality = style.formality ?? 'neutral';
  const emojisAllowed = style.emojis_allowed ?? true;
  
  const businessName = business.business_name || 'this business';
  
  const systemPromptParts = [
    `You are the AI assistant for ${businessName}.`,
    "Match the owner's tone and style when replying to customers.",
    `Tone keywords: ${toneWords.join(', ')}.`,
    `Formality level: ${formality}.`,
    emojisAllowed 
      ? 'Emojis are allowed when appropriate.' 
      : 'Avoid emojis unless the customer uses them first.',
    'Always be clear, concise, and helpful.',
    'Focus on providing excellent customer service.',
  ];

  const sampleGreeting = style.typical_greetings?.[0];
  const sampleSignoff = style.typical_signoffs?.[0];

  if (sampleGreeting) {
    systemPromptParts.push(`Example greeting style: "${sampleGreeting}"`);
  }
  if (sampleSignoff) {
    systemPromptParts.push(`Example signoff style: "${sampleSignoff}"`);
  }

  return {
    title: 'Owner-Tuned AI Assistant',
    systemPrompt: systemPromptParts.join(' '),
    toneWords,
    formality,
    emojisAllowed,
    sampleGreeting,
    sampleSignoff,
  };
}

async function applyServicesToTenant(
  tenantDb: any,
  tenantId: string,
  parsed: KnowledgeJson
): Promise<{ created: number; updated: number; skipped: number }> {
  const stats = { created: 0, updated: 0, skipped: 0 };
  const services = getServices(parsed);

  if (!Array.isArray(services) || services.length === 0) {
    return stats;
  }

  for (const svc of services) {
    const name = svc.name?.trim();
    if (!name) {
      stats.skipped++;
      continue;
    }

    const category = svc.category?.trim() || 'General';
    const description = svc.description?.trim() || '';
    const priceHint = svc.price || svc.price_hint || svc.starting_price;
    const priceRange = typeof priceHint === 'number' ? `$${priceHint}+` : (priceHint?.toString() || 'Contact for pricing');
    const durationMinutes = svc.duration_minutes || svc.duration_hint_minutes;
    const durationHours = durationMinutes ? (durationMinutes / 60).toFixed(1) : '1.5';
    const durationText = durationMinutes ? `${durationMinutes} minutes` : '1-2 hours';

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
          SET overview = COALESCE(NULLIF(${description}, ''), overview),
              detailed_description = COALESCE(NULLIF(${description}, ''), detailed_description),
              price_range = COALESCE(${priceRange}, price_range)
          WHERE id = ${existingId} AND tenant_id = ${tenantId}
        `);
        stats.updated++;
      } else {
        await tenantDb.execute(sql`
          INSERT INTO services (tenant_id, name, price_range, overview, detailed_description, duration, duration_hours, min_duration_hours, max_duration_hours)
          VALUES (
            ${tenantId},
            ${name},
            ${priceRange},
            ${description || name},
            ${description || `${name} service`},
            ${durationText},
            ${durationHours},
            ${durationHours},
            ${(parseFloat(durationHours) + 0.5).toFixed(1)}
          )
        `);
        stats.created++;
      }
    } catch (error: any) {
      console.warn(`${LOG_PREFIX} Service upsert error for ${name}:`, error.message);
      stats.skipped++;
    }
  }

  return stats;
}

async function applyFaqsToTenant(
  tenantDb: any,
  tenantId: string,
  parsed: KnowledgeJson
): Promise<{ created: number; updated: number; skipped: number }> {
  const stats = { created: 0, updated: 0, skipped: 0 };
  const faqs = getFaqs(parsed);

  if (!Array.isArray(faqs) || faqs.length === 0) {
    return stats;
  }

  for (const faq of faqs) {
    const question = faq.question?.trim() || faq.q?.trim();
    const answer = faq.answer?.trim() || faq.a?.trim();
    const confidence = faq.confidence ?? 1.0;
    
    if (!question || !answer) {
      stats.skipped++;
      continue;
    }

    if (confidence < 0.5) {
      stats.skipped++;
      continue;
    }

    const category = faq.category?.trim() || 'general';
    const normalizedQ = question.toLowerCase().replace(/[^\w\s]/g, '');

    try {
      const existingResult = await tenantDb.execute(sql`
        SELECT id FROM faq_entries
        WHERE tenant_id = ${tenantId}
          AND LOWER(REGEXP_REPLACE(question, '[^\w\s]', '', 'g')) = ${normalizedQ}
        LIMIT 1
      `);

      if (existingResult.rows.length > 0) {
        const existingId = existingResult.rows[0].id;
        await tenantDb.execute(sql`
          UPDATE faq_entries
          SET answer = ${answer},
              category = COALESCE(${category}, category),
              updated_at = NOW()
          WHERE id = ${existingId} AND tenant_id = ${tenantId}
        `);
        stats.updated++;
      } else {
        await tenantDb.execute(sql`
          INSERT INTO faq_entries (tenant_id, category, question, answer, display_order, enabled)
          VALUES (
            ${tenantId},
            ${category},
            ${question},
            ${answer},
            ${0},
            true
          )
        `);
        stats.created++;
      }
    } catch (error: any) {
      console.warn(`${LOG_PREFIX} FAQ upsert error:`, error.message);
      stats.skipped++;
    }
  }

  return stats;
}

async function applyPersonaToAiConfig(
  tenantDb: any,
  tenantId: string,
  persona: PersonaResult
): Promise<{ agentPreferencesUpdated: boolean; behaviorRulesUpdated: boolean }> {
  const result = { agentPreferencesUpdated: false, behaviorRulesUpdated: false };
  
  const formalityMap: Record<string, number> = {
    'casual': 2,
    'neutral': 3,
    'formal': 4,
    'very_formal': 5,
    'very_casual': 1,
  };

  const formalityLevel = formalityMap[persona.formality.toLowerCase()] ?? 3;

  try {
    const existingResult = await tenantDb.execute(sql`
      SELECT id FROM agent_preferences LIMIT 1
    `);

    if (existingResult.rows.length > 0) {
      await tenantDb.execute(sql`
        UPDATE agent_preferences
        SET formality = ${formalityLevel},
            use_emojis = ${persona.emojisAllowed},
            sms_opening_message = COALESCE(${persona.sampleGreeting || null}, sms_opening_message),
            updated_at = NOW()
        WHERE id = ${existingResult.rows[0].id}
      `);
      result.agentPreferencesUpdated = true;
      console.log(`${LOG_PREFIX} Updated agent_preferences: formality=${formalityLevel}, emojis=${persona.emojisAllowed}`);
    } else {
      await tenantDb.execute(sql`
        INSERT INTO agent_preferences (formality, use_emojis, sms_opening_message)
        VALUES (${formalityLevel}, ${persona.emojisAllowed}, ${persona.sampleGreeting || 'Hi! Thanks for reaching out. How can I help you today?'})
      `);
      result.agentPreferencesUpdated = true;
      console.log(`${LOG_PREFIX} Inserted new agent_preferences row`);
    }
  } catch (error: any) {
    console.warn(`${LOG_PREFIX} Agent preferences update error:`, error.message);
  }

  try {
    const systemPromptCheck = await tenantDb.execute(sql`
      SELECT id FROM ai_behavior_rules
      WHERE tenant_id = ${tenantId} AND rule_key = 'parser_generated_style'
      LIMIT 1
    `);

    if (systemPromptCheck.rows.length > 0) {
      await tenantDb.execute(sql`
        UPDATE ai_behavior_rules
        SET content = ${persona.systemPrompt},
            updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND rule_key = 'parser_generated_style'
      `);
      result.behaviorRulesUpdated = true;
      console.log(`${LOG_PREFIX} Updated ai_behavior_rules for tenant ${tenantId}`);
    } else {
      await tenantDb.execute(sql`
        INSERT INTO ai_behavior_rules (tenant_id, rule_key, category, name, description, content, priority, enabled)
        VALUES (
          ${tenantId},
          'parser_generated_style',
          'personality',
          'Parser-Generated Style Guide',
          'AI behavior rules generated from SMS history analysis',
          ${persona.systemPrompt},
          50,
          true
        )
      `);
      result.behaviorRulesUpdated = true;
      console.log(`${LOG_PREFIX} Inserted ai_behavior_rules for tenant ${tenantId}`);
    }
  } catch (error: any) {
    console.warn(`${LOG_PREFIX} AI behavior rules update error:`, error.message);
  }
  
  return result;
}

async function applyTenantProfileHints(
  tenantDb: any,
  tenantId: string,
  parsed: KnowledgeJson
): Promise<{ appliedBusinessName?: string; appliedTagline?: string; appliedIndustry?: string; notes: string[] }> {
  const result: { appliedBusinessName?: string; appliedTagline?: string; appliedIndustry?: string; notes: string[] } = {
    notes: [],
  };

  const business = getBusinessProfile(parsed);
  
  if (business.business_name) {
    result.appliedBusinessName = business.business_name;
    result.notes.push(`Detected business name: ${business.business_name}`);
  }
  
  if (business.short_description || business.tagline) {
    result.appliedTagline = business.short_description || business.tagline;
    result.notes.push(`Detected tagline: ${result.appliedTagline}`);
  }
  
  if (business.industry) {
    result.appliedIndustry = business.industry;
    result.notes.push(`Detected industry: ${business.industry}`);
  }

  if (business.typical_service_radius_miles) {
    result.notes.push(`Detected service radius: ${business.typical_service_radius_miles} miles`);
  }

  return result;
}

export async function applyKnowledgeToTenant(
  knowledgeImportId: number,
  tenantId: string,
  options: {
    applyServices?: boolean;
    applyFaqs?: boolean;
    applyPersona?: boolean;
    applyProfile?: boolean;
  } = {}
): Promise<OnboardingApplyResult> {
  const {
    applyServices = true,
    applyFaqs = true,
    applyPersona = true,
    applyProfile = true,
  } = options;

  const tenantDb = wrapTenantDb(db, tenantId);

  const importResult = await tenantDb.execute(sql`
    SELECT * FROM phone_history_imports
    WHERE id = ${knowledgeImportId} AND tenant_id = ${tenantId}
  `);

  if (!importResult.rows || importResult.rows.length === 0) {
    throw new Error('Knowledge import not found for this tenant');
  }

  const importRow = importResult.rows[0] as any;
  const rawKnowledge = importRow.knowledge_json;

  if (!rawKnowledge) {
    throw new Error('Import record has no knowledge JSON stored');
  }

  let parsed: KnowledgeJson;
  try {
    parsed = KnowledgeJsonSchema.parse(rawKnowledge);
  } catch (err) {
    console.error(`${LOG_PREFIX} Knowledge JSON parse error:`, err);
    throw new Error('Stored knowledge JSON is invalid or not in the expected format');
  }

  const warnings: string[] = [];
  const parserVersion = parsed.meta?.parser_version;
  if (parserVersion && parserVersion !== 'v2-onboarding') {
    warnings.push(`Knowledge JSON has parser_version "${parserVersion}", expected "v2-onboarding". Continuing with best-effort mapping.`);
  }

  console.log(`${LOG_PREFIX} Building setup from knowledge import ${knowledgeImportId} for tenant ${tenantId}`);

  const persona = buildPersonaFromStyleProfile(parsed);

  let servicesResult = { created: 0, updated: 0, skipped: 0 };
  if (applyServices) {
    servicesResult = await applyServicesToTenant(tenantDb, tenantId, parsed);
    console.log(`${LOG_PREFIX} Services: ${servicesResult.created} created, ${servicesResult.updated} updated, ${servicesResult.skipped} skipped`);
  }

  let faqsResult = { created: 0, updated: 0, skipped: 0 };
  if (applyFaqs) {
    faqsResult = await applyFaqsToTenant(tenantDb, tenantId, parsed);
    console.log(`${LOG_PREFIX} FAQs: ${faqsResult.created} created, ${faqsResult.updated} updated, ${faqsResult.skipped} skipped`);
  }

  let personaApplied = { agentPreferencesUpdated: false, behaviorRulesUpdated: false };
  if (applyPersona) {
    personaApplied = await applyPersonaToAiConfig(tenantDb, tenantId, persona);
    console.log(`${LOG_PREFIX} AI persona applied: prefs=${personaApplied.agentPreferencesUpdated}, rules=${personaApplied.behaviorRulesUpdated}`);
  }

  let tenantProfile = { notes: [] as string[] };
  if (applyProfile) {
    tenantProfile = await applyTenantProfileHints(tenantDb, tenantId, parsed);
  }

  await tenantDb.execute(sql`
    UPDATE phone_history_imports
    SET applied_at = NOW(),
        applied_flags = ${JSON.stringify({
          services: applyServices,
          faqs: applyFaqs,
          persona: applyPersona,
          profile: applyProfile,
        })}::jsonb
    WHERE id = ${knowledgeImportId} AND tenant_id = ${tenantId}
  `);

  return {
    persona,
    personaApplied,
    services: servicesResult,
    faqs: faqsResult,
    tenantProfile,
    warnings,
  };
}

export async function getKnowledgePreview(
  knowledgeImportId: number,
  tenantId: string
): Promise<{
  servicesCount: number;
  faqsCount: number;
  hasStyleProfile: boolean;
  hasBusinessProfile: boolean;
  businessName?: string;
  toneWords?: string[];
}> {
  const tenantDb = wrapTenantDb(db, tenantId);

  const importResult = await tenantDb.execute(sql`
    SELECT knowledge_json FROM phone_history_imports
    WHERE id = ${knowledgeImportId} AND tenant_id = ${tenantId}
  `);

  if (!importResult.rows || importResult.rows.length === 0) {
    throw new Error('Knowledge import not found');
  }

  const rawKnowledge = (importResult.rows[0] as any).knowledge_json;
  if (!rawKnowledge) {
    return {
      servicesCount: 0,
      faqsCount: 0,
      hasStyleProfile: false,
      hasBusinessProfile: false,
    };
  }

  const parsed = KnowledgeJsonSchema.parse(rawKnowledge);
  
  const services = getServices(parsed);
  const faqs = getFaqs(parsed);
  const styleProfile = getStyleProfile(parsed);
  const businessProfile = getBusinessProfile(parsed);

  return {
    servicesCount: Array.isArray(services) ? services.length : 0,
    faqsCount: Array.isArray(faqs) ? faqs.length : 0,
    hasStyleProfile: Object.keys(styleProfile).length > 0,
    hasBusinessProfile: Object.keys(businessProfile).length > 0,
    businessName: businessProfile.business_name,
    toneWords: styleProfile.tone_words,
  };
}
