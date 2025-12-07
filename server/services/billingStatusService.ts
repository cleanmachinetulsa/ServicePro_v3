/**
 * Billing Status Service (SP-6)
 * 
 * Manages tenant billing status, Stripe state mapping, and suspension logic.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { tenants, tenantConfig } from '@shared/schema';
import { sendTenantEmail } from './tenantEmailService';
import { createTenantDb } from '../tenantDb';

export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';

const SUSPENSION_GRACE_PERIOD_DAYS = 14;

/**
 * Maps Stripe subscription and invoice status to internal billing status
 */
export function mapStripeToBillingStatus(
  subscriptionStatus: string | null,
  invoiceStatus: string | null,
  isTrial: boolean
): BillingStatus {
  if (isTrial) return 'trialing';
  if (!subscriptionStatus) return 'cancelled';

  if (subscriptionStatus === 'active') {
    if (invoiceStatus === 'past_due' || invoiceStatus === 'open') return 'past_due';
    return 'active';
  }

  if (subscriptionStatus === 'trialing') return 'trialing';
  if (subscriptionStatus === 'past_due') return 'past_due';
  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'unpaid') return 'cancelled';
  if (subscriptionStatus === 'incomplete' || subscriptionStatus === 'incomplete_expired') return 'past_due';

  return 'active';
}

/**
 * Check if a tenant should be suspended based on billing status duration
 */
export function shouldSuspendTenant(
  billingStatus: BillingStatus,
  billingStatusSince: Date | null
): boolean {
  if (billingStatus !== 'past_due') return false;
  if (!billingStatusSince) return false;

  const now = new Date();
  const statusAge = now.getTime() - billingStatusSince.getTime();
  const ageDays = Math.floor(statusAge / (1000 * 60 * 60 * 24));

  return ageDays >= SUSPENSION_GRACE_PERIOD_DAYS;
}

export interface UpdateBillingStatusPayload {
  billingStatus: BillingStatus;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  lastInvoiceStatus?: string | null;
  lastInvoiceDueAt?: Date | null;
}

/**
 * Update tenant billing status with automatic status change tracking
 */
export async function updateTenantBillingStatus(
  tenantId: string,
  payload: UpdateBillingStatusPayload
): Promise<{ success: boolean; suspended?: boolean }> {
  try {
    const [existingTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!existingTenant) {
      console.error(`[BILLING STATUS] Tenant ${tenantId} not found`);
      return { success: false };
    }

    const currentStatus = existingTenant.status as BillingStatus;
    const newStatus = payload.billingStatus;
    const statusChanged = currentStatus !== newStatus;

    const updateData: Record<string, any> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (statusChanged) {
      updateData.billingStatusSince = new Date();
    }

    if (payload.cancelAtPeriodEnd !== undefined) {
      updateData.cancelAtPeriodEnd = payload.cancelAtPeriodEnd;
    }

    if (payload.stripeCustomerId !== undefined) {
      updateData.stripeCustomerId = payload.stripeCustomerId;
    }

    if (payload.stripeSubscriptionId !== undefined) {
      updateData.stripeSubscriptionId = payload.stripeSubscriptionId;
    }

    if (payload.lastInvoiceStatus !== undefined) {
      updateData.lastInvoiceStatus = payload.lastInvoiceStatus;
    }

    if (payload.lastInvoiceDueAt !== undefined) {
      updateData.lastInvoiceDueAt = payload.lastInvoiceDueAt;
    }

    await db.update(tenants).set(updateData).where(eq(tenants.id, tenantId));

    console.log(`[BILLING STATUS] Updated tenant ${tenantId}: ${currentStatus} → ${newStatus}`);

    return { success: true, suspended: newStatus === 'suspended' };
  } catch (error) {
    console.error(`[BILLING STATUS] Error updating tenant ${tenantId}:`, error);
    return { success: false };
  }
}

/**
 * Check tenant billing status and apply suspension if needed
 */
