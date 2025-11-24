import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';
import { tenants, impersonationEvents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getRootDb } from './tenantDb';

const router = Router();

const startImpersonationSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
});

router.post('/start', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const { tenantId } = startImpersonationSchema.parse(req.body);

    const rootDb = getRootDb();
    const tenant = await rootDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant || tenant.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    req.session.impersonatingTenantId = tenantId;
    req.session.impersonationStartedAt = new Date().toISOString();

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Log to impersonation_events table
    await rootDb.insert(impersonationEvents).values({
      realUserId: req.session.userId!,
      tenantId,
      action: 'start',
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    const { logAuditEvent } = await import('./securityService');
    await logAuditEvent({
      userId: req.session.userId,
      action: 'impersonation_start',
      resource: 'tenant_impersonation',
      details: `Started impersonating tenant: ${tenantId}`,
    });

    res.json({
      success: true,
      tenantId,
      tenantName: tenant[0].name,
      message: 'Impersonation started',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors,
      });
    }

    const { logAuditEvent } = await import('./securityService');
    await logAuditEvent({
      userId: req.session.userId,
      action: 'impersonation_start_failed',
      resource: 'tenant_impersonation',
      details: `Failed to start impersonation: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to start impersonation',
    });
  }
});

router.post('/stop', requireAuth, async (req, res) => {
  try {
    const wasImpersonating = !!req.session.impersonatingTenantId;
    const formerTenantId = req.session.impersonatingTenantId;

    req.session.impersonatingTenantId = null;
    req.session.impersonationStartedAt = null;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (wasImpersonating && formerTenantId) {
      // Log to impersonation_events table
      const rootDb = getRootDb();
      await rootDb.insert(impersonationEvents).values({
        realUserId: req.session.userId!,
        tenantId: formerTenantId,
        action: 'stop',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      const { logAuditEvent } = await import('./securityService');
      await logAuditEvent({
        userId: req.session.userId,
        action: 'impersonation_stop',
        resource: 'tenant_impersonation',
        details: `Stopped impersonating tenant: ${formerTenantId}`,
      });
    }

    res.json({
      success: true,
      message: 'Impersonation cleared',
    });
  } catch (error) {
    const { logAuditEvent } = await import('./securityService');
    await logAuditEvent({
      userId: req.session?.userId || 0,
      action: 'impersonation_stop_failed',
      resource: 'tenant_impersonation',
      details: `Failed to stop impersonation: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to stop impersonation',
    });
  }
});

export default router;
