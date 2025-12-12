import type { TenantDb } from './tenantDb';
import { customers, appointments } from '@shared/schema';
import { eq, and, sql, desc, asc } from 'drizzle-orm';

/**
 * Customer Booking Stats Service
 * 
 * Centralized service for tracking customer booking statistics:
 * - totalAppointments: Count of all appointments (created)
 * - isReturningCustomer: True if customer has completed at least one appointment
 * - firstAppointmentAt: Timestamp of first appointment
 * - lastAppointmentAt: Timestamp of most recent appointment
 * 
 * All functions are transaction-safe and idempotent.
 */

/**
 * Record appointment creation for a customer
 * - Increment totalAppointments
 * - Set firstAppointmentAt if null
 * - Update lastAppointmentAt
 * 
 * FAIL-OPEN: This function will never throw or break the booking flow.
 * All errors are logged but swallowed to ensure bookings succeed even if stats write fails.
 * 
 * @param tenantDb - TenantDb instance
 * @param customerId - Customer ID
 * @param scheduledTime - Appointment scheduled time
 * @param txInstance - Optional transaction instance (for nested transactions)
 * @param context - Optional context for detailed error logging (tenantId, phone, service, eventId)
 */
export async function recordAppointmentCreated(
  tenantDb: TenantDb,
  customerId: number,
  scheduledTime: Date,
  txInstance?: any,
  context?: { tenantId?: string; phone?: string; service?: string; eventId?: string }
): Promise<boolean> {
  try {
    const ctx = context || {};
    const contextStr = Object.entries(ctx).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(' ');
    const contextLog = contextStr ? ` [${contextStr}]` : '';
    
    // FIXED: Detect if transaction is passed and use directly without nesting
    if (txInstance) {
      // Use passed transaction directly - NO nesting
      const [customer] = await txInstance
        .select({
          id: customers.id,
          totalAppointments: customers.totalAppointments,
          firstAppointmentAt: customers.firstAppointmentAt,
          lastAppointmentAt: customers.lastAppointmentAt,
        })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer) {
        console.error(`[BOOKING STATS] Customer ${customerId} not found${contextLog}`);
        return false;
      }

      // Calculate new values
      const newTotalAppointments = (customer.totalAppointments || 0) + 1;
      const firstAppointmentAt = customer.firstAppointmentAt || scheduledTime;
      
      // Update lastAppointmentAt if this is later than current
      let lastAppointmentAt = customer.lastAppointmentAt;
      if (!lastAppointmentAt || scheduledTime > lastAppointmentAt) {
        lastAppointmentAt = scheduledTime;
      }

      // Update customer stats
      await txInstance
        .update(customers)
        .set({
          totalAppointments: newTotalAppointments,
          firstAppointmentAt,
          lastAppointmentAt,
        })
        .where(eq(customers.id, customerId));

      console.log(`[BOOKING STATS] Updated customer ${customerId}: total=${newTotalAppointments}${contextLog}`);
      return true;
    } else {
      // Try transaction if available, else fall back to direct update
      const hasTransaction = tenantDb && typeof tenantDb.transaction === 'function';
      
      if (hasTransaction) {
        await tenantDb.transaction(async (tx: any) => {
          // Get current customer data
          const [customer] = await tx
            .select({
              id: customers.id,
              totalAppointments: customers.totalAppointments,
              firstAppointmentAt: customers.firstAppointmentAt,
              lastAppointmentAt: customers.lastAppointmentAt,
            })
            .from(customers)
            .where(eq(customers.id, customerId))
            .limit(1);

          if (!customer) {
            console.error(`[BOOKING STATS] Customer ${customerId} not found${contextLog}`);
            return;
          }

          // Calculate new values
          const newTotalAppointments = (customer.totalAppointments || 0) + 1;
          const firstAppointmentAt = customer.firstAppointmentAt || scheduledTime;
          
          // Update lastAppointmentAt if this is later than current
          let lastAppointmentAt = customer.lastAppointmentAt;
          if (!lastAppointmentAt || scheduledTime > lastAppointmentAt) {
            lastAppointmentAt = scheduledTime;
          }

          // Update customer stats
          await tx
            .update(customers)
            .set({
              totalAppointments: newTotalAppointments,
              firstAppointmentAt,
              lastAppointmentAt,
            })
            .where(eq(customers.id, customerId));

          console.log(`[BOOKING STATS] Updated customer ${customerId}: total=${newTotalAppointments}${contextLog}`);
        });
      } else {
        // Fallback: Direct update without transaction
        const [customer] = await tenantDb
          .select({
            id: customers.id,
            totalAppointments: customers.totalAppointments,
            firstAppointmentAt: customers.firstAppointmentAt,
            lastAppointmentAt: customers.lastAppointmentAt,
          })
          .from(customers)
          .where(eq(customers.id, customerId))
          .limit(1);

        if (!customer) {
          console.error(`[BOOKING STATS] Customer ${customerId} not found${contextLog}`);
          return false;
        }

        // Calculate new values
        const newTotalAppointments = (customer.totalAppointments || 0) + 1;
        const firstAppointmentAt = customer.firstAppointmentAt || scheduledTime;
        
        let lastAppointmentAt = customer.lastAppointmentAt;
        if (!lastAppointmentAt || scheduledTime > lastAppointmentAt) {
          lastAppointmentAt = scheduledTime;
        }

        // Direct update
        await tenantDb
          .update(customers)
          .set({
            totalAppointments: newTotalAppointments,
            firstAppointmentAt,
            lastAppointmentAt,
          })
          .where(eq(customers.id, customerId));

        console.log(`[BOOKING STATS] Updated customer ${customerId}: total=${newTotalAppointments} (no-tx fallback)${contextLog}`);
      }
      return true;
    }
  } catch (error) {
    // FAIL-OPEN: Log error but NEVER throw - booking must succeed
    const ctx = context || {};
    const contextStr = Object.entries(ctx).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(' ');
    const errorMsg = String(error).substring(0, 100);
    console.error(`[BOOKING STATS] FAIL-OPEN: stats write failed for customer ${customerId}: ${errorMsg}${contextStr ? ` [${contextStr}]` : ''}`);
    return false;
  }
}

