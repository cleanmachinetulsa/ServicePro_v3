import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';
import { db } from '../db';
import { smsCampaigns, smsCampaignRecipients, smsDeliveryStatus } from '@shared/schema';

const TWILIO_ERROR_MEANINGS: Record<string, string> = {
  '21610': 'Unsubscribed recipient',
  '21611': 'Invalid destination number',
  '21612': 'Geographic permission error',
  '21614': 'To number not SMS-capable',
  '21617': 'Message body too long',
  '30001': 'Queue overflow',
  '30002': 'Account suspended',
  '30003': 'Unreachable destination',
  '30004': 'Message blocked',
  '30005': 'Unknown destination',
  '30006': 'Landline or unreachable',
  '30007': 'Carrier violation',
  '30008': 'Unknown error',
  '30009': 'Missing segment',
  '30010': 'Message price exceeds max',
  '63001': 'Channel not installed',
  '63002': 'Channel not available',
  '63003': 'Channel response parsing error',
  '63004': 'Channel authentication error',
};

export interface CampaignRunAnalytics {
  campaign: {
    id: number;
    name: string;
    tenantId: string;
    scheduledDate: Date | null;
    sentAt: Date | null;
    completedAt: Date | null;
    status: string;
    message: string;
    fromNumber: string | null;
  };
  totals: {
    total_outbound: number;
    delivered: number;
    sent: number;
    failed: number;
    undelivered: number;
    pending: number;
    skipped_unsubscribed: number;
    skipped_invalid: number;
    skipped_other: number;
  };
  error_breakdown: Array<{ error_code: string; count: number; meaning: string }>;
  status_breakdown: Array<{ status: string; count: number }>;
  skip_reason_breakdown: Array<{ skip_reason: string; count: number }>;
}

export interface DailyStats {
  date: string;
  total_outbound: number;
  delivered: number;
  failed: number;
  undelivered: number;
  sent: number;
}

export interface TenantSmsSummary {
  daily_stats: DailyStats[];
  totals: {
    total_outbound: number;
    delivered: number;
    failed: number;
    undelivered: number;
  };
  error_breakdown: Array<{ error_code: string; count: number; meaning: string }>;
  status_breakdown: Array<{ status: string; count: number }>;
}

