import { Express, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { 
  listPacks, 
  getPack, 
  savePack, 
  updatePack,
  deletePack,
  cloneTenantFromPack,
  exportPackAsJson,
  importPackFromJson,
  savePackTemplate,
} from './services/industryPackService';
import { insertIndustryPackSchema, updateIndustryPackSchema } from '@shared/schema';

function requireRootAdmin(req: Request, res: Response, next: () => void) {
  const role = (req.session as any)?.role;
  if (role !== 'root_admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Root admin role required.' });
  }
  next();
}

function requireAdminRole(req: Request, res: Response, next: () => void) {
  const role = (req.session as any)?.role;
  const allowedRoles = ['owner', 'manager', 'admin', 'root_admin'];
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
  }
  next();
}

export function registerIndustryPackRoutes(app: Express) {
  console.log('[INDUSTRY PACKS] Registering routes...');

  app.get('/api/admin/industry-packs', requireAuth, requireRootAdmin, async (req: Request, res: Response) => {
    try {
      const packs = await listPacks(true);
      res.json({ success: true, data: packs });
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error listing packs:', error);
      res.status(500).json({ success: false, message: 'Failed to list industry packs' });
    }
  });

  app.get('/api/industry-packs/public', async (req: Request, res: Response) => {
    try {
      const packs = await listPacks(false);
      
      const sanitizedPacks = packs.map(pack => ({
        id: pack.id,
        key: pack.key,
        name: pack.name,
        description: pack.description,
        configJson: {
          industry: pack.configJson?.industry,
          heroText: pack.configJson?.heroText,
          colorPalette: pack.configJson?.colorPalette,
        },
      }));
      
      res.json({ success: true, data: sanitizedPacks });
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error listing public packs:', error);
      res.status(500).json({ success: false, message: 'Failed to list public industry packs' });
    }
  });

  app.get('/api/admin/industry-packs/:id', requireAuth, requireRootAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid pack ID' });
      }
      
      const pack = await getPack(id);
      if (!pack) {
        return res.status(404).json({ success: false, message: 'Pack not found' });
      }
      
      res.json({ success: true, data: pack });
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error getting pack:', error);
      res.status(500).json({ success: false, message: 'Failed to get industry pack' });
    }
  });

  app.post('/api/admin/industry-packs', requireAuth, requireRootAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertIndustryPackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid pack data',
          errors: parsed.error.flatten().fieldErrors 
        });
      }
      
      const result = await savePack(parsed.data);
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error creating pack:', error);
      res.status(500).json({ success: false, message: 'Failed to create industry pack' });
    }
  });

  app.put('/api/admin/industry-packs/:id', requireAuth, requireRootAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid pack ID' });
      }
      
      const parsed = updateIndustryPackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid pack data',
          errors: parsed.error.flatten().fieldErrors 
        });
      }
      
      const result = await updatePack(id, parsed.data);
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error updating pack:', error);
      res.status(500).json({ success: false, message: 'Failed to update industry pack' });
    }
  });

  app.delete('/api/admin/industry-packs/:id', requireAuth, requireRootAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid pack ID' });
      }
      
      const result = await deletePack(id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error deleting pack:', error);
      res.status(500).json({ success: false, message: 'Failed to delete industry pack' });
    }
  });

  app.get('/api/admin/industry-packs/:id/export', requireAuth, requireRootAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid pack ID' });
      }
      
      const result = await exportPackAsJson(id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="industry-pack-${id}.json"`);
      res.send(result.json);
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error exporting pack:', error);
      res.status(500).json({ success: false, message: 'Failed to export industry pack' });
    }
  });

  app.post('/api/admin/industry-packs/import', requireAuth, requireRootAdmin, async (req: Request, res: Response) => {
    try {
      const { json } = req.body;
      if (!json || typeof json !== 'string') {
        return res.status(400).json({ success: false, message: 'JSON string is required' });
      }
      
      const result = await importPackFromJson(json);
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error importing pack:', error);
      res.status(500).json({ success: false, message: 'Failed to import industry pack' });
    }
  });

  app.post('/api/admin/industry-packs/:id/clone-tenant', requireAuth, requireRootAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid pack ID' });
      }
      
      const { businessName, ownerEmail, subdomain, phone } = req.body;
      
      if (!businessName || typeof businessName !== 'string') {
        return res.status(400).json({ success: false, message: 'Business name is required' });
      }
      
      if (!ownerEmail || typeof ownerEmail !== 'string') {
        return res.status(400).json({ success: false, message: 'Owner email is required' });
      }
      
      const result = await cloneTenantFromPack(id, {
        businessName,
        ownerEmail,
        subdomain,
        phone,
      });
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error cloning tenant:', error);
      res.status(500).json({ success: false, message: 'Failed to clone tenant from pack' });
    }
  });

  app.post('/api/admin/industry-packs/:id/templates', requireAuth, requireRootAdmin, async (req: Request, res: Response) => {
    try {
      const packId = parseInt(req.params.id);
      if (isNaN(packId)) {
        return res.status(400).json({ success: false, message: 'Invalid pack ID' });
      }
      
      const { templateKey, templateValue } = req.body;
      
      if (!templateKey || typeof templateKey !== 'string') {
        return res.status(400).json({ success: false, message: 'Template key is required' });
      }
      
      if (!templateValue || typeof templateValue !== 'string') {
        return res.status(400).json({ success: false, message: 'Template value is required' });
      }
      
      const result = await savePackTemplate({
        packId,
        templateKey,
        templateValue,
      });
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('[INDUSTRY PACKS] Error saving template:', error);
      res.status(500).json({ success: false, message: 'Failed to save template' });
    }
  });

  console.log('[INDUSTRY PACKS] Routes registered: /api/industry-packs, /api/admin/industry-packs/*');
}
