/**
 * Contact Utilities - Deduplication, Phone Normalization, and Fuzzy Matching
 * 
 * Production-grade contact management utilities for third-party billing system
 */

import type { TenantDb } from './tenantDb';
import { 
  contacts, 
  appointments, 
  invoices, 
  authorizations, 
  paymentLinks,
  type Contact, 
  type InsertContact 
} from "@shared/schema";
import { eq, or, sql, and } from "drizzle-orm";

/**
 * Phone Number Normalization & Validation
 */

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
 * Handles various input formats:
 * - (918) 555-1234
 * - 918-555-1234
 * - 9185551234
 * - +19185551234
 * - 1-918-555-1234
 */
export function normalizePhoneE164(phone: string): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Handle different lengths
  let normalized = '';
  if (digits.length === 10) {
    // US number without country code: 9185551234 -> +19185551234
    normalized = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code: 19185551234 -> +19185551234
    normalized = `+${digits}`;
  } else if (digits.length === 11) {
    // International format without +
    normalized = `+${digits}`;
  } else {
    // Already has country code or invalid
    normalized = phone.startsWith('+') ? phone : `+${digits}`;
  }

  // Validate E.164 format (basic check)
  const e164Regex = /^\+\d{10,15}$/;
  if (!e164Regex.test(normalized)) {
    console.warn(`Invalid phone number format: ${phone} -> ${normalized}`);
    return null;
  }

  return normalized;
}

/**
 * Format phone number for display: +19185551234 -> (918) 555-1234
 */
export function formatPhoneDisplay(phoneE164: string): string {
  if (!phoneE164) return '';

  const digits = phoneE164.replace(/\D/g, '');

  // US number formatting
  if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.substring(1, 4);
    const prefix = digits.substring(4, 7);
    const lineNumber = digits.substring(7, 11);
    return `(${areaCode}) ${prefix}-${lineNumber}`;
  }

  // International or unknown format
  return phoneE164;
}

/**
 * Email Canonicalization
 * Normalize email addresses to prevent duplicates:
 * - Lowercase
 * - Remove Gmail dots (gmail.com only)
 * - Remove + suffixes (gmail+tag@gmail.com -> gmail@gmail.com)
 */
export function canonicalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  let canonical = email.trim().toLowerCase();

  // Gmail-specific normalization
  if (canonical.endsWith('@gmail.com')) {
    let [localPart, domain] = canonical.split('@');

    // Remove + suffix
    if (localPart.includes('+')) {
      localPart = localPart.split('+')[0];
    }

    // Remove dots
    localPart = localPart.replace(/\./g, '');

    canonical = `${localPart}@${domain}`;
  } else {
    // For other providers, just remove + suffix
    if (canonical.includes('+')) {
      const [localPart, domain] = canonical.split('@');
      const cleanLocal = localPart.split('+')[0];
      canonical = `${cleanLocal}@${domain}`;
    }
  }

  return canonical;
}

/**
 * Fuzzy Matching - Find potentially duplicate contacts
 */

export interface DuplicateMatch {
  contact: Contact;
  matchType: 'exact_phone' | 'exact_email' | 'similar_name_phone' | 'similar_name_email';
  confidence: number; // 0-100
}

/**
 * Find potential duplicate contacts using fuzzy matching
 * Returns ranked list of potential duplicates with confidence scores
 */