/**
 * Record appointment completion for a customer
 * - Set isReturningCustomer = true (if they have completed at least one appointment)
 * - This marks them as a returning customer for future bookings
 * 
 * @param customerId - Customer ID
 * @param txInstance - Optional transaction instance (for nested transactions)
 */
export async function recordAppointmentCompleted(
  tenantDb: TenantDb,
  customerId: number,
  txInstance?: any
): Promise<void> {
  try {
    console.log(`[BOOKING STATS] Recording appointment completed for customer ${customerId}`);

    // FIXED: Detect if transaction is passed and use directly without nesting
    if (txInstance) {
      // Use passed transaction directly - NO nesting
      const [result] = await txInstance
        .select({
          completedCount: sql<number>`COUNT(*)::int`,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.customerId, customerId),
            eq(appointments.status, 'completed')
          )
        );

      const completedCount = result?.completedCount || 0;

      // If customer has at least 1 completed appointment, mark as returning customer
      if (completedCount >= 1) {
        await txInstance
          .update(customers)
          .set({
            isReturningCustomer: true,
          })
          .where(eq(customers.id, customerId));

        console.log(`[BOOKING STATS] Customer ${customerId} marked as returning customer (${completedCount} completed appointments)`);
      }
    } else {
      // Create new transaction
      await tenantDb.transaction(async (tx: any) => {
        // Count completed appointments for this customer
        const [result] = await tx
          .select({
            completedCount: sql<number>`COUNT(*)::int`,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.customerId, customerId),
              eq(appointments.status, 'completed')
            )
          );

        const completedCount = result?.completedCount || 0;

        // If customer has at least 1 completed appointment, mark as returning customer
        if (completedCount >= 1) {
          await tx
            .update(customers)
            .set({
              isReturningCustomer: true,
            })
            .where(eq(customers.id, customerId));

          console.log(`[BOOKING STATS] Customer ${customerId} marked as returning customer (${completedCount} completed appointments)`);
        }
      });
    }
  } catch (error) {
    console.error(`[BOOKING STATS] Error recording appointment completed for customer ${customerId}:`, error);
    // Don't throw - this is a non-blocking operation
  }
}

/**
 * Handle appointment cancellation for a customer
 * - Decrement totalAppointments (if > 0)
 * - Recalculate first/last appointment times from remaining appointments
 * 
 * Note: This is idempotent and safe to call multiple times
 * 
 * @param customerId - Customer ID
 * @param txInstance - Optional transaction instance (for nested transactions)
 */
