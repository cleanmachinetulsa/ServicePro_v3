import { Request, Response, Router } from 'express';
import { quickReplyCategories, quickReplyTemplates } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';
import { 
  insertQuickReplyCategorySchema, 
  insertQuickReplyTemplateSchema,
  type InsertQuickReplyCategory,
  type InsertQuickReplyTemplate 
} from '@shared/schema';

const router = Router();

// Get all categories with their templates
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await req.tenantDb!
      .select()
      .from(quickReplyCategories)
      .where(req.tenantDb!.withTenantFilter(quickReplyCategories))
      .orderBy(asc(quickReplyCategories.displayOrder));

    // Get templates for each category
    const categoriesWithTemplates = await Promise.all(
      categories.map(async (category) => {
        const templates = await req.tenantDb!
          .select()
          .from(quickReplyTemplates)
          .where(req.tenantDb!.withTenantFilter(quickReplyTemplates, eq(quickReplyTemplates.categoryId, category.id)))
          .orderBy(asc(quickReplyTemplates.displayOrder));

        return {
          ...category,
          templates,
        };
      })
    );

    res.json({ success: true, categories: categoriesWithTemplates });
  } catch (error) {
    console.error('Error fetching quick reply categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quick reply categories',
    });
  }
});

// Create new category
router.post('/categories', async (req: Request, res: Response) => {
  try {
    const validatedData = insertQuickReplyCategorySchema.parse(req.body);

    const newCategory = await req.tenantDb!
      .insert(quickReplyCategories)
      .values(validatedData)
      .returning();

    res.json({ success: true, category: newCategory[0] });
  } catch (error) {
    console.error('Error creating quick reply category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create quick reply category',
    });
  }
});

// Update category
router.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    const validatedData = insertQuickReplyCategorySchema.partial().parse(req.body);

    const updatedCategory = await req.tenantDb!
      .update(quickReplyCategories)
      .set(validatedData)
      .where(req.tenantDb!.withTenantFilter(quickReplyCategories, eq(quickReplyCategories.id, categoryId)))
      .returning();

    if (updatedCategory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({ success: true, category: updatedCategory[0] });
  } catch (error) {
    console.error('Error updating quick reply category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quick reply category',
    });
  }
});

// Delete category (and all its templates)
router.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);

    // Delete all templates in this category first
    await req.tenantDb!
      .delete(quickReplyTemplates)
      .where(req.tenantDb!.withTenantFilter(quickReplyTemplates, eq(quickReplyTemplates.categoryId, categoryId)));

    // Delete the category
    const deleted = await req.tenantDb!
      .delete(quickReplyCategories)
      .where(req.tenantDb!.withTenantFilter(quickReplyCategories, eq(quickReplyCategories.id, categoryId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quick reply category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quick reply category',
    });
  }
});

// Create new template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const validatedData = insertQuickReplyTemplateSchema.parse(req.body);

    const newTemplate = await req.tenantDb!
      .insert(quickReplyTemplates)
      .values(validatedData)
      .returning();

    res.json({ success: true, template: newTemplate[0] });
  } catch (error) {
    console.error('Error creating quick reply template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create quick reply template',
    });
  }
});

// Update template
router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    const validatedData = insertQuickReplyTemplateSchema.partial().parse(req.body);

    const updatedTemplate = await req.tenantDb!
      .update(quickReplyTemplates)
      .set(validatedData)
      .where(req.tenantDb!.withTenantFilter(quickReplyTemplates, eq(quickReplyTemplates.id, templateId)))
      .returning();

    if (updatedTemplate.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    res.json({ success: true, template: updatedTemplate[0] });
  } catch (error) {
    console.error('Error updating quick reply template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quick reply template',
    });
  }
});

// Delete template
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);

    const deleted = await req.tenantDb!
      .delete(quickReplyTemplates)
      .where(req.tenantDb!.withTenantFilter(quickReplyTemplates, eq(quickReplyTemplates.id, templateId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quick reply template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quick reply template',
    });
  }
});

// Update template last used timestamp
router.post('/templates/:id/use', async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);

    await req.tenantDb!
      .update(quickReplyTemplates)
      .set({ lastUsed: new Date() })
      .where(req.tenantDb!.withTenantFilter(quickReplyTemplates, eq(quickReplyTemplates.id, templateId)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating template usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update template usage',
    });
  }
});

export default router;
