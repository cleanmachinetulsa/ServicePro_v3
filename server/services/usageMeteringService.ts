/**
 * SP-18: Usage Metering Service v2
 * 
 * Provides:
 * - Aggregated monthly usage per tenant per channel
 * - Cap checking with warning/over_cap status
 * - Hard-stop enforcement via canTenantUseChannel()
 * - Daily aggregation job
 */

import { db } from '../db';
import { 
  usageLedger, 
  tenants, 
  tenantUsageStatusV2,
  TenantUsageStatusV2,
  USAGE_CHANNELS_V2,
  UsageChannelV2,
} from '@shared/schema';
import { 
  USAGE_CAPS_BY_TIER, 
  getUsageCapsForTier, 
  computeChannelStatus, 
  getOverallStatus,
  formatPeriodLabel,
  mapEventTypeToChannel,
  UsageStatus,
  UsageStatusResult,
  TenantUsageStatus as TenantUsageStatusResult,
  UsageChannel,
} from '@shared/usageCapsConfig';
import { PlanTier } from '@shared/addonsConfig';
import { eq, and, gte, lte, sql, count } from 'drizzle-orm';
import { format, startOfMonth, endOfMonth } from 'date-fns';

function getCurrentPeriodKey(): string {
  return format(new Date(), 'yyyy-MM');
}

function getMonthBounds(periodKey: string): { start: Date; end: Date } {
  const [year, month] = periodKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

export async function getTenantMonthlyUsage(
  tenantId: string,
  periodKey?: string
): Promise<Record<UsageChannelV2, number>> {
  const period = periodKey || getCurrentPeriodKey();
  const { start, end } = getMonthBounds(period);

  const results = await db
    .select({
      eventType: usageLedger.eventType,
      totalUnits: sql<number>`sum(${usageLedger.units})::int`,
    })
    .from(usageLedger)
    .where(
      and(
        eq(usageLedger.tenantId, tenantId),
        gte(usageLedger.occurredAt, start),
        lte(usageLedger.occurredAt, end)
      )
    )
    .groupBy(usageLedger.eventType);

  const channelTotals: Record<UsageChannelV2, number> = {
    sms: 0,
    mms: 0,
    voice: 0,
    email: 0,
    ai: 0,
  };

  for (const row of results) {
    const channel = mapEventTypeToChannel(row.eventType);
    if (channel && channel in channelTotals) {
      channelTotals[channel as UsageChannelV2] += row.totalUnits || 0;
    }
  }

  return channelTotals;
}

export async function getTenantUsageStatus(
  tenantId: string,
  periodKey?: string
): Promise<TenantUsageStatusResult> {
  const period = periodKey || getCurrentPeriodKey();
  const [year, month] = period.split('-').map(Number);

  const [tenant] = await db
    .select({ planTier: tenants.planTier })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const planTier = (tenant?.planTier as PlanTier) || 'free';
  const tierCaps = getUsageCapsForTier(planTier);

  const usage = await getTenantMonthlyUsage(tenantId, period);

  const channels: Record<UsageChannel, UsageStatusResult> = {
    sms: computeChannelStatus('sms', usage.sms, tierCaps),
    mms: computeChannelStatus('mms', usage.mms, tierCaps),
    voice: computeChannelStatus('voice', usage.voice, tierCaps),
    email: computeChannelStatus('email', usage.email, tierCaps),
    ai: computeChannelStatus('ai', usage.ai, tierCaps),
  };

  const overallStatus = getOverallStatus(channels);

  const [statusRow] = await db
    .select({ hardStopEnabled: tenantUsageStatusV2.hardStopEnabled })
    .from(tenantUsageStatusV2)
    .where(eq(tenantUsageStatusV2.tenantId, tenantId))
    .limit(1);

  return {
    tenantId,
    period: {
      year,
      month,
      label: formatPeriodLabel(year, month),
    },
    channels,
    overallStatus,
    hardStopEnabled: statusRow?.hardStopEnabled ?? false,
  };
}

export async function updateTenantUsageStatus(tenantId: string): Promise<void> {
  const periodKey = getCurrentPeriodKey();
  const usage = await getTenantMonthlyUsage(tenantId, periodKey);

  const [tenant] = await db
    .select({ planTier: tenants.planTier })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const planTier = (tenant?.planTier as PlanTier) || 'free';
  const tierCaps = getUsageCapsForTier(planTier);

  const channels: Record<UsageChannel, UsageStatusResult> = {
    sms: computeChannelStatus('sms', usage.sms, tierCaps),
    mms: computeChannelStatus('mms', usage.mms, tierCaps),
    voice: computeChannelStatus('voice', usage.voice, tierCaps),
    email: computeChannelStatus('email', usage.email, tierCaps),
    ai: computeChannelStatus('ai', usage.ai, tierCaps),
  };

  const overallStatus = getOverallStatus(channels);

  const existing = await db
    .select()
    .from(tenantUsageStatusV2)
    .where(eq(tenantUsageStatusV2.tenantId, tenantId))
    .limit(1);

  if (existing.length > 0) {
    await db.update(tenantUsageStatusV2)
      .set({
        periodKey,
        smsUsed: usage.sms,
        mmsUsed: usage.mms,
        voiceUsed: usage.voice,
        emailUsed: usage.email,
        aiUsed: usage.ai,
        overallStatus,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenantUsageStatusV2.tenantId, tenantId));
  } else {
    await db.insert(tenantUsageStatusV2).values({
      tenantId,
      periodKey,
      smsUsed: usage.sms,
      mmsUsed: usage.mms,
      voiceUsed: usage.voice,
      emailUsed: usage.email,
      aiUsed: usage.ai,
      overallStatus,
      hardStopEnabled: false,
      lastCalculatedAt: new Date(),
    });
  }
}

export async function canTenantUseChannel(
  tenantId: string,
  channel: UsageChannelV2
): Promise<{ allowed: boolean; reason?: string; status: UsageStatus }> {
  try {
    const [statusRow] = await db
      .select()
      .from(tenantUsageStatusV2)
      .where(eq(tenantUsageStatusV2.tenantId, tenantId))
      .limit(1);

    if (!statusRow) {
      return { allowed: true, status: 'ok' };
    }

    if (!statusRow.hardStopEnabled) {
      return { allowed: true, status: statusRow.overallStatus as UsageStatus };
    }

    const [tenant] = await db
      .select({ planTier: tenants.planTier })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const planTier = (tenant?.planTier as PlanTier) || 'free';
    const tierCaps = getUsageCapsForTier(planTier);
    const channelCaps = tierCaps[channel];

    const channelUsed = {
      sms: statusRow.smsUsed,
      mms: statusRow.mmsUsed,
      voice: statusRow.voiceUsed,
      email: statusRow.emailUsed,
      ai: statusRow.aiUsed,
    }[channel] || 0;

    if (channelUsed >= channelCaps.monthlyCap) {
      return {
        allowed: false,
        reason: `Monthly ${channel.toUpperCase()} cap reached (${channelUsed}/${channelCaps.monthlyCap} ${channelCaps.unitLabel}). Please upgrade your plan or contact support.`,
        status: 'over_cap',
      };
    }

    return { allowed: true, status: statusRow.overallStatus as UsageStatus };
  } catch (error) {
    console.error('[USAGE METERING] Error checking channel allowance:', error);
    return { allowed: true, status: 'ok' };
  }
}

export async function setHardStopEnabled(
  tenantId: string,
  enabled: boolean
): Promise<void> {
  await db.update(tenantUsageStatusV2)
    .set({ hardStopEnabled: enabled, updatedAt: new Date() })
    .where(eq(tenantUsageStatusV2.tenantId, tenantId));
}

export async function getAllTenantsUsageStatus(
  filters?: {
    status?: UsageStatus;
    planTier?: PlanTier;
  }
): Promise<Array<{
  tenantId: string;
  tenantName: string;
  planTier: string;
  smsUsed: number;
  mmsUsed: number;
  voiceUsed: number;
  emailUsed: number;
  aiUsed: number;
  overallStatus: UsageStatus;
}>> {
  let query = db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      planTier: tenants.planTier,
      smsUsed: sql<number>`COALESCE(${tenantUsageStatusV2.smsUsed}, 0)`,
      mmsUsed: sql<number>`COALESCE(${tenantUsageStatusV2.mmsUsed}, 0)`,
      voiceUsed: sql<number>`COALESCE(${tenantUsageStatusV2.voiceUsed}, 0)`,
      emailUsed: sql<number>`COALESCE(${tenantUsageStatusV2.emailUsed}, 0)`,
      aiUsed: sql<number>`COALESCE(${tenantUsageStatusV2.aiUsed}, 0)`,
      overallStatus: sql<string>`COALESCE(${tenantUsageStatusV2.overallStatus}, 'ok')`,
    })
    .from(tenants)
    .leftJoin(tenantUsageStatusV2, eq(tenants.id, tenantUsageStatusV2.tenantId));

  const results = await query;

  let filtered = results.map(r => ({
    ...r,
    overallStatus: (r.overallStatus || 'ok') as UsageStatus,
  }));

  if (filters?.status) {
    filtered = filtered.filter(r => r.overallStatus === filters.status);
  }

  if (filters?.planTier) {
    filtered = filtered.filter(r => r.planTier === filters.planTier);
  }

  return filtered;
}

