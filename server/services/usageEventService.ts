import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { usageEvents, usageFeatureRollups, type InsertUsageEvent } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { 
  usagePricing, 
  getUnitCost,
  type UsageChannel, 
  type UsageSource, 
  type UsageDirection, 
  type UsageFeature 
} from '@shared/pricing/usagePricing';

export interface RecordUsageEventParams {
  tenantId: string;
  channel: UsageChannel;
  direction: UsageDirection;
  source: UsageSource;
  feature: UsageFeature;
  quantity?: number;
  metadata?: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    templateKey?: string;
    campaignId?: number;
    messageId?: string;
    callSid?: string;
    durationSeconds?: number;
  };
}

export async function recordUsageEvent(params: RecordUsageEventParams): Promise<void> {
  try {
    const { tenantId, channel, direction, source, feature, quantity = 1, metadata } = params;
    
    const unitCost = getUnitCost(channel, direction, {
      inputTokens: metadata?.inputTokens,
      outputTokens: metadata?.outputTokens,
    });
    
    let totalCost = unitCost * quantity;
    
    if (channel === 'ai' && metadata?.inputTokens && metadata?.outputTokens) {
      totalCost = (metadata.inputTokens * usagePricing.ai.perInputToken) + 
                  (metadata.outputTokens * usagePricing.ai.perOutputToken);
    }
    
    const rootDb = wrapTenantDb(db, 'root');
    
    await rootDb.execute(sql`
      INSERT INTO usage_events (
        tenant_id, channel, direction, source, feature, 
        quantity, unit_cost, total_cost, metadata
      ) VALUES (
        ${tenantId}, ${channel}, ${direction}, ${source}, ${feature},
        ${quantity}, ${unitCost.toFixed(6)}, ${totalCost.toFixed(6)}, 
        ${metadata ? JSON.stringify(metadata) : null}::jsonb
      )
    `);
    
  } catch (error) {
    console.error('[USAGE EVENT] Error recording usage event:', error);
  }
}

export async function recordSmsUsage(
  tenantId: string, 
  direction: UsageDirection, 
  feature: UsageFeature = 'general',
  metadata?: { templateKey?: string; campaignId?: number; messageId?: string }
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    channel: 'sms',
    direction,
    source: 'twilio',
    feature,
    quantity: 1,
    metadata,
  });
}

export async function recordMmsUsage(
  tenantId: string, 
  direction: UsageDirection, 
  feature: UsageFeature = 'general',
  metadata?: { templateKey?: string; campaignId?: number; messageId?: string }
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    channel: 'mms',
    direction,
    source: 'twilio',
    feature,
    quantity: 1,
    metadata,
  });
}

export async function recordVoiceUsage(
  tenantId: string, 
  durationSeconds: number,
  feature: UsageFeature = 'general',
  metadata?: { callSid?: string }
): Promise<void> {
  const minutes = Math.ceil(durationSeconds / 60);
  await recordUsageEvent({
    tenantId,
    channel: 'voice',
    direction: 'inbound',
    source: 'twilio',
    feature,
    quantity: minutes,
    metadata: { ...metadata, durationSeconds },
  });
}

export async function recordEmailUsage(
  tenantId: string, 
  feature: UsageFeature = 'general',
  metadata?: { templateKey?: string; campaignId?: number }
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    channel: 'email',
    direction: 'outbound',
    source: 'sendgrid',
    feature,
    quantity: 1,
    metadata,
  });
}

export async function recordAiUsage(
  tenantId: string, 
  feature: UsageFeature,
  inputTokens: number,
  outputTokens: number,
  model: string = 'gpt-4o'
): Promise<void> {
  const totalTokens = inputTokens + outputTokens;
  await recordUsageEvent({
    tenantId,
    channel: 'ai',
    direction: 'outbound',
    source: 'openai',
    feature,
    quantity: totalTokens,
    metadata: { model, inputTokens, outputTokens },
  });
}

export async function getUsageEventsByTenant(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const result = await rootDb.execute(sql`
    SELECT * FROM usage_events
    WHERE tenant_id = ${tenantId}
      AND timestamp >= ${startDate.toISOString()}::timestamptz
      AND timestamp <= ${endDate.toISOString()}::timestamptz
    ORDER BY timestamp DESC
    LIMIT 1000
  `);
  
  return result.rows;
}

