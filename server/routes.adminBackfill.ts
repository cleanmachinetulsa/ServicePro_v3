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
import { getPortRecoveryTransactionsByCampaignIds, awardPoints } from './gamificationService';
import { portRecoveryCampaigns } from '@shared/schema';
import { eq, sql as drizzleSql } from 'drizzle-orm';
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

// ============================================================
// PORT RECOVERY CAMPAIGN POINTS NORMALIZATION
// ============================================================

const PORT_RECOVERY_CAMPAIGN_KEY = 'port-recovery-2025-12-11';

/**
 * POST /api/admin/backfill/loyalty/normalize-port-recovery-2025-12-11
 * 
 * One-time correction tool to fix customers who received more than 500 points
 * from the port recovery campaign. Creates negative adjustments to bring
 * net campaign points to exactly 500.
 */
router.post('/loyalty/normalize-port-recovery-2025-12-11', async (req: Request, res: Response) => {
  try {
    console.log('[LOYALTY NORMALIZE] Port recovery normalization requested by user:', req.session?.userId);

    const campaignRecords = await db
      .select({ id: portRecoveryCampaigns.id })
      .from(portRecoveryCampaigns)
      .where(eq(portRecoveryCampaigns.name, PORT_RECOVERY_CAMPAIGN_KEY));
    
    const campaignIds = campaignRecords.map(c => c.id);
    
    console.log(`[LOYALTY NORMALIZE] Found ${campaignIds.length} campaigns matching "${PORT_RECOVERY_CAMPAIGN_KEY}": [${campaignIds.join(', ')}]`);

    if (campaignIds.length === 0) {
      return res.json({
        success: true,
        campaignKey: PORT_RECOVERY_CAMPAIGN_KEY,
        message: 'No campaigns found matching this campaign key',
        scannedTransactions: 0,
        customersAnalyzed: 0,
        correctedCustomers: 0,
        corrections: [],
      });
    }

    const txs = await getPortRecoveryTransactionsByCampaignIds(db, campaignIds);

    console.log(`[LOYALTY NORMALIZE] Found ${txs.length} port_recovery transactions for these campaigns`);

    const byCustomer = new Map<number, { total: number; transactions: typeof txs }>();

    for (const tx of txs) {
      if (!tx.customerId) continue;
      
      const entry = byCustomer.get(tx.customerId) ?? { total: 0, transactions: [] };
      entry.total += tx.amount;
      entry.transactions.push(tx);
      byCustomer.set(tx.customerId, entry);
    }

    const corrections: Array<{ customerId: number; excess: number; previousTotal: number }> = [];

    for (const [customerId, info] of byCustomer.entries()) {
      if (info.total > 500) {
        const excess = info.total - 500;
        corrections.push({ customerId, excess, previousTotal: info.total });
      }
    }

    console.log(`[LOYALTY NORMALIZE] Found ${corrections.length} customers with excess points`);

    const results: Array<{ customerId: number; correctedBy: number; previousTotal: number; newTotal: number }> = [];

    for (const { customerId, excess, previousTotal } of corrections) {
      const adjustmentPoints = -excess;

      try {
        const result = await awardPoints(
          db,
          customerId,
          adjustmentPoints,
          'port_recovery_correction',
          null,
          `Port recovery correction - reducing by ${excess} points [${PORT_RECOVERY_CAMPAIGN_KEY}]`
        );

        results.push({
          customerId,
          correctedBy: adjustmentPoints,
          previousTotal,
          newTotal: result.currentPoints,
        });

        console.log(`[LOYALTY NORMALIZE] Corrected customer ${customerId}: ${previousTotal} → ${previousTotal + adjustmentPoints} points`);
      } catch (err) {
        console.error(`[LOYALTY NORMALIZE] Error correcting customer ${customerId}:`, err);
      }
    }

    return res.json({
      success: true,
      campaignKey: PORT_RECOVERY_CAMPAIGN_KEY,
      scannedTransactions: txs.length,
      customersAnalyzed: byCustomer.size,
      correctedCustomers: results.length,
      corrections: results,
    });
  } catch (error) {
    console.error('[LOYALTY NORMALIZE] Error normalizing port-recovery points:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Failed to normalize port-recovery loyalty points',
      error: errorMsg,
    });
  }
});

/**
 * GET /api/admin/backfill/loyalty/port-recovery-2025-12-11/status
 * 
 * Preview the current state of port recovery campaign points
 * Shows which customers have received points and any over-awards
 */
router.get('/loyalty/port-recovery-2025-12-11/status', async (req: Request, res: Response) => {
  try {
    const campaignRecords = await db
      .select({ id: portRecoveryCampaigns.id })
      .from(portRecoveryCampaigns)
      .where(eq(portRecoveryCampaigns.name, PORT_RECOVERY_CAMPAIGN_KEY));
    
    const campaignIds = campaignRecords.map(c => c.id);
    
    if (campaignIds.length === 0) {
      return res.json({
        success: true,
        campaignKey: PORT_RECOVERY_CAMPAIGN_KEY,
        message: 'No campaigns found matching this campaign key',
        totalTransactions: 0,
        uniqueCustomers: 0,
        correctlyAwarded: { count: 0, totalPoints: 0 },
        overAwardedCustomers: 0,
        overAwardedDetails: [],
      });
    }

    const txs = await getPortRecoveryTransactionsByCampaignIds(db, campaignIds);

    const byCustomer = new Map<number, { total: number; transactionCount: number }>();

    for (const tx of txs) {
      if (!tx.customerId) continue;
      
      const entry = byCustomer.get(tx.customerId) ?? { total: 0, transactionCount: 0 };
      entry.total += tx.amount;
      entry.transactionCount += 1;
      byCustomer.set(tx.customerId, entry);
    }

    const overAwardedCustomers: Array<{ customerId: number; total: number; excess: number; transactionCount: number }> = [];
    const correctlyAwardedCount = { count: 0, totalPoints: 0 };

    for (const [customerId, info] of byCustomer.entries()) {
      if (info.total > 500) {
        overAwardedCustomers.push({
          customerId,
          total: info.total,
          excess: info.total - 500,
          transactionCount: info.transactionCount,
        });
      } else if (info.total > 0) {
        correctlyAwardedCount.count++;
        correctlyAwardedCount.totalPoints += info.total;
      }
    }

    return res.json({
      success: true,
      campaignKey: PORT_RECOVERY_CAMPAIGN_KEY,
      totalTransactions: txs.length,
      uniqueCustomers: byCustomer.size,
      correctlyAwarded: correctlyAwardedCount,
      overAwardedCustomers: overAwardedCustomers.length,
      overAwardedDetails: overAwardedCustomers,
    });
  } catch (error) {
    console.error('[LOYALTY STATUS] Error fetching port-recovery status:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch port-recovery status',
      error: errorMsg,
    });
  }
});

export default router;