export async function getCampaignRunAnalytics(
  campaignId: number,
  tenantId: string
): Promise<CampaignRunAnalytics | null> {
  const [campaign] = await db
    .select()
    .from(smsCampaigns)
    .where(and(eq(smsCampaigns.id, campaignId), eq(smsCampaigns.tenantId, tenantId)))
    .limit(1);

  if (!campaign) {
    return null;
  }

  const recipients = await db
    .select({
      status: smsCampaignRecipients.status,
      errorCode: smsCampaignRecipients.errorCode,
      skipReason: smsCampaignRecipients.skipReason,
      count: count(),
    })
    .from(smsCampaignRecipients)
    .where(eq(smsCampaignRecipients.campaignId, campaignId))
    .groupBy(smsCampaignRecipients.status, smsCampaignRecipients.errorCode, smsCampaignRecipients.skipReason);

  const totals = {
    total_outbound: 0,
    delivered: 0,
    sent: 0,
    failed: 0,
    undelivered: 0,
    pending: 0,
    skipped_unsubscribed: 0,
    skipped_invalid: 0,
    skipped_other: 0,
  };

  const errorCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const skipReasonCounts: Record<string, number> = {};

  for (const row of recipients) {
    const cnt = Number(row.count);
    totals.total_outbound += cnt;
    
    const status = row.status?.toLowerCase() || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + cnt;

    if (status === 'delivered') totals.delivered += cnt;
    else if (status === 'sent') totals.sent += cnt;
    else if (status === 'failed') totals.failed += cnt;
    else if (status === 'undelivered') totals.undelivered += cnt;
    else if (status === 'pending' || status === 'queued') totals.pending += cnt;
    else if (status === 'skipped') {
      const skipReason = row.skipReason || 'other';
      skipReasonCounts[skipReason] = (skipReasonCounts[skipReason] || 0) + cnt;
      if (skipReason === 'unsubscribed' || skipReason === 'sms_consent_false') {
        totals.skipped_unsubscribed += cnt;
      } else if (skipReason === 'invalid_phone' || skipReason === 'no_phone') {
        totals.skipped_invalid += cnt;
      } else {
        totals.skipped_other += cnt;
      }
    }

    if (row.errorCode) {
      errorCounts[row.errorCode] = (errorCounts[row.errorCode] || 0) + cnt;
    }
  }

  const error_breakdown = Object.entries(errorCounts)
    .map(([error_code, count]) => ({
      error_code,
      count,
      meaning: TWILIO_ERROR_MEANINGS[error_code] || 'Unknown error',
    }))
    .sort((a, b) => b.count - a.count);

  const status_breakdown = Object.entries(statusCounts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const skip_reason_breakdown = Object.entries(skipReasonCounts)
    .map(([skip_reason, count]) => ({ skip_reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      tenantId: campaign.tenantId,
      scheduledDate: campaign.scheduledDate,
      sentAt: campaign.sentAt,
      completedAt: campaign.completedAt,
      status: campaign.status,
      message: campaign.message,
      fromNumber: campaign.fromNumber,
    },
    totals,
    error_breakdown,
    status_breakdown,
    skip_reason_breakdown,
  };
}

export async function getTenantSmsSummary(
  tenantId: string,
  fromDate: Date,
  toDate: Date
): Promise<TenantSmsSummary> {
  const dailyResult = await db.execute(sql`
    SELECT 
      DATE(created_at AT TIME ZONE 'UTC') as date,
      COUNT(*) as total_outbound,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'undelivered') as undelivered,
      COUNT(*) FILTER (WHERE status = 'sent') as sent
    FROM sms_campaign_recipients
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${fromDate.toISOString()}
      AND created_at <= ${toDate.toISOString()}
    GROUP BY DATE(created_at AT TIME ZONE 'UTC')
    ORDER BY date ASC
  `);

  const daily_stats: DailyStats[] = (dailyResult.rows || []).map((row: any) => ({
    date: row.date,
    total_outbound: Number(row.total_outbound) || 0,
    delivered: Number(row.delivered) || 0,
    failed: Number(row.failed) || 0,
    undelivered: Number(row.undelivered) || 0,
    sent: Number(row.sent) || 0,
  }));

  const totals = daily_stats.reduce(
    (acc, day) => ({
      total_outbound: acc.total_outbound + day.total_outbound,
      delivered: acc.delivered + day.delivered,
      failed: acc.failed + day.failed,
      undelivered: acc.undelivered + day.undelivered,
    }),
    { total_outbound: 0, delivered: 0, failed: 0, undelivered: 0 }
  );

  const errorResult = await db.execute(sql`
    SELECT 
      error_code,
      COUNT(*) as count
    FROM sms_campaign_recipients
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${fromDate.toISOString()}
      AND created_at <= ${toDate.toISOString()}
      AND error_code IS NOT NULL
    GROUP BY error_code
    ORDER BY count DESC
  `);

  const error_breakdown = (errorResult.rows || []).map((row: any) => ({
    error_code: row.error_code,
    count: Number(row.count) || 0,
    meaning: TWILIO_ERROR_MEANINGS[row.error_code] || 'Unknown error',
  }));

  const statusResult = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as count
    FROM sms_campaign_recipients
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${fromDate.toISOString()}
      AND created_at <= ${toDate.toISOString()}
    GROUP BY status
    ORDER BY count DESC
  `);

  const status_breakdown = (statusResult.rows || []).map((row: any) => ({
    status: row.status,
    count: Number(row.count) || 0,
  }));

  return {
    daily_stats,
    totals,
    error_breakdown,
    status_breakdown,
  };
}

export async function getCampaignsList(tenantId: string): Promise<any[]> {
  const campaigns = await db
    .select({
      id: smsCampaigns.id,
      name: smsCampaigns.name,
      status: smsCampaigns.status,
      scheduledDate: smsCampaigns.scheduledDate,
      sentAt: smsCampaigns.sentAt,
      completedAt: smsCampaigns.completedAt,
      recipientCount: smsCampaigns.recipientCount,
      sentCount: smsCampaigns.sentCount,
      failedCount: smsCampaigns.failedCount,
      deliveredCount: smsCampaigns.deliveredCount,
      createdAt: smsCampaigns.createdAt,
    })
    .from(smsCampaigns)
    .where(eq(smsCampaigns.tenantId, tenantId))
    .orderBy(desc(smsCampaigns.createdAt))
    .limit(100);

  return campaigns;
}