export async function handleAppointmentCancellation(
  tenantDb: TenantDb,
  customerId: number,
  txInstance?: any
): Promise<void> {
  try {
    console.log(`[BOOKING STATS] Handling appointment cancellation for customer ${customerId}`);

    // FIXED: Detect if transaction is passed and use directly without nesting
    if (txInstance) {
      // Use passed transaction directly - NO nesting
      const [customer] = await txInstance
        .select({
          id: customers.id,
          totalAppointments: customers.totalAppointments,
        })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer) {
        console.error(`[BOOKING STATS] Customer ${customerId} not found`);
        return;
      }

      // Decrement totalAppointments (but not below 0)
      const newTotalAppointments = Math.max((customer.totalAppointments || 0) - 1, 0);

      // Recalculate first/last appointment times from non-cancelled appointments
      const activeAppointments = await txInstance
        .select({
          scheduledTime: appointments.scheduledTime,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.customerId, customerId),
            sql`${appointments.status} != 'cancelled'`
          )
        )
        .orderBy(asc(appointments.scheduledTime));

      let firstAppointmentAt = null;
      let lastAppointmentAt = null;

      if (activeAppointments.length > 0) {
        firstAppointmentAt = activeAppointments[0].scheduledTime;
        lastAppointmentAt = activeAppointments[activeAppointments.length - 1].scheduledTime;
      }

      // Update customer stats
      await txInstance
        .update(customers)
        .set({
          totalAppointments: newTotalAppointments,
          firstAppointmentAt,
          lastAppointmentAt,
        })
        .where(eq(customers.id, customerId));

      console.log(`[BOOKING STATS] Updated customer ${customerId} after cancellation:`, {
        totalAppointments: newTotalAppointments,
        firstAppointmentAt,
        lastAppointmentAt,
      });
    } else {
      // Create new transaction
      await tenantDb.transaction(async (tx: any) => {
        // Get current customer data
        const [customer] = await tx
          .select({
            id: customers.id,
            totalAppointments: customers.totalAppointments,
          })
          .from(customers)
          .where(eq(customers.id, customerId))
          .limit(1);

        if (!customer) {
          console.error(`[BOOKING STATS] Customer ${customerId} not found`);
          return;
        }

        // Decrement totalAppointments (but not below 0)
        const newTotalAppointments = Math.max((customer.totalAppointments || 0) - 1, 0);

        // Recalculate first/last appointment times from non-cancelled appointments
        const activeAppointments = await tx
          .select({
            scheduledTime: appointments.scheduledTime,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.customerId, customerId),
              sql`${appointments.status} != 'cancelled'`
            )
          )
          .orderBy(asc(appointments.scheduledTime));

        let firstAppointmentAt = null;
        let lastAppointmentAt = null;

        if (activeAppointments.length > 0) {
          firstAppointmentAt = activeAppointments[0].scheduledTime;
          lastAppointmentAt = activeAppointments[activeAppointments.length - 1].scheduledTime;
        }

        // Update customer stats
        await tx
          .update(customers)
          .set({
            totalAppointments: newTotalAppointments,
            firstAppointmentAt,
            lastAppointmentAt,
          })
          .where(eq(customers.id, customerId));

        console.log(`[BOOKING STATS] Updated customer ${customerId} after cancellation:`, {
          totalAppointments: newTotalAppointments,
          firstAppointmentAt,
          lastAppointmentAt,
        });
      });
    }
  } catch (error) {
    console.error(`[BOOKING STATS] Error handling cancellation for customer ${customerId}:`, error);
    // Don't throw - this is a non-blocking operation
  }
}

/**
 * Recalculate customer appointment stats from scratch
 * Used for backfill script and manual corrections
 * 
 * - Query all appointments for customer
 * - Recalculate totalAppointments from count
 * - Set isReturningCustomer based on completed appointments
 * - Update first/last appointment times
 * 
 * This is the source of truth and should be idempotent
 * 
 * @param customerId - Customer ID
 * @param txInstance - Optional transaction instance (for nested transactions)
 */
