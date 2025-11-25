import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { customerVehicles } from '@shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

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
  // Match on ALL fields including tenantId to avoid duplicates and ensure tenant isolation
  // Use isNull() for null comparisons to avoid SQL NULL comparison issues
  // Normalize undefined to null for consistent matching
  const normalizedYear = year ?? null;
  const normalizedMake = make ?? null;
  const normalizedModel = model ?? null;
  const normalizedColor = color ?? null;
  
  const conditions = [
    eq(customerVehicles.tenantId, tenantId), // CRITICAL: Tenant isolation
    eq(customerVehicles.customerId, customerId)
  ];
  
  // Add conditions for vehicle attributes, using isNull() for null values
  if (normalizedYear !== null) {
    conditions.push(eq(customerVehicles.year, normalizedYear));
  } else {
    conditions.push(isNull(customerVehicles.year));
  }
  
  if (normalizedMake !== null) {
    conditions.push(eq(customerVehicles.make, normalizedMake));
  } else {
    conditions.push(isNull(customerVehicles.make));
  }
  
  if (normalizedModel !== null) {
    conditions.push(eq(customerVehicles.model, normalizedModel));
  } else {
    conditions.push(isNull(customerVehicles.model));
  }
  
  if (normalizedColor !== null) {
    conditions.push(eq(customerVehicles.color, normalizedColor));
  } else {
    conditions.push(isNull(customerVehicles.color));
  }

  const [existing] = await tenantDb
    .select()
    .from(customerVehicles)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    return existing;
  }

  // Create new vehicle card with tenantId
  const [created] = await tenantDb
    .insert(customerVehicles)
    .values({
      tenantId, // CRITICAL: Include tenantId for multi-tenant isolation
      customerId,
      year: normalizedYear,
      make: normalizedMake,
      model: normalizedModel,
      color: normalizedColor,
      isPrimary: false, // Will be set to true if this is the first vehicle
    })
    .returning();

  // If this is the customer's first vehicle, mark it as primary
  // MUST include tenantId filter for tenant isolation
  const allVehicles = await tenantDb
    .select()
    .from(customerVehicles)
    .where(and(
      eq(customerVehicles.tenantId, tenantId),
      eq(customerVehicles.customerId, customerId)
    ));

  if (allVehicles.length === 1) {
    await tenantDb
      .update(customerVehicles)
      .set({ isPrimary: true })
      .where(and(
        eq(customerVehicles.tenantId, tenantId),
        eq(customerVehicles.id, created.id)
      ));
    
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
    .where(and(
      eq(customerVehicles.tenantId, tenantId), // CRITICAL: Tenant isolation
      eq(customerVehicles.customerId, customerId)
    ))
    .orderBy(desc(customerVehicles.isPrimary)); // Primary vehicle first
}
