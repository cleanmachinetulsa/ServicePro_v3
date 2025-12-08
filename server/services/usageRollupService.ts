import cron from 'node-cron';
import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { sql } from 'drizzle-orm';
import { usagePricing, calculateUsageCost } from '@shared/pricing/usagePricing';
import { collectAllTenantsUsage } from './usageCollectorService';

let rollupSchedulerInitialized = false;

interface PerChannelCosts {
  smsCostCents: number;
  mmsCostCents: number;
  voiceCostCents: number;
  emailCostCents: number;
  aiCostCents: number;
  totalCostCents: number;
}

interface DetailedUsage {
  smsInbound: number;
  smsOutbound: number;
  mmsInbound: number;
  mmsOutbound: number;
  voiceMinutes: number;
  emailTotal: number;
  aiTokensIn: number;
  aiTokensOut: number;
}

export function calculatePerChannelCostsDetailed(usage: DetailedUsage): PerChannelCosts {
  const smsCostCents = Math.round(
    (usage.smsInbound * usagePricing.sms.inbound + usage.smsOutbound * usagePricing.sms.outbound) * 100
  );
  const mmsCostCents = Math.round(
    (usage.mmsInbound * usagePricing.mms.inbound + usage.mmsOutbound * usagePricing.mms.outbound) * 100
  );
  const voiceCostCents = Math.round(usage.voiceMinutes * usagePricing.voice.perMinute * 100);
  const emailCostCents = Math.round(usage.emailTotal * usagePricing.email.perEmail * 100);
  const aiCostCents = Math.round(
    (usage.aiTokensIn * usagePricing.ai.perInputToken + usage.aiTokensOut * usagePricing.ai.perOutputToken) * 100
  );
  
  return {
    smsCostCents,
    mmsCostCents,
    voiceCostCents,
    emailCostCents,
    aiCostCents,
    totalCostCents: smsCostCents + mmsCostCents + voiceCostCents + emailCostCents + aiCostCents,
  };
}

export function calculatePerChannelCosts(usage: {
  smsTotal: number;
  mmsTotal: number;
  voiceMinutes: number;
  emailTotal: number;
  aiTokens: number;
}): PerChannelCosts {
  const avgSmsRate = (usagePricing.sms.inbound + usagePricing.sms.outbound) / 2;
  const avgMmsRate = (usagePricing.mms.inbound + usagePricing.mms.outbound) / 2;
  const avgAiRate = (usagePricing.ai.perInputToken + usagePricing.ai.perOutputToken) / 2;
  
  const smsCostCents = Math.round(usage.smsTotal * avgSmsRate * 100);
  const mmsCostCents = Math.round(usage.mmsTotal * avgMmsRate * 100);
  const voiceCostCents = Math.round(usage.voiceMinutes * usagePricing.voice.perMinute * 100);
  const emailCostCents = Math.round(usage.emailTotal * usagePricing.email.perEmail * 100);
  const aiCostCents = Math.round(usage.aiTokens * avgAiRate * 100);
  
  return {
    smsCostCents,
    mmsCostCents,
    voiceCostCents,
    emailCostCents,
    aiCostCents,
    totalCostCents: smsCostCents + mmsCostCents + voiceCostCents + emailCostCents + aiCostCents,
  };
}

