import { Router, Request, Response } from 'express';
import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { suggestions, tenants } from '@shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { requireAuth } from '../authMiddleware';
import { requireRole } from '../rbacMiddleware';

export const suggestionsRouter = Router();

/**
 * Platform-level suggestions: for ServicePro itself.
 * Requires platform admin auth.
 */
suggestionsRouter.get('/platform', requireAuth, requireRole(['owner']), async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(suggestions)
      .where(isNull(suggestions.tenantId))
      .orderBy(desc(suggestions.createdAt))
      .limit(200);

    return res.json({ success: true, suggestions: rows });
  } catch (err) {
    console.error('[SUGGESTIONS PLATFORM LIST ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to load suggestions' });
  }
});

/**
 * Create platform-level suggestion (public route for feedback about ServicePro)
 */
suggestionsRouter.post('/platform', async (req: Request, res: Response) => {
  try {
    const { message, context, name, contact } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const [row] = await db
      .insert(suggestions)
      .values({
        tenantId: null,
        source: 'platform',
        context: context ?? null,
        message,
        name: name ?? null,
        contact: contact ?? null,
      })
      .returning();

    return res.json({ success: true, suggestion: row });
  } catch (err) {
    console.error('[SUGGESTIONS PLATFORM CREATE ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to save suggestion' });
  }
});

/**
 * Tenant-scoped suggestions: internal (tenant owner/staff).
 * Uses tenantId from req.tenantId.
 */
suggestionsRouter.get('/tenant', requireAuth, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const tenantDb = wrapTenantDb(db, tenantId);

    const rows = await tenantDb
      .select()
      .from(suggestions)
      .where(eq(suggestions.tenantId, tenantId))
      .orderBy(desc(suggestions.createdAt))
      .limit(200);

    return res.json({ success: true, suggestions: rows });
  } catch (err) {
    console.error('[SUGGESTIONS TENANT LIST ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to load tenant suggestions' });
  }
});

/**
 * Create tenant-scoped suggestion (from owner/staff)
 */
suggestionsRouter.post('/tenant', requireAuth, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const { message, context, name, contact } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const tenantDb = wrapTenantDb(db, tenantId);

    const [row] = await tenantDb
      .insert(suggestions)
      .values({
        tenantId,
        source: 'tenant_owner',
        context: context ?? null,
        message,
        name: name ?? null,
        contact: contact ?? null,
      })
      .returning();

    return res.json({ success: true, suggestion: row });
  } catch (err) {
    console.error('[SUGGESTIONS TENANT CREATE ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to save suggestion' });
  }
});

/**
 * Public customer suggestions: for public website visitors
 * POST /api/suggestions/public/:subdomain
 */
suggestionsRouter.post('/public/:subdomain', async (req: Request, res: Response) => {
  try {
    const subdomain = req.params.subdomain as string;
    const { message, context, name, contact } = req.body ?? {};
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Resolve subdomain to tenantId
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);
    
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const tenantId = tenant.id;
    const tenantDb = wrapTenantDb(db, tenantId);

    const [row] = await tenantDb
      .insert(suggestions)
      .values({
        tenantId,
        source: 'tenant_customer',
        context: context ?? null,
        message,
        name: name ?? null,
        contact: contact ?? null,
      })
      .returning();

    return res.json({ success: true, suggestion: row });
  } catch (err) {
    console.error('[SUGGESTIONS PUBLIC CREATE ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to save suggestion' });
  }
});

/**
 * Mark suggestion handled / add notes
 */
suggestionsRouter.patch('/:id', requireAuth, async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });

    const { handled, notes } = req.body ?? {};
    const updates: any = {};

    if (typeof handled === 'boolean') {
      updates.handled = handled;
      updates.handledAt = handled ? new Date() : null;
      updates.handledBy = handled ? (req.user?.email ?? req.user?.username ?? 'system') : null;
    }

    if (typeof notes === 'string') {
      updates.notes = notes;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No changes' });
    }

    const [row] = await db
      .update(suggestions)
      .set(updates)
      .where(eq(suggestions.id, id))
      .returning();

    return res.json({ success: true, suggestion: row });
  } catch (err) {
    console.error('[SUGGESTIONS UPDATE ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to update suggestion' });
  }
});

/**
 * Delete a suggestion (admin only)
 */
suggestionsRouter.delete('/:id', requireAuth, requireRole(['owner', 'manager']), async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });

    await db
      .delete(suggestions)
      .where(eq(suggestions.id, id));

    return res.json({ success: true });
  } catch (err) {
    console.error('[SUGGESTIONS DELETE ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to delete suggestion' });
  }
});