export async function getUsageFeatureBreakdown(
  tenantId: string,
  days: number = 30
): Promise<{
  channel: string;
  source: string;
  feature: string;
  eventCount: number;
  totalQuantity: number;
  estimatedCost: number;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
}[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const result = await rootDb.execute(sql`
    SELECT 
      channel,
      source,
      feature,
      COUNT(*) as event_count,
      SUM(quantity) as total_quantity,
      SUM(CAST(total_cost AS NUMERIC)) as estimated_cost,
      SUM(CASE WHEN channel = 'ai' THEN (metadata->>'inputTokens')::integer ELSE NULL END) as ai_input_tokens,
      SUM(CASE WHEN channel = 'ai' THEN (metadata->>'outputTokens')::integer ELSE NULL END) as ai_output_tokens
    FROM usage_events
    WHERE tenant_id = ${tenantId}
      AND timestamp >= CURRENT_DATE - ${days}::integer
    GROUP BY channel, source, feature
    ORDER BY estimated_cost DESC
  `);
  
  return result.rows.map((row: any) => ({
    channel: row.channel,
    source: row.source,
    feature: row.feature,
    eventCount: parseInt(row.event_count) || 0,
    totalQuantity: parseInt(row.total_quantity) || 0,
    estimatedCost: parseFloat(row.estimated_cost) || 0,
    aiInputTokens: row.ai_input_tokens ? parseInt(row.ai_input_tokens) : null,
    aiOutputTokens: row.ai_output_tokens ? parseInt(row.ai_output_tokens) : null,
  }));
}

export async function getUsageSummaryByChannel(
  tenantId: string,
  days: number = 30
): Promise<{
  channel: string;
  count: number;
  estimatedCost: number;
  percentOfTotal: number;
}[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const result = await rootDb.execute(sql`
    WITH channel_totals AS (
      SELECT 
        channel,
        COUNT(*) as count,
        SUM(CAST(total_cost AS NUMERIC)) as estimated_cost
      FROM usage_events
      WHERE tenant_id = ${tenantId}
        AND timestamp >= CURRENT_DATE - ${days}::integer
      GROUP BY channel
    ),
    grand_total AS (
      SELECT SUM(estimated_cost) as total FROM channel_totals
    )
    SELECT 
      ct.channel,
      ct.count,
      ct.estimated_cost,
      CASE 
        WHEN gt.total > 0 THEN (ct.estimated_cost / gt.total * 100)
        ELSE 0
      END as percent_of_total
    FROM channel_totals ct, grand_total gt
    ORDER BY ct.estimated_cost DESC
  `);
  
  return result.rows.map((row: any) => ({
    channel: row.channel,
    count: parseInt(row.count) || 0,
    estimatedCost: parseFloat(row.estimated_cost) || 0,
    percentOfTotal: parseFloat(row.percent_of_total) || 0,
  }));
}

export async function getDailyUsageForExport(
  tenantId: string,
  days: number = 30
): Promise<{
  date: string;
  channel: string;
  direction: string;
  source: string;
  feature: string;
  count: number;
  estimatedCost: number;
}[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const result = await rootDb.execute(sql`
    SELECT 
      DATE(timestamp) as date,
      channel,
      direction,
      source,
      feature,
      COUNT(*) as count,
      SUM(CAST(total_cost AS NUMERIC)) as estimated_cost
    FROM usage_events
    WHERE tenant_id = ${tenantId}
      AND timestamp >= CURRENT_DATE - ${days}::integer
    GROUP BY DATE(timestamp), channel, direction, source, feature
    ORDER BY date DESC, channel, feature
  `);
  
  return result.rows.map((row: any) => ({
    date: row.date,
    channel: row.channel,
    direction: row.direction,
    source: row.source,
    feature: row.feature,
    count: parseInt(row.count) || 0,
    estimatedCost: parseFloat(row.estimated_cost) || 0,
  }));
}

