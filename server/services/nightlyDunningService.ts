/**
 * Phase 2.3 - Nightly Dunning Service
 * 
 * Runs nightly to:
 * - Increment overdue_days for tenants with unpaid invoices
 * - Send payment reminder emails at specific thresholds
 * - Auto-suspend tenants at 30 days overdue
 * - Restrict admin login at 45 days overdue
 */

import cron from 'node-cron';
import { db } from '../db';
import { tenants, tenantInvoices, tenantConfig } from '@shared/schema';
import { eq, and, ne, sql, or, inArray } from 'drizzle-orm';
import { sendBusinessEmail } from '../emailService';

let dunningSchedulerInitialized = false;

const REMINDER_THRESHOLD_DAYS = 14;
const SUSPENSION_THRESHOLD_DAYS = 30;
const LOGIN_RESTRICTION_THRESHOLD_DAYS = 45;

interface DunningResult {
  tenantsProcessed: number;
  remindersSet: number;
  suspended: number;
  loginRestricted: number;
  emailsSent: number;
  errors: string[];
}

/**
 * Run nightly dunning process
 */
export async function runNightlyDunning(): Promise<DunningResult> {
  console.log('[DUNNING] Starting nightly dunning process');

  const result: DunningResult = {
    tenantsProcessed: 0,
    remindersSet: 0,
    suspended: 0,
    loginRestricted: 0,
    emailsSent: 0,
    errors: [],
  };

  try {
    const overdueInvoices = await db.select({
      tenantId: tenantInvoices.tenantId,
      invoiceId: tenantInvoices.id,
      dueDate: tenantInvoices.dueDate,
      totalAmount: tenantInvoices.totalAmount,
    })
    .from(tenantInvoices)
    .where(or(
      eq(tenantInvoices.status, 'open'),
      eq(tenantInvoices.status, 'past_due')
    ));

    const tenantOverdueMap = new Map<string, { maxOverdueDays: number; totalDue: number }>();

    for (const invoice of overdueInvoices) {
      const dueDate = new Date(invoice.dueDate);
      const now = new Date();
      const daysSinceDue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      const existing = tenantOverdueMap.get(invoice.tenantId) || { maxOverdueDays: 0, totalDue: 0 };
      tenantOverdueMap.set(invoice.tenantId, {
        maxOverdueDays: Math.max(existing.maxOverdueDays, daysSinceDue),
        totalDue: existing.totalDue + (invoice.totalAmount || 0),
      });
    }

    const allTenants = await db.select()
      .from(tenants)
      .where(ne(tenants.status, 'cancelled'));

    for (const tenant of allTenants) {
      result.tenantsProcessed++;
      const overdueInfo = tenantOverdueMap.get(tenant.id);

      if (!overdueInfo || overdueInfo.maxOverdueDays === 0) {
        if (tenant.overdueDays > 0) {
          await db.update(tenants)
            .set({ overdueDays: 0, updatedAt: new Date() })
            .where(eq(tenants.id, tenant.id));
        }
        continue;
      }

      const previousOverdueDays = tenant.overdueDays;
      const newOverdueDays = overdueInfo.maxOverdueDays;

      await db.update(tenants)
        .set({ 
          overdueDays: newOverdueDays,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenant.id));

      const tenantConfigData = await db.select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenant.id))
        .limit(1);
      
      const email = tenantConfigData[0]?.primaryContactEmail;

      if (previousOverdueDays < REMINDER_THRESHOLD_DAYS && newOverdueDays >= REMINDER_THRESHOLD_DAYS) {
        result.remindersSet++;
        
        if (email) {
          try {
            await sendPaymentReminderEmail(email, tenant.name, overdueInfo.totalDue / 100, newOverdueDays);
            result.emailsSent++;
          } catch (error) {
            result.errors.push(`Failed to send reminder email to ${tenant.id}: ${error}`);
          }
        }
      }

      if (previousOverdueDays < SUSPENSION_THRESHOLD_DAYS && newOverdueDays >= SUSPENSION_THRESHOLD_DAYS) {
        result.suspended++;
        
        await db.update(tenants)
          .set({ 
            status: 'suspended',
            billingStatusSince: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenant.id));

        console.log(`[DUNNING] Suspended tenant ${tenant.id} after ${newOverdueDays} days overdue`);

        if (email) {
          try {
            await sendAccountSuspendedEmail(email, tenant.name, overdueInfo.totalDue / 100);
            result.emailsSent++;
          } catch (error) {
            result.errors.push(`Failed to send suspension email to ${tenant.id}: ${error}`);
          }
        }
      }

      if (newOverdueDays >= LOGIN_RESTRICTION_THRESHOLD_DAYS) {
        result.loginRestricted++;
        console.log(`[DUNNING] Tenant ${tenant.id} has login restrictions at ${newOverdueDays} days overdue`);
      }
    }

  } catch (error) {
    console.error('[DUNNING] Critical error:', error);
    result.errors.push(`Critical error: ${error}`);
  }

  console.log(`[DUNNING] Completed: ${result.tenantsProcessed} processed, ${result.remindersSet} reminders, ${result.suspended} suspended, ${result.errors.length} errors`);
  return result;
}