export async function rollupDailyUsage(date?: Date): Promise<void> {
  const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dateStr = targetDate.toISOString().split('T')[0];
  
  console.log(`[USAGE ROLLUP] Starting daily rollup for ${dateStr}`);
  
  const rootDb = wrapTenantDb(db, 'root');
  
  await collectAllTenantsUsage(targetDate);
  
  const metrics = await rootDb.execute(sql`
    SELECT 
      tenant_id,
      date,
      sms_inbound_count,
      sms_outbound_count,
      mms_inbound_count,
      mms_outbound_count,
      voice_minutes,
      emails_sent,
      ai_tokens_in,
      ai_tokens_out
    FROM usage_metrics
    WHERE date = ${dateStr}::date
  `);
  
  for (const row of metrics.rows) {
    const metric = row as any;
    
    const smsInbound = parseInt(metric.sms_inbound_count) || 0;
    const smsOutbound = parseInt(metric.sms_outbound_count) || 0;
    const mmsInbound = parseInt(metric.mms_inbound_count) || 0;
    const mmsOutbound = parseInt(metric.mms_outbound_count) || 0;
    const voiceMinutes = parseInt(metric.voice_minutes) || 0;
    const emailTotal = parseInt(metric.emails_sent) || 0;
    const aiTokensIn = parseInt(metric.ai_tokens_in) || 0;
    const aiTokensOut = parseInt(metric.ai_tokens_out) || 0;
    
    const smsTotal = smsInbound + smsOutbound;
    const mmsTotal = mmsInbound + mmsOutbound;
    const aiTokens = aiTokensIn + aiTokensOut;
    
    const channelCosts = calculatePerChannelCostsDetailed({
      smsInbound,
      smsOutbound,
      mmsInbound,
      mmsOutbound,
      voiceMinutes,
      emailTotal,
      aiTokensIn,
      aiTokensOut,
    });
    
    const estimatedCost = channelCosts.totalCostCents / 100;
    
    const existing = await rootDb.execute(sql`
      SELECT id FROM usage_rollups_daily
      WHERE tenant_id = ${metric.tenant_id}
        AND date = ${dateStr}::date
    `);
    
    if (existing.rows.length > 0) {
      await rootDb.execute(sql`
        UPDATE usage_rollups_daily
        SET 
          sms_total = ${smsTotal},
          mms_total = ${mmsTotal},
          voice_total_minutes = ${voiceMinutes},
          email_total = ${emailTotal},
          ai_total_tokens = ${aiTokens},
          estimated_cost_usd = ${estimatedCost.toFixed(4)},
          sms_cost_cents = ${channelCosts.smsCostCents},
          mms_cost_cents = ${channelCosts.mmsCostCents},
          voice_cost_cents = ${channelCosts.voiceCostCents},
          email_cost_cents = ${channelCosts.emailCostCents},
          ai_cost_cents = ${channelCosts.aiCostCents}
        WHERE tenant_id = ${metric.tenant_id}
          AND date = ${dateStr}::date
      `);
    } else {
      await rootDb.execute(sql`
        INSERT INTO usage_rollups_daily (
          tenant_id, date, sms_total, mms_total, voice_total_minutes,
          email_total, ai_total_tokens, estimated_cost_usd,
          sms_cost_cents, mms_cost_cents, voice_cost_cents, email_cost_cents, ai_cost_cents
        ) VALUES (
          ${metric.tenant_id}, ${dateStr}::date,
          ${smsTotal}, ${mmsTotal},
          ${voiceMinutes}, ${emailTotal},
          ${aiTokens}, ${estimatedCost.toFixed(4)},
          ${channelCosts.smsCostCents}, ${channelCosts.mmsCostCents},
          ${channelCosts.voiceCostCents}, ${channelCosts.emailCostCents}, ${channelCosts.aiCostCents}
        )
      `);
    }
    
    console.log(`[USAGE ROLLUP] Rolled up ${metric.tenant_id}: $${estimatedCost.toFixed(4)} (SMS: ${channelCosts.smsCostCents}¢, Voice: ${channelCosts.voiceCostCents}¢, Email: ${channelCosts.emailCostCents}¢, AI: ${channelCosts.aiCostCents}¢)`);
  }
  
  console.log(`[USAGE ROLLUP] Completed rollup for ${metrics.rows.length} tenant(s)`);
}

export async function getDailyRollups(
  tenantId: string,
  days: number = 30
): Promise<any[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const result = await rootDb.execute(sql`
    SELECT * FROM usage_rollups_daily
    WHERE tenant_id = ${tenantId}
      AND date >= CURRENT_DATE - ${days}::integer
    ORDER BY date DESC
  `);
  
  return result.rows;
}

