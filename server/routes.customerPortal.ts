/**
 * Phase 15 - Customer Portal Routes
 * 
 * Protected routes for authenticated customers to access their data.
 * Requires tenantMiddleware and customerPortalAuthMiddleware.
 */

import { Router } from 'express';
import { customerPortalAuthMiddleware } from './customerPortalAuthMiddleware';
import { tenantMiddleware } from './tenantMiddleware';
import { appointments, loyaltyTransactions } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import type { TenantDb } from './tenantDb';

const router = Router();

// Apply tenant middleware first, then customer auth
router.use(tenantMiddleware);
router.use(customerPortalAuthMiddleware);

/**
 * GET /api/portal/me
 * 
 * Get authenticated customer's profile and overview data
 */
router.get('/me', async (req, res) => {
  try {
    const customer = req.customer!;
    const customerIdentity = req.customerIdentity;
    const tenantDb = req.tenantDb as TenantDb;

    // Get upcoming appointments
    const now = new Date();
    const upcomingAppointments = await tenantDb
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.customerId, customer.id),
          gte(appointments.scheduledTime, now)
        )
      )
      .orderBy(appointments.scheduledTime)
      .limit(5);

    // Get recent appointments
    const recentAppointments = await tenantDb
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, customer.id))
      .orderBy(desc(appointments.scheduledTime))
      .limit(5);

    // Get recent loyalty transactions
    const recentLoyaltyTx = await tenantDb
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.customerId, customer.id))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(10);

    // Calculate total points from loyaltyTransactions
    let totalPoints = 0;
    for (const tx of recentLoyaltyTx) {
      totalPoints += Number(tx.points || 0);
    }

    // Build response
    const response = {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        vehicleInfo: customer.vehicleInfo,
        loyaltyTier: customer.loyaltyTier,
        isVip: customer.isVip,
      },
      identity: customerIdentity ? {
        lastLoginAt: customerIdentity.lastLoginAt,
      } : null,
      appointments: {
        upcoming: upcomingAppointments.map(apt => ({
          id: apt.id,
          scheduledTime: apt.scheduledTime,
          serviceId: apt.serviceId,
          status: apt.status,
          address: apt.address,
          additionalRequests: apt.additionalRequests,
        })),
        recent: recentAppointments.map(apt => ({
          id: apt.id,
          scheduledTime: apt.scheduledTime,
          serviceId: apt.serviceId,
          status: apt.status,
          completedAt: apt.completedAt,
        })),
      },
      loyalty: {
        totalPoints,
        tier: customer.loyaltyTier,
        recentTransactions: recentLoyaltyTx.map(tx => ({
          id: tx.id,
          points: tx.points,
          description: tx.description,
          source: tx.source,
          createdAt: tx.createdAt,
        })),
      },
    };

    return res.json(response);
  } catch (error) {
    console.error('[CustomerPortal] /me error:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/portal/appointments
 * 
 * Get customer's appointment history
 */
router.get('/appointments', async (req, res) => {
  try {
    const customer = req.customer!;
    const tenantDb = req.tenantDb as TenantDb;

    const customerAppointments = await tenantDb
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, customer.id))
      .orderBy(desc(appointments.scheduledTime))
      .limit(50);

    return res.json({
      appointments: customerAppointments,
    });
  } catch (error) {
    console.error('[CustomerPortal] /appointments error:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/portal/loyalty
 * 
 * Get customer's loyalty points and transaction history
 */
router.get('/loyalty', async (req, res) => {
  try {
    const customer = req.customer!;
    const tenantDb = req.tenantDb as TenantDb;

    // Get all loyalty transactions
    const transactions = await tenantDb
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.customerId, customer.id))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(100);

    // Calculate total points
    let totalPoints = 0;
    for (const tx of transactions) {
      totalPoints += Number(tx.points || 0);
    }

    return res.json({
      totalPoints,
      tier: customer.loyaltyTier,
      transactions,
    });
  } catch (error) {
    console.error('[CustomerPortal] /loyalty error:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