export async function findPotentialDuplicates(
  tenantDb: TenantDb,
  input: {
    name?: string;
    phoneE164?: string;
    email?: string;
  }
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];

  // 1. Exact phone match (highest confidence - 100%)
  if (input.phoneE164) {
    const phoneMatches = await tenantDb.query.contacts.findMany({
      where: tenantDb.withTenantFilter(contacts, eq(contacts.phoneE164, input.phoneE164))
    });

    for (const contact of phoneMatches) {
      matches.push({
        contact,
        matchType: 'exact_phone',
        confidence: 100,
      });
    }
  }

  // 2. Exact email match (high confidence - 95%)
  if (input.email) {
    const canonicalEmail = canonicalizeEmail(input.email);
    if (canonicalEmail) {
      const emailMatches = await tenantDb.query.contacts.findMany({
        where: tenantDb.withTenantFilter(contacts, eq(contacts.email, canonicalEmail))
      });

      for (const contact of emailMatches) {
        // Skip if already matched by phone
        if (!matches.find(m => m.contact.id === contact.id)) {
          matches.push({
            contact,
            matchType: 'exact_email',
            confidence: 95,
          });
        }
      }
    }
  }

  // 3. Similar name + matching last 4 digits of phone (medium confidence - 70%)
  if (input.name && input.phoneE164) {
    const last4 = input.phoneE164.slice(-4);
    const nameLower = input.name.toLowerCase();

    // Get all contacts and filter by name similarity and phone last 4
    const allContacts = await tenantDb.query.contacts.findMany({
      where: tenantDb.withTenantFilter(contacts)
    });

    for (const contact of allContacts) {
      // Skip if already matched
      if (matches.find(m => m.contact.id === contact.id)) continue;

      // Check if last 4 digits match
      if (contact.phoneE164?.slice(-4) === last4) {
        // Check name similarity (simple contains check)
        const contactNameLower = contact.name.toLowerCase();
        if (
          contactNameLower.includes(nameLower) ||
          nameLower.includes(contactNameLower)
        ) {
          matches.push({
            contact,
            matchType: 'similar_name_phone',
            confidence: 70,
          });
        }
      }
    }
  }

  // 4. Similar name + matching email domain (low confidence - 50%)
  if (input.name && input.email) {
    const emailDomain = input.email.split('@')[1]?.toLowerCase();
    const nameLower = input.name.toLowerCase();

    const allContacts = await tenantDb.query.contacts.findMany({
      where: tenantDb.withTenantFilter(contacts)
    });

    for (const contact of allContacts) {
      // Skip if already matched
      if (matches.find(m => m.contact.id === contact.id)) continue;

      if (contact.email) {
        const contactDomain = contact.email.split('@')[1]?.toLowerCase();

        if (contactDomain === emailDomain) {
          const contactNameLower = contact.name.toLowerCase();
          if (
            contactNameLower.includes(nameLower) ||
            nameLower.includes(contactNameLower)
          ) {
            matches.push({
              contact,
              matchType: 'similar_name_email',
              confidence: 50,
            });
          }
        }
      }
    }
  }

  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Upsert Contact - Create or update contact with deduplication
 * 
 * If exact match found (phone or email), returns existing contact
 * If potential duplicates found with confidence > 80%, suggests merging
 * Otherwise, creates new contact
 */
export async function upsertContact(
  tenantDb: TenantDb,
  contactData: Omit<InsertContact, 'phoneE164' | 'phoneDisplay'> & {
    phone: string; // Raw phone input
  }
): Promise<{
  contact: Contact;
  isNew: boolean;
  potentialDuplicates: DuplicateMatch[];
}> {
  // Normalize phone number
  const phoneE164 = normalizePhoneE164(contactData.phone);
  if (!phoneE164) {
    throw new Error(`Invalid phone number: ${contactData.phone}`);
  }

  const phoneDisplay = formatPhoneDisplay(phoneE164);
  const canonicalEmail = canonicalizeEmail(contactData.email);

  // Find potential duplicates
  const duplicates = await findPotentialDuplicates(tenantDb, {
    name: contactData.name,
    phoneE164,
    email: canonicalEmail || undefined,
  });

  // If exact match (100% confidence), return existing contact
  const exactMatch = duplicates.find(d => d.confidence === 100);
  if (exactMatch) {
    // Update existing contact with new information (merge strategy)
    const updated = await tenantDb
      .update(contacts)
      .set({
        ...contactData,
        phoneE164,
        phoneDisplay,
        email: canonicalEmail || contactData.email,
        updatedAt: new Date(),
      })
      .where(tenantDb.withTenantFilter(contacts, eq(contacts.id, exactMatch.contact.id)))
      .returning()
      .execute();

    return {
      contact: updated[0],
      isNew: false,
      potentialDuplicates: duplicates.slice(1), // Exclude exact match from suggestions
    };
  }

  // No exact match - create new contact
  const newContact = await tenantDb
    .insert(contacts)
    .values({
      ...contactData,
      phoneE164,
      phoneDisplay,
      email: canonicalEmail || contactData.email || null,
      roleTags: contactData.roleTags || [],
      notificationPrefs: contactData.notificationPrefs || { sms: true, email: true },
    })
    .returning()
    .execute();

  return {
    contact: newContact[0],
    isNew: true,
    potentialDuplicates: duplicates.filter(d => d.confidence > 50), // Only high confidence suggestions
  };
}

