import cron from 'node-cron';
import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { sql } from 'drizzle-orm';
import { usagePricing, calculateUsageCost } from '@shared/pricing/usagePricing';
import { collectAllTenantsUsage } from './usageCollectorService';

let rollupSchedulerInitialized = false;

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
      sms_outbound_count + sms_inbound_count as sms_total,
      mms_outbound_count + mms_inbound_count as mms_total,
      voice_minutes as voice_total_minutes,
      emails_sent as email_total,
      ai_tokens_in + ai_tokens_out as ai_total_tokens
    FROM usage_metrics
    WHERE date = ${dateStr}::date
  `);
  
  for (const row of metrics.rows) {
    const metric = row as any;
    
    const estimatedCost = calculateUsageCost({
      smsTotal: parseInt(metric.sms_total) || 0,
      mmsTotal: parseInt(metric.mms_total) || 0,
      voiceTotalMinutes: parseInt(metric.voice_total_minutes) || 0,
      emailTotal: parseInt(metric.email_total) || 0,
      aiTotalTokens: parseInt(metric.ai_total_tokens) || 0,
    });
    
    const existing = await rootDb.execute(sql`
      SELECT id FROM usage_rollups_daily
      WHERE tenant_id = ${metric.tenant_id}
        AND date = ${dateStr}::date
    `);
    
    if (existing.rows.length > 0) {
      await rootDb.execute(sql`
        UPDATE usage_rollups_daily
        SET 
          sms_total = ${parseInt(metric.sms_total) || 0},
          mms_total = ${parseInt(metric.mms_total) || 0},
          voice_total_minutes = ${parseInt(metric.voice_total_minutes) || 0},
          email_total = ${parseInt(metric.email_total) || 0},
          ai_total_tokens = ${parseInt(metric.ai_total_tokens) || 0},
          estimated_cost_usd = ${estimatedCost.toFixed(4)}
        WHERE tenant_id = ${metric.tenant_id}
          AND date = ${dateStr}::date
      `);
    } else {
      await rootDb.execute(sql`
        INSERT INTO usage_rollups_daily (
          tenant_id, date, sms_total, mms_total, voice_total_minutes,
          email_total, ai_total_tokens, estimated_cost_usd
        ) VALUES (
          ${metric.tenant_id}, ${dateStr}::date,
          ${parseInt(metric.sms_total) || 0}, ${parseInt(metric.mms_total) || 0},
          ${parseInt(metric.voice_total_minutes) || 0}, ${parseInt(metric.email_total) || 0},
          ${parseInt(metric.ai_total_tokens) || 0}, ${estimatedCost.toFixed(4)}
        )
      `);
    }
    
    console.log(`[USAGE ROLLUP] Rolled up ${metric.tenant_id}: $${estimatedCost.toFixed(4)}`);
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
      COALESCE(SUM(r.estimated_cost_usd), 0) as estimated_monthly_cost
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