export async function getAllTenantsUsageSummaryV2(): Promise<{
  tenantId: string;
  tenantName: string;
  businessName: string | null;
  planTier: string;
  totalEstimatedCost: number;
  aiCost: number;
  aiPercent: number;
  twilioCost: number;
  twilioPercent: number;
  emailsSent: number;
  smsCount: number;
  aiTokensTotal: number;
}[]> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const result = await rootDb.execute(sql`
    WITH tenant_usage AS (
      SELECT 
        ue.tenant_id,
        SUM(CAST(ue.total_cost AS NUMERIC)) as total_cost,
        SUM(CASE WHEN ue.source = 'openai' THEN CAST(ue.total_cost AS NUMERIC) ELSE 0 END) as ai_cost,
        SUM(CASE WHEN ue.source = 'twilio' THEN CAST(ue.total_cost AS NUMERIC) ELSE 0 END) as twilio_cost,
        SUM(CASE WHEN ue.channel = 'email' THEN 1 ELSE 0 END) as emails_sent,
        SUM(CASE WHEN ue.channel IN ('sms', 'mms') THEN 1 ELSE 0 END) as sms_count,
        SUM(CASE WHEN ue.channel = 'ai' THEN ue.quantity ELSE 0 END) as ai_tokens_total
      FROM usage_events ue
      WHERE ue.timestamp >= ${startOfMonth.toISOString()}::timestamptz
      GROUP BY ue.tenant_id
    )
    SELECT 
      t.id as tenant_id,
      t.name as tenant_name,
      tc.business_name,
      t.plan_tier,
      COALESCE(tu.total_cost, 0) as total_estimated_cost,
      COALESCE(tu.ai_cost, 0) as ai_cost,
      CASE 
        WHEN COALESCE(tu.total_cost, 0) > 0 
        THEN (COALESCE(tu.ai_cost, 0) / tu.total_cost * 100)
        ELSE 0
      END as ai_percent,
      COALESCE(tu.twilio_cost, 0) as twilio_cost,
      CASE 
        WHEN COALESCE(tu.total_cost, 0) > 0 
        THEN (COALESCE(tu.twilio_cost, 0) / tu.total_cost * 100)
        ELSE 0
      END as twilio_percent,
      COALESCE(tu.emails_sent, 0) as emails_sent,
      COALESCE(tu.sms_count, 0) as sms_count,
      COALESCE(tu.ai_tokens_total, 0) as ai_tokens_total
    FROM tenants t
    LEFT JOIN tenant_config tc ON tc.tenant_id = t.id
    LEFT JOIN tenant_usage tu ON tu.tenant_id = t.id
    WHERE t.status != 'cancelled'
    ORDER BY total_estimated_cost DESC
  `);
  
  return result.rows.map((row: any) => ({
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    businessName: row.business_name,
    planTier: row.plan_tier,
    totalEstimatedCost: parseFloat(row.total_estimated_cost) || 0,
    aiCost: parseFloat(row.ai_cost) || 0,
    aiPercent: parseFloat(row.ai_percent) || 0,
    twilioCost: parseFloat(row.twilio_cost) || 0,
    twilioPercent: parseFloat(row.twilio_percent) || 0,
    emailsSent: parseInt(row.emails_sent) || 0,
    smsCount: parseInt(row.sms_count) || 0,
    aiTokensTotal: parseInt(row.ai_tokens_total) || 0,
  }));
}

export async function rollupFeatureUsageDaily(date?: Date): Promise<void> {
  const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dateStr = targetDate.toISOString().split('T')[0];
  
  console.log(`[USAGE FEATURE ROLLUP] Starting rollup for ${dateStr}`);
  
  const rootDb = wrapTenantDb(db, 'root');
  
  const aggregates = await rootDb.execute(sql`
    SELECT 
      tenant_id,
      channel,
      direction,
      source,
      feature,
      COUNT(*) as event_count,
      SUM(quantity) as total_quantity,
      SUM(CAST(total_cost AS NUMERIC)) as estimated_cost,
      SUM(CASE WHEN channel = 'ai' THEN (metadata->>'inputTokens')::integer ELSE NULL END) as ai_input_tokens,
      SUM(CASE WHEN channel = 'ai' THEN (metadata->>'outputTokens')::integer ELSE NULL END) as ai_output_tokens
    FROM usage_events
    WHERE DATE(timestamp) = ${dateStr}::date
    GROUP BY tenant_id, channel, direction, source, feature
  `);
  
  for (const row of aggregates.rows) {
    const agg = row as any;
    
    await rootDb.execute(sql`
      DELETE FROM usage_feature_rollups 
      WHERE tenant_id = ${agg.tenant_id}
        AND date = ${dateStr}::date
        AND channel = ${agg.channel}
        AND direction = ${agg.direction}
        AND source = ${agg.source}
        AND feature = ${agg.feature}
    `);
    
    await rootDb.execute(sql`
      INSERT INTO usage_feature_rollups (
        tenant_id, date, channel, direction, source, feature,
        event_count, total_quantity, estimated_cost_usd,
        ai_input_tokens, ai_output_tokens
      ) VALUES (
        ${agg.tenant_id}, ${dateStr}::date, ${agg.channel}, ${agg.direction}, 
        ${agg.source}, ${agg.feature},
        ${parseInt(agg.event_count) || 0}, ${parseInt(agg.total_quantity) || 0},
        ${parseFloat(agg.estimated_cost) || 0},
        ${agg.ai_input_tokens ? parseInt(agg.ai_input_tokens) : null},
        ${agg.ai_output_tokens ? parseInt(agg.ai_output_tokens) : null}
      )
    `);
  }
  
  console.log(`[USAGE FEATURE ROLLUP] Completed rollup with ${aggregates.rows.length} feature aggregates`);
}
