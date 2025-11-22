import { Router } from 'express';
import { 
  customers, 
  customerVehicles, 
  customerServiceHistory, 
  appointments 
} from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';

export function registerCustomerIntelligenceRoutes(app: Router) {
  const router = Router();

  /**
   * GET /api/customer-intelligence/:phone/profile
   * Get complete customer profile including vehicles and service history
   * SECURITY: Requires authentication to prevent unauthorized access to customer PII
   */
  router.get('/:phone/profile', requireAuth, async (req, res) => {
    try {
      const { phone } = req.params;

      const customer = await req.tenantDb!.query.customers.findFirst({
        where: req.tenantDb!.withTenantFilter(customers, eq(customers.phone, phone))
      });

      if (!customer) {
        return res.json({
          exists: false,
          isReturning: false
        });
      }

      const vehicles = await req.tenantDb!.query.customerVehicles.findMany({
        where: req.tenantDb!.withTenantFilter(customerVehicles, eq(customerVehicles.customerId, customer.id)),
        orderBy: [desc(customerVehicles.isPrimary), desc(customerVehicles.createdAt)]
      });

      const history = await req.tenantDb!.query.customerServiceHistory.findMany({
        where: req.tenantDb!.withTenantFilter(customerServiceHistory, eq(customerServiceHistory.customerId, customer.id)),
        orderBy: [desc(customerServiceHistory.serviceDate)],
        limit: 10
      });

      const stats = {
        totalAppointments: customer.totalAppointments || 0,
        lifetimeValue: customer.lifetimeValue || '0.00',
        firstVisit: customer.firstAppointmentAt,
        lastVisit: customer.lastAppointmentAt,
        isReturning: customer.isReturningCustomer
      };

      res.json({
        exists: true,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        },
        vehicles,
        serviceHistory: history,
        stats
      });

    } catch (error) {
      console.error('[CUSTOMER INTELLIGENCE] Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch customer profile' });
    }
  });

  /**
   * GET /api/customer-intelligence/:customerId/recent-services
   * Get recent services for AI context (last 3 services)
   * SECURITY: Requires authentication to prevent unauthorized access to customer service history
   */
  router.get('/:customerId/recent-services', requireAuth, async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);

      const recentServices = await req.tenantDb!.query.customerServiceHistory.findMany({
        where: req.tenantDb!.withTenantFilter(customerServiceHistory, eq(customerServiceHistory.customerId, customerId)),
        orderBy: [desc(customerServiceHistory.serviceDate)],
        limit: 3
      });

      res.json(recentServices);
    } catch (error) {
      console.error('[CUSTOMER INTELLIGENCE] Error fetching recent services:', error);
      res.status(500).json({ error: 'Failed to fetch recent services' });
    }
  });

  /**
   * POST /api/customer-intelligence/record-service
   * Record a completed service in history (called after appointment completion)
   */
  router.post('/record-service', requireAuth, async (req, res) => {
    try {
      const {
        customerId,
        appointmentId,
        serviceType,
        vehicleId,
        technicianId,
        amount
      } = req.body;

      const [historyRecord] = await req.tenantDb!.insert(customerServiceHistory).values({
        customerId,
        appointmentId,
        serviceDate: new Date(),
        serviceType,
        vehicleId,
        technicianId,
        amount: amount?.toString()
      }).returning();

      const customerStats = await req.tenantDb!
        .select({
          totalAppointments: sql<number>`count(*)`,
          lifetimeValue: sql<string>`COALESCE(sum(${customerServiceHistory.amount}), 0)`,
          firstAppointment: sql<Date>`min(${customerServiceHistory.serviceDate})`,
          lastAppointment: sql<Date>`max(${customerServiceHistory.serviceDate})`
        })
        .from(customerServiceHistory)
        .where(req.tenantDb!.withTenantFilter(customerServiceHistory, eq(customerServiceHistory.customerId, customerId)))
        .groupBy(customerServiceHistory.customerId);

      if (customerStats.length > 0) {
        const stats = customerStats[0];
        await req.tenantDb!.update(customers)
          .set({
            isReturningCustomer: stats.totalAppointments > 0,
            totalAppointments: stats.totalAppointments,
            lifetimeValue: stats.lifetimeValue,
            firstAppointmentAt: stats.firstAppointment,
            lastAppointmentAt: stats.lastAppointment
          })
          .where(req.tenantDb!.withTenantFilter(customers, eq(customers.id, customerId)));
      }

      res.json({ success: true, historyRecord });

    } catch (error) {
      console.error('[CUSTOMER INTELLIGENCE] Error recording service:', error);
      res.status(500).json({ error: 'Failed to record service' });
    }
  });

  app.use('/api/customer-intelligence', router);
}
