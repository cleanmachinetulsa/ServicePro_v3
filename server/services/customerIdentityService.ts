/**
 * Phase 15 - Customer Identity Service
 * 
 * Handles customer identity resolution and linking for customer portal authentication.
 * This service maps phone/email to customer records and manages identity lifecycle.
 */

import type { TenantDb } from '../tenantDb';
import { customers, customerIdentities, type CustomerIdentity, type InsertCustomerIdentity } from '@shared/schema';
import { eq, or, and } from 'drizzle-orm';
import { normalizePhoneE164, canonicalizeEmail } from '../contactUtils';

export interface ResolveCustomerIdentityArgs {
  tenantId: string;
  phone?: string;
  email?: string;
}

export interface ResolvedCustomerIdentity {
  tenantId: string;
  customerId: number;
  identityId: number;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
}

/**
 * Resolve or create a customer identity from phone/email
 * 
 * Logic:
 * 1. Normalize phone/email inputs
 * 2. Try to find existing customer by phone or email
 * 3. If found: ensure identity record exists (upsert)
 * 4. If not found: create minimal customer + identity record
 * 5. Return resolved identity
 */
export async function resolveCustomerIdentity(
  db: TenantDb,
  args: ResolveCustomerIdentityArgs,
): Promise<ResolvedCustomerIdentity> {
  const { tenantId, phone, email } = args;

  // Normalize inputs
  const normalizedPhone = phone ? normalizePhoneE164(phone) : null;
  const normalizedEmail = email ? canonicalizeEmail(email) : null;

  if (!normalizedPhone && !normalizedEmail) {
    throw new Error('At least one of phone or email is required');
  }

  // CRITICAL: Search for existing customer with EXPLICIT tenant filter
  // to prevent cross-tenant data leakage
  let customer;
  
  if (normalizedPhone && normalizedEmail) {
    // Search by phone OR email, but ALWAYS within tenant
    const existingCustomers = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        or(
          eq(customers.phone, normalizedPhone),
          eq(customers.email, normalizedEmail)
        )
      ))
      .limit(1);
    customer = existingCustomers[0];
  } else if (normalizedPhone) {
    const existingCustomers = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        eq(customers.phone, normalizedPhone)
      ))
      .limit(1);
    customer = existingCustomers[0];
  } else if (normalizedEmail) {
    const existingCustomers = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, normalizedEmail)
      ))
      .limit(1);
    customer = existingCustomers[0];
  }

  // If no customer found, create a minimal one
  if (!customer) {
    const [newCustomer] = await db
      .insert(customers)
      .values({
        tenantId,
        name: normalizedEmail || normalizedPhone || 'New Customer',
        phone: normalizedPhone,
        email: normalizedEmail,
      })
      .returning();
    
    customer = newCustomer;
    console.log(`[CustomerIdentity] Created new customer ID ${customer.id} for ${normalizedPhone || normalizedEmail}`);
  }

  // Ensure identity record exists (upsert)
  const existingIdentities = await db
    .select()
    .from(customerIdentities)
    .where(
      and(
        eq(customerIdentities.tenantId, tenantId),
        eq(customerIdentities.customerId, customer.id)
      )
    )
    .limit(1);

  let identity = existingIdentities[0];

  if (!identity) {
    // Create new identity
    const [newIdentity] = await db
      .insert(customerIdentities)
      .values({
        tenantId,
        customerId: customer.id,
        primaryPhone: normalizedPhone,
        primaryEmail: normalizedEmail,
      })
      .returning();
    
    identity = newIdentity;
    console.log(`[CustomerIdentity] Created identity ${identity.id} for customer ${customer.id}`);
  } else {
    // Update existing identity with latest phone/email if provided
    const updates: Partial<InsertCustomerIdentity> = {
      updatedAt: new Date(),
    };
    
    if (normalizedPhone && identity.primaryPhone !== normalizedPhone) {
      updates.primaryPhone = normalizedPhone;
    }
    if (normalizedEmail && identity.primaryEmail !== normalizedEmail) {
      updates.primaryEmail = normalizedEmail;
    }

    if (Object.keys(updates).length > 1) { // More than just updatedAt
      const [updatedIdentity] = await db
        .update(customerIdentities)
        .set(updates)
        .where(and(
          eq(customerIdentities.id, identity.id),
          eq(customerIdentities.tenantId, tenantId)
        ))
        .returning();
      
      identity = updatedIdentity;
      console.log(`[CustomerIdentity] Updated identity ${identity.id} with new contact info`);
    }
  }

  return {
    tenantId: identity.tenantId,
    customerId: identity.customerId,
    identityId: identity.id,
    primaryPhone: identity.primaryPhone,
    primaryEmail: identity.primaryEmail,
  };
}

/**
 * Update last login timestamp for an identity
 */
export async function updateLastLogin(
  db: TenantDb,
  identityId: number
): Promise<void> {
  await db
    .update(customerIdentities)
    .set({ lastLoginAt: new Date() })
    .where(eq(customerIdentities.id, identityId));
}

/**
 * Get customer identity by customer ID
 */
export async function getCustomerIdentity(
  db: TenantDb,
  customerId: number
): Promise<CustomerIdentity | null> {
  const identities = await db
    .select()
    .from(customerIdentities)
    .where(eq(customerIdentities.customerId, customerId))
    .limit(1);

  return identities[0] || null;
}
