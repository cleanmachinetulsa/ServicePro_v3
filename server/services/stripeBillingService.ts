/**
 * Phase 2.3 - Stripe Billing Service
 * 
 * Handles SaaS billing operations for tenants:
 * - Stripe customer creation and management
 * - Monthly invoice generation from usage rollups
 * - Invoice status tracking and Stripe sync
 * 
 * Separate from customer-facing payment processing (Stripe payment intents for appointments)
 */

import Stripe from 'stripe';
import { db } from '../db';
import { tenants, tenantInvoices, usageRollupsDaily } from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { stripe, isStripeConfigured, getTierDisplayName } from './stripeService';
import { calculateUsageCost, usagePricing } from '@shared/pricing/usagePricing';

const STRIPE_ENABLED = isStripeConfigured();

interface PlanPricing {
  monthlyPriceCents: number;
  name: string;
}

const PLAN_PRICING: Record<string, PlanPricing> = {
  free: { monthlyPriceCents: 0, name: 'Free' },
  starter: { monthlyPriceCents: 3900, name: 'Starter' },
  pro: { monthlyPriceCents: 8900, name: 'Pro' },
  elite: { monthlyPriceCents: 19900, name: 'Elite' },
  internal: { monthlyPriceCents: 0, name: 'Internal' },
};

export interface TenantBillingInfo {
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planTier: string;
  status: string;
  overdueDays: number;
  billingStatusSince: Date | null;
}

export interface UsageSummary {
  smsTotal: number;
  mmsTotal: number;
  voiceMinutes: number;
  emailTotal: number;
  aiTokens: number;
  estimatedCostCents: number;
}

export interface MonthlyInvoiceData {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  subscriptionAmount: number;
  usageAmount: number;
  discountAmount: number;
  totalAmount: number;
  usageBreakdown: {
    smsTotal: number;
    mmsTotal: number;
    voiceMinutes: number;
    emailTotal: number;
    aiTokens: number;
    smsCost: number;
    mmsCost: number;
    voiceCost: number;
    emailCost: number;
    aiCost: number;
  };
}

/**
 * Ensure a tenant has a Stripe customer ID
 * Creates one if not present
 */
