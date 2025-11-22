/**
 * Phase 2.5: Admin Phone Config Routes
 * 
 * Admin UI for managing tenant phone configurations and IVR modes.
 * Follows same patterns as adminTenants.ts with shared schemas and robust validation.
 */

import { Express, Request, Response } from 'express';
import { db } from './db';
import { tenantPhoneConfig, tenants, insertTenantPhoneConfigSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';
import { nanoid } from 'nanoid';

export function registerAdminPhoneConfigRoutes(app: Express) {
  
  // GET all phone configs with tenant details
  app.get('/api/admin/phone-config', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const allConfigs = await db
        .select({
          id: tenantPhoneConfig.id,
          tenantId: tenantPhoneConfig.tenantId,
          phoneNumber: tenantPhoneConfig.phoneNumber,
          ivrMode: tenantPhoneConfig.ivrMode,
          sipDomain: tenantPhoneConfig.sipDomain,
          sipUsername: tenantPhoneConfig.sipUsername,
          messagingServiceSid: tenantPhoneConfig.messagingServiceSid,
          createdAt: tenantPhoneConfig.createdAt,
          tenantName: tenants.name,
          isRoot: tenants.isRoot,
        })
        .from(tenantPhoneConfig)
        .leftJoin(tenants, eq(tenantPhoneConfig.tenantId, tenants.id))
        .orderBy(tenantPhoneConfig.createdAt);

      res.json({ success: true, configs: allConfigs });
    } catch (error: any) {
      console.error('[ADMIN PHONE CONFIG] Error fetching phone configs:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET single phone config by ID
  app.get('/api/admin/phone-config/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [config] = await db
        .select({
          id: tenantPhoneConfig.id,
          tenantId: tenantPhoneConfig.tenantId,
          phoneNumber: tenantPhoneConfig.phoneNumber,
          ivrMode: tenantPhoneConfig.ivrMode,
          sipDomain: tenantPhoneConfig.sipDomain,
          sipUsername: tenantPhoneConfig.sipUsername,
          messagingServiceSid: tenantPhoneConfig.messagingServiceSid,
          createdAt: tenantPhoneConfig.createdAt,
          tenantName: tenants.name,
        })
        .from(tenantPhoneConfig)
        .leftJoin(tenants, eq(tenantPhoneConfig.tenantId, tenants.id))
        .where(eq(tenantPhoneConfig.id, id))
        .limit(1);

      if (!config) {
        return res.status(404).json({ success: false, error: 'Phone config not found' });
      }

      res.json({ success: true, config });
    } catch (error: any) {
      console.error('[ADMIN PHONE CONFIG] Error fetching phone config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST create new phone config
  app.post('/api/admin/phone-config', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      // Build and validate body with schema
      const body: any = {
        id: nanoid(),
        tenantId: req.body.tenantId,
        phoneNumber: req.body.phoneNumber,
        ivrMode: req.body.ivrMode || 'simple',
      };
      
      // Only include optional fields if they have non-empty trimmed values, validate them with schema
      const sipDomainTrimmed = typeof req.body.sipDomain === 'string' ? req.body.sipDomain.trim() : '';
      if (sipDomainTrimmed) {
        const sipDomainSchema = insertTenantPhoneConfigSchema.shape.sipDomain;
        body.sipDomain = sipDomainSchema.parse(sipDomainTrimmed);
      }
      
      const sipUsernameTrimmed = typeof req.body.sipUsername === 'string' ? req.body.sipUsername.trim() : '';
      if (sipUsernameTrimmed) {
        const sipUsernameSchema = insertTenantPhoneConfigSchema.shape.sipUsername;
        body.sipUsername = sipUsernameSchema.parse(sipUsernameTrimmed);
      }
      
      const messagingServiceSidTrimmed = typeof req.body.messagingServiceSid === 'string' ? req.body.messagingServiceSid.trim() : '';
      if (messagingServiceSidTrimmed) {
        const messagingServiceSidSchema = insertTenantPhoneConfigSchema.shape.messagingServiceSid;
        body.messagingServiceSid = messagingServiceSidSchema.parse(messagingServiceSidTrimmed);
      }
      
      const configData = insertTenantPhoneConfigSchema.parse(body);

      // Verify tenant exists
      const [tenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, configData.tenantId))
        .limit(1);

      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      // Check if phone number already exists
      const [existing] = await db
        .select({ id: tenantPhoneConfig.id })
        .from(tenantPhoneConfig)
        .where(eq(tenantPhoneConfig.phoneNumber, configData.phoneNumber))
        .limit(1);

      if (existing) {
        return res.status(409).json({ 
          success: false, 
          error: 'Phone number already configured for another tenant' 
        });
      }

      await db.insert(tenantPhoneConfig).values(configData);

      const [newConfig] = await db
        .select({
          id: tenantPhoneConfig.id,
          tenantId: tenantPhoneConfig.tenantId,
          phoneNumber: tenantPhoneConfig.phoneNumber,
          ivrMode: tenantPhoneConfig.ivrMode,
          sipDomain: tenantPhoneConfig.sipDomain,
          sipUsername: tenantPhoneConfig.sipUsername,
          messagingServiceSid: tenantPhoneConfig.messagingServiceSid,
          createdAt: tenantPhoneConfig.createdAt,
          tenantName: tenants.name,
          isRoot: tenants.isRoot,
        })
        .from(tenantPhoneConfig)
        .leftJoin(tenants, eq(tenantPhoneConfig.tenantId, tenants.id))
        .where(eq(tenantPhoneConfig.id, configData.id))
        .limit(1);

      console.log(`[ADMIN PHONE CONFIG] Created phone config for tenant ${configData.tenantId}: ${configData.phoneNumber}`);
      res.json({ success: true, config: newConfig });
    } catch (error: any) {
      console.error('[ADMIN PHONE CONFIG] Error creating phone config:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // PATCH update phone config
  app.patch('/api/admin/phone-config/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Verify config exists
      const [existing] = await db
        .select({ 
          id: tenantPhoneConfig.id, 
          phoneNumber: tenantPhoneConfig.phoneNumber 
        })
        .from(tenantPhoneConfig)
        .where(eq(tenantPhoneConfig.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Phone config not found' });
      }

      // Build update object with only provided fields
      // For optional fields, omit if empty/null so DB sets NULL
      const updateData: any = {};
      
      if (req.body.phoneNumber !== undefined) {
        // Validate E.164 format
        const phoneSchema = insertTenantPhoneConfigSchema.shape.phoneNumber;
        updateData.phoneNumber = phoneSchema.parse(req.body.phoneNumber);
        
        // Check uniqueness if changing phone number
        if (updateData.phoneNumber !== existing.phoneNumber) {
          const [duplicate] = await db
            .select({ id: tenantPhoneConfig.id })
            .from(tenantPhoneConfig)
            .where(eq(tenantPhoneConfig.phoneNumber, updateData.phoneNumber))
            .limit(1);

          if (duplicate) {
            return res.status(409).json({ 
              success: false, 
              error: 'Phone number already in use by another tenant' 
            });
          }
        }
      }

      if (req.body.ivrMode !== undefined) {
        const ivrSchema = insertTenantPhoneConfigSchema.shape.ivrMode;
        updateData.ivrMode = ivrSchema.parse(req.body.ivrMode);
      }

      // For optional fields: trim, validate non-empty values, or set to null to clear
      if (req.body.sipDomain !== undefined) {
        const trimmed = typeof req.body.sipDomain === 'string' ? req.body.sipDomain.trim() : '';
        if (trimmed === '' || req.body.sipDomain === null) {
          updateData.sipDomain = null;
        } else {
          const sipDomainSchema = insertTenantPhoneConfigSchema.shape.sipDomain;
          updateData.sipDomain = sipDomainSchema.parse(trimmed);
        }
      }

      if (req.body.sipUsername !== undefined) {
        const trimmed = typeof req.body.sipUsername === 'string' ? req.body.sipUsername.trim() : '';
        if (trimmed === '' || req.body.sipUsername === null) {
          updateData.sipUsername = null;
        } else {
          const sipUsernameSchema = insertTenantPhoneConfigSchema.shape.sipUsername;
          updateData.sipUsername = sipUsernameSchema.parse(trimmed);
        }
      }

      if (req.body.messagingServiceSid !== undefined) {
        const trimmed = typeof req.body.messagingServiceSid === 'string' ? req.body.messagingServiceSid.trim() : '';
        if (trimmed === '' || req.body.messagingServiceSid === null) {
          updateData.messagingServiceSid = null;
        } else {
          const messagingServiceSidSchema = insertTenantPhoneConfigSchema.shape.messagingServiceSid;
          updateData.messagingServiceSid = messagingServiceSidSchema.parse(trimmed);
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid fields to update' });
      }

      await db
        .update(tenantPhoneConfig)
        .set(updateData)
        .where(eq(tenantPhoneConfig.id, id));

      console.log(`[ADMIN PHONE CONFIG] Updated phone config ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[ADMIN PHONE CONFIG] Error updating phone config:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // DELETE phone config
  app.delete('/api/admin/phone-config/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [existing] = await db
        .select({ 
          id: tenantPhoneConfig.id,
          tenantId: tenantPhoneConfig.tenantId,
          phoneNumber: tenantPhoneConfig.phoneNumber,
        })
        .from(tenantPhoneConfig)
        .where(eq(tenantPhoneConfig.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Phone config not found' });
      }

      // CRITICAL: Prevent deletion of root tenant's phone config
      if (existing.tenantId === 'root') {
        return res.status(403).json({ 
          success: false, 
          error: 'Cannot delete root tenant phone configuration. This is the flagship business phone number.' 
        });
      }

      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, id));

      console.log(`[ADMIN PHONE CONFIG] Deleted phone config ${id} (${existing.phoneNumber})`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[ADMIN PHONE CONFIG] Error deleting phone config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET all tenants for dropdown
  app.get('/api/admin/phone-config/tenants/list', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const allTenants = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          isRoot: tenants.isRoot,
        })
        .from(tenants)
        .orderBy(tenants.createdAt);

      res.json({ success: true, tenants: allTenants });
    } catch (error: any) {
      console.error('[ADMIN PHONE CONFIG] Error fetching tenants:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log('[ADMIN PHONE CONFIG] Routes registered');
}
