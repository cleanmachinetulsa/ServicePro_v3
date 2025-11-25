import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { customerVehicles } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Finds or creates a vehicle card for a customer.
 * Uses direct tenant isolation via wrapTenantDb.
 * 
 * @param tenantId - Tenant identifier for isolation
 * @param customerId - Customer ID who owns the vehicle
 * @param year - Vehicle year (optional)
 * @param make - Vehicle make (optional)
 * @param model - Vehicle model (optional)
 * @param color - Vehicle color (optional)
 * @returns Vehicle card record
 */
export async function findOrCreateVehicleCard(
  tenantId: string,
  customerId: number,
  year?: string | null,
  make?: string | null,
  model?: string | null,
  color?: string | null
) {
  const tenantDb = wrapTenantDb(db, tenantId);

  // Try to find a matching vehicle already
  // Match on all provided fields to avoid duplicates
  const conditions = [eq(customerVehicles.customerId, customerId)];
  
  if (year !== undefined) {
    conditions.push(eq(customerVehicles.year, year ?? null));
  }
  if (make !== undefined) {
    conditions.push(eq(customerVehicles.make, make ?? null));
  }
  if (model !== undefined) {
    conditions.push(eq(customerVehicles.model, model ?? null));
  }
  if (color !== undefined) {
    conditions.push(eq(customerVehicles.color, color ?? null));
  }

  const [existing] = await tenantDb
    .select()
    .from(customerVehicles)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    return existing;
  }

  // Create new vehicle card
  const [created] = await tenantDb
    .insert(customerVehicles)
    .values({
      customerId,
      year: year ?? null,
      make: make ?? null,
      model: model ?? null,
      color: color ?? null,
      isPrimary: false, // Will be set to true if this is the first vehicle
    })
    .returning();

  // If this is the customer's first vehicle, mark it as primary
  const allVehicles = await tenantDb
    .select()
    .from(customerVehicles)
    .where(eq(customerVehicles.customerId, customerId));

  if (allVehicles.length === 1) {
    await tenantDb
      .update(customerVehicles)
      .set({ isPrimary: true })
      .where(eq(customerVehicles.id, created.id));
    
    return { ...created, isPrimary: true };
  }

  return created;
}

/**
 * Gets all vehicles for a customer with tenant isolation
 */
export async function getCustomerVehicles(tenantId: string, customerId: number) {
  const tenantDb = wrapTenantDb(db, tenantId);

  return await tenantDb
    .select()
    .from(customerVehicles)
    .where(eq(customerVehicles.customerId, customerId))
    .orderBy(desc(customerVehicles.isPrimary)); // Primary vehicle first
}
