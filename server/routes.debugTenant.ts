import { Express, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { 
  customers, 
  conversations, 
  messages, 
  appointments, 
  loyaltyPoints,
  rewardServices,
  redeemedRewards,
  smsCampaigns,
  emailCampaigns,
  smsTemplates,
  emailTemplates,
  upsellOffers
} from '@shared/schema';

export function registerDebugTenantRoutes(app: Express) {
  app.get('/api/debug/tenant/snapshot', async (req: Request, res: Response) => {
    try {
      const tenant = req.tenant;
      const tenantDb = req.tenantDb;
      
      if (!tenant || !tenantDb) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated or no tenant context',
          debug: {
            hasTenant: !!tenant,
            hasTenantDb: !!tenantDb,
            sessionUserId: req.session?.userId,
            sessionTenantId: req.session?.tenantId
          }
        });
      }

      const tenantId = tenant.id;
      console.log('[DEBUG TENANT] Snapshot request for tenant:', tenantId);

      const countQuery = async (table: any, name: string) => {
        try {
          const result = await tenantDb.raw
            .select({ count: sql<number>`count(*)::int` })
            .from(table)
            .where(tenantDb.withTenantFilter(table));
          return result[0]?.count || 0;
        } catch (error) {
          console.error(`[DEBUG TENANT] Error counting ${name}:`, error);
          return -1;
        }
      };

      const [
        customersCount,
        conversationsCount,
        messagesCount,
        appointmentsCount,
        loyaltyPointsCount,
        rewardServicesCount,
        redeemedRewardsCount,
        smsCampaignsCount,
        emailCampaignsCount,
        smsTemplatesCount,
        emailTemplatesCount,
        upsellOffersCount
      ] = await Promise.all([
        countQuery(customers, 'customers'),
        countQuery(conversations, 'conversations'),
        countQuery(messages, 'messages'),
        countQuery(appointments, 'appointments'),
        countQuery(loyaltyPoints, 'loyalty_points'),
        countQuery(rewardServices, 'reward_services'),
        countQuery(redeemedRewards, 'redeemed_rewards'),
        countQuery(smsCampaigns, 'sms_campaigns'),
        countQuery(emailCampaigns, 'email_campaigns'),
        countQuery(smsTemplates, 'sms_templates'),
        countQuery(emailTemplates, 'email_templates'),
        countQuery(upsellOffers, 'upsell_offers')
      ]);

      const snapshot = {
        tenantContext: {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: tenant.subdomain || tenant.id,
          isRootTenant: tenant.isRoot
        },
        coreCounts: {
          customers: customersCount,
          conversations: conversationsCount,
          messages: messagesCount,
          appointments: appointmentsCount
        },
        engagementCounts: {
          loyalty_points: loyaltyPointsCount,
          reward_services: rewardServicesCount,
          redeemed_rewards: redeemedRewardsCount,
          sms_campaigns: smsCampaignsCount,
          email_campaigns: emailCampaignsCount,
          sms_templates: smsTemplatesCount,
          email_templates: emailTemplatesCount,
          upsell_offers: upsellOffersCount
        },
        timestamp: new Date().toISOString()
      };

      console.log('[DEBUG TENANT] Snapshot result:', JSON.stringify(snapshot, null, 2));

      res.json({
        success: true,
        ...snapshot
      });
    } catch (error) {
      console.error('[DEBUG TENANT] Snapshot error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      });
    }
  });

  console.log('[DEBUG TENANT] Routes registered: GET /api/debug/tenant/snapshot');
}