export async function rebuildUsageForAllTenants(): Promise<{
  tenantsProcessed: number;
  errors: string[];
}> {
  const allTenants = await db.select({ id: tenants.id }).from(tenants);
  const errors: string[] = [];
  let processed = 0;

  for (const tenant of allTenants) {
    try {
      await updateTenantUsageStatus(tenant.id);
      processed++;
    } catch (error) {
      const msg = `Failed to update usage for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`;
      console.error('[USAGE METERING]', msg);
      errors.push(msg);
    }
  }

  console.log(`[USAGE METERING] Rebuilt usage for ${processed}/${allTenants.length} tenants`);
  return { tenantsProcessed: processed, errors };
}

export async function getDailyUsageBreakdown(
  tenantId: string,
  days: number = 30
): Promise<Array<{
  date: string;
  sms: number;
  mms: number;
  voice: number;
  email: number;
  ai: number;
}>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const results = await db
    .select({
      date: sql<string>`date(${usageLedger.occurredAt})`,
      eventType: usageLedger.eventType,
      totalUnits: sql<number>`sum(${usageLedger.units})::int`,
    })
    .from(usageLedger)
    .where(
      and(
        eq(usageLedger.tenantId, tenantId),
        gte(usageLedger.occurredAt, startDate)
      )
    )
    .groupBy(sql`date(${usageLedger.occurredAt})`, usageLedger.eventType)
    .orderBy(sql`date(${usageLedger.occurredAt})`);

  const dailyMap: Record<string, { sms: number; mms: number; voice: number; email: number; ai: number }> = {};

  for (const row of results) {
    if (!dailyMap[row.date]) {
      dailyMap[row.date] = { sms: 0, mms: 0, voice: 0, email: 0, ai: 0 };
    }
    const channel = mapEventTypeToChannel(row.eventType);
    if (channel && channel in dailyMap[row.date]) {
      dailyMap[row.date][channel as UsageChannelV2] += row.totalUnits || 0;
    }
  }

  return Object.entries(dailyMap).map(([date, usage]) => ({
    date,
    ...usage,
  }));
}