export async function ensureStripeCustomer(tenantId: string): Promise<string | null> {
  if (!stripe) {
    console.warn('[STRIPE BILLING] Stripe not configured - cannot create customer');
    return null;
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  try {
    const customer = await stripe.customers.create({
      name: tenant.name,
      metadata: {
        tenantId: tenant.id,
        planTier: tenant.planTier,
      },
    });

    await db.update(tenants)
      .set({ 
        stripeCustomerId: customer.id,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    console.log(`[STRIPE BILLING] Created Stripe customer ${customer.id} for tenant ${tenantId}`);
    return customer.id;
  } catch (error) {
    console.error(`[STRIPE BILLING] Failed to create Stripe customer for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Get tenant billing information
 */
export async function getTenantBillingInfo(tenantId: string): Promise<TenantBillingInfo | null> {
  const [tenant] = await db.select({
    tenantId: tenants.id,
    stripeCustomerId: tenants.stripeCustomerId,
    stripeSubscriptionId: tenants.stripeSubscriptionId,
    planTier: tenants.planTier,
    status: tenants.status,
    overdueDays: tenants.overdueDays,
    billingStatusSince: tenants.billingStatusSince,
  }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant) {
    return null;
  }

  return {
    tenantId: tenant.tenantId,
    stripeCustomerId: tenant.stripeCustomerId,
    stripeSubscriptionId: tenant.stripeSubscriptionId,
    planTier: tenant.planTier,
    status: tenant.status,
    overdueDays: tenant.overdueDays,
    billingStatusSince: tenant.billingStatusSince,
  };
}

/**
 * Calculate usage for a billing period
 */
export async function calculatePeriodUsage(
  tenantId: string,
  periodStart: string,
  periodEnd: string
): Promise<UsageSummary> {
  const result = await db
    .select({
      smsTotal: sql<number>`COALESCE(SUM(sms_total), 0)`,
      mmsTotal: sql<number>`COALESCE(SUM(mms_total), 0)`,
      voiceMinutes: sql<number>`COALESCE(SUM(voice_total_minutes), 0)`,
      emailTotal: sql<number>`COALESCE(SUM(email_total), 0)`,
      aiTokens: sql<number>`COALESCE(SUM(ai_total_tokens), 0)`,
    })
    .from(usageRollupsDaily)
    .where(and(
      eq(usageRollupsDaily.tenantId, tenantId),
      gte(usageRollupsDaily.date, periodStart),
      lte(usageRollupsDaily.date, periodEnd)
    ));

  const usage = result[0] || { smsTotal: 0, mmsTotal: 0, voiceMinutes: 0, emailTotal: 0, aiTokens: 0 };
  
  const estimatedCost = calculateUsageCost({
    smsTotal: Number(usage.smsTotal) || 0,
    mmsTotal: Number(usage.mmsTotal) || 0,
    voiceTotalMinutes: Number(usage.voiceMinutes) || 0,
    emailTotal: Number(usage.emailTotal) || 0,
    aiTotalTokens: Number(usage.aiTokens) || 0,
  });

  return {
    smsTotal: Number(usage.smsTotal) || 0,
    mmsTotal: Number(usage.mmsTotal) || 0,
    voiceMinutes: Number(usage.voiceMinutes) || 0,
    emailTotal: Number(usage.emailTotal) || 0,
    aiTokens: Number(usage.aiTokens) || 0,
    estimatedCostCents: Math.round(estimatedCost * 100),
  };
}

/**
 * Generate invoice data for a billing period
 */
export async function generateInvoiceData(
  tenantId: string,
  periodStart: string,
  periodEnd: string
): Promise<MonthlyInvoiceData> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const planPricing = PLAN_PRICING[tenant.planTier] || PLAN_PRICING.starter;
  const usage = await calculatePeriodUsage(tenantId, periodStart, periodEnd);

  const smsCost = Math.round(usage.smsTotal * usagePricing.smsPerMessage * 100);
  const mmsCost = Math.round(usage.mmsTotal * usagePricing.mmsPerMessage * 100);
  const voiceCost = Math.round(usage.voiceMinutes * usagePricing.voicePerMinute * 100);
  const emailCost = Math.round(usage.emailTotal * usagePricing.emailPerMessage * 100);
  const aiCost = Math.round(usage.aiTokens * ((usagePricing.aiTokenIn + usagePricing.aiTokenOut) / 2) * 100);

  const usageAmount = smsCost + mmsCost + voiceCost + emailCost + aiCost;
  const subscriptionAmount = planPricing.monthlyPriceCents;
  const discountAmount = 0;
  const totalAmount = subscriptionAmount + usageAmount - discountAmount;

  return {
    tenantId,
    periodStart,
    periodEnd,
    subscriptionAmount,
    usageAmount,
    discountAmount,
    totalAmount,
    usageBreakdown: {
      smsTotal: usage.smsTotal,
      mmsTotal: usage.mmsTotal,
      voiceMinutes: usage.voiceMinutes,
      emailTotal: usage.emailTotal,
      aiTokens: usage.aiTokens,
      smsCost,
      mmsCost,
      voiceCost,
      emailCost,
      aiCost,
    },
  };
}

/**
 * Create a tenant invoice in the database
 */
export async function createTenantInvoice(data: MonthlyInvoiceData): Promise<number> {
  const dueDate = new Date(data.periodEnd);
  dueDate.setDate(dueDate.getDate() + 14);

  const [invoice] = await db.insert(tenantInvoices).values({
    tenantId: data.tenantId,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    subscriptionAmount: data.subscriptionAmount,
    usageAmount: data.usageAmount,
    discountAmount: data.discountAmount,
    totalAmount: data.totalAmount,
    status: 'draft',
    dueDate: dueDate.toISOString().split('T')[0],
    usageBreakdown: data.usageBreakdown,
  }).returning({ id: tenantInvoices.id });

  return invoice.id;
}

/**
 * Create Stripe invoice and charge the customer
 */
export async function createAndChargeStripeInvoice(invoiceId: number): Promise<{
  success: boolean;
  stripeInvoiceId?: string;
  hostedUrl?: string;
  pdfUrl?: string;
  error?: string;
}> {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  const [invoice] = await db.select().from(tenantInvoices).where(eq(tenantInvoices.id, invoiceId)).limit(1);
  
  if (!invoice) {
    return { success: false, error: 'Invoice not found' };
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, invoice.tenantId)).limit(1);
  
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  const stripeCustomerId = await ensureStripeCustomer(invoice.tenantId);
  if (!stripeCustomerId) {
    return { success: false, error: 'Failed to create Stripe customer' };
  }

  try {
    const planPricing = PLAN_PRICING[tenant.planTier] || PLAN_PRICING.starter;

    if (invoice.subscriptionAmount > 0) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        amount: invoice.subscriptionAmount,
        currency: 'usd',
        description: `${planPricing.name} Plan - ${invoice.periodStart} to ${invoice.periodEnd}`,
      });
    }

    if (invoice.usageAmount > 0) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        amount: invoice.usageAmount,
        currency: 'usd',
        description: `Usage charges - ${invoice.periodStart} to ${invoice.periodEnd}`,
      });
    }

    const stripeInvoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: 'charge_automatically',
      auto_advance: true,
      metadata: {
        tenantId: invoice.tenantId,
        invoiceId: String(invoice.id),
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
      },
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id);

    await db.update(tenantInvoices)
      .set({
        stripeInvoiceId: finalizedInvoice.id,
        stripeHostedInvoiceUrl: finalizedInvoice.hosted_invoice_url || undefined,
        stripePdfUrl: finalizedInvoice.invoice_pdf || undefined,
        status: 'open',
        updatedAt: new Date(),
      })
      .where(eq(tenantInvoices.id, invoiceId));

    console.log(`[STRIPE BILLING] Created and finalized Stripe invoice ${finalizedInvoice.id} for tenant ${invoice.tenantId}`);

    return {
      success: true,
      stripeInvoiceId: finalizedInvoice.id,
      hostedUrl: finalizedInvoice.hosted_invoice_url || undefined,
      pdfUrl: finalizedInvoice.invoice_pdf || undefined,
    };
  } catch (error) {
    console.error(`[STRIPE BILLING] Failed to create Stripe invoice:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get recent invoices for a tenant
 */
export async function getTenantInvoices(tenantId: string, limit: number = 6): Promise<typeof tenantInvoices.$inferSelect[]> {
  return db.select()
    .from(tenantInvoices)
    .where(eq(tenantInvoices.tenantId, tenantId))
    .orderBy(desc(tenantInvoices.createdAt))
    .limit(limit);
}

/**
 * Get Stripe billing portal URL for a tenant
 */
export async function getBillingPortalUrl(tenantId: string, returnUrl: string): Promise<string | null> {
  if (!stripe) {
    return null;
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  
  if (!tenant?.stripeCustomerId) {
    return null;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  } catch (error) {
    console.error(`[STRIPE BILLING] Failed to create billing portal session:`, error);
    return null;
  }
}

/**
 * Update invoice status from Stripe webhook
 */
export async function updateInvoiceFromStripe(
  stripeInvoiceId: string,
  status: 'paid' | 'past_due' | 'uncollectible' | 'void',
  paymentIntentId?: string
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (paymentIntentId) {
    updateData.stripePaymentIntentId = paymentIntentId;
  }

  if (status === 'paid') {
    updateData.paidAt = new Date();
  }

  await db.update(tenantInvoices)
    .set(updateData)
    .where(eq(tenantInvoices.stripeInvoiceId, stripeInvoiceId));

  console.log(`[STRIPE BILLING] Updated invoice ${stripeInvoiceId} status to ${status}`);
}

/**
 * Get all tenants with billing info for admin dashboard
 */
export async function getAllTenantsBillingInfo(): Promise<{
  tenantId: string;
  name: string;
  planTier: string;
  status: string;
  stripeCustomerId: string | null;
  overdueDays: number;
  lastInvoiceStatus: string | null;
  lastInvoiceAmount: number | null;
}[]> {
  const tenantsData = await db.select({
    tenantId: tenants.id,
    name: tenants.name,
    planTier: tenants.planTier,
    status: tenants.status,
    stripeCustomerId: tenants.stripeCustomerId,
    overdueDays: tenants.overdueDays,
    lastInvoiceStatus: tenants.lastInvoiceStatus,
  }).from(tenants);

  const result = await Promise.all(tenantsData.map(async (tenant) => {
    const [lastInvoice] = await db.select({
      totalAmount: tenantInvoices.totalAmount,
    })
    .from(tenantInvoices)
    .where(eq(tenantInvoices.tenantId, tenant.tenantId))
    .orderBy(desc(tenantInvoices.createdAt))
    .limit(1);

    return {
      ...tenant,
      lastInvoiceAmount: lastInvoice?.totalAmount || null,
    };
  }));

  return result;
}

/**
 * SP-20: Add-On Billing Integration
 * 
 * Attach an add-on price to a tenant's subscription
 */
export async function attachAddonPriceToSubscription(
  subscriptionId: string,
  priceId: string,
  addonKey: string,
  quantity: number = 1
): Promise<{ success: boolean; subscriptionItemId?: string; error?: string }> {
  if (!stripe) {
    console.warn('[STRIPE BILLING] Stripe not configured - cannot attach add-on');
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const subscriptionItem = await stripe.subscriptionItems.create({
      subscription: subscriptionId,
      price: priceId,
      quantity: quantity,
      metadata: {
        addonKey: addonKey,
        type: 'addon',
      },
    });

    console.log(`[STRIPE BILLING] Attached add-on ${addonKey} to subscription ${subscriptionId}: item ${subscriptionItem.id}`);
    
    return { 
      success: true, 
      subscriptionItemId: subscriptionItem.id 
    };
  } catch (error: any) {
    console.error(`[STRIPE BILLING] Failed to attach add-on ${addonKey}:`, error?.message || error);
    return { 
      success: false, 
      error: error?.message || 'Failed to attach add-on to subscription' 
    };
  }
}

/**
 * SP-20: Detach an add-on price from a tenant's subscription
 */
export async function detachAddonPriceFromSubscription(
  subscriptionItemId: string,
  addonKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    console.warn('[STRIPE BILLING] Stripe not configured - cannot detach add-on');
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    await stripe.subscriptionItems.del(subscriptionItemId, {
      proration_behavior: 'create_prorations',
    });

    console.log(`[STRIPE BILLING] Detached add-on ${addonKey} subscription item ${subscriptionItemId}`);
    
    return { success: true };
  } catch (error: any) {
    console.error(`[STRIPE BILLING] Failed to detach add-on ${addonKey}:`, error?.message || error);
    return { 
      success: false, 
      error: error?.message || 'Failed to detach add-on from subscription' 
    };
  }
}

/**
 * SP-20: Update add-on quantity on a subscription
 */
export async function updateAddonQuantity(
  subscriptionItemId: string,
  quantity: number,
  addonKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    console.warn('[STRIPE BILLING] Stripe not configured - cannot update add-on');
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    await stripe.subscriptionItems.update(subscriptionItemId, {
      quantity: quantity,
      proration_behavior: 'create_prorations',
    });

    console.log(`[STRIPE BILLING] Updated add-on ${addonKey} quantity to ${quantity}`);
    
    return { success: true };
  } catch (error: any) {
    console.error(`[STRIPE BILLING] Failed to update add-on ${addonKey} quantity:`, error?.message || error);
    return { 
      success: false, 
      error: error?.message || 'Failed to update add-on quantity' 
    };
  }
}

console.log(`[STRIPE BILLING SERVICE] Initialized - Stripe ${STRIPE_ENABLED ? 'enabled' : 'disabled'}`);
