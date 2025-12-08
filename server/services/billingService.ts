/**
 * Billing Service (SP-27)
 * 
 * Central service for tenant subscription management with safe Stripe calls.
 * Provides:
 * - createOrUpdateSubscriptionForTenant - Safe subscription creation
 * - updateTenantDunningState - Manage payment failure tracking
 * - resetTenantDunningState - Clear on successful payment
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { stripe, getPriceIdForTier, isStripeConfigured } from './stripeService';
import { stripeSafeCall, StripeSafeResult } from './stripeSafeCall';

export type PlanKey = 'starter' | 'pro' | 'elite';

export interface SubscriptionResult {
  success: boolean;
  code?: 'MISSING_PRICE_ID' | 'STRIPE_ERROR' | 'TENANT_NOT_FOUND' | 'NOT_CONFIGURED' | 'ALREADY_SUBSCRIBED';
  message?: string;
  subscriptionId?: string;
  customerId?: string;
}

/**
 * Create or update subscription for a tenant
 * Safe wrapper that never throws - returns structured result
 */
export async function createOrUpdateSubscriptionForTenant(
  tenantId: string,
  planKey: PlanKey
): Promise<SubscriptionResult> {
  if (!isStripeConfigured() || !stripe) {
    console.warn(`[BILLING SERVICE] Stripe not configured - cannot create subscription for ${tenantId}`);
    return {
      success: false,
      code: 'NOT_CONFIGURED',
      message: 'Stripe is not configured. Billing features are disabled.',
    };
  }

  let priceId: string;
  try {
    priceId = getPriceIdForTier(planKey);
  } catch (error: any) {
    console.warn(`[BILLING SERVICE] Missing price ID for tier ${planKey}: ${error.message}`);
    return {
      success: false,
      code: 'MISSING_PRICE_ID',
      message: `No Stripe price configured for tier: ${planKey}`,
    };
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) {
    return {
      success: false,
      code: 'TENANT_NOT_FOUND',
      message: `Tenant ${tenantId} not found`,
    };
  }

  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const createResult = await stripeSafeCall(
      () => stripe!.customers.create({
        name: tenant.name,
        metadata: { tenantId: tenant.id },
      }),
      `create customer for ${tenantId}`
    );

    if (!createResult.ok) {
      return {
        success: false,
        code: 'STRIPE_ERROR',
        message: createResult.error,
      };
    }

    customerId = createResult.result!.id;
    await db.update(tenants)
      .set({ stripeCustomerId: customerId })
      .where(eq(tenants.id, tenantId));
  }

  if (tenant.stripeSubscriptionId) {
    const updateResult = await stripeSafeCall(
      async () => {
        const subscription = await stripe!.subscriptions.retrieve(tenant.stripeSubscriptionId!);
        return stripe!.subscriptions.update(tenant.stripeSubscriptionId!, {
          items: [{
            id: subscription.items.data[0]?.id,
            price: priceId,
          }],
          proration_behavior: 'create_prorations',
        });
      },
      `update subscription for ${tenantId}`
    );

    if (!updateResult.ok) {
      return {
        success: false,
        code: 'STRIPE_ERROR',
        message: updateResult.error,
      };
    }

    console.log(`[BILLING SERVICE] Updated subscription ${updateResult.result!.id} for tenant ${tenantId} to ${planKey}`);

    return {
      success: true,
      subscriptionId: updateResult.result!.id,
      customerId,
    };
  }

  const createSubResult = await stripeSafeCall(
    () => stripe!.subscriptions.create({
      customer: customerId!,
      items: [{ price: priceId }],
      metadata: { tenantId },
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    }),
    `create subscription for ${tenantId}`
  );

  if (!createSubResult.ok) {
    return {
      success: false,
      code: 'STRIPE_ERROR',
      message: createSubResult.error,
    };
  }

  await db.update(tenants)
    .set({ stripeSubscriptionId: createSubResult.result!.id })
    .where(eq(tenants.id, tenantId));

  console.log(`[BILLING SERVICE] Created subscription ${createSubResult.result!.id} for tenant ${tenantId} (${planKey})`);

  return {
    success: true,
    subscriptionId: createSubResult.result!.id,
    customerId,
  };
}

/**
 * Increment failed payment attempts for a tenant
 * Called on invoice.payment_failed webhook
 */
export async function incrementFailedAttempts(tenantId: string): Promise<{
  failedAttempts: number;
  shouldSuspend: boolean;
}> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) {
    console.warn(`[BILLING SERVICE] Tenant ${tenantId} not found for failed attempts update`);
    return { failedAttempts: 0, shouldSuspend: false };
  }

  const currentAttempts = tenant.failedPaymentAttempts || 0;
  const newAttempts = currentAttempts + 1;
  const now = new Date();

  const updateData: Record<string, any> = {
    failedPaymentAttempts: newAttempts,
    updatedAt: now,
  };

  if (newAttempts === 1) {
    updateData.delinquentSince = now;
  }

  if (newAttempts >= 3) {
    updateData.status = 'suspended';
    updateData.billingStatusSince = now;
  }

  await db.update(tenants).set(updateData).where(eq(tenants.id, tenantId));

  console.log(`[BILLING SERVICE] Tenant ${tenantId} failed payment attempts: ${newAttempts}${newAttempts >= 3 ? ' (SUSPENDED)' : ''}`);

  return {
    failedAttempts: newAttempts,
    shouldSuspend: newAttempts >= 3,
  };
}

/**
 * Reset failed payment attempts on successful payment
 * Called on invoice.payment_succeeded webhook
 */
export async function resetFailedAttempts(tenantId: string): Promise<void> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) {
    console.warn(`[BILLING SERVICE] Tenant ${tenantId} not found for reset`);
    return;
  }

  const wasSuspended = tenant.status === 'suspended';
  const wasDelinquent = (tenant.failedPaymentAttempts || 0) > 0;

  const updateData: Record<string, any> = {
    failedPaymentAttempts: 0,
    delinquentSince: null,
    updatedAt: new Date(),
  };

  if (wasSuspended) {
    updateData.status = 'active';
    updateData.billingStatusSince = new Date();
  }

  await db.update(tenants).set(updateData).where(eq(tenants.id, tenantId));

  if (wasDelinquent || wasSuspended) {
    console.log(`[BILLING SERVICE] Tenant ${tenantId} dunning state reset${wasSuspended ? ' (reactivated from suspension)' : ''}`);
  }
}

/**
 * Get tenant billing summary for UI display
 */
export async function getTenantBillingSummary(tenantId: string): Promise<{
  planTier: string;
  status: string;
  failedPaymentAttempts: number;
  delinquentSince: Date | null;
  stripeConfigured: boolean;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  billingStatusSince: Date | null;
} | null> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) return null;

  return {
    planTier: tenant.planTier || 'free',
    status: tenant.status || 'active',
    failedPaymentAttempts: tenant.failedPaymentAttempts || 0,
    delinquentSince: tenant.delinquentSince,
    stripeConfigured: isStripeConfigured(),
    hasStripeCustomer: !!tenant.stripeCustomerId,
    hasSubscription: !!tenant.stripeSubscriptionId,
    cancelAtPeriodEnd: tenant.cancelAtPeriodEnd || false,
    billingStatusSince: tenant.billingStatusSince,
  };
}
