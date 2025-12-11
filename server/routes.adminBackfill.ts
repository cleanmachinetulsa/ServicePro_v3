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
import { importCustomersFromSheet, previewCustomersFromSheet, type CustomerSheetImportSummary } from './services/customerImportFromSheetsService';
import { getLastCustomersSheetsSync, runSheetsCustomerBackfillForTenant } from './services/sheetsCustomerAutoSyncService';
import { z } from 'zod';

const router = Router();

// ============================================================
// MIDDLEWARE: Require owner role AND root tenant
// ============================================================

function requireRootOwner(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Check if user has owner role (NOT manager - managers shouldn't run backfills)
  const userRole = (req as any).user?.role;
  if (userRole !== 'owner') {
    return res.status(403).json({ 
      success: false, 
      message: 'Owner role required for backfill operations' 
    });
  }

  // Verify user belongs to root tenant
  const tenantId = (req as any).tenantId || req.session.tenantId;
  if (tenantId !== 'root') {
    return res.status(403).json({ 
      success: false, 
      message: 'Backfill operations are only available for root tenant (Clean Machine)' 
    });
  }

  next();
}

// Apply auth middleware to all routes (requires owner role + root tenant)
router.use(requireRootOwner);

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
    const { eq, desc, and } = await import('drizzle-orm');

    // Fetch migration log entries for customer backfill (tenant-scoped to 'root')
    const history = await db
      .select()
      .from(migrationLog)
      .where(
        and(
          eq(migrationLog.tenantId, 'root'),
          eq(migrationLog.type, 'customer_backfill')
        )
      )
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

// ============================================================
// GOOGLE SHEETS CUSTOMER BACKFILL (New Identity Service)
// ============================================================

/**
 * POST /api/admin/backfill/customers/from-sheets/preview
 * 
 * Preview customers from Google Sheets before import
 */
router.post('/customers/from-sheets/preview', async (req: Request, res: Response) => {
  try {
    console.log('[ADMIN BACKFILL] Sheets preview requested by user:', req.session.userId);

    const result = await previewCustomersFromSheet('root', { dryRun: true });

    return res.json({
      success: true,
      message: 'Preview generated from Google Sheets',
      data: {
        totalRows: result.totalRows,
        normalizedRows: result.normalizedRows,
        tabsFound: result.tabsFound,
        sampleRows: result.sampleRows.slice(0, 10),
      },
    });
  } catch (error) {
    console.error('[ADMIN BACKFILL] Error in sheets preview:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Sheets preview failed',
      error: errorMsg,
    });
  }
});

/**
 * POST /api/admin/backfill/customers/from-sheets
 * 
 * Import customers from Google Sheets using unified Customer Identity Service.
 * This uses findOrCreateCustomer for proper deduplication and merge.
 */
router.post('/customers/from-sheets', async (req: Request, res: Response) => {
  try {
    const bodySchema = z.object({
      confirm: z.boolean().optional(),
      dryRun: z.boolean().optional().default(false),
    });

    const { confirm, dryRun } = bodySchema.parse(req.body);

    if (!dryRun && confirm !== true) {
      return res.status(400).json({
        success: false,
        message: 'For real import, set { "confirm": true, "dryRun": false }',
      });
    }

    console.log(`[ADMIN BACKFILL] Sheets import requested (dryRun: ${dryRun}) by user:`, req.session.userId);

    const summary: CustomerSheetImportSummary = dryRun 
      ? await importCustomersFromSheet('root', { dryRun: true })
      : await runSheetsCustomerBackfillForTenant('root', 'manual');

    console.log('[ADMIN BACKFILL] Sheets import complete:', summary);

    return res.json({
      success: true,
      message: dryRun ? 'Dry-run completed (no changes made)' : 'Import completed successfully',
      summary,
    });
  } catch (error) {
    console.error('[ADMIN BACKFILL] Error in sheets import:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Sheets import failed',
      error: errorMsg,
    });
  }
});

/**
 * GET /api/admin/backfill/customers-sheets/last-auto-sync
 * 
 * Health-check endpoint returning the most recent customers-sheets import
 * Works whether the run was triggered by cron or manually
 */
router.get('/customers-sheets/last-auto-sync', async (req: Request, res: Response) => {
  try {
    const tenantId = 'root';
    const lastRun = await getLastCustomersSheetsSync(tenantId);

    if (!lastRun) {
      return res.json({
        hasRun: false,
        lastRunAt: null,
        triggerSource: null,
        summary: null,
      });
    }

    let notes: any = null;
    try {
      notes = lastRun.notes ? JSON.parse(lastRun.notes) : null;
    } catch {
      notes = null;
    }

    return res.json({
      hasRun: true,
      lastRunAt: lastRun.completedAt ?? lastRun.startedAt,
      triggerSource: notes?.triggerSource ?? 'unknown',
      summary: notes ? {
        totalRows: notes.totalRows,
        normalizedRows: notes.normalizedRows,
        created: notes.created,
        updated: notes.updated,
        skipped: notes.skipped,
        normalizationFailures: notes.normalizationFailures,
        errorCount: notes.errorCount,
        error: notes.error,
      } : null,
    });
  } catch (error) {
    console.error('[ADMIN BACKFILL] Error fetching last auto-sync:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch last auto-sync status',
      error: errorMsg,
    });
  }
});

export default router;