export async function getAllTenantsUsageSummary(): Promise<any[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const result = await rootDb.execute(sql`
    SELECT 
      t.id as tenant_id,
      t.name as tenant_name,
      tc.business_name,
      t.plan_tier,
      COALESCE(SUM(r.sms_total), 0) as sms_total,
      COALESCE(SUM(r.mms_total), 0) as mms_total,
      COALESCE(SUM(r.voice_total_minutes), 0) as voice_total,
      COALESCE(SUM(r.email_total), 0) as email_total,
      COALESCE(SUM(r.ai_total_tokens), 0) as ai_tokens_total,
      COALESCE(SUM(r.estimated_cost_usd), 0) as estimated_monthly_cost,
      COALESCE(SUM(r.sms_cost_cents), 0) as sms_cost_cents,
      COALESCE(SUM(r.mms_cost_cents), 0) as mms_cost_cents,
      COALESCE(SUM(r.voice_cost_cents), 0) as voice_cost_cents,
      COALESCE(SUM(r.email_cost_cents), 0) as email_cost_cents,
      COALESCE(SUM(r.ai_cost_cents), 0) as ai_cost_cents
    FROM tenants t
    LEFT JOIN tenant_config tc ON tc.tenant_id = t.id
    LEFT JOIN usage_rollups_daily r ON r.tenant_id = t.id
      AND r.date >= ${startOfMonth.toISOString().split('T')[0]}::date
    WHERE t.status != 'cancelled'
    GROUP BY t.id, t.name, tc.business_name, t.plan_tier
    ORDER BY estimated_monthly_cost DESC
  `);
  
  return result.rows;
}

export interface TenantUsageForPeriod {
  byChannel: {
    sms: { count: number; costCents: number };
    mms: { count: number; costCents: number };
    voice: { minutes: number; costCents: number };
    email: { count: number; costCents: number };
    ai: { tokens: number; costCents: number };
  };
  totalCostCents: number;
  totalCostUsd: number;
}

export async function calculateTenantUsageForPeriod(
  tenantId: string,
  from: Date,
  to: Date
): Promise<TenantUsageForPeriod> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];
  
  const result = await rootDb.execute(sql`
    SELECT 
      COALESCE(SUM(sms_total), 0) as sms_total,
      COALESCE(SUM(mms_total), 0) as mms_total,
      COALESCE(SUM(voice_total_minutes), 0) as voice_total,
      COALESCE(SUM(email_total), 0) as email_total,
      COALESCE(SUM(ai_total_tokens), 0) as ai_tokens_total,
      COALESCE(SUM(sms_cost_cents), 0) as sms_cost_cents,
      COALESCE(SUM(mms_cost_cents), 0) as mms_cost_cents,
      COALESCE(SUM(voice_cost_cents), 0) as voice_cost_cents,
      COALESCE(SUM(email_cost_cents), 0) as email_cost_cents,
      COALESCE(SUM(ai_cost_cents), 0) as ai_cost_cents,
      COALESCE(SUM(estimated_cost_usd), 0) as total_cost_usd
    FROM usage_rollups_daily
    WHERE tenant_id = ${tenantId}
      AND date >= ${fromStr}::date
      AND date <= ${toStr}::date
  `);
  
  const row = result.rows[0] as any || {};
  
  const smsCostCents = parseInt(row.sms_cost_cents) || 0;
  const mmsCostCents = parseInt(row.mms_cost_cents) || 0;
  const voiceCostCents = parseInt(row.voice_cost_cents) || 0;
  const emailCostCents = parseInt(row.email_cost_cents) || 0;
  const aiCostCents = parseInt(row.ai_cost_cents) || 0;
  const totalCostCents = smsCostCents + mmsCostCents + voiceCostCents + emailCostCents + aiCostCents;
  
  return {
    byChannel: {
      sms: { count: parseInt(row.sms_total) || 0, costCents: smsCostCents },
      mms: { count: parseInt(row.mms_total) || 0, costCents: mmsCostCents },
      voice: { minutes: parseInt(row.voice_total) || 0, costCents: voiceCostCents },
      email: { count: parseInt(row.email_total) || 0, costCents: emailCostCents },
      ai: { tokens: parseInt(row.ai_tokens_total) || 0, costCents: aiCostCents },
    },
    totalCostCents,
    totalCostUsd: parseFloat(row.total_cost_usd) || totalCostCents / 100,
  };
}