/**
 * Search contacts by phone, email, or name
 * Returns exact and fuzzy matches
 */
export async function searchContacts(
  tenantDb: TenantDb,
  query: string,
  limit: number = 10
): Promise<Contact[]> {
  const queryLower = query.toLowerCase().trim();

  // Try to parse as phone number
  const phoneE164 = normalizePhoneE164(query);

  // Try to parse as email
  const canonicalEmail = query.includes('@') ? canonicalizeEmail(query) : null;

  // Build search query
  const results = await tenantDb.query.contacts.findMany({
    where: tenantDb.withTenantFilter(contacts,
      or(
        phoneE164 ? eq(contacts.phoneE164, phoneE164) : undefined,
        canonicalEmail ? eq(contacts.email, canonicalEmail) : undefined,
        sql`LOWER(${contacts.name}) LIKE ${`%${queryLower}%`}`,
        sql`LOWER(${contacts.company}) LIKE ${`%${queryLower}%`}`
      )
    ),
    limit
  });

  return results;
}

/**
 * Update all contact references across the database
 * Replaces oldContactId with newContactId in all referencing tables
 * 
 * @param tx - Transaction client from db.transaction()
 * @param oldContactId - Contact ID to replace
 * @param newContactId - Contact ID to use instead
 * @returns Summary of updates made
 */
export async function updateContactReferences(
  tx: any,
  oldContactId: number,
  newContactId: number
): Promise<{
  appointmentsUpdated: number;
  invoicesUpdated: number;
  authorizationsUpdated: number;
  paymentLinksUpdated: number;
  totalUpdated: number;
}> {
  console.log(`[Contact Merge] Updating references from contact #${oldContactId} to contact #${newContactId}`);

  let appointmentsUpdated = 0;
  let invoicesUpdated = 0;
  let authorizationsUpdated = 0;
  let paymentLinksUpdated = 0;

  // 1. Update appointments table (4 contact reference fields)
  // Update requesterContactId
  const requesterUpdates = await tx
    .update(appointments)
    .set({ requesterContactId: newContactId })
    .where(eq(appointments.requesterContactId, oldContactId))
    .execute();
  appointmentsUpdated += requesterUpdates.rowCount || 0;

  // Update serviceContactId
  const serviceUpdates = await tx
    .update(appointments)
    .set({ serviceContactId: newContactId })
    .where(eq(appointments.serviceContactId, oldContactId))
    .execute();
  appointmentsUpdated += serviceUpdates.rowCount || 0;

  // Update vehicleOwnerContactId
  const vehicleOwnerUpdates = await tx
    .update(appointments)
    .set({ vehicleOwnerContactId: newContactId })
    .where(eq(appointments.vehicleOwnerContactId, oldContactId))
    .execute();
  appointmentsUpdated += vehicleOwnerUpdates.rowCount || 0;

  // Update billingContactId
  const billingUpdates = await tx
    .update(appointments)
    .set({ billingContactId: newContactId })
    .where(eq(appointments.billingContactId, oldContactId))
    .execute();
  appointmentsUpdated += billingUpdates.rowCount || 0;

  console.log(`[Contact Merge] Updated ${appointmentsUpdated} appointment contact references`);

  // 2. Update invoices table (billToContactId)
  const invoiceUpdates = await tx
    .update(invoices)
    .set({ billToContactId: newContactId })
    .where(eq(invoices.billToContactId, oldContactId))
    .execute();
  invoicesUpdated = invoiceUpdates.rowCount || 0;
  console.log(`[Contact Merge] Updated ${invoicesUpdated} invoice references`);

  // 3. Update authorizations table (signerContactId)
  const authUpdates = await tx
    .update(authorizations)
    .set({ signerContactId: newContactId })
    .where(eq(authorizations.signerContactId, oldContactId))
    .execute();
  authorizationsUpdated = authUpdates.rowCount || 0;
  console.log(`[Contact Merge] Updated ${authorizationsUpdated} authorization references`);

  // 4. Update paymentLinks table (contactId)
  const paymentLinkUpdates = await tx
    .update(paymentLinks)
    .set({ contactId: newContactId })
    .where(eq(paymentLinks.contactId, oldContactId))
    .execute();
  paymentLinksUpdated = paymentLinkUpdates.rowCount || 0;
  console.log(`[Contact Merge] Updated ${paymentLinksUpdated} payment link references`);

  const totalUpdated = appointmentsUpdated + invoicesUpdated + authorizationsUpdated + paymentLinksUpdated;

  console.log(`[Contact Merge] Total references updated: ${totalUpdated}`);

  return {
    appointmentsUpdated,
    invoicesUpdated,
    authorizationsUpdated,
    paymentLinksUpdated,
    totalUpdated,
  };
}

