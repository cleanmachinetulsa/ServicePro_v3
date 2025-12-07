/**
 * SP-11: Root Admin Usage Overview API
 * 
 * Provides aggregate usage metrics across all tenants for platform monitoring.
 */
import { Router } from 'express';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { tenants } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';
import { getPlanLimits } from '@shared/pricing/planLimits';
import { calculateUsageCost } from '@shared/pricing/usagePricing';

const router = Router();

router.get('/api/root-admin/usage/overview', async (req, res) => {
  try {
    const session = req.session as any;
    
    if (!session?.tenantId || session.tenantId !== 'root') {
      return res.status(403).json({ success: false, error: 'Root access required' });
    }
    
    const role = session.role;
    if (role !== 'root_admin' && role !== 'owner' && role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Admin role required' });
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const allTenants = await db.select().from(tenants);

    const rootDb = wrapTenantDb(db, 'root');

    const usageResult = await rootDb.execute(sql`
      SELECT 
        tenant_id,
        COALESCE(SUM(sms_outbound_count + sms_inbound_count), 0) as sms_count,
        COALESCE(SUM(voice_minutes), 0) as voice_minutes,
        COALESCE(SUM(emails_sent), 0) as email_count,
        COALESCE(SUM(CEIL((ai_tokens_in + ai_tokens_out) / 1000.0)), 0) as ai_requests,
        COALESCE(SUM(mms_outbound_count + mms_inbound_count), 0) as mms_count
      FROM usage_metrics
      WHERE date >= ${periodStart.toISOString().split('T')[0]}::date
        AND date <= ${periodEnd.toISOString().split('T')[0]}::date
      GROUP BY tenant_id
    `);

    const usageByTenant: Record<string, any> = {};
    for (const row of usageResult.rows as any[]) {
      usageByTenant[row.tenant_id] = {
        smsCount: parseInt(row.sms_count) || 0,
        voiceMinutes: parseInt(row.voice_minutes) || 0,
        emailCount: parseInt(row.email_count) || 0,
        aiRequests: parseInt(row.ai_requests) || 0,
        mmsCount: parseInt(row.mms_count) || 0,
      };
    }

    let totalSms = 0;
    let totalVoiceMinutes = 0;
    let totalEmails = 0;
    let totalAiRequests = 0;
    let totalEstimatedCost = 0;
    let activeTenants = 0;
    const tenantsByPlan: Record<string, number> = {};

    const tenantsData = allTenants.map(tenant => {
      const planTier = tenant.planTier || 'starter';
      const limits = getPlanLimits(planTier);
      const usage = usageByTenant[tenant.id] || {
        smsCount: 0,
        voiceMinutes: 0,
        emailCount: 0,
        aiRequests: 0,
        mmsCount: 0,
      };

      const estimatedCost = calculateUsageCost({
        smsTotal: usage.smsCount,
        mmsTotal: usage.mmsCount,
        voiceTotalMinutes: usage.voiceMinutes,
        emailTotal: usage.emailCount,
        aiTotalTokens: usage.aiRequests * 1000,
      });

      totalSms += usage.smsCount;
      totalVoiceMinutes += usage.voiceMinutes;
      totalEmails += usage.emailCount;
      totalAiRequests += usage.aiRequests;
      totalEstimatedCost += estimatedCost;

      if (tenant.status === 'active' || tenant.status === 'trialing') {
        activeTenants++;
      }

      tenantsByPlan[planTier] = (tenantsByPlan[planTier] || 0) + 1;

      return {
        tenantId: tenant.id,
        name: tenant.name,
        planTier,
        status: tenant.status || 'unknown',
        usage: {
          smsCount: usage.smsCount,
          voiceMinutes: usage.voiceMinutes,
          emailCount: usage.emailCount,
          aiRequests: usage.aiRequests,
        },
        limits: {
          maxSmsPerMonth: limits.maxSmsPerMonth,
          maxVoiceMinutesPerMonth: limits.maxVoiceMinutesPerMonth,
          maxEmailsPerMonth: limits.maxEmailsPerMonth,
          maxAiRequestsPerMonth: limits.maxAiRequestsPerMonth,
        },
        estimatedCost,
      };
    });

    res.json({
      success: true,
      period: {
        label: periodLabel,
        startDate: periodStart.toISOString().split('T')[0],
        endDate: periodEnd.toISOString().split('T')[0],
      },
      aggregates: {
        totalTenants: allTenants.length,
        activeTenants,
        totalSms,
        totalVoiceMinutes,
        totalEmails,
        totalAiRequests,
        totalEstimatedCost,
        tenantsByPlan,
      },
      tenants: tenantsData,
    });
  } catch (error: any) {
    console.error('[AdminUsageOverview] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch usage overview' });
  }
});

export default router;