export async function getTenantUsageSummary(
  tenantId: string,
  from: Date,
  to: Date
): Promise<{
  channels: Array<{
    channel: string;
    count: number;
    costCents: number;
    costUsd: number;
  }>;
  daily: Array<{
    date: string;
    totalCostCents: number;
    smsCount: number;
    mmsCount: number;
    voiceMinutes: number;
    emailCount: number;
    aiTokens: number;
  }>;
  totalCostCents: number;
  totalCostUsd: number;
}> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];
  
  const summaryResult = await rootDb.execute(sql`
    SELECT 
      COALESCE(SUM(sms_total), 0) as sms_total,
      COALESCE(SUM(mms_total), 0) as mms_total,
      COALESCE(SUM(voice_total_minutes), 0) as voice_total,
      COALESCE(SUM(email_total), 0) as email_total,
      COALESCE(SUM(ai_total_tokens), 0) as ai_tokens_total,
      COALESCE(SUM(sms_cost_cents), 0) as sms_cost_cents,
      COALESCE(SUM(mms_cost_cents), 0) as mms_cost_cents,
      COALESCE(SUM(voice_cost_cents), 0) as voice_cost_cents,
      COALESCE(SUM(email_cost_cents), 0) as email_cost_cents,
      COALESCE(SUM(ai_cost_cents), 0) as ai_cost_cents
    FROM usage_rollups_daily
    WHERE tenant_id = ${tenantId}
      AND date >= ${fromStr}::date
      AND date <= ${toStr}::date
  `);
  
  const dailyResult = await rootDb.execute(sql`
    SELECT 
      date,
      sms_total,
      mms_total,
      voice_total_minutes,
      email_total,
      ai_total_tokens,
      sms_cost_cents + mms_cost_cents + voice_cost_cents + email_cost_cents + ai_cost_cents as total_cost_cents
    FROM usage_rollups_daily
    WHERE tenant_id = ${tenantId}
      AND date >= ${fromStr}::date
      AND date <= ${toStr}::date
    ORDER BY date ASC
  `);
  
  const row = summaryResult.rows[0] as any || {};
  
  const smsCostCents = parseInt(row.sms_cost_cents) || 0;
  const mmsCostCents = parseInt(row.mms_cost_cents) || 0;
  const voiceCostCents = parseInt(row.voice_cost_cents) || 0;
  const emailCostCents = parseInt(row.email_cost_cents) || 0;
  const aiCostCents = parseInt(row.ai_cost_cents) || 0;
  const totalCostCents = smsCostCents + mmsCostCents + voiceCostCents + emailCostCents + aiCostCents;
  
  return {
    channels: [
      { channel: 'sms', count: parseInt(row.sms_total) || 0, costCents: smsCostCents, costUsd: smsCostCents / 100 },
      { channel: 'mms', count: parseInt(row.mms_total) || 0, costCents: mmsCostCents, costUsd: mmsCostCents / 100 },
      { channel: 'voice', count: parseInt(row.voice_total) || 0, costCents: voiceCostCents, costUsd: voiceCostCents / 100 },
      { channel: 'email', count: parseInt(row.email_total) || 0, costCents: emailCostCents, costUsd: emailCostCents / 100 },
      { channel: 'ai', count: parseInt(row.ai_tokens_total) || 0, costCents: aiCostCents, costUsd: aiCostCents / 100 },
    ],
    daily: dailyResult.rows.map((r: any) => ({
      date: r.date,
      totalCostCents: parseInt(r.total_cost_cents) || 0,
      smsCount: parseInt(r.sms_total) || 0,
      mmsCount: parseInt(r.mms_total) || 0,
      voiceMinutes: parseInt(r.voice_total_minutes) || 0,
      emailCount: parseInt(r.email_total) || 0,
      aiTokens: parseInt(r.ai_total_tokens) || 0,
    })),
    totalCostCents,
    totalCostUsd: totalCostCents / 100,
  };
}

