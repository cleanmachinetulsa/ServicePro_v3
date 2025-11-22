import { Router } from 'express';
import { appointments, invoices, services, emailCampaigns, appointmentUpsells, customers } from '@shared/schema';
import { sql, gte, lte, and, eq, desc } from 'drizzle-orm';

const router = Router();

// Get seasonal trends - appointments and revenue by month
router.get('/seasonal-trends', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - Number(months));

    // Get appointments by month
    const appointmentTrends = await (req as any).tenantDb!
      .select({
        month: sql<string>`TO_CHAR(${appointments.scheduledTime}, 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
        completed: sql<number>`SUM(CASE WHEN ${appointments.completed} = true THEN 1 ELSE 0 END)::int`
      })
      .from(appointments)
      .where((req as any).tenantDb!.withTenantFilter(appointments, gte(appointments.scheduledTime, monthsAgo)))
      .groupBy(sql`TO_CHAR(${appointments.scheduledTime}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${appointments.scheduledTime}, 'YYYY-MM')`);

    // Get revenue by month
    const revenueTrends = await (req as any).tenantDb!
      .select({
        month: sql<string>`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`,
        revenue: sql<number>`SUM(${invoices.amount})::numeric`,
        paidRevenue: sql<number>`SUM(CASE WHEN ${invoices.paymentStatus} = 'paid' THEN ${invoices.amount} ELSE 0 END)::numeric`,
        invoiceCount: sql<number>`COUNT(*)::int`
      })
      .from(invoices)
      .where((req as any).tenantDb!.withTenantFilter(invoices, gte(invoices.createdAt, monthsAgo)))
      .groupBy(sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`);

    res.json({
      success: true,
      appointments: appointmentTrends,
      revenue: revenueTrends
    });
  } catch (error) {
    console.error('Error fetching seasonal trends:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch seasonal trends' });
  }
});

// Get service popularity - which services are booked most
router.get('/service-popularity', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - Number(months));

    const serviceStats = await (req as any).tenantDb!
      .select({
        serviceName: services.name,
        count: sql<number>`COUNT(*)::int`,
        completed: sql<number>`SUM(CASE WHEN ${appointments.completed} = true THEN 1 ELSE 0 END)::int`,
        cancelled: sql<number>`COUNT(*) - SUM(CASE WHEN ${appointments.completed} = true THEN 1 ELSE 0 END)::int`
      })
      .from(appointments)
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where((req as any).tenantDb!.withTenantFilter(appointments, gte(appointments.scheduledTime, monthsAgo)))
      .groupBy(services.name)
      .orderBy(desc(sql`COUNT(*)`));

    res.json({
      success: true,
      services: serviceStats
    });
  } catch (error) {
    console.error('Error fetching service popularity:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch service popularity' });
  }
});

// Get campaign effectiveness - bookings/revenue after email campaigns
router.get('/campaign-effectiveness', async (req, res) => {
  try {
    // Get all sent campaigns
    const campaigns = await (req as any).tenantDb!
      .select()
      .from(emailCampaigns)
      .where((req as any).tenantDb!.withTenantFilter(emailCampaigns, eq(emailCampaigns.status, 'sent')))
      .orderBy(desc(emailCampaigns.sentAt));

    // For each campaign, count appointments/revenue in the 7 days after sending
    const campaignStats = await Promise.all(
      campaigns.map(async (campaign) => {
        if (!campaign.sentAt) return null;

        const weekAfter = new Date(campaign.sentAt);
        weekAfter.setDate(weekAfter.getDate() + 7);

        const appointmentsAfter = await (req as any).tenantDb!
          .select({
            count: sql<number>`COUNT(*)::int`,
            revenue: sql<number>`COALESCE(SUM(${invoices.amount}), 0)::numeric`
          })
          .from(appointments)
          .leftJoin(invoices, eq(appointments.id, invoices.appointmentId))
          .where(
            (req as any).tenantDb!.withTenantFilter(appointments,
              and(
                gte(appointments.scheduledTime, campaign.sentAt),
                lte(appointments.scheduledTime, weekAfter)
              )
            )
          );

        return {
          campaignName: campaign.name,
          sentDate: campaign.sentAt,
          recipientCount: campaign.recipientCount,
          openRate: Number(campaign.openRate || 0),
          clickRate: Number(campaign.clickRate || 0),
          appointmentsGenerated: appointmentsAfter[0]?.count || 0,
          revenueGenerated: Number(appointmentsAfter[0]?.revenue || 0)
        };
      })
    );

    res.json({
      success: true,
      campaigns: campaignStats.filter(c => c !== null)
    });
  } catch (error) {
    console.error('Error fetching campaign effectiveness:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch campaign effectiveness' });
  }
});

