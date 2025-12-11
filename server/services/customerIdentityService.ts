/**
 * Customer Identity Service
 * 
 * Unified service for customer identity resolution, creation, and enrichment.
 * 
 * Features:
 * - Phone/email normalization
 * - Find-or-create with smart merge (never overwrites existing good data)
 * - Portal authentication support (Phase 15)
 * - Multi-tenant isolation via TenantDb
 * 
 * @module customerIdentityService
 */

import type { TenantDb } from '../tenantDb';
import { customers, customerIdentities, type Customer, type CustomerIdentity, type InsertCustomerIdentity } from '@shared/schema';
import { eq, or, and } from 'drizzle-orm';
import { normalizePhoneE164, canonicalizeEmail } from '../contactUtils';
import * as customerRepository from './customerRepository';

const LOG_PREFIX = '[CUSTOMER IDENTITY]';

// ============================================================
// NORMALIZATION HELPERS
// ============================================================

/**
 * Normalize phone to E.164 format (supports international numbers)
 * Reuses existing normalizePhoneE164 from contactUtils for consistency
 * Returns null if phone is invalid or empty
 */
export function normalizePhone(raw?: string | null): string | null {
  // Reuse the existing E.164 normalizer from contactUtils
  return normalizePhoneE164(raw || null);
}

/**
 * Normalize email to lowercase, trimmed (uses canonicalizeEmail from contactUtils)
 * Returns null if email is invalid or empty
 */
export function normalizeEmail(raw?: string | null): string | null {
  return canonicalizeEmail(raw || null);
}

/**
 * Check if an import source is already present in comma-separated sources
 * Uses exact token matching
 */
function hasImportSource(currentSources: string | null, source: string): boolean {
  if (!currentSources) return false;
  const tokens = currentSources.split(',').map(s => s.trim().toLowerCase());
  return tokens.includes(source.toLowerCase());
}

/**
 * Append import source if not already present (exact token match)
 */
function appendImportSource(currentSources: string | null, source: string): string {
  if (!currentSources) return source;
  if (hasImportSource(currentSources, source)) return currentSources;
  return `${currentSources},${source}`;
}

// ============================================================
// CUSTOMER IDENTITY INPUT/OUTPUT TYPES
// ============================================================

export interface CustomerIdentityInput {
  tenantId: string;
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  address?: string | null;
  vehicleDescription?: string | null;
  notes?: string | null;
  source?: string | null;
}

export interface FindOrCreateResult {
  customer: Customer;
  createdNew: boolean;
  updatedExisting: boolean;
}

export interface FindOrCreatePreviewResult {
  wouldCreate: boolean;
  wouldUpdate: boolean;
  wouldSkip: boolean;
  matchedBy?: 'phone' | 'email' | null;
}

// ============================================================
// FIND OR CREATE CUSTOMER (MAIN FUNCTION)
// ============================================================

/**
 * Find or create a customer with smart merge behavior.
 * 
 * Logic:
 * 1. Normalize phone/email
 * 2. Search for existing customer by phone, then by email
 * 3. If found: merge new data into existing (fill blanks, append notes)
 * 4. If not found: create new customer with all provided data
 * 
 * Merge rules:
 * - Never overwrites existing non-empty fields
 * - Notes are appended with source tag
 * - Phone/email are filled if blank
 */
