import { db } from '../db';
import { wrapTenantDb, TenantDb } from '../tenantDb';
import { usageMetrics, tenants, messages, smsDeliveryStatus } from '@shared/schema';
import { eq, sql, and, gte, lt } from 'drizzle-orm';

interface DailyUsageData {
  tenantId: string;
  date: string;
  smsOutboundCount: number;
  smsInboundCount: number;
  mmsOutboundCount: number;
  mmsInboundCount: number;
  voiceMinutes: number;
  emailsSent: number;
  aiTokensIn: number;
  aiTokensOut: number;
}

export async function collectTenantUsage(tenantId: string, date: Date): Promise<DailyUsageData> {
  const dateStr = date.toISOString().split('T')[0];
  const startOfDay = new Date(dateStr + 'T00:00:00Z');
  const endOfDay = new Date(dateStr + 'T23:59:59Z');
  
  const rootDb = wrapTenantDb(db, 'root');
  
  const smsStats = await rootDb.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE direction LIKE 'outbound%' AND (body IS NULL OR LENGTH(body) < 1600)) as sms_outbound,
      COUNT(*) FILTER (WHERE direction = 'inbound' AND (body IS NULL OR LENGTH(body) < 1600)) as sms_inbound,
      COUNT(*) FILTER (WHERE direction LIKE 'outbound%' AND body IS NOT NULL AND LENGTH(body) >= 1600) as mms_outbound,
      COUNT(*) FILTER (WHERE direction = 'inbound' AND body IS NOT NULL AND LENGTH(body) >= 1600) as mms_inbound
    FROM sms_delivery_status
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${startOfDay}
      AND created_at < ${endOfDay}
  `);
  
  const smsRow = smsStats.rows[0] as any || {};
  
  const voiceStats = await rootDb.execute(sql`
    SELECT COALESCE(SUM(CAST(quantity AS INTEGER)), 0) as total_minutes
    FROM api_usage_logs
    WHERE service = 'twilio'
      AND api_type = 'voice'
      AND timestamp >= ${startOfDay}
      AND timestamp < ${endOfDay}
  `);
  
  const voiceRow = voiceStats.rows[0] as any || {};
  
  const emailStats = await rootDb.execute(sql`
    SELECT COALESCE(SUM(quantity), 0) as total_emails
    FROM api_usage_logs
    WHERE service = 'sendgrid'
      AND api_type = 'email'
      AND timestamp >= ${startOfDay}
      AND timestamp < ${endOfDay}
  `);
  
  const emailRow = emailStats.rows[0] as any || {};
  
  const aiStats = await rootDb.execute(sql`
    SELECT 
      COALESCE(SUM(CASE WHEN api_type = 'tokens_in' THEN quantity ELSE 0 END), 0) as tokens_in,
      COALESCE(SUM(CASE WHEN api_type = 'tokens_out' THEN quantity ELSE 0 END), 0) as tokens_out,
      COALESCE(SUM(quantity), 0) as total_tokens
    FROM api_usage_logs
    WHERE service = 'openai'
      AND timestamp >= ${startOfDay}
      AND timestamp < ${endOfDay}
  `);
  
  const aiRow = aiStats.rows[0] as any || {};
  
  return {
    tenantId,
    date: dateStr,
    smsOutboundCount: parseInt(smsRow.sms_outbound) || 0,
    smsInboundCount: parseInt(smsRow.sms_inbound) || 0,
    mmsOutboundCount: parseInt(smsRow.mms_outbound) || 0,
    mmsInboundCount: parseInt(smsRow.mms_inbound) || 0,
    voiceMinutes: parseInt(voiceRow.total_minutes) || 0,
    emailsSent: parseInt(emailRow.total_emails) || 0,
    aiTokensIn: parseInt(aiRow.tokens_in) || parseInt(aiRow.total_tokens) || 0,
    aiTokensOut: parseInt(aiRow.tokens_out) || 0,
  };
}

export async function writeRawUsageMetrics(data: DailyUsageData): Promise<void> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const existing = await rootDb.execute(sql`
    SELECT id FROM usage_metrics
    WHERE tenant_id = ${data.tenantId}
      AND date = ${data.date}::date
  `);
  
  if (existing.rows.length > 0) {
    await rootDb.execute(sql`
      UPDATE usage_metrics
      SET 
        sms_outbound_count = ${data.smsOutboundCount},
        sms_inbound_count = ${data.smsInboundCount},
        mms_outbound_count = ${data.mmsOutboundCount},
        mms_inbound_count = ${data.mmsInboundCount},
        voice_minutes = ${data.voiceMinutes},
        emails_sent = ${data.emailsSent},
        ai_tokens_in = ${data.aiTokensIn},
        ai_tokens_out = ${data.aiTokensOut},
        updated_at = NOW()
      WHERE tenant_id = ${data.tenantId}
        AND date = ${data.date}::date
    `);
    console.log(`[USAGE COLLECTOR] Updated metrics for tenant ${data.tenantId} on ${data.date}`);
  } else {
    await rootDb.execute(sql`
      INSERT INTO usage_metrics (
        tenant_id, date, sms_outbound_count, sms_inbound_count,
        mms_outbound_count, mms_inbound_count, voice_minutes,
        emails_sent, ai_tokens_in, ai_tokens_out
      ) VALUES (
        ${data.tenantId}, ${data.date}::date, ${data.smsOutboundCount}, ${data.smsInboundCount},
        ${data.mmsOutboundCount}, ${data.mmsInboundCount}, ${data.voiceMinutes},
        ${data.emailsSent}, ${data.aiTokensIn}, ${data.aiTokensOut}
      )
    `);
    console.log(`[USAGE COLLECTOR] Created metrics for tenant ${data.tenantId} on ${data.date}`);
  }
}

export async function collectAllTenantsUsage(date: Date): Promise<void> {
  console.log(`[USAGE COLLECTOR] Starting usage collection for ${date.toISOString().split('T')[0]}`);
  
  const rootDb = wrapTenantDb(db, 'root');
  
  const allTenants = await rootDb.execute(sql`
    SELECT id FROM tenants WHERE status != 'cancelled'
  `);
  
  for (const tenant of allTenants.rows) {
    try {
      const tenantId = (tenant as any).id;
      const usageData = await collectTenantUsage(tenantId, date);
      await writeRawUsageMetrics(usageData);
    } catch (error) {
      console.error(`[USAGE COLLECTOR] Error collecting usage for tenant ${(tenant as any).id}:`, error);
    }
  }
  
  console.log(`[USAGE COLLECTOR] Completed usage collection for ${allTenants.rows.length} tenants`);
}

export async function getUsageMetricsForTenant(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const result = await rootDb.execute(sql`
    SELECT * FROM usage_metrics
    WHERE tenant_id = ${tenantId}
      AND date >= ${startDate.toISOString().split('T')[0]}::date
      AND date <= ${endDate.toISOString().split('T')[0]}::date
    ORDER BY date DESC
  `);
  
  return result.rows;
}

export async function getUsageSummaryForTenant(tenantId: string): Promise<{
  smsTotal: number;
  mmsTotal: number;
  voiceTotal: number;
  emailTotal: number;
  aiTokensTotal: number;
  currentMonthCost: number;
}> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const result = await rootDb.execute(sql`
    SELECT 
      COALESCE(SUM(sms_outbound_count + sms_inbound_count), 0) as sms_total,
      COALESCE(SUM(mms_outbound_count + mms_inbound_count), 0) as mms_total,
      COALESCE(SUM(voice_minutes), 0) as voice_total,
      COALESCE(SUM(emails_sent), 0) as email_total,
      COALESCE(SUM(ai_tokens_in + ai_tokens_out), 0) as ai_tokens_total
    FROM usage_metrics
    WHERE tenant_id = ${tenantId}
      AND date >= ${startOfMonth.toISOString().split('T')[0]}::date
  `);
  
  const row = result.rows[0] as any || {};
  
  const { usagePricing } = await import('@shared/pricing/usagePricing');
  
  const smsTotal = parseInt(row.sms_total) || 0;
  const mmsTotal = parseInt(row.mms_total) || 0;
  const voiceTotal = parseInt(row.voice_total) || 0;
  const emailTotal = parseInt(row.email_total) || 0;
  const aiTokensTotal = parseInt(row.ai_tokens_total) || 0;
  
  const currentMonthCost = 
    smsTotal * usagePricing.sms +
    mmsTotal * usagePricing.mms +
    voiceTotal * usagePricing.voiceMinute +
    emailTotal * usagePricing.email +
    aiTokensTotal * usagePricing.aiToken;
  
  return {
    smsTotal,
    mmsTotal,
    voiceTotal,
    emailTotal,
    aiTokensTotal,
    currentMonthCost,
  };
}
