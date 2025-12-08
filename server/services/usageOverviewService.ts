import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { tenants } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { calculateUsageCost } from '@shared/pricing/usagePricing';
import { getPlanLimits, type PlanLimits } from '@shared/pricing/planLimits';
import { stripe, isStripeConfigured } from './stripeService';

export type PlanStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'unknown';
export type PlanTier = 'free' | 'starter' | 'pro' | 'elite' | 'internal';

export interface UsageSnapshot {
  smsSentLast30d: number;
  voiceMinutesLast30d: number;
  emailsSentLast30d: number;
  aiRequestsLast30d: number;
}

export interface BillingPeriod {
  startDate: string;
  endDate: string;
  label: string;
}

export interface DailyUsage {
  date: string;
  smsCount: number;
  voiceMinutes: number;
  emailCount: number;
  aiRequests: number;
}

export interface BillingOverview {
  planId: string | null;
  planName: string;
  planTier: string;
  planTierLabel: string;
  status: PlanStatus;
  trialEndsAt: string | null;
  nextRenewalAt: string | null;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  usage: UsageSnapshot;
  estimatedCostLast30d: number;
  planLimits: PlanLimits;
  currentPeriod: BillingPeriod;
  dailyUsage: DailyUsage[];
  // SP-27: Enhanced dunning tracking
  failedPaymentAttempts: number;
  delinquentSince: string | null;
  lastInvoiceStatus: string | null;
}

const tierLabels: Record<PlanTier, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  elite: 'Elite',
  internal: 'Internal',
};

function mapStatusToEnum(status: string | null): PlanStatus {
  switch (status) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'suspended':
      return 'suspended';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export async function getBillingOverview(tenantId: string): Promise<BillingOverview> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }
  
  const now = new Date();
  
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const usageResult = await rootDb.execute(sql`
    SELECT 
      COALESCE(SUM(sms_outbound_count), 0) as sms_sent,
      COALESCE(SUM(sms_outbound_count + sms_inbound_count), 0) as sms_total,
      COALESCE(SUM(mms_outbound_count + mms_inbound_count), 0) as mms_total,
      COALESCE(SUM(voice_minutes), 0) as voice_total,
      COALESCE(SUM(emails_sent), 0) as email_total,
      COALESCE(SUM(ai_tokens_in + ai_tokens_out), 0) as ai_tokens_total
    FROM usage_metrics
    WHERE tenant_id = ${tenantId}
      AND date >= ${periodStart.toISOString().split('T')[0]}::date
      AND date <= ${periodEnd.toISOString().split('T')[0]}::date
  `);
  
  const usageRow = usageResult.rows[0] as any || {};
  
  const smsSent = parseInt(usageRow.sms_sent) || 0;
  const smsTotal = parseInt(usageRow.sms_total) || 0;
  const mmsTotal = parseInt(usageRow.mms_total) || 0;
  const voiceTotal = parseInt(usageRow.voice_total) || 0;
  const emailTotal = parseInt(usageRow.email_total) || 0;
  const aiTokensTotal = parseInt(usageRow.ai_tokens_total) || 0;
  
  const aiRequestsEstimate = Math.ceil(aiTokensTotal / 1000);
  
  const estimatedCost = calculateUsageCost({
    smsTotal,
    mmsTotal,
    voiceTotalMinutes: voiceTotal,
    emailTotal,
    aiTotalTokens: aiTokensTotal,
  });
  
  const dailyUsageResult = await rootDb.execute(sql`
    SELECT 
      date,
      COALESCE(sms_outbound_count + sms_inbound_count, 0) as sms_count,
      COALESCE(voice_minutes, 0) as voice_minutes,
      COALESCE(emails_sent, 0) as email_count,
      COALESCE(CEIL((ai_tokens_in + ai_tokens_out) / 1000.0), 0) as ai_requests
    FROM usage_metrics
    WHERE tenant_id = ${tenantId}
      AND date >= ${thirtyDaysAgo.toISOString().split('T')[0]}::date
    ORDER BY date ASC
  `);
  
  const dailyUsage: DailyUsage[] = (dailyUsageResult.rows as any[]).map(row => ({
    date: row.date,
    smsCount: parseInt(row.sms_count) || 0,
    voiceMinutes: parseInt(row.voice_minutes) || 0,
    emailCount: parseInt(row.email_count) || 0,
    aiRequests: parseInt(row.ai_requests) || 0,
  }));
  
  const planTier = (tenant.planTier || 'starter') as PlanTier;
  const planTierLabel = tierLabels[planTier] || 'Starter';
  const planLimits = getPlanLimits(planTier);
  
  let trialEndsAt: string | null = null;
  let nextRenewalAt: string | null = null;
  const dbCancelAtPeriodEnd = tenant.cancelAtPeriodEnd || false;
  let cancelAtPeriodEnd = dbCancelAtPeriodEnd;
  
  if (tenant.stripeSubscriptionId && isStripeConfigured() && stripe) {
    try {
      const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
      
      if (subscription.trial_end) {
        trialEndsAt = new Date(subscription.trial_end * 1000).toISOString();
      }
      
      if (subscription.current_period_end) {
        nextRenewalAt = new Date(subscription.current_period_end * 1000).toISOString();
      }
      
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
    } catch (error) {
      console.warn(`[USAGE OVERVIEW] Failed to fetch Stripe subscription for tenant ${tenantId}:`, error);
      cancelAtPeriodEnd = dbCancelAtPeriodEnd;
    }
  }
  
  return {
    planId: tenant.stripeSubscriptionId || null,
    planName: `${planTierLabel} Plan`,
    planTier,
    planTierLabel,
    status: mapStatusToEnum(tenant.status),
    trialEndsAt,
    nextRenewalAt,
    hasStripeCustomer: !!tenant.stripeCustomerId,
    hasSubscription: !!tenant.stripeSubscriptionId,
    cancelAtPeriodEnd,
    usage: {
      smsSentLast30d: smsSent,
      voiceMinutesLast30d: voiceTotal,
      emailsSentLast30d: emailTotal,
      aiRequestsLast30d: aiRequestsEstimate,
    },
    estimatedCostLast30d: estimatedCost,
    planLimits,
    currentPeriod: {
      startDate: periodStart.toISOString().split('T')[0],
      endDate: periodEnd.toISOString().split('T')[0],
      label: periodLabel,
    },
    dailyUsage,
    // SP-27: Enhanced dunning tracking
    failedPaymentAttempts: tenant.failedPaymentAttempts || 0,
    delinquentSince: tenant.delinquentSince?.toISOString() || null,
    lastInvoiceStatus: tenant.lastInvoiceStatus || null,
  };
}