/**
 * Send payment reminder email
 */
async function sendPaymentReminderEmail(
  email: string,
  tenantName: string,
  amountDue: number,
  daysOverdue: number
): Promise<void> {
  const subject = `Payment Reminder - ServicePro Account`;
  const textContent = `Payment Reminder - Your ServicePro account has an outstanding balance of $${amountDue.toFixed(2)} that is ${daysOverdue} days past due. Please update your payment method to avoid service interruption.`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d97706;">Payment Reminder</h2>
      <p>Hello ${tenantName},</p>
      <p>Your ServicePro account has an outstanding balance of <strong>$${amountDue.toFixed(2)}</strong> that is ${daysOverdue} days past due.</p>
      <p>To avoid service interruption, please update your payment method or pay your outstanding balance as soon as possible.</p>
      <p>You can manage your billing and payment methods in your <a href="https://serviceproapp.com/admin/billing">Billing Dashboard</a>.</p>
      <p>If you have any questions, please contact our support team.</p>
      <p>Best regards,<br>The ServicePro Team</p>
    </div>
  `;
  await sendBusinessEmail(email, subject, textContent, htmlContent);
}

/**
 * Send account suspended email
 */
async function sendAccountSuspendedEmail(
  email: string,
  tenantName: string,
  amountDue: number
): Promise<void> {
  const subject = `Account Suspended - ServicePro`;
  const textContent = `Account Suspended - Your ServicePro account has been suspended due to an outstanding balance of $${amountDue.toFixed(2)}. Please pay your balance to restore services.`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Account Suspended</h2>
      <p>Hello ${tenantName},</p>
      <p>Your ServicePro account has been suspended due to an outstanding balance of <strong>$${amountDue.toFixed(2)}</strong> that is more than 30 days past due.</p>
      <p><strong>What this means:</strong></p>
      <ul>
        <li>Outbound SMS and voice services are disabled</li>
        <li>New appointments cannot be scheduled</li>
        <li>Your public site remains accessible</li>
      </ul>
      <p>To restore your account, please pay your outstanding balance immediately through your <a href="https://serviceproapp.com/admin/billing">Billing Dashboard</a>.</p>
      <p>If you need assistance or have questions about your account, please contact our support team.</p>
      <p>Best regards,<br>The ServicePro Team</p>
    </div>
  `;
  await sendBusinessEmail(email, subject, textContent, htmlContent);
}

/**
 * Check if a tenant has login restrictions due to severe overdue status
 */
export async function hasLoginRestrictions(tenantId: string): Promise<boolean> {
  const [tenant] = await db.select({ overdueDays: tenants.overdueDays })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return (tenant?.overdueDays || 0) >= LOGIN_RESTRICTION_THRESHOLD_DAYS;
}

/**
 * Get dunning status for a tenant
 */
export async function getTenantDunningStatus(tenantId: string): Promise<{
  overdueDays: number;
  isOverdue: boolean;
  hasReminder: boolean;
  isSuspended: boolean;
  hasLoginRestrictions: boolean;
}> {
  const [tenant] = await db.select({ 
    overdueDays: tenants.overdueDays,
    status: tenants.status,
  })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const overdueDays = tenant?.overdueDays || 0;

  return {
    overdueDays,
    isOverdue: overdueDays > 0,
    hasReminder: overdueDays >= REMINDER_THRESHOLD_DAYS,
    isSuspended: tenant?.status === 'suspended' || overdueDays >= SUSPENSION_THRESHOLD_DAYS,
    hasLoginRestrictions: overdueDays >= LOGIN_RESTRICTION_THRESHOLD_DAYS,
  };
}

/**
 * Initialize the nightly dunning scheduler
 * Runs every night at 2:00 AM UTC
 */
export function initializeNightlyDunningScheduler() {
  if (dunningSchedulerInitialized) {
    console.log('[DUNNING] Scheduler already initialized, skipping...');
    return;
  }

  cron.schedule('0 2 * * *', async () => {
    console.log('[DUNNING] Running scheduled nightly dunning process');
    try {
      await runNightlyDunning();
    } catch (error) {
      console.error('[DUNNING] Scheduler error:', error);
    }
  }, {
    timezone: 'UTC'
  });

  dunningSchedulerInitialized = true;
  console.log('[DUNNING] Scheduler initialized - runs nightly at 2:00 AM UTC');
}
