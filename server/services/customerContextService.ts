/**
 * Phase 15 - Customer Context Service
 * 
 * Provides rich customer context for AI-powered features.
 * This service is designed to be called by AI agents to personalize responses.
 * 
 * Future enhancements (not implemented in Phase 15):
 * - Integration with conversation handlers
 * - Personalized service recommendations based on history
 * - Customer preference tracking
 * - Predictive maintenance scheduling
 */

import { tenantDb } from '../tenantDb';
import { customers, appointments, loyaltyTransactions } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

/**
 * Customer context for AI personalization
 */
export interface CustomerContext {
  customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    vehicleInfo: string | null;
    loyaltyTier: string;
    isVip: boolean;
    lastVisit: Date | null;
  };
  history: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    lastAppointmentDate: Date | null;
    favoriteServices: string[];
  };
  loyalty: {
    totalPoints: number;
    tier: string;
    lifetimeValue: number;
  };
  preferences: {
    preferredContactMethod: 'sms' | 'email' | 'phone' | null;
    preferredTimeSlots: string[];
    specialRequests: string[];
  };
}

/**
 * Get comprehensive customer context for AI personalization
 * 
 * @param tenantId - Tenant ID (for multi-tenant isolation)
 * @param customerId - Customer ID
 * @returns Rich customer context object
 */
export async function getCustomerContext(
  tenantId: string,
  customerId: number
): Promise<CustomerContext | null> {
  const db = tenantDb.withTenantFilter(tenantId);

  // Get customer record
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) {
    return null;
  }

  // Get appointment history
  const allAppointments = await db
    .select()
    .from(appointments)
    .where(eq(appointments.customerId, customerId))
    .orderBy(desc(appointments.scheduledTime));

  const completedCount = allAppointments.filter(
    (apt) => apt.status === 'completed'
  ).length;

  const cancelledCount = allAppointments.filter(
    (apt) => apt.status === 'cancelled'
  ).length;

  const lastAppointment = allAppointments[0];

  // Get loyalty info
  const loyaltyTxns = await db
    .select()
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.customerId, customerId))
    .orderBy(desc(loyaltyTransactions.createdAt));

  const totalPoints = loyaltyTxns.reduce((sum, txn) => sum + txn.points, 0);

  // Calculate lifetime value (approximate based on completed appointments)
  // This is a simple heuristic - in production, you'd use actual payment data
  const avgServiceValue = 150; // Placeholder
  const lifetimeValue = completedCount * avgServiceValue;

  // Analyze favorite services (most frequently booked)
  const serviceFrequency = new Map<number, number>();
  allAppointments.forEach((apt) => {
    const count = serviceFrequency.get(apt.serviceId) || 0;
    serviceFrequency.set(apt.serviceId, count + 1);
  });

  const topServiceIds = Array.from(serviceFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((entry) => entry[0]);

  // In production, you'd fetch service names from the services table
  const favoriteServices = topServiceIds.map((id) => `Service ID ${id}`);

  // Analyze preferred time slots (not implemented - placeholder)
  const preferredTimeSlots: string[] = [];

  // Analyze special requests (not implemented - placeholder)
  const specialRequests: string[] = [];

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      vehicleInfo: customer.vehicleInfo,
      loyaltyTier: customer.loyaltyTier,
      isVip: customer.isVip || false,
      lastVisit: lastAppointment?.scheduledTime || null,
    },
    history: {
      totalAppointments: allAppointments.length,
      completedAppointments: completedCount,
      cancelledAppointments: cancelledCount,
      lastAppointmentDate: lastAppointment?.scheduledTime || null,
      favoriteServices,
    },
    loyalty: {
      totalPoints,
      tier: customer.loyaltyTier,
      lifetimeValue,
    },
    preferences: {
      preferredContactMethod: customer.email ? 'email' : 'sms',
      preferredTimeSlots,
      specialRequests,
    },
  };
}

/**
 * Get simplified customer summary for quick AI context
 * 
 * @param tenantId - Tenant ID
 * @param customerId - Customer ID
 * @returns Brief customer summary string for AI prompts
 */
export async function getCustomerSummary(
  tenantId: string,
  customerId: number
): Promise<string | null> {
  const context = await getCustomerContext(tenantId, customerId);

  if (!context) {
    return null;
  }

  const { customer, history, loyalty } = context;

  const parts = [
    `Customer: ${customer.name}`,
    customer.isVip ? '(VIP)' : '',
    `- ${history.totalAppointments} appointments (${history.completedAppointments} completed)`,
    `- ${loyalty.totalPoints} loyalty points (${loyalty.tier} tier)`,
    customer.lastVisit ? `- Last visit: ${customer.lastVisit.toLocaleDateString()}` : '',
    history.favoriteServices.length > 0
      ? `- Favorite services: ${history.favoriteServices.join(', ')}`
      : '',
  ];

  return parts.filter(Boolean).join('\n');
}

/**
 * Check if customer has any upcoming appointments
 * 
 * @param tenantId - Tenant ID
 * @param customerId - Customer ID
 * @returns True if customer has upcoming appointments
 */
export async function hasUpcomingAppointments(
  tenantId: string,
  customerId: number
): Promise<boolean> {
  const db = tenantDb.withTenantFilter(tenantId);

  const now = new Date();
  const [result] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.customerId, customerId),
        gte(appointments.scheduledTime, now)
      )
    )
    .limit(1);

  return !!result;
}
