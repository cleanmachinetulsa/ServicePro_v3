/**
 * Contact Utilities - Deduplication, Phone Normalization, and Fuzzy Matching
 * 
 * Production-grade contact management utilities for third-party billing system
 */

import { db } from "./db";
import { contacts, type Contact, type InsertContact } from "@shared/schema";
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
  input: {
    name?: string;
    phoneE164?: string;
    email?: string;
  }
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];

  // 1. Exact phone match (highest confidence - 100%)
  if (input.phoneE164) {
    const phoneMatches = await db
      .select()
      .from(contacts)
      .where(eq(contacts.phoneE164, input.phoneE164))
      .execute();

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
      const emailMatches = await db
        .select()
        .from(contacts)
        .where(eq(contacts.email, canonicalEmail))
        .execute();

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
    const allContacts = await db.select().from(contacts).execute();

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

    const allContacts = await db.select().from(contacts).execute();

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
  const duplicates = await findPotentialDuplicates({
    name: contactData.name,
    phoneE164,
    email: canonicalEmail || undefined,
  });

  // If exact match (100% confidence), return existing contact
  const exactMatch = duplicates.find(d => d.confidence === 100);
  if (exactMatch) {
    // Update existing contact with new information (merge strategy)
    const updated = await db
      .update(contacts)
      .set({
        ...contactData,
        phoneE164,
        phoneDisplay,
        email: canonicalEmail || contactData.email,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, exactMatch.contact.id))
      .returning()
      .execute();

    return {
      contact: updated[0],
      isNew: false,
      potentialDuplicates: duplicates.slice(1), // Exclude exact match from suggestions
    };
  }

  // No exact match - create new contact
  const newContact = await db
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
  query: string,
  limit: number = 10
): Promise<Contact[]> {
  const queryLower = query.toLowerCase().trim();

  // Try to parse as phone number
  const phoneE164 = normalizePhoneE164(query);

  // Try to parse as email
  const canonicalEmail = query.includes('@') ? canonicalizeEmail(query) : null;

  // Build search query
  const results = await db
    .select()
    .from(contacts)
    .where(
      or(
        phoneE164 ? eq(contacts.phoneE164, phoneE164) : undefined,
        canonicalEmail ? eq(contacts.email, canonicalEmail) : undefined,
        sql`LOWER(${contacts.name}) LIKE ${`%${queryLower}%`}`,
        sql`LOWER(${contacts.company}) LIKE ${`%${queryLower}%`}`
      )
    )
    .limit(limit)
    .execute();

  return results;
}

/**
 * Merge two contacts - combine data and update references
 * Keeps primaryContactId and deletes duplicateContactId
 */
export async function mergeContacts(
  primaryContactId: number,
  duplicateContactId: number
): Promise<Contact> {
  // Get both contacts
  const [primary, duplicate] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.id, primaryContactId)).execute(),
    db.select().from(contacts).where(eq(contacts.id, duplicateContactId)).execute(),
  ]);

  if (!primary[0] || !duplicate[0]) {
    throw new Error('Contact not found');
  }

  // Merge strategy: keep primary data, fill in missing fields from duplicate
  const merged = {
    ...primary[0],
    email: primary[0].email || duplicate[0].email,
    company: primary[0].company || duplicate[0].company,
    address: primary[0].address || duplicate[0].address,
    city: primary[0].city || duplicate[0].city,
    state: primary[0].state || duplicate[0].state,
    zip: primary[0].zip || duplicate[0].zip,
    notes: primary[0].notes
      ? `${primary[0].notes}\n\n[Merged from contact #${duplicateContactId}]: ${duplicate[0].notes || ''}`
      : duplicate[0].notes,
    roleTags: Array.from(
      new Set([
        ...(primary[0].roleTags as string[] || []),
        ...(duplicate[0].roleTags as string[] || []),
      ])
    ),
  };

  // Update primary contact
  const updated = await db
    .update(contacts)
    .set(merged)
    .where(eq(contacts.id, primaryContactId))
    .returning()
    .execute();

  // TODO: Update all references (appointments, authorizations, payment_links)
  // to point to primaryContactId instead of duplicateContactId

  // Delete duplicate contact
  await db.delete(contacts).where(eq(contacts.id, duplicateContactId)).execute();

  return updated[0];
}