export async function findOrCreateCustomer(
  db: TenantDb,
  input: CustomerIdentityInput
): Promise<FindOrCreateResult> {
  const { tenantId, source = 'import' } = input;

  const normalizedPhone = normalizePhone(input.phone);
  const normalizedEmail = normalizeEmail(input.email);

  console.log(`${LOG_PREFIX} findOrCreateCustomer: phone=${normalizedPhone}, email=${normalizedEmail}, source=${source}`);

  // 1) Try to find existing customer by phone, then email
  let existing: Customer | null = null;

  if (normalizedPhone) {
    existing = await customerRepository.findByPhone(db, tenantId, normalizedPhone);
    if (existing) {
      console.log(`${LOG_PREFIX} Found existing customer by phone: ID=${existing.id}`);
    }
  }

  if (!existing && normalizedEmail) {
    existing = await customerRepository.findByEmail(db, tenantId, normalizedEmail);
    if (existing) {
      console.log(`${LOG_PREFIX} Found existing customer by email: ID=${existing.id}`);
    }
  }

  if (existing) {
    // 2) Merge data into existing record (fill blanks only)
    const updatedFields: Partial<Customer> = {};

    // Name fields: fill blanks, don't overwrite
    const inputName = input.fullName || 
      `${input.firstName || ''} ${input.lastName || ''}`.trim() || null;

    if (inputName && (!existing.name || existing.name === 'Unknown' || existing.name === 'New Customer')) {
      updatedFields.name = inputName;
    }

    // Phone/Email: fill if missing
    if (normalizedPhone && !existing.phone) {
      updatedFields.phone = normalizedPhone;
    }

    if (normalizedEmail && !existing.email) {
      updatedFields.email = normalizedEmail;
    }

    // Address: fill if missing
    const inputAddress = input.address || input.city || null;
    if (inputAddress && !existing.address) {
      updatedFields.address = inputAddress;
    }

    // Vehicle info: fill if missing
    if (input.vehicleDescription && !existing.vehicleInfo) {
      updatedFields.vehicleInfo = input.vehicleDescription;
    }

    // Notes: append with source tag
    if (input.notes) {
      const sourceTag = `[${source}]`;
      if (existing.notes) {
        if (!existing.notes.includes(input.notes)) {
          updatedFields.notes = `${existing.notes}\n${sourceTag} ${input.notes}`;
        }
      } else {
        updatedFields.notes = `${sourceTag} ${input.notes}`;
      }
    }

    // Update importSource to track data origin (exact token match)
    if (source && source !== 'unknown') {
      const newSources = appendImportSource(existing.importSource, source);
      if (newSources !== existing.importSource) {
        updatedFields.importSource = newSources;
      }
    }

    if (Object.keys(updatedFields).length > 0) {
      console.log(`${LOG_PREFIX} Updating customer ${existing.id} with:`, Object.keys(updatedFields));
      const updated = await customerRepository.updateCustomer(db, tenantId, existing.id, updatedFields);
      return { customer: updated, createdNew: false, updatedExisting: true };
    }

    return { customer: existing, createdNew: false, updatedExisting: false };
  }

  // 3) No existing record: create new
  const nameForInsert = input.fullName || 
    `${input.firstName || ''} ${input.lastName || ''}`.trim() || 
    (normalizedEmail || normalizedPhone || 'Unknown');

  console.log(`${LOG_PREFIX} Creating new customer: name=${nameForInsert}, source=${source}`);

  const created = await customerRepository.createCustomer(db, tenantId, {
    name: nameForInsert,
    phone: normalizedPhone,
    email: normalizedEmail,
    address: input.address || input.city || null,
    vehicleInfo: input.vehicleDescription || null,
    notes: input.notes ? `[${source}] ${input.notes}` : null,
  });

  // Set importSource separately since it may not be in InsertCustomer
  if (source) {
    await customerRepository.updateCustomer(db, tenantId, created.id, {
      importSource: source,
    });
  }

  return { customer: created, createdNew: true, updatedExisting: false };
}

/**
 * Preview version of findOrCreateCustomer - checks what would happen without writing
 * Used for accurate dry-run metrics in import operations
 */
export async function findOrCreateCustomerPreview(
  db: TenantDb,
  input: CustomerIdentityInput
): Promise<FindOrCreatePreviewResult> {
  const { tenantId, source = 'import' } = input;

  const normalizedPhone = normalizePhone(input.phone);
  const normalizedEmail = normalizeEmail(input.email);

  // 1) Check for existing customer by phone
  let existing: Customer | null = null;
  let matchedBy: 'phone' | 'email' | null = null;

  if (normalizedPhone) {
    existing = await customerRepository.findByPhone(db, tenantId, normalizedPhone);
    if (existing) matchedBy = 'phone';
  }

  if (!existing && normalizedEmail) {
    existing = await customerRepository.findByEmail(db, tenantId, normalizedEmail);
    if (existing) matchedBy = 'email';
  }

  if (!existing) {
    // No matching customer - would create new
    return { wouldCreate: true, wouldUpdate: false, wouldSkip: false, matchedBy: null };
  }

  // Check if any fields would be updated
  const wouldUpdateFields: string[] = [];
  
  const inputName = input.fullName || 
    `${input.firstName || ''} ${input.lastName || ''}`.trim() || null;

  if (inputName && (!existing.name || existing.name === 'Unknown' || existing.name === 'New Customer')) {
    wouldUpdateFields.push('name');
  }

  if (normalizedPhone && !existing.phone) {
    wouldUpdateFields.push('phone');
  }

  if (normalizedEmail && !existing.email) {
    wouldUpdateFields.push('email');
  }

  const inputAddress = input.address || input.city || null;
  if (inputAddress && !existing.address) {
    wouldUpdateFields.push('address');
  }

  if (input.vehicleDescription && !existing.vehicleInfo) {
    wouldUpdateFields.push('vehicleInfo');
  }

  if (input.notes && (!existing.notes || !existing.notes.includes(input.notes))) {
    wouldUpdateFields.push('notes');
  }

  if (source && source !== 'unknown' && !hasImportSource(existing.importSource, source)) {
    wouldUpdateFields.push('importSource');
  }

  if (wouldUpdateFields.length > 0) {
    return { wouldCreate: false, wouldUpdate: true, wouldSkip: false, matchedBy };
  }

  return { wouldCreate: false, wouldUpdate: false, wouldSkip: true, matchedBy };
}

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
