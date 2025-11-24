/**
 * Phase 16 - Admin Backfill Routes
 * 
 * Admin-only endpoints for running customer backfill operations.
 * These endpoints are protected and require owner/admin authentication.
 * 
 * Endpoints:
 * - POST /api/admin/backfill/customers/summary - Dry-run preview
 * - POST /api/admin/backfill/customers/run - Execute backfill
 */

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { runCustomerBackfill, type BackfillStats } from './services/customerBackfillService';
import { z } from 'zod';

const router = Router();

// ============================================================
// MIDDLEWARE: Require owner/admin role
// ============================================================

function requireOwnerOrAdmin(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Check if user has owner or manager role
  const userRole = (req as any).user?.role;
  if (userRole !== 'owner' && userRole !== 'manager') {
    return res.status(403).json({ 
      success: false, 
      message: 'Owner or manager role required for backfill operations' 
    });
  }

  next();
}

// Apply auth middleware to all routes
router.use(requireOwnerOrAdmin);

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/admin/backfill/customers/summary
 * 
 * Dry-run customer backfill to preview what would happen
 * without making any actual database changes.
 */
router.post('/customers/summary', async (req: Request, res: Response) => {
  try {
    console.log('[ADMIN BACKFILL] Summary (dry-run) requested by user:', req.session.userId);

    // Always run in dry-run mode for summary
    const stats: BackfillStats = await runCustomerBackfill(db, {
      tenantId: 'root',
      dryRun: true,
    });

    return res.json({
      success: true,
      message: 'Dry-run completed successfully (no changes made)',
      stats,
    });
  } catch (error) {
    console.error('[ADMIN BACKFILL] Error in summary endpoint:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Backfill summary failed',
      error: errorMsg,
    });
  }
});

/**
 * POST /api/admin/backfill/customers/run
 * 
 * Execute actual customer backfill with database writes.
 * Requires explicit confirmation in request body.
 */
router.post('/customers/run', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const bodySchema = z.object({
      confirm: z.boolean(),
    });

    const { confirm } = bodySchema.parse(req.body);

    // Require explicit confirmation
    if (confirm !== true) {
      return res.status(400).json({
        success: false,
        message: 'Backfill execution requires explicit confirmation: { "confirm": true }',
      });
    }

    console.log('[ADMIN BACKFILL] REAL RUN requested by user:', req.session.userId);
    console.log('[ADMIN BACKFILL] ⚠️  This will modify the database!');

    // Execute backfill with actual database writes
    const stats: BackfillStats = await runCustomerBackfill(db, {
      tenantId: 'root',
      dryRun: false,
    });

    console.log('[ADMIN BACKFILL] ✅ Backfill completed successfully');

    return res.json({
      success: true,
      message: 'Customer backfill completed successfully',
      stats,
    });
  } catch (error) {
    console.error('[ADMIN BACKFILL] Error in run endpoint:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Backfill execution failed',
      error: errorMsg,
    });
  }
});

/**
 * GET /api/admin/backfill/customers/history
 * 
 * Retrieve past backfill runs from migration log
 */
router.get('/customers/history', async (req: Request, res: Response) => {
  try {
    const { migrationLog } = await import('@shared/schema');
    const { eq, desc } = await import('drizzle-orm');

    // Fetch migration log entries for customer backfill
    const history = await db
      .select()
      .from(migrationLog)
      .where(eq(migrationLog.type, 'customer_backfill'))
      .orderBy(desc(migrationLog.startedAt))
      .limit(20);

    return res.json({
      success: true,
      history: history.map(entry => ({
        id: entry.id,
        tenantId: entry.tenantId,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        notes: entry.notes ? JSON.parse(entry.notes) : null,
        duration: entry.completedAt && entry.startedAt
          ? (new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime()) / 1000
          : null,
      })),
    });
  } catch (error) {
    console.error('[ADMIN BACKFILL] Error fetching history:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch backfill history',
      error: errorMsg,
    });
  }
});

export default router;