export async function recalcCustomerAppointmentStats(
  tenantDb: TenantDb,
  customerId: number,
  txInstance?: any
): Promise<void> {
  try {
    console.log(`[BOOKING STATS] Recalculating stats for customer ${customerId}`);

    // FIXED: Detect if transaction is passed and use directly without nesting
    if (txInstance) {
      // Use passed transaction directly - NO nesting
      const customerAppointments = await txInstance
        .select({
          id: appointments.id,
          scheduledTime: appointments.scheduledTime,
          status: appointments.status,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.customerId, customerId),
            sql`${appointments.status} != 'cancelled'`
          )
        )
        .orderBy(asc(appointments.scheduledTime));

      // Calculate stats from appointments
      const totalAppointments = customerAppointments.length;
      const completedAppointments = customerAppointments.filter(
        (appt) => appt.status === 'completed'
      );
      const isReturningCustomer = completedAppointments.length > 0;

      let firstAppointmentAt = null;
      let lastAppointmentAt = null;

      if (customerAppointments.length > 0) {
        firstAppointmentAt = customerAppointments[0].scheduledTime;
        lastAppointmentAt = customerAppointments[customerAppointments.length - 1].scheduledTime;
      }

      // Update customer with recalculated stats
      await txInstance
        .update(customers)
        .set({
          totalAppointments,
          isReturningCustomer,
          firstAppointmentAt,
          lastAppointmentAt,
        })
        .where(eq(customers.id, customerId));

      console.log(`[BOOKING STATS] Recalculated customer ${customerId}:`, {
        totalAppointments,
        completedAppointments: completedAppointments.length,
        isReturningCustomer,
        firstAppointmentAt,
        lastAppointmentAt,
      });
    } else {
      // Create new transaction
      await tenantDb.transaction(async (tx: any) => {
        // Get all non-cancelled appointments for this customer
        const customerAppointments = await tx
          .select({
            id: appointments.id,
            scheduledTime: appointments.scheduledTime,
            status: appointments.status,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.customerId, customerId),
              sql`${appointments.status} != 'cancelled'`
            )
          )
          .orderBy(asc(appointments.scheduledTime));

        // Calculate stats from appointments
        const totalAppointments = customerAppointments.length;
        const completedAppointments = customerAppointments.filter(
          (appt) => appt.status === 'completed'
        );
        const isReturningCustomer = completedAppointments.length > 0;

        let firstAppointmentAt = null;
        let lastAppointmentAt = null;

        if (customerAppointments.length > 0) {
          firstAppointmentAt = customerAppointments[0].scheduledTime;
          lastAppointmentAt = customerAppointments[customerAppointments.length - 1].scheduledTime;
        }

        // Update customer with recalculated stats
        await tx
          .update(customers)
          .set({
            totalAppointments,
            isReturningCustomer,
            firstAppointmentAt,
            lastAppointmentAt,
          })
          .where(eq(customers.id, customerId));

        console.log(`[BOOKING STATS] Recalculated customer ${customerId}:`, {
          totalAppointments,
          completedAppointments: completedAppointments.length,
          isReturningCustomer,
          firstAppointmentAt,
          lastAppointmentAt,
        });
      });
    }
  } catch (error) {
    console.error(`[BOOKING STATS] Error recalculating stats for customer ${customerId}:`, error);
    throw error; // Throw for backfill script to handle
  }
}

/**
 * Batch recalculate stats for multiple customers
 * Used for efficient backfill processing
 * 
 * @param customerIds - Array of customer IDs
 * @returns Object with success/failure counts
 */
export async function batchRecalcCustomerStats(
  tenantDb: TenantDb,
  customerIds: number[]
): Promise<{ success: number; failed: number; errors: Array<{ customerId: number; error: string }> }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ customerId: number; error: string }>,
  };

  console.log(`[BOOKING STATS] Batch recalculating stats for ${customerIds.length} customers`);

  for (const customerId of customerIds) {
    try {
      await recalcCustomerAppointmentStats(tenantDb, customerId);
      results.success++;
    } catch (error: any) {
      results.failed++;
      results.errors.push({
        customerId,
        error: error.message || 'Unknown error',
      });
      console.error(`[BOOKING STATS] Failed to recalc customer ${customerId}:`, error);
    }
  }

  console.log(`[BOOKING STATS] Batch complete:`, {
    total: customerIds.length,
    success: results.success,
    failed: results.failed,
  });

  return results;
}