export async function getAllTenantsUsageSummaryForPeriod(
  from: Date,
  to: Date
): Promise<any[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];
  
  const result = await rootDb.execute(sql`
    SELECT 
      t.id as tenant_id,
      t.name as tenant_name,
      t.subdomain,
      tc.business_name,
      t.plan_tier,
      COALESCE(SUM(r.sms_total), 0) as sms_total,
      COALESCE(SUM(r.mms_total), 0) as mms_total,
      COALESCE(SUM(r.voice_total_minutes), 0) as voice_total,
      COALESCE(SUM(r.email_total), 0) as email_total,
      COALESCE(SUM(r.ai_total_tokens), 0) as ai_tokens_total,
      COALESCE(SUM(r.estimated_cost_usd), 0) as total_cost_usd,
      COALESCE(SUM(r.sms_cost_cents), 0) as sms_cost_cents,
      COALESCE(SUM(r.mms_cost_cents), 0) as mms_cost_cents,
      COALESCE(SUM(r.voice_cost_cents), 0) as voice_cost_cents,
      COALESCE(SUM(r.email_cost_cents), 0) as email_cost_cents,
      COALESCE(SUM(r.ai_cost_cents), 0) as ai_cost_cents
    FROM tenants t
    LEFT JOIN tenant_config tc ON tc.tenant_id = t.id
    LEFT JOIN usage_rollups_daily r ON r.tenant_id = t.id
      AND r.date >= ${fromStr}::date
      AND r.date <= ${toStr}::date
    WHERE t.status != 'cancelled'
    GROUP BY t.id, t.name, t.subdomain, tc.business_name, t.plan_tier
    ORDER BY total_cost_usd DESC
  `);
  
  return result.rows.map((row: any) => ({
    tenantId: row.tenant_id,
    tenantName: row.tenant_name || row.business_name || row.subdomain,
    subdomain: row.subdomain,
    planTier: row.plan_tier,
    smsTotal: parseInt(row.sms_total) || 0,
    mmsTotal: parseInt(row.mms_total) || 0,
    voiceTotal: parseInt(row.voice_total) || 0,
    emailTotal: parseInt(row.email_total) || 0,
    aiTokensTotal: parseInt(row.ai_tokens_total) || 0,
    totalCostUsd: parseFloat(row.total_cost_usd) || 0,
    smsCostCents: parseInt(row.sms_cost_cents) || 0,
    mmsCostCents: parseInt(row.mms_cost_cents) || 0,
    voiceCostCents: parseInt(row.voice_cost_cents) || 0,
    emailCostCents: parseInt(row.email_cost_cents) || 0,
    aiCostCents: parseInt(row.ai_cost_cents) || 0,
    totalCostCents: (parseInt(row.sms_cost_cents) || 0) + (parseInt(row.mms_cost_cents) || 0) +
      (parseInt(row.voice_cost_cents) || 0) + (parseInt(row.email_cost_cents) || 0) + (parseInt(row.ai_cost_cents) || 0),
  }));
}

export function initializeUsageRollupScheduler() {
  if (rollupSchedulerInitialized) {
    console.log('[USAGE ROLLUP] Scheduler already initialized, skipping...');
    return;
  }
  
  cron.schedule('0 0 * * *', async () => {
    console.log('[USAGE ROLLUP] Running scheduled daily rollup');
    try {
      await rollupDailyUsage();
    } catch (error) {
      console.error('[USAGE ROLLUP] Scheduler error:', error);
    }
  }, {
    timezone: 'UTC'
  });
  
  rollupSchedulerInitialized = true;
  console.log('[USAGE ROLLUP] Scheduler initialized - runs daily at midnight UTC');
}