/**
 * Merge two contacts - combine data and update references
 * Keeps primaryContactId and deletes duplicateContactId
 */
export async function mergeContacts(
  tenantDb: TenantDb,
  primaryContactId: number,
  duplicateContactId: number
): Promise<Contact> {
  console.log(`[Contact Merge] Starting merge: keeping contact #${primaryContactId}, removing #${duplicateContactId}`);

  // Get both contacts
  const [primary, duplicate] = await Promise.all([
    tenantDb.query.contacts.findFirst({ where: tenantDb.withTenantFilter(contacts, eq(contacts.id, primaryContactId)) }),
    tenantDb.query.contacts.findFirst({ where: tenantDb.withTenantFilter(contacts, eq(contacts.id, duplicateContactId)) }),
  ]);

  if (!primary || !duplicate) {
    throw new Error('Contact not found');
  }

  console.log(`[Contact Merge] Merging "${duplicate.name}" (${duplicate.phoneE164}) into "${primary.name}" (${primary.phoneE164})`);

  // Use transaction for the entire merge operation
  return await tenantDb.transaction(async (tx) => {
    // Merge strategy: keep primary data, fill in missing fields from duplicate
    const merged = {
      ...primary,
      email: primary.email || duplicate.email,
      company: primary.company || duplicate.company,
      address: primary.address || duplicate.address,
      city: primary.city || duplicate.city,
      state: primary.state || duplicate.state,
      zip: primary.zip || duplicate.zip,
      notes: primary.notes
        ? `${primary.notes}\n\n[Merged from contact #${duplicateContactId}]: ${duplicate.notes || ''}`
        : duplicate.notes,
      roleTags: Array.from(
        new Set([
          ...(primary.roleTags as string[] || []),
          ...(duplicate.roleTags as string[] || []),
        ])
      ),
    };

    // Update primary contact with merged data
    const updated = await tx
      .update(contacts)
      .set(merged)
      .where(eq(contacts.id, primaryContactId))
      .returning()
      .execute();

    console.log(`[Contact Merge] Updated primary contact data`);

    // Update all references in other tables to point to the primary contact
    await updateContactReferences(tx, duplicateContactId, primaryContactId);

    // Delete duplicate contact
    await tx.delete(contacts).where(tenantDb.withTenantFilter(contacts, eq(contacts.id, duplicateContactId))).execute();
    console.log(`[Contact Merge] Deleted duplicate contact #${duplicateContactId}`);
    console.log(`[Contact Merge] Merge completed successfully`);

    return updated[0];
  });
}
