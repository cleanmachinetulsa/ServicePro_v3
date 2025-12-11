/**
 * Customer Repository - Data Access Layer for Customer CRUD Operations
 * 
 * Provides tenant-scoped customer data access with proper normalization.
 * All functions enforce tenant isolation via TenantDb.
 * 
 * @module customerRepository
 */

import type { TenantDb } from '../tenantDb';
import { customers, type Customer, type InsertCustomer } from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';

export type CustomerRow = Customer;

/**
 * Find a customer by normalized phone number (tenant-scoped)
 */
export async function findByPhone(
  db: TenantDb,
  tenantId: string,
  phone: string
): Promise<CustomerRow | null> {
  const results = await db
    .select()
    .from(customers)
    .where(and(
      eq(customers.tenantId, tenantId),
      eq(customers.phone, phone)
    ))
    .limit(1);

  return results[0] || null;
}

/**
 * Find a customer by normalized email address (tenant-scoped)
 */
export async function findByEmail(
  db: TenantDb,
  tenantId: string,
  email: string
): Promise<CustomerRow | null> {
  const results = await db
    .select()
    .from(customers)
    .where(and(
      eq(customers.tenantId, tenantId),
      eq(customers.email, email)
    ))
    .limit(1);

  return results[0] || null;
}

/**
 * Find a customer by phone OR email (tenant-scoped)
 */
export async function findByPhoneOrEmail(
  db: TenantDb,
  tenantId: string,
  phone: string | null,
  email: string | null
): Promise<CustomerRow | null> {
  if (!phone && !email) return null;

  const conditions = [];
  if (phone) conditions.push(eq(customers.phone, phone));
  if (email) conditions.push(eq(customers.email, email));

  const results = await db
    .select()
    .from(customers)
    .where(and(
      eq(customers.tenantId, tenantId),
      or(...conditions)
    ))
    .limit(1);

  return results[0] || null;
}

/**
 * Update a customer record by ID (tenant-scoped)
 */
export async function updateCustomer(
  db: TenantDb,
  tenantId: string,
  customerId: number,
  updates: Partial<InsertCustomer>
): Promise<CustomerRow> {
  const [updated] = await db
    .update(customers)
    .set({
      ...updates,
      lastInteraction: new Date(),
    })
    .where(and(
      eq(customers.id, customerId),
      eq(customers.tenantId, tenantId)
    ))
    .returning();

  if (!updated) {
    throw new Error(`Customer ${customerId} not found in tenant ${tenantId}`);
  }

  return updated;
}

/**
 * Create a new customer record (tenant-scoped)
 */
export async function createCustomer(
  db: TenantDb,
  tenantId: string,
  data: Partial<InsertCustomer>
): Promise<CustomerRow> {
  const [created] = await db
    .insert(customers)
    .values({
      tenantId,
      name: data.name || 'Unknown',
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      vehicleInfo: data.vehicleInfo || null,
      notes: data.notes || null,
    })
    .returning();

  return created;
}

/**
 * Get a customer by ID (tenant-scoped)
 */
export async function getById(
  db: TenantDb,
  tenantId: string,
  customerId: number
): Promise<CustomerRow | null> {
  const results = await db
    .select()
    .from(customers)
    .where(and(
      eq(customers.id, customerId),
      eq(customers.tenantId, tenantId)
    ))
    .limit(1);

  return results[0] || null;
}

/**
 * Get total customer count for a tenant
 */
export async function getCustomerCount(
  db: TenantDb,
  tenantId: string
): Promise<number> {
  const results = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  return results.length;
}
