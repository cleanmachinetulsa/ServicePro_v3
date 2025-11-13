import { Router, Request, Response } from 'express';
import { db } from './db';
import { smsTemplates, smsTemplateVersions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import {
  renderTemplate,
  getTemplate,
  saveTemplateVersion,
  getTemplateVersionHistory,
  clearTemplateCache
} from './templateRenderer';

const router = Router();

/**
 * Get all SMS templates
 * GET /api/sms-templates
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { language = 'en' } = req.query;
    
    const templates = await db
      .select()
      .from(smsTemplates)
      .where(eq(smsTemplates.language, language as string))
      .orderBy(smsTemplates.category, smsTemplates.name);

    res.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('[SMS TEMPLATES] Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SMS templates',
    });
  }
});

/**
 * Get a specific SMS template by key
 * GET /api/sms-templates/:key
 */
router.get('/:key', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { language = 'en' } = req.query;
    
    const template = await getTemplate(key, language as string);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('[SMS TEMPLATES] Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SMS template',
    });
  }
});

/**
 * Preview a template with sample data
 * POST /api/sms-templates/:key/preview
 */
router.post('/:key/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { payload, language = 'en' } = req.body;

    const result = await renderTemplate(key, payload || {}, { preview: true, language });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[SMS TEMPLATES] Error previewing template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview template',
    });
  }
});

/**
 * Update a template
 * PUT /api/sms-templates/:id
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { body, name, description, enabled, variables, changeDescription } = req.body;
    const userId = (req as any).user?.id;

    const templateId = parseInt(id);
    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID',
      });
    }

    // If body or variables changed, save version
    if (body !== undefined || variables !== undefined) {
      const [currentTemplate] = await db
        .select()
        .from(smsTemplates)
        .where(eq(smsTemplates.id, templateId))
        .limit(1);

      if (!currentTemplate) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      const result = await saveTemplateVersion(
        templateId,
        body || currentTemplate.body,
        variables || currentTemplate.variables,
        changeDescription || 'Template updated',
        userId
      );

      if (!result.success) {
        return res.status(500).json(result);
      }

      // Also update name, description, enabled if provided
      if (name !== undefined || description !== undefined || enabled !== undefined) {
        await db
          .update(smsTemplates)
          .set({
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(enabled !== undefined && { enabled }),
            updatedAt: new Date(),
            updatedBy: userId,
          })
          .where(eq(smsTemplates.id, templateId));
      }

      return res.json(result);
    }

    // Otherwise just update metadata
    const [updated] = await db
      .update(smsTemplates)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(enabled !== undefined && { enabled }),
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(smsTemplates.id, templateId))
      .returning();

    clearTemplateCache();

    res.json({
      success: true,
      template: updated,
      message: 'Template updated successfully',
    });
  } catch (error) {
    console.error('[SMS TEMPLATES] Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
    });
  }
});

/**
 * Get version history for a template
 * GET /api/sms-templates/:id/versions
 */
router.get('/:id/versions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID',
      });
    }

    const versions = await getTemplateVersionHistory(templateId);

    res.json({
      success: true,
      versions,
    });
  } catch (error) {
    console.error('[SMS TEMPLATES] Error fetching version history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version history',
    });
  }
});

/**
 * Clear the template cache
 * POST /api/sms-templates/cache/clear
 */
router.post('/cache/clear', requireAuth, async (req: Request, res: Response) => {
  try {
    clearTemplateCache();

    res.json({
      success: true,
      message: 'Template cache cleared successfully',
    });
  } catch (error) {
    console.error('[SMS TEMPLATES] Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
});

export default router;
