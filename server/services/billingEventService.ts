/**
 * SP-19: Billing Event Service
 * 
 * Records billing events to the audit table for tracking and analysis.
 */

import { db } from '../db';
import { billingEvents } from '@shared/schema';
import type { InsertBillingEvent } from '@shared/schema';

const LOG_PREFIX = '[BILLING EVENTS]';

type BillingEventType = 
  | 'invoice_created'
  | 'invoice_paid'
  | 'invoice_past_due'
  | 'payment_failed'
  | 'payment_recovered'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'tenant_suspended'
  | 'tenant_reactivated'
  | 'plan_upgraded'
  | 'plan_downgraded';

export interface LogBillingEventParams {
  tenantId: string;
  eventType: BillingEventType;
  stripeEventId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  previousStatus?: string;
  newStatus?: string;
  previousPlan?: string;
  newPlan?: string;
  amountCents?: number;
  meta?: Record<string, any>;
}

/**
 * Log a billing event to the audit table
 */
export async function logBillingEvent(params: LogBillingEventParams): Promise<void> {
  try {
    const insertData: InsertBillingEvent = {
      tenantId: params.tenantId,
      eventType: params.eventType,
      stripeEventId: params.stripeEventId || null,
      stripeCustomerId: params.stripeCustomerId || null,
      stripeSubscriptionId: params.stripeSubscriptionId || null,
      stripeInvoiceId: params.stripeInvoiceId || null,
      previousStatus: params.previousStatus || null,
      newStatus: params.newStatus || null,
      previousPlan: params.previousPlan || null,
      newPlan: params.newPlan || null,
      amountCents: params.amountCents || null,
      meta: params.meta || null,
      occurredAt: new Date(),
    };

    await db.insert(billingEvents).values(insertData);

    console.log(`${LOG_PREFIX} Logged ${params.eventType} for tenant ${params.tenantId}`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to log billing event:`, error);
  }
}

/**
 * Log a payment failed event
 */
export async function logPaymentFailed(
  tenantId: string,
  stripeCustomerId: string,
  stripeInvoiceId: string,
  previousStatus: string,
  amountCents?: number,
  meta?: Record<string, any>
): Promise<void> {
  await logBillingEvent({
    tenantId,
    eventType: 'payment_failed',
    stripeCustomerId,
    stripeInvoiceId,
    previousStatus,
    newStatus: 'past_due',
    amountCents,
    meta,
  });
}

/**
 * Log a payment recovered event
 */
export async function logPaymentRecovered(
  tenantId: string,
  stripeCustomerId: string,
  stripeInvoiceId: string,
  previousStatus: string,
  amountCents?: number,
  meta?: Record<string, any>
): Promise<void> {
  await logBillingEvent({
    tenantId,
    eventType: 'payment_recovered',
    stripeCustomerId,
    stripeInvoiceId,
    previousStatus,
    newStatus: 'active',
    amountCents,
    meta,
  });
}

/**
 * Log a tenant suspended event
 */
export async function logTenantSuspended(
  tenantId: string,
  stripeCustomerId?: string,
  previousStatus?: string,
  meta?: Record<string, any>
): Promise<void> {
  await logBillingEvent({
    tenantId,
    eventType: 'tenant_suspended',
    stripeCustomerId,
    previousStatus,
    newStatus: 'suspended',
    meta,
  });
}

/**
 * Log a tenant reactivated event
 */
export async function logTenantReactivated(
  tenantId: string,
  stripeCustomerId?: string,
  previousStatus?: string,
  meta?: Record<string, any>
): Promise<void> {
  await logBillingEvent({
    tenantId,
    eventType: 'tenant_reactivated',
    stripeCustomerId,
    previousStatus,
    newStatus: 'active',
    meta,
  });
}

/**
 * Log a subscription change event
 */
export async function logSubscriptionChange(
  tenantId: string,
  eventType: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled',
  stripeSubscriptionId: string,
  previousPlan?: string,
  newPlan?: string,
  meta?: Record<string, any>
): Promise<void> {
  await logBillingEvent({
    tenantId,
    eventType,
    stripeSubscriptionId,
    previousPlan,
    newPlan,
    meta,
  });
}

/**
 * Log a plan change event
 */
export async function logPlanChange(
  tenantId: string,
  previousPlan: string,
  newPlan: string,
  stripeSubscriptionId?: string,
  meta?: Record<string, any>
): Promise<void> {
  const isUpgrade = getPlanWeight(newPlan) > getPlanWeight(previousPlan);
  
  await logBillingEvent({
    tenantId,
    eventType: isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
    stripeSubscriptionId,
    previousPlan,
    newPlan,
    meta,
  });
}

/**
 * Get plan weight for comparison
 */
function getPlanWeight(plan: string): number {
  const weights: Record<string, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    elite: 3,
    enterprise: 4,
    internal: 10,
  };
  return weights[plan] || 0;
}
