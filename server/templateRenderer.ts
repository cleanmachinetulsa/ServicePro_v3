import { db } from "./db";
import { smsTemplates, smsTemplateVersions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Template Renderer Service
 * Centralized service for rendering SMS templates with variable interpolation,
 * validation, and caching
 */

// In-memory cache for templates
const templateCache = new Map<string, any>();
let cacheTimestamp = Date.now();

/**
 * Clear the template cache (called when templates are updated)
 */
export function clearTemplateCache() {
  templateCache.clear();
  cacheTimestamp = Date.now();
  console.log('[TEMPLATE RENDERER] Cache cleared');
}

/**
 * Validate that all required variables are provided in the payload
 */
function validatePayload(
  templateKey: string,
  variables: Array<{ name: string; required: boolean }>,
  payload: Record<string, string>
): { valid: boolean; missing: string[] } {
  const requiredVars = variables.filter(v => v.required).map(v => v.name);
  const missing = requiredVars.filter(v => !payload[v] || payload[v].trim() === '');

  if (missing.length > 0) {
    console.warn(`[TEMPLATE RENDERER] Missing required variables for ${templateKey}:`, missing);
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

/**
 * Safe placeholder replacement
 * Replaces {variableName} with values from payload
 * Warns about missing optional variables
 */
function interpolateTemplate(
  templateKey: string,
  body: string,
  variables: Array<{ name: string; required: boolean }>,
  payload: Record<string, string>
): string {
  let result = body;

  variables.forEach(variable => {
    const placeholder = `{${variable.name}}`;
    const value = payload[variable.name];

    if (value !== undefined && value !== null) {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    } else if (!variable.required) {
      // Optional variable not provided - replace with empty string
      console.log(`[TEMPLATE RENDERER] Optional variable '${variable.name}' not provided for ${templateKey}, using empty string`);
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), '');
    }
  });

  return result;
}

/**
 * Render an SMS template with variable substitution
 * 
 * @param templateKey - Unique key for the template (e.g., 'on_site_arrival')
 * @param payload - Object with variable values (e.g., { firstName: 'John', serviceName: 'Detail' })
 * @param options - Optional parameters
 * @returns Rendered template string or null if template not found/disabled
 */
export async function renderTemplate(
  templateKey: string,
  payload: Record<string, string> = {},
  options: { preview?: boolean; language?: string } = {}
): Promise<{ success: boolean; message?: string; missing?: string[]; rendered?: string }> {
  try {
    const { preview = false, language = 'en' } = options;

    // Check cache first (unless preview mode)
    const cacheKey = `${templateKey}:${language}`;
    let template = templateCache.get(cacheKey);

    if (!template || preview) {
      // Fetch from database
      const [dbTemplate] = await db
        .select()
        .from(smsTemplates)
        .where(
          and(
            eq(smsTemplates.templateKey, templateKey),
            eq(smsTemplates.language, language)
          )
        )
        .limit(1);

      if (!dbTemplate) {
        console.error(`[TEMPLATE RENDERER] Template not found: ${templateKey} (${language})`);
        return {
          success: false,
          message: `Template '${templateKey}' not found`
        };
      }

      template = dbTemplate;

      // Cache it (unless preview)
      if (!preview) {
        templateCache.set(cacheKey, template);
      }
    }

    // Check if template is enabled
    if (!template.enabled && !preview) {
      console.warn(`[TEMPLATE RENDERER] Template disabled: ${templateKey}`);
      return {
        success: false,
        message: `Template '${templateKey}' is disabled`
      };
    }

    // Validate payload
    const validation = validatePayload(templateKey, template.variables, payload);
    if (!validation.valid) {
      return {
        success: false,
        message: `Missing required variables: ${validation.missing.join(', ')}`,
        missing: validation.missing
      };
    }

    // Interpolate variables
    const rendered = interpolateTemplate(templateKey, template.body, template.variables, payload);

    // Log usage (not in preview mode)
    if (!preview) {
      console.log(`[TEMPLATE RENDERER] Rendered ${templateKey} for ${language}`);
    }

    return {
      success: true,
      rendered,
      message: 'Template rendered successfully'
    };
  } catch (error) {
    console.error('[TEMPLATE RENDERER] Error rendering template:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to render template'
    };
  }
}

/**
 * Get template with metadata (for dashboard preview)
 */
export async function getTemplate(templateKey: string, language: string = 'en') {
  try {
    const [template] = await db
      .select()
      .from(smsTemplates)
      .where(
        and(
          eq(smsTemplates.templateKey, templateKey),
          eq(smsTemplates.language, language)
        )
      )
      .limit(1);

    return template;
  } catch (error) {
    console.error('[TEMPLATE RENDERER] Error fetching template:', error);
    return null;
  }
}

/**
 * Save a new version of a template
 */
export async function saveTemplateVersion(
  templateId: number,
  newBody: string,
  newVariables: any,
  changeDescription: string,
  userId?: number
) {
  try {
    // Get current template
    const [currentTemplate] = await db
      .select()
      .from(smsTemplates)
      .where(eq(smsTemplates.id, templateId))
      .limit(1);

    if (!currentTemplate) {
      return { success: false, message: 'Template not found' };
    }

    // Save version history
    await db.insert(smsTemplateVersions).values({
      templateId,
      version: currentTemplate.version,
      body: currentTemplate.body,
      variables: currentTemplate.variables,
      changeDescription,
      createdBy: userId,
    });

    // Update template
    const [updated] = await db
      .update(smsTemplates)
      .set({
        body: newBody,
        variables: newVariables,
        version: currentTemplate.version + 1,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(smsTemplates.id, templateId))
      .returning();

    // Clear cache
    clearTemplateCache();

    return {
      success: true,
      template: updated,
      message: 'Template updated successfully'
    };
  } catch (error) {
    console.error('[TEMPLATE RENDERER] Error saving template version:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save template'
    };
  }
}

/**
 * Helper function to get template version history
 */
export async function getTemplateVersionHistory(templateId: number) {
  try {
    const versions = await db
      .select()
      .from(smsTemplateVersions)
      .where(eq(smsTemplateVersions.templateId, templateId))
      .orderBy(smsTemplateVersions.createdAt);

    return versions;
  } catch (error) {
    console.error('[TEMPLATE RENDERER] Error fetching version history:', error);
    return [];
  }
}
