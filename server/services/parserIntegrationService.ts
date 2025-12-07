import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { sql } from 'drizzle-orm';
import { phoneHistoryImports } from '@shared/schema';

const LOG_PREFIX = '[PARSER INTEGRATION]';

export interface ParserConfig {
  businessName?: string;
  businessPhone?: string;
  threadGapMinutes?: number;
  includeFaqs?: boolean;
  includeToneProfile?: boolean;
  includeServices?: boolean;
  includeAnalytics?: boolean;
}

export interface ParserAnalytics {
  calls?: { total?: number; missed?: number; received?: number };
  conversations?: { total?: number; avgLength?: number; threads?: number };
}

export interface ParserPreview {
  servicesCount: number;
  faqCount: number;
  styleSnippets: string[];
}

export interface ParserResult {
  success: boolean;
  knowledgeJson?: any;
  analytics?: ParserAnalytics;
  preview?: ParserPreview;
  error?: string;
}

function getParserApiUrl(): string | null {
  return process.env.PARSER_API_URL || null;
}

export async function runParserIntegration(
  files: Express.Multer.File[],
  config: ParserConfig,
  tenantId: string
): Promise<ParserResult> {
  const parserUrl = getParserApiUrl();
  
  if (!parserUrl) {
    console.warn(`${LOG_PREFIX} Parser API URL not configured`);
    return { success: false, error: 'Parser API not configured. Set PARSER_API_URL environment variable.' };
  }

  if (!files || files.length === 0) {
    return { success: false, error: 'No files provided for parsing' };
  }

  console.log(`${LOG_PREFIX} Starting parser integration for tenant ${tenantId} with ${files.length} file(s)`);

  try {
    const formData = new FormData();
    
    for (const file of files) {
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('files', blob, file.originalname);
    }
    
    formData.append('config', JSON.stringify(config));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(parserUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${LOG_PREFIX} Parser API error: ${response.status} - ${errorText}`);
      return { 
        success: false, 
        error: `Parser API returned ${response.status}: ${errorText.substring(0, 200)}` 
      };
    }

    const data = await response.json();
    console.log(`${LOG_PREFIX} Parser returned data successfully`);

    const analytics: ParserAnalytics = extractAnalytics(data);
    const preview: ParserPreview = extractPreview(data);

    return {
      success: true,
      knowledgeJson: data,
      analytics,
      preview,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`${LOG_PREFIX} Parser API timeout`);
      return { success: false, error: 'Parser API request timed out (120s limit)' };
    }
    
    console.error(`${LOG_PREFIX} Parser integration error:`, error);
    return { success: false, error: error.message || 'Unknown parser error' };
  }
}

function extractAnalytics(data: any): ParserAnalytics {
  const analytics: ParserAnalytics = {};

  if (data?.analytics?.calls) {
    analytics.calls = data.analytics.calls;
  } else if (data?.call_analytics) {
    analytics.calls = {
      total: data.call_analytics.total_calls,
      missed: data.call_analytics.missed_calls,
      received: data.call_analytics.received_calls,
    };
  }

  if (data?.analytics?.conversations) {
    analytics.conversations = data.analytics.conversations;
  } else if (data?.conversation_analytics) {
    analytics.conversations = {
      total: data.conversation_analytics.total_threads,
      avgLength: data.conversation_analytics.avg_thread_length,
      threads: data.conversation_analytics.threads,
    };
  }

  return analytics;
}

function extractPreview(data: any): ParserPreview {
  const preview: ParserPreview = {
    servicesCount: 0,
    faqCount: 0,
    styleSnippets: [],
  };

  const services = data?.onboarding?.services || data?.ONBOARDING?.services || [];
  preview.servicesCount = Array.isArray(services) ? services.length : 0;

  const faqs = data?.ai_training?.faqs || data?.AI_TRAINING?.faqs || [];
  preview.faqCount = Array.isArray(faqs) ? faqs.length : 0;

  const styleProfile = data?.ai_training?.style_profile || data?.AI_TRAINING?.style_profile;
  if (styleProfile) {
    if (styleProfile.example_responses && Array.isArray(styleProfile.example_responses)) {
      preview.styleSnippets = styleProfile.example_responses.slice(0, 3);
    } else if (styleProfile.tone_snippets && Array.isArray(styleProfile.tone_snippets)) {
      preview.styleSnippets = styleProfile.tone_snippets.slice(0, 3);
    } else if (typeof styleProfile.description === 'string') {
      preview.styleSnippets = [styleProfile.description.substring(0, 150)];
    }
  }

  return preview;
}

export async function createParserImportRecord(
  tenantId: string,
  fileName: string,
  config: ParserConfig
): Promise<number> {
  const tenantDb = wrapTenantDb(db, tenantId);

  const result = await tenantDb.execute(sql`
    INSERT INTO phone_history_imports (tenant_id, file_name, source, status, parser_config)
    VALUES (${tenantId}, ${fileName}, 'parser_tool', 'pending', ${JSON.stringify(config)}::jsonb)
    RETURNING id
  `);

  return (result.rows[0] as any).id;
}

export async function updateParserImportWithResult(
  importId: number,
  tenantId: string,
  result: ParserResult
): Promise<void> {
  const tenantDb = wrapTenantDb(db, tenantId);

  if (result.success) {
    await tenantDb.execute(sql`
      UPDATE phone_history_imports
      SET status = 'success',
          knowledge_json = ${JSON.stringify(result.knowledgeJson)}::jsonb,
          analytics_json = ${JSON.stringify(result.analytics || {})}::jsonb,
          completed_at = NOW()
      WHERE id = ${importId} AND tenant_id = ${tenantId}
    `);
  } else {
    await tenantDb.execute(sql`
      UPDATE phone_history_imports
      SET status = 'failed',
          error_text = ${result.error || 'Unknown error'},
          completed_at = NOW()
      WHERE id = ${importId} AND tenant_id = ${tenantId}
    `);
  }
}

export async function getParserImport(
  importId: number,
  tenantId: string
): Promise<any | null> {
  const tenantDb = wrapTenantDb(db, tenantId);

  const result = await tenantDb.execute(sql`
    SELECT * FROM phone_history_imports
    WHERE id = ${importId} AND tenant_id = ${tenantId}
  `);

  return result.rows[0] || null;
}

export async function getLatestParserImport(tenantId: string): Promise<any | null> {
  const tenantDb = wrapTenantDb(db, tenantId);

  const result = await tenantDb.execute(sql`
    SELECT * FROM phone_history_imports
    WHERE tenant_id = ${tenantId} AND source = 'parser_tool'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  return result.rows[0] || null;
}

export async function markImportApplied(
  importId: number,
  tenantId: string,
  appliedFlags: { faqs?: boolean; services?: boolean; toneProfile?: boolean }
): Promise<void> {
  const tenantDb = wrapTenantDb(db, tenantId);

  await tenantDb.execute(sql`
    UPDATE phone_history_imports
    SET applied_at = NOW(),
        applied_flags = ${JSON.stringify(appliedFlags)}::jsonb
    WHERE id = ${importId} AND tenant_id = ${tenantId}
  `);
}
