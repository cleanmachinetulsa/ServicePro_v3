/**
 * Phase 2.5: Admin Phone Config Routes
 * 
 * Admin UI for managing tenant phone configurations and IVR modes.
 * Allows owners to toggle between simple/ivr/ai-voice modes without SQL.
 */

import { Express, Request, Response } from 'express';
import { db } from './db';
import { tenantPhoneConfig, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';
import { z } from 'zod';
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
      const schema = z.object({
        tenantId: z.string().min(1, 'Tenant ID is required'),
        phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (+1...)'),
        ivrMode: z.enum(['simple', 'ivr', 'ai-voice']).default('simple'),
        sipDomain: z.string().optional(),
        sipUsername: z.string().optional(),
        messagingServiceSid: z.string().optional(),
      });

      const data = schema.parse(req.body);

      // Verify tenant exists
      const [tenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, data.tenantId))
        .limit(1);

      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      // Check if phone number already exists
      const [existing] = await db
        .select({ id: tenantPhoneConfig.id })
        .from(tenantPhoneConfig)
        .where(eq(tenantPhoneConfig.phoneNumber, data.phoneNumber))
        .limit(1);

      if (existing) {
        return res.status(409).json({ 
          success: false, 
          error: 'Phone number already configured for another tenant' 
        });
      }

      const id = nanoid();

      await db.insert(tenantPhoneConfig).values({
        id,
        tenantId: data.tenantId,
        phoneNumber: data.phoneNumber,
        ivrMode: data.ivrMode,
        sipDomain: data.sipDomain || null,
        sipUsername: data.sipUsername || null,
        messagingServiceSid: data.messagingServiceSid || null,
      });

      console.log(`[ADMIN PHONE CONFIG] Created phone config for tenant ${data.tenantId}: ${data.phoneNumber}`);
      res.json({ success: true, id });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors[0].message });
      }
      console.error('[ADMIN PHONE CONFIG] Error creating phone config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PATCH update phone config
  app.patch('/api/admin/phone-config/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const schema = z.object({
        phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
        ivrMode: z.enum(['simple', 'ivr', 'ai-voice']).optional(),
        sipDomain: z.string().nullable().optional(),
        sipUsername: z.string().nullable().optional(),
        messagingServiceSid: z.string().nullable().optional(),
      });

      const data = schema.parse(req.body);

      // Verify config exists
      const [existing] = await db
        .select({ id: tenantPhoneConfig.id })
        .from(tenantPhoneConfig)
        .where(eq(tenantPhoneConfig.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Phone config not found' });
      }

      // If updating phone number, check uniqueness
      if (data.phoneNumber) {
        const [duplicate] = await db
          .select({ id: tenantPhoneConfig.id })
          .from(tenantPhoneConfig)
          .where(eq(tenantPhoneConfig.phoneNumber, data.phoneNumber))
          .limit(1);

        if (duplicate && duplicate.id !== id) {
          return res.status(409).json({ 
            success: false, 
            error: 'Phone number already in use by another tenant' 
          });
        }
      }

      await db
        .update(tenantPhoneConfig)
        .set(data)
        .where(eq(tenantPhoneConfig.id, id));

      console.log(`[ADMIN PHONE CONFIG] Updated phone config ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors[0].message });
      }
      console.error('[ADMIN PHONE CONFIG] Error updating phone config:', error);
      res.status(500).json({ success: false, error: error.message });
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
        })
        .from(tenantPhoneConfig)
        .where(eq(tenantPhoneConfig.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Phone config not found' });
      }

      // Prevent deletion of root tenant's phone config (safety)
      if (existing.tenantId === 'root') {
        return res.status(403).json({ 
          success: false, 
          error: 'Cannot delete root tenant phone configuration' 
        });
      }

      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, id));

      console.log(`[ADMIN PHONE CONFIG] Deleted phone config ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[ADMIN PHONE CONFIG] Error deleting phone config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log('[ADMIN PHONE CONFIG] Routes registered');
}