export async function checkAndApplySuspension(tenantId: string): Promise<boolean> {
  try {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      console.error(`[BILLING STATUS] Tenant ${tenantId} not found for suspension check`);
      return false;
    }

    const currentStatus = tenant.status as BillingStatus;
    const billingStatusSince = tenant.billingStatusSince;

    if (shouldSuspendTenant(currentStatus, billingStatusSince)) {
      await updateTenantBillingStatus(tenantId, { billingStatus: 'suspended' });

      await sendAccountSuspendedEmail(tenantId);

      console.log(`[BILLING STATUS] Tenant ${tenantId} suspended after ${SUSPENSION_GRACE_PERIOD_DAYS} days past_due`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[BILLING STATUS] Error checking suspension for tenant ${tenantId}:`, error);
    return false;
  }
}

/**
 * Get tenant billing info for display
 */
export async function getTenantBillingInfo(tenantId: string): Promise<{
  status: BillingStatus;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  billingStatusSince: Date | null;
} | null> {
  try {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) return null;

    return {
      status: tenant.status as BillingStatus,
      cancelAtPeriodEnd: tenant.cancelAtPeriodEnd,
      hasStripeCustomer: !!tenant.stripeCustomerId,
      hasSubscription: !!tenant.stripeSubscriptionId,
      billingStatusSince: tenant.billingStatusSince,
    };
  } catch (error) {
    console.error(`[BILLING STATUS] Error fetching billing info for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Send payment failed email to tenant owner
 */
export async function sendPaymentFailedEmail(tenantId: string): Promise<void> {
  try {
    const [config] = await db
      .select({
        businessName: tenantConfig.businessName,
        ownerEmail: tenantConfig.primaryContactEmail,
      })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    if (!config?.ownerEmail) {
      console.warn(`[BILLING DUNNING] No owner email found for tenant ${tenantId}`);
      return;
    }

    const tenantDb = createTenantDb({ id: tenantId, name: config.businessName || 'Your Business', subdomain: null, isRoot: false });

    const subject = 'Action Required: Payment Failed';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Payment Failed</h2>
        <p>Hi there,</p>
        <p>We weren't able to process your recent payment for <strong>${config.businessName}</strong>.</p>
        <p>To avoid any interruption to your service, please update your payment method as soon as possible.</p>
        <div style="margin: 24px 0;">
          <a href="${process.env.APP_URL || 'https://serviceproapp.com'}/settings/billing" 
             style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Update Payment Method
          </a>
        </div>
        <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
        <p>Thanks,<br>The ServicePro Team</p>
      </div>
    `;

    await sendTenantEmail(tenantDb, tenantId, {
      to: config.ownerEmail,
      subject,
      html,
      category: 'billing_dunning',
    });

    console.log(`[BILLING DUNNING] Payment failed email sent to ${config.ownerEmail} for tenant ${tenantId}`);
  } catch (error) {
    console.error(`[BILLING DUNNING] Error sending payment failed email for tenant ${tenantId}:`, error);
  }
}

/**
 * Send account suspended email to tenant owner
 */
export async function sendAccountSuspendedEmail(tenantId: string): Promise<void> {
  try {
    const [config] = await db
      .select({
        businessName: tenantConfig.businessName,
        ownerEmail: tenantConfig.primaryContactEmail,
      })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    if (!config?.ownerEmail) {
      console.warn(`[BILLING DUNNING] No owner email found for tenant ${tenantId}`);
      return;
    }

    const tenantDb = createTenantDb({ id: tenantId, name: config.businessName || 'Your Business', subdomain: null, isRoot: false });

    const subject = 'Your Account Has Been Suspended';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Account Suspended</h2>
        <p>Hi there,</p>
        <p>Your account for <strong>${config.businessName}</strong> has been temporarily suspended due to an unpaid balance.</p>
        <p><strong>Don't worry - your data is safe.</strong> We've paused your account to protect you from additional charges.</p>
        <p>To restore access to your account, please update your payment method:</p>
        <div style="margin: 24px 0;">
          <a href="${process.env.APP_URL || 'https://serviceproapp.com'}/settings/billing" 
             style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Update Payment Method
          </a>
        </div>
        <p>Once your payment is processed, your account will be automatically restored.</p>
        <p>If you have any questions or need assistance, please contact our support team.</p>
        <p>Thanks,<br>The ServicePro Team</p>
      </div>
    `;

    await sendTenantEmail(tenantDb, tenantId, {
      to: config.ownerEmail,
      subject,
      html,
      category: 'billing_dunning',
    });

    console.log(`[BILLING DUNNING] Account suspended email sent to ${config.ownerEmail} for tenant ${tenantId}`);
  } catch (error) {
    console.error(`[BILLING DUNNING] Error sending account suspended email for tenant ${tenantId}:`, error);
  }
}

/**
 * Send payment recovered email to tenant owner
 */
export async function sendPaymentRecoveredEmail(tenantId: string): Promise<void> {
  try {
    const [config] = await db
      .select({
        businessName: tenantConfig.businessName,
        ownerEmail: tenantConfig.primaryContactEmail,
      })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);

    if (!config?.ownerEmail) {
      console.warn(`[BILLING DUNNING] No owner email found for tenant ${tenantId}`);
      return;
    }

    const tenantDb = createTenantDb({ id: tenantId, name: config.businessName || 'Your Business', subdomain: null, isRoot: false });

    const subject = 'Payment Successful - Account Restored';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Your Account Has Been Restored</h2>
        <p>Hi there,</p>
        <p>Great news! Your payment for <strong>${config.businessName}</strong> has been successfully processed.</p>
        <p>Your account is now fully active and all features have been restored.</p>
        <div style="margin: 24px 0;">
          <a href="${process.env.APP_URL || 'https://serviceproapp.com'}/dashboard" 
             style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
        <p>Thank you for your continued business!</p>
        <p>Best regards,<br>The ServicePro Team</p>
      </div>
    `;

    await sendTenantEmail(tenantDb, tenantId, {
      to: config.ownerEmail,
      subject,
      html,
      category: 'billing_dunning',
    });

    console.log(`[BILLING DUNNING] Payment recovered email sent to ${config.ownerEmail} for tenant ${tenantId}`);
  } catch (error) {
    console.error(`[BILLING DUNNING] Error sending payment recovered email for tenant ${tenantId}:`, error);
  }
}
