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
import { importCustomersFromSheet } from './customerImportFromSheetsService';

const LOG_PREFIX = '[SHEETS AUTO-SYNC]';

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
 */
export async function runSheetsCustomerBackfillForTenant(tenantId: string) {
  console.log(`${LOG_PREFIX} Starting customer backfill for tenant: ${tenantId}`);
  
  const summary = await importCustomersFromSheet(tenantId, {
    dryRun: false,
    tabNames: AUTO_SYNC_TABS,
  });
  
  return summary;
}

/**
 * Initialize the Google Sheets customer auto-sync scheduler
 * Only runs if ENABLE_SHEETS_CUSTOMER_AUTO_SYNC=1
 */
export function initializeSheetsCustomerAutoSync() {
  const isEnabled = process.env.ENABLE_SHEETS_CUSTOMER_AUTO_SYNC === '1';
  
  if (!isEnabled) {
    console.log(`${LOG_PREFIX} Auto-sync DISABLED (set ENABLE_SHEETS_CUSTOMER_AUTO_SYNC=1 to enable)`);
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
      const summary = await runSheetsCustomerBackfillForTenant(tenantId);
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
