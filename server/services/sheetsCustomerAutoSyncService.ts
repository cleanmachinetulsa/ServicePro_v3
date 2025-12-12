/**
 * SP-SHEETS-AUTO-SYNC - Automatic Google Sheets → Customer DB Sync Service
 * 
 * Provides scheduled synchronization of customer data from Google Sheets
 * to the customer database. Designed to run as a cron job to keep customer
 * data "always live" without manual refresh steps.
 * 
 * Features:
 * - Runs every 15 minutes when enabled
 * - Opt-in via ENABLE_SHEETS_CUSTOMER_AUTO_SYNC env var
 * - Uses existing importCustomersFromSheet (idempotent via findOrCreateCustomer)
 * - Tenant-aware for multi-tenant support
 */

import cron from 'node-cron';
import { importCustomersFromSheet, type CustomerSheetImportSummary } from './customerImportFromSheetsService';
import { db } from '../db';
import { migrationLog } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const LOG_PREFIX = '[SHEETS AUTO-SYNC]';
const MIGRATION_TYPE = 'customers_sheets_import';

const CLEAN_MACHINE_TENANT_ID = 'root';

const AUTO_SYNC_TABS = [
  'Live Client Requests',
  'Customer_Info_Sheet',
  'Customer Information',
  'Customer Database',
];

/**
 * Get the Clean Machine tenant ID
 * Currently hardcoded to 'root' as Clean Machine is the primary/root tenant
 */
export function getCleanMachineTenantId(): string {
  return CLEAN_MACHINE_TENANT_ID;
}

/**
 * Run the Google Sheets customer backfill for a specific tenant
 * Records history to migrationLog with triggerSource in notes
 */
export async function runSheetsCustomerBackfillForTenant(
  tenantId: string,
  triggerSource: 'auto' | 'manual' = 'manual'
): Promise<CustomerSheetImportSummary> {
  console.log(`${LOG_PREFIX} Starting customer backfill for tenant: ${tenantId} (trigger: ${triggerSource})`);
  
  const startedAt = new Date();
  let migrationLogId: number | undefined;
  
  try {
    const [logEntry] = await db
      .insert(migrationLog)
      .values({
        type: MIGRATION_TYPE,
        tenantId,
        startedAt,
        notes: JSON.stringify({ triggerSource, startedAt: startedAt.toISOString() }),
      })
      .returning({ id: migrationLog.id });
    
    migrationLogId = logEntry?.id;
  } catch (err) {
    console.error(`${LOG_PREFIX} Error creating migration log entry:`, err);
  }
  
  try {
    const summary = await importCustomersFromSheet(tenantId, {
      dryRun: false,
      tabNames: AUTO_SYNC_TABS,
    });
    
    if (migrationLogId) {
      await db
        .update(migrationLog)
        .set({
          completedAt: new Date(),
          notes: JSON.stringify({
            triggerSource,
            startedAt: startedAt.toISOString(),
            completedAt: new Date().toISOString(),
            totalRows: summary.totalRows,
            normalizedRows: summary.normalizedRows,
            created: summary.created,
            updated: summary.updated,
            skipped: summary.skipped,
            normalizationFailures: summary.normalizationFailures,
            errorCount: summary.errors.length,
          }),
        })
        .where(eq(migrationLog.id, migrationLogId));
    }
    
    return summary;
  } catch (err: any) {
    if (migrationLogId) {
      await db
        .update(migrationLog)
        .set({
          completedAt: new Date(),
          notes: JSON.stringify({
            triggerSource,
            startedAt: startedAt.toISOString(),
            error: err?.message,
          }),
        })
        .where(eq(migrationLog.id, migrationLogId));
    }
    throw err;
  }
}

/**
 * Get the most recent customers-sheets import for a tenant
 */
export async function getLastCustomersSheetsSync(tenantId: string) {
  const [entry] = await db
    .select()
    .from(migrationLog)
    .where(
      and(
        eq(migrationLog.tenantId, tenantId),
        eq(migrationLog.type, MIGRATION_TYPE)
      )
    )
    .orderBy(desc(migrationLog.startedAt))
    .limit(1);
  
  return entry ?? null;
}

/**
 * Initialize the Google Sheets customer auto-sync scheduler
 * Only runs if ENABLE_SHEETS_CUSTOMER_IMPORT=true
 * Disabled by default to prevent log spam from duplicate key errors
 */
export function initializeSheetsCustomerAutoSync() {
  const isEnabled = process.env.ENABLE_SHEETS_CUSTOMER_IMPORT === 'true';
  
  if (!isEnabled) {
    console.log(`${LOG_PREFIX} Auto-sync DISABLED by default (set ENABLE_SHEETS_CUSTOMER_IMPORT=true to enable)`);
    return;
  }
  
  console.log(`${LOG_PREFIX} Auto-sync ENABLED - scheduling every 15 minutes`);
  
  cron.schedule('*/15 * * * *', async () => {
    try {
      const tenantId = getCleanMachineTenantId();
      if (!tenantId) {
        console.warn(`${LOG_PREFIX} Clean Machine tenantId not found; skipping run.`);
        return;
      }
      
      console.log(`${LOG_PREFIX} Starting customer backfill for Clean Machine...`);
      const summary = await runSheetsCustomerBackfillForTenant(tenantId, 'auto');
      console.log(`${LOG_PREFIX} Completed`, {
        totalRows: summary.totalRows,
        normalizedRows: summary.normalizedRows,
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        normalizationFailures: summary.normalizationFailures,
        errors: summary.errors.length,
      });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error during backfill`, {
        error: err?.message,
        stack: err?.stack,
      });
    }
  }, {
    timezone: 'America/Chicago'
  });
  
  console.log(`${LOG_PREFIX} Scheduler initialized (runs every 15 minutes in America/Chicago timezone)`);
}