// Get financial forecast - predict future revenue based on trends
router.get('/financial-forecast', async (req, res) => {
  try {
    // Get last 12 months of revenue data
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const historicalRevenue = await (req as any).tenantDb!
      .select({
        month: sql<string>`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`,
        revenue: sql<number>`SUM(CASE WHEN ${invoices.paymentStatus} = 'paid' THEN ${invoices.amount} ELSE 0 END)::numeric`,
        appointmentCount: sql<number>`COUNT(DISTINCT ${invoices.appointmentId})::int`
      })
      .from(invoices)
      .where((req as any).tenantDb!.withTenantFilter(invoices, gte(invoices.createdAt, twelveMonthsAgo)))
      .groupBy(sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`);

    // Calculate simple moving average for forecast
    const revenues = historicalRevenue.map(r => Number(r.revenue));
    const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    
    // Calculate growth rate
    const firstHalf = revenues.slice(0, Math.floor(revenues.length / 2));
    const secondHalf = revenues.slice(Math.floor(revenues.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const growthRate = (secondAvg - firstAvg) / firstAvg;

    // Generate 6-month forecast
    const forecast = [];
    const now = new Date();
    for (let i = 1; i <= 6; i++) {
      const forecastDate = new Date(now);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      const month = forecastDate.toISOString().slice(0, 7);
      const predictedRevenue = avgRevenue * (1 + (growthRate * i));
      
      forecast.push({
        month,
        predictedRevenue: Math.round(predictedRevenue),
        confidence: Math.max(0.5, 1 - (i * 0.1)) // Confidence decreases over time
      });
    }

    // Get customer acquisition trends
    const customerTrends = await (req as any).tenantDb!
      .select({
        month: sql<string>`TO_CHAR(${customers.lastInteraction}, 'YYYY-MM')`,
        newCustomers: sql<number>`COUNT(DISTINCT ${customers.id})::int`
      })
      .from(customers)
      .where((req as any).tenantDb!.withTenantFilter(customers, gte(customers.lastInteraction, twelveMonthsAgo)))
      .groupBy(sql`TO_CHAR(${customers.lastInteraction}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${customers.lastInteraction}, 'YYYY-MM')`);

    res.json({
      success: true,
      historical: historicalRevenue,
      forecast,
      metrics: {
        avgMonthlyRevenue: Math.round(avgRevenue),
        growthRate: Math.round(growthRate * 100) / 100,
        totalRevenue: revenues.reduce((a, b) => a + b, 0)
      },
      customerTrends
    });
  } catch (error) {
    console.error('Error generating financial forecast:', error);
    res.status(500).json({ success: false, error: 'Failed to generate forecast' });
  }
});

// Get upsell performance
router.get('/upsell-performance', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - Number(months));

    const upsellStats = await (req as any).tenantDb!
      .select({
        month: sql<string>`TO_CHAR(${appointmentUpsells.offeredAt}, 'YYYY-MM')`,
        offered: sql<number>`COUNT(*)::int`,
        accepted: sql<number>`SUM(CASE WHEN ${appointmentUpsells.status} = 'accepted' THEN 1 ELSE 0 END)::int`,
        declined: sql<number>`SUM(CASE WHEN ${appointmentUpsells.status} = 'declined' THEN 1 ELSE 0 END)::int`,
        revenue: sql<number>`SUM(CASE WHEN ${appointmentUpsells.status} = 'accepted' THEN ${appointmentUpsells.discountApplied} ELSE 0 END)::numeric`
      })
      .from(appointmentUpsells)
      .where((req as any).tenantDb!.withTenantFilter(appointmentUpsells, gte(appointmentUpsells.offeredAt, monthsAgo)))
      .groupBy(sql`TO_CHAR(${appointmentUpsells.offeredAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${appointmentUpsells.offeredAt}, 'YYYY-MM')`);

    res.json({
      success: true,
      upsells: upsellStats
    });
  } catch (error) {
    console.error('Error fetching upsell performance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch upsell performance' });
  }
});

export default router;
