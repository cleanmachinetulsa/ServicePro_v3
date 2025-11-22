import { Express, Request, Response } from 'express';
import { db } from './db';
import { tenants, tenantConfig, insertTenantSchema, insertTenantConfigSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';

export function registerAdminTenantRoutes(app: Express) {
  
  app.get('/api/admin/tenants', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const allTenants = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          subdomain: tenants.subdomain,
          isRoot: tenants.isRoot,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
          businessName: tenantConfig.businessName,
          logoUrl: tenantConfig.logoUrl,
          primaryColor: tenantConfig.primaryColor,
          tier: tenantConfig.tier,
        })
        .from(tenants)
        .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
        .orderBy(tenants.createdAt);

      res.json({ success: true, tenants: allTenants });
    } catch (error: any) {
      console.error('[ADMIN TENANTS] Error fetching tenants:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/admin/tenants/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [tenant] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          subdomain: tenants.subdomain,
          isRoot: tenants.isRoot,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
          businessName: tenantConfig.businessName,
          logoUrl: tenantConfig.logoUrl,
          primaryColor: tenantConfig.primaryColor,
          tier: tenantConfig.tier,
          configCreatedAt: tenantConfig.createdAt,
          configUpdatedAt: tenantConfig.updatedAt,
        })
        .from(tenants)
        .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
        .where(eq(tenants.id, id))
        .limit(1);

      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      res.json({ success: true, tenant });
    } catch (error: any) {
      console.error('[ADMIN TENANTS] Error fetching tenant:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/admin/tenants', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const tenantData = insertTenantSchema.parse({
        id: req.body.id,
        name: req.body.name,
        subdomain: req.body.subdomain,
        isRoot: false,
      });

      const configData = insertTenantConfigSchema.parse({
        tenantId: req.body.id,
        businessName: req.body.businessName || req.body.name,
        logoUrl: req.body.logoUrl || null,
        primaryColor: req.body.primaryColor || '#3b82f6',
        tier: req.body.tier || 'starter',
      });

      await db.transaction(async (tx) => {
        await tx.insert(tenants).values(tenantData);
        await tx.insert(tenantConfig).values(configData);
      });

      const [newTenant] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          subdomain: tenants.subdomain,
          isRoot: tenants.isRoot,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
          businessName: tenantConfig.businessName,
          logoUrl: tenantConfig.logoUrl,
          primaryColor: tenantConfig.primaryColor,
          tier: tenantConfig.tier,
        })
        .from(tenants)
        .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
        .where(eq(tenants.id, tenantData.id))
        .limit(1);

      console.log('[ADMIN TENANTS] Created tenant:', tenantData.id);
      res.json({ success: true, tenant: newTenant });
    } catch (error: any) {
      console.error('[ADMIN TENANTS] Error creating tenant:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.patch('/api/admin/tenants/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [existing] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
      
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      if (existing.isRoot) {
        return res.status(403).json({ success: false, error: 'Cannot modify root tenant' });
      }

      await db.transaction(async (tx) => {
        const tenantUpdates: any = { updatedAt: new Date() };
        if (req.body.name !== undefined) tenantUpdates.name = req.body.name;
        if (req.body.subdomain !== undefined) tenantUpdates.subdomain = req.body.subdomain;
        
        if (Object.keys(tenantUpdates).length > 1) {
          await tx.update(tenants)
            .set(tenantUpdates)
            .where(eq(tenants.id, id));
        }

        const configUpdates: any = { updatedAt: new Date() };
        if (req.body.businessName !== undefined) configUpdates.businessName = req.body.businessName;
        if (req.body.logoUrl !== undefined) configUpdates.logoUrl = req.body.logoUrl;
        if (req.body.primaryColor !== undefined) configUpdates.primaryColor = req.body.primaryColor;
        if (req.body.tier !== undefined) configUpdates.tier = req.body.tier;
        
        if (Object.keys(configUpdates).length > 1) {
          await tx.update(tenantConfig)
            .set(configUpdates)
            .where(eq(tenantConfig.tenantId, id));
        }
      });

      const [updatedTenant] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          subdomain: tenants.subdomain,
          isRoot: tenants.isRoot,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
          businessName: tenantConfig.businessName,
          logoUrl: tenantConfig.logoUrl,
          primaryColor: tenantConfig.primaryColor,
          tier: tenantConfig.tier,
        })
        .from(tenants)
        .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
        .where(eq(tenants.id, id))
        .limit(1);

      console.log('[ADMIN TENANTS] Updated tenant:', id);
      res.json({ success: true, tenant: updatedTenant });
    } catch (error: any) {
      console.error('[ADMIN TENANTS] Error updating tenant:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/admin/tenants/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [existing] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
      
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      if (existing.isRoot) {
        return res.status(403).json({ success: false, error: 'Cannot delete root tenant' });
      }

      await db.delete(tenants).where(eq(tenants.id, id));

      console.log('[ADMIN TENANTS] Deleted tenant:', id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[ADMIN TENANTS] Error deleting tenant:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
