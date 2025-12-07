/**
 * Phase 2.3 - Monthly Invoice Generator Service
 * 
 * Runs on the 1st of each month to:
 * - Generate invoices from previous month's usage
 * - Create Stripe invoices and auto-charge
 * - Track invoice status
 */

import cron from 'node-cron';
import { db } from '../db';
import { tenants, tenantInvoices } from '@shared/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import {
  generateInvoiceData,
  createTenantInvoice,
  createAndChargeStripeInvoice,
} from './stripeBillingService';

let invoiceSchedulerInitialized = false;

/**
 * Generate invoices for all active tenants for the previous month
 */
export async function generateMonthlyInvoices(): Promise<{
  generated: number;
  charged: number;
  errors: string[];
}> {
  console.log('[INVOICE GENERATOR] Starting monthly invoice generation');

  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodStart = previousMonth.toISOString().split('T')[0];
  
  const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const periodEnd = lastDayOfPrevMonth.toISOString().split('T')[0];

  const activeTenants = await db.select()
    .from(tenants)
    .where(and(
      ne(tenants.status, 'cancelled'),
      ne(tenants.planTier, 'free'),
      ne(tenants.planTier, 'internal')
    ));

  console.log(`[INVOICE GENERATOR] Found ${activeTenants.length} active billable tenants`);

  let generated = 0;
  let charged = 0;
  const errors: string[] = [];

  for (const tenant of activeTenants) {
    try {
      const existingInvoice = await db.select()
        .from(tenantInvoices)
        .where(and(
          eq(tenantInvoices.tenantId, tenant.id),
          eq(tenantInvoices.periodStart, periodStart),
          eq(tenantInvoices.periodEnd, periodEnd)
        ))
        .limit(1);

      if (existingInvoice.length > 0) {
        console.log(`[INVOICE GENERATOR] Invoice already exists for tenant ${tenant.id}, skipping`);
        continue;
      }

      const invoiceData = await generateInvoiceData(tenant.id, periodStart, periodEnd);
      
      if (invoiceData.totalAmount <= 0) {
        console.log(`[INVOICE GENERATOR] Zero-amount invoice for tenant ${tenant.id}, skipping`);
        continue;
      }

      const invoiceId = await createTenantInvoice(invoiceData);
      generated++;
      console.log(`[INVOICE GENERATOR] Created invoice #${invoiceId} for tenant ${tenant.id}: $${(invoiceData.totalAmount / 100).toFixed(2)}`);

      const chargeResult = await createAndChargeStripeInvoice(invoiceId);
      if (chargeResult.success) {
        charged++;
        console.log(`[INVOICE GENERATOR] Charged Stripe invoice ${chargeResult.stripeInvoiceId} for tenant ${tenant.id}`);
      } else {
        errors.push(`Stripe charge failed for tenant ${tenant.id}: ${chargeResult.error}`);
      }
    } catch (error) {
      const errorMsg = `Failed to generate invoice for tenant ${tenant.id}: ${error}`;
      console.error(`[INVOICE GENERATOR] ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  console.log(`[INVOICE GENERATOR] Completed: ${generated} generated, ${charged} charged, ${errors.length} errors`);
  return { generated, charged, errors };
}

/**
 * Manually trigger invoice generation for a specific tenant
 */
export async function generateInvoiceForTenant(
  tenantId: string,
  periodStart: string,
  periodEnd: string
): Promise<{
  success: boolean;
  invoiceId?: number;
  stripeInvoiceId?: string;
  error?: string;
}> {
  try {
    const invoiceData = await generateInvoiceData(tenantId, periodStart, periodEnd);
    
    if (invoiceData.totalAmount <= 0) {
      return { success: false, error: 'Invoice amount is zero' };
    }

    const invoiceId = await createTenantInvoice(invoiceData);
    const chargeResult = await createAndChargeStripeInvoice(invoiceId);

    return {
      success: chargeResult.success,
      invoiceId,
      stripeInvoiceId: chargeResult.stripeInvoiceId,
      error: chargeResult.error,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Initialize the monthly invoice scheduler
 * Runs on the 1st of each month at 6:00 AM UTC
 */
export function initializeInvoiceGeneratorScheduler() {
  if (invoiceSchedulerInitialized) {
    console.log('[INVOICE GENERATOR] Scheduler already initialized, skipping...');
    return;
  }

  cron.schedule('0 6 1 * *', async () => {
    console.log('[INVOICE GENERATOR] Running scheduled monthly invoice generation');
    try {
      await generateMonthlyInvoices();
    } catch (error) {
      console.error('[INVOICE GENERATOR] Scheduler error:', error);
    }
  }, {
    timezone: 'UTC'
  });

  invoiceSchedulerInitialized = true;
  console.log('[INVOICE GENERATOR] Scheduler initialized - runs on 1st of each month at 6:00 AM UTC');
}
