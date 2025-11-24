/**
 * Phase 16 - Customer Backfill Service
 * 
 * Merges customer data from Google Sheets with DB records to create
 * a comprehensive customer master database for the root tenant (Clean Machine).
 * 
 * Features:
 * - Reads customer data from Google Sheets tabs
 * - Merges with existing DB customers, appointments, and invoices
 * - Computes customer metrics (first/last job date, total jobs, lifetime value)
 * - Assigns customers to households based on normalized address
 * - Supports dry-run mode for safe testing
 * - Logs all backfill runs to migration_log table
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import type { TenantDb } from '../tenantDb';
import { 
  customers, appointments, invoices, households, migrationLog 
} from '@shared/schema';
import { eq, and, desc, sql, min, max, count, sum } from 'drizzle-orm';
import { normalizeAddress, parseAddress, type RawAddress } from './addressNormalization';

// Google Sheets integration
import { getGoogleSheetsReadClient } from '../googleIntegration';

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1-xeX82TPoxxeyWXoCEXh-TdMkBHuJSXjoUSaiFjfv9g';

// Tab names to read customer data from
const CUSTOMER_TABS = [
  'Customer Information',
  'Live Client Requests',
  'Customer_Info_Sheet',
];

// ============================================================
// TYPES
// ============================================================

export interface BackfillOptions {
  tenantId: string;   // For now, only 'root' is supported
  dryRun?: boolean;   // If true, no DB writes (default false)
}

export interface BackfillStats {
  tenantId: string;
  dryRun: boolean;
  customersExamined: number;
  customersInserted: number;
  customersUpdated: number;
  householdsCreated: number;
  sheetsRead: number;
  errors: string[];
}

interface IntermediateJob {
  date?: Date;
  value?: number;
}

interface IntermediateCustomer {
  // Identity
  phone?: string;
  email?: string;
  name?: string;

  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  // Aggregated jobs (from sheets or DB)
  jobs: IntermediateJob[];

  // Metadata
  importSources: Set<string>;
  
  // DB customer ID if already exists
  existingCustomerId?: number;
  
  // Household assignment
  householdId?: number;
  normalizedAddress?: string | null;
}

type CustomerKey = string; // normalized phone or email:address

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Run customer backfill for a tenant (currently only supports 'root')
 * 
 * @param database - Base database client
 * @param options - Backfill options (tenantId, dryRun)
 * @returns Stats about the backfill run
 */
export async function runCustomerBackfill(
  database: typeof db,
  options: BackfillOptions
): Promise<BackfillStats> {
  const { tenantId, dryRun = false } = options;

  // Validate tenant ID (only root supported for now)
  if (tenantId !== 'root') {
    throw new Error(`Customer backfill is currently only supported for tenant 'root', got: ${tenantId}`);
  }

  // Initialize stats
  const stats: BackfillStats = {
    tenantId,
    dryRun,
    customersExamined: 0,
    customersInserted: 0,
    customersUpdated: 0,
    householdsCreated: 0,
    sheetsRead: 0,
    errors: [],
  };

  // Get tenant-scoped DB
  const tenantDb = wrapTenantDb(database, tenantId);

  // Log migration start
  let migrationLogId: number | undefined;
  try {
    const [logEntry] = await database
      .insert(migrationLog)
      .values({
        type: 'customer_backfill',
        tenantId,
        startedAt: new Date(),
        notes: JSON.stringify({ dryRun, startedAt: new Date().toISOString() }),
      })
      .returning({ id: migrationLog.id });
    
    migrationLogId = logEntry?.id;
    console.log(`[BACKFILL] Started customer backfill for tenant ${tenantId} (dry run: ${dryRun}) - log ID: ${migrationLogId}`);
  } catch (error) {
    console.error('[BACKFILL] Error creating migration log entry:', error);
    stats.errors.push(`Failed to create migration log: ${error}`);
  }

  try {
    // Step 1: Read data from Google Sheets
    const customerMap = await readFromGoogleSheets(tenantId, stats);

    // Step 2: Merge with existing DB customers
    await mergeWithDbCustomers(tenantDb, customerMap, stats);

    // Step 3: Augment with appointments & invoices
    await augmentWithAppointments(tenantDb, customerMap, stats);

    // Step 4: Assign households
    await assignHouseholds(tenantDb, customerMap, dryRun, stats);

    // Step 5: Upsert customers
    await upsertCustomers(tenantDb, customerMap, dryRun, stats);

    // Update migration log with completion
    if (migrationLogId) {
      await database
        .update(migrationLog)
        .set({
          completedAt: new Date(),
          notes: JSON.stringify({
            dryRun,
            ...stats,
            completedAt: new Date().toISOString(),
          }),
        })
        .where(eq(migrationLog.id, migrationLogId));
    }

    console.log(`[BACKFILL] Completed customer backfill for tenant ${tenantId}`);
    console.log(`[BACKFILL] Stats:`, JSON.stringify(stats, null, 2));

    return stats;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[BACKFILL] Fatal error during customer backfill:', error);
    stats.errors.push(`Fatal error: ${errorMsg}`);

    // Update migration log with error
    if (migrationLogId) {
      try {
        await database
          .update(migrationLog)
          .set({
            completedAt: new Date(),
            notes: JSON.stringify({
              dryRun,
              ...stats,
              error: errorMsg,
              completedAt: new Date().toISOString(),
            }),
          })
          .where(eq(migrationLog.id, migrationLogId));
      } catch (logError) {
        console.error('[BACKFILL] Error updating migration log with error:', logError);
      }
    }

    throw error;
  }
}

// ============================================================
// STEP 1: READ FROM GOOGLE SHEETS
// ============================================================

async function readFromGoogleSheets(
  tenantId: string,
  stats: BackfillStats
): Promise<Map<CustomerKey, IntermediateCustomer>> {
  const customerMap = new Map<CustomerKey, IntermediateCustomer>();

  console.log(`[BACKFILL] Reading customer data from Google Sheets...`);

  try {
    const sheets = await getGoogleSheetsReadClient();
    if (!sheets) {
      console.warn('[BACKFILL] Google Sheets client not available, skipping sheet import');
      stats.errors.push('Google Sheets client not available');
      return customerMap;
    }

    // Read each customer tab
    for (const tabName of CUSTOMER_TABS) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: `${tabName}!A:Z`, // Read all columns A-Z
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          console.log(`[BACKFILL] Tab "${tabName}" is empty or not found, skipping`);
          continue;
        }

        stats.sheetsRead++;
        console.log(`[BACKFILL] Processing ${rows.length} rows from "${tabName}"`);

        // First row is headers
        const headers = rows[0].map((h: string) => h.toLowerCase().trim());
        const phoneIdx = findColumnIndex(headers, ['phone', 'phone number', 'cell', 'mobile']);
        const emailIdx = findColumnIndex(headers, ['email', 'e-mail', 'email address']);
        const nameIdx = findColumnIndex(headers, ['name', 'customer name', 'client name', 'full name']);
        const addressIdx = findColumnIndex(headers, ['address', 'street address', 'full address']);

        // Process data rows
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const phone = phoneIdx >= 0 ? row[phoneIdx]?.trim() : undefined;
          const email = emailIdx >= 0 ? row[emailIdx]?.trim() : undefined;
          const name = nameIdx >= 0 ? row[nameIdx]?.trim() : undefined;
          const address = addressIdx >= 0 ? row[addressIdx]?.trim() : undefined;

          // Skip if no phone and no email
          if (!phone && !email) continue;

          // Generate customer key
          const key = getCustomerKey(phone, email);
          if (!key) continue;

          // Get or create intermediate customer
          let customer = customerMap.get(key);
          if (!customer) {
            customer = {
              phone: phone ? normalizePhone(phone) : undefined,
              email: email?.toLowerCase(),
              name,
              jobs: [],
              importSources: new Set(),
            };
            customerMap.set(key, customer);
          }

          // Merge data (prefer non-empty values)
          if (name && !customer.name) customer.name = name;
          if (phone && !customer.phone) customer.phone = normalizePhone(phone);
          if (email && !customer.email) customer.email = email.toLowerCase();

          // Parse and merge address
          if (address) {
            const parsed = parseAddress(address);
            if (parsed.addressLine1 && !customer.addressLine1) {
              customer.addressLine1 = parsed.addressLine1;
            }
            if (parsed.city && !customer.city) customer.city = parsed.city;
            if (parsed.state && !customer.state) customer.state = parsed.state;
            if (parsed.postalCode && !customer.postalCode) customer.postalCode = parsed.postalCode;
          }

          // Track import source
          customer.importSources.add(`sheet:${tabName}`);
        }

        console.log(`[BACKFILL] Processed ${rows.length - 1} rows from "${tabName}"`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[BACKFILL] Error reading sheet "${tabName}":`, error);
        stats.errors.push(`Sheet "${tabName}" error: ${errorMsg}`);
      }
    }

    console.log(`[BACKFILL] Total unique customers from sheets: ${customerMap.size}`);
    return customerMap;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[BACKFILL] Error in readFromGoogleSheets:', error);
    stats.errors.push(`Google Sheets read error: ${errorMsg}`);
    return customerMap;
  }
}

// ============================================================
// STEP 2: MERGE WITH DB CUSTOMERS
// ============================================================

async function mergeWithDbCustomers(
  tenantDb: TenantDb,
  customerMap: Map<CustomerKey, IntermediateCustomer>,
  stats: BackfillStats
): Promise<void> {
  console.log('[BACKFILL] Merging with existing DB customers...');

  try {
    // Fetch all existing customers for this tenant
    const existingCustomers = await tenantDb.query.customers.findMany({
      where: tenantDb.withTenantFilter(customers, sql`TRUE`),
    });

    console.log(`[BACKFILL] Found ${existingCustomers.length} existing customers in DB`);

    for (const dbCustomer of existingCustomers) {
      const key = getCustomerKey(dbCustomer.phone, dbCustomer.email);
      if (!key) continue;

      let customer = customerMap.get(key);
      
      if (customer) {
        // Merge DB data into existing intermediate customer
        customer.existingCustomerId = dbCustomer.id;
        customer.importSources.add('db');

        // Prefer DB values for certain fields
        if (dbCustomer.name) customer.name = dbCustomer.name;
        if (dbCustomer.email) customer.email = dbCustomer.email;
        
        // Parse DB address if we don't have address yet
        if (dbCustomer.address && !customer.addressLine1) {
          const parsed = parseAddress(dbCustomer.address);
          customer.addressLine1 = parsed.addressLine1;
          customer.city = parsed.city;
          customer.state = parsed.state;
          customer.postalCode = parsed.postalCode;
        }
      } else {
        // DB-only customer (not in sheets) - add to map
        const parsed = parseAddress(dbCustomer.address || '');
        customer = {
          phone: dbCustomer.phone || undefined,
          email: dbCustomer.email || undefined,
          name: dbCustomer.name,
          addressLine1: parsed.addressLine1,
          city: parsed.city,
          state: parsed.state,
          postalCode: parsed.postalCode,
          jobs: [],
          importSources: new Set(['db']),
          existingCustomerId: dbCustomer.id,
        };
        customerMap.set(key, customer);
      }
    }

    stats.customersExamined = customerMap.size;
    console.log(`[BACKFILL] After DB merge: ${customerMap.size} total unique customers`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[BACKFILL] Error merging with DB customers:', error);
    stats.errors.push(`DB merge error: ${errorMsg}`);
  }
}

// ============================================================
// STEP 3: AUGMENT WITH APPOINTMENTS & INVOICES
// ============================================================

async function augmentWithAppointments(
  tenantDb: TenantDb,
  customerMap: Map<CustomerKey, IntermediateCustomer>,
  stats: BackfillStats
): Promise<void> {
  console.log('[BACKFILL] Augmenting customers with appointment and invoice data...');

  try {
    // For each customer with an existing DB ID, fetch their appointments
    for (const [key, customer] of customerMap.entries()) {
      if (!customer.existingCustomerId) continue;

      try {
        // Fetch completed appointments for this customer
        const customerAppointments = await tenantDb
          .select({
            id: appointments.id,
            scheduledTime: appointments.scheduledTime,
            completed: appointments.completed,
          })
          .from(appointments)
          .where(
            tenantDb.withTenantFilter(
              appointments,
              and(
                eq(appointments.customerId, customer.existingCustomerId),
                eq(appointments.completed, true)
              )
            )
          );

        // Fetch invoices for these appointments
        if (customerAppointments.length > 0) {
          const appointmentIds = customerAppointments.map(a => a.id);
          
          const customerInvoices = await tenantDb
            .select({
              appointmentId: invoices.appointmentId,
              totalAmount: invoices.totalAmount,
            })
            .from(invoices)
            .where(
              tenantDb.withTenantFilter(
                invoices,
                sql`${invoices.appointmentId} = ANY(${appointmentIds})`
              )
            );

          // Build map of appointment ID -> invoice amount
          const invoiceMap = new Map<number, number>();
          for (const invoice of customerInvoices) {
            if (invoice.appointmentId && invoice.totalAmount) {
              invoiceMap.set(
                invoice.appointmentId, 
                Number(invoice.totalAmount)
              );
            }
          }

          // Add jobs to customer record
          for (const appt of customerAppointments) {
            customer.jobs.push({
              date: new Date(appt.scheduledTime),
              value: invoiceMap.get(appt.id) || 0,
            });
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[BACKFILL] Error fetching appointments for customer ${customer.existingCustomerId}:`, error);
        stats.errors.push(`Customer ${customer.name || customer.phone} appointments error: ${errorMsg}`);
      }
    }

    console.log('[BACKFILL] Appointment augmentation complete');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[BACKFILL] Error in augmentWithAppointments:', error);
    stats.errors.push(`Appointments augment error: ${errorMsg}`);
  }
}

// ============================================================
// STEP 4: ASSIGN HOUSEHOLDS
// ============================================================

async function assignHouseholds(
  tenantDb: TenantDb,
  customerMap: Map<CustomerKey, IntermediateCustomer>,
  dryRun: boolean,
  stats: BackfillStats
): Promise<void> {
  console.log('[BACKFILL] Assigning households based on normalized addresses...');

  // Cache households we create during this run
  const householdCache = new Map<string, number>();

  try {
    for (const [key, customer] of customerMap.entries()) {
      // Normalize address
      const rawAddress: RawAddress = {
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        city: customer.city,
        state: customer.state,
        postalCode: customer.postalCode,
        country: customer.country,
      };

      const normalized = normalizeAddress(rawAddress);
      customer.normalizedAddress = normalized;

      if (!normalized) continue; // Skip if no address

      // Check cache first
      if (householdCache.has(normalized)) {
        customer.householdId = householdCache.get(normalized);
        continue;
      }

      // Check DB for existing household
      const [existingHousehold] = await tenantDb
        .select({ id: households.id })
        .from(households)
        .where(
          tenantDb.withTenantFilter(
            households,
            eq(households.normalizedAddress, normalized)
          )
        )
        .limit(1);

      if (existingHousehold) {
        customer.householdId = existingHousehold.id;
        householdCache.set(normalized, existingHousehold.id);
      } else if (!dryRun) {
        // Create new household
        const [newHousehold] = await tenantDb
          .insert(households)
          .values({
            tenantId: tenantDb.tenantId,
            normalizedAddress: normalized,
            createdAt: new Date(),
          })
          .returning({ id: households.id });

        if (newHousehold) {
          customer.householdId = newHousehold.id;
          householdCache.set(normalized, newHousehold.id);
          stats.householdsCreated++;
        }
      } else {
        // Dry run - count would-be creations
        if (!householdCache.has(normalized)) {
          stats.householdsCreated++;
          householdCache.set(normalized, -1); // Placeholder
        }
      }
    }

    console.log(`[BACKFILL] Household assignment complete (${stats.householdsCreated} new households)`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[BACKFILL] Error assigning households:', error);
    stats.errors.push(`Household assignment error: ${errorMsg}`);
  }
}

// ============================================================
// STEP 5: UPSERT CUSTOMERS
// ============================================================

async function upsertCustomers(
  tenantDb: TenantDb,
  customerMap: Map<CustomerKey, IntermediateCustomer>,
  dryRun: boolean,
  stats: BackfillStats
): Promise<void> {
  console.log('[BACKFILL] Upserting customers to database...');

  for (const [key, customer] of customerMap.entries()) {
    try {
      // Calculate metrics from jobs
      const metrics = calculateCustomerMetrics(customer.jobs);

      // Build customer data object
      const customerData = {
        tenantId: tenantDb.tenantId,
        name: customer.name || 'Unknown',
        phone: customer.phone || null,
        email: customer.email || null,
        address: buildFullAddress(customer),
        importSource: Array.from(customer.importSources).join(','),
        householdId: customer.householdId || null,
        firstAppointmentAt: metrics.firstJobDate,
        lastAppointmentAt: metrics.lastJobDate,
        totalAppointments: metrics.totalJobs,
        lifetimeValue: metrics.totalLifetimeValue.toFixed(2),
      };

      if (dryRun) {
        // Dry run - just count
        if (customer.existingCustomerId) {
          stats.customersUpdated++;
        } else {
          stats.customersInserted++;
        }
      } else {
        // Real run - perform DB operations
        if (customer.existingCustomerId) {
          // Update existing customer
          await tenantDb
            .update(customers)
            .set(customerData)
            .where(
              tenantDb.withTenantFilter(
                customers,
                eq(customers.id, customer.existingCustomerId)
              )
            );
          stats.customersUpdated++;
        } else {
          // Insert new customer
          await tenantDb
            .insert(customers)
            .values(customerData);
          stats.customersInserted++;
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[BACKFILL] Error upserting customer ${customer.name || customer.phone}:`, error);
      stats.errors.push(`Customer upsert error for ${customer.name || customer.phone}: ${errorMsg}`);
    }
  }

  console.log(`[BACKFILL] Customer upsert complete (${stats.customersInserted} inserted, ${stats.customersUpdated} updated)`);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate a unique key for a customer based on phone or email
 */
function getCustomerKey(phone: string | null | undefined, email: string | null | undefined): CustomerKey | null {
  if (phone) {
    const normalized = normalizePhone(phone);
    if (normalized) return `phone:${normalized}`;
  }
  if (email) {
    return `email:${email.toLowerCase()}`;
  }
  return null;
}

/**
 * Normalize phone number to digits only (E.164 format without +)
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // If starts with 1 and is 11 digits, keep it; otherwise just return digits
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits;
  }
  // If 10 digits, assume US and prepend 1
  if (digits.length === 10) {
    return '1' + digits;
  }
  return digits;
}

/**
 * Find column index by multiple possible header names
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const idx = headers.findIndex(h => h.includes(name));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Calculate customer metrics from job history
 */
function calculateCustomerMetrics(jobs: IntermediateJob[]): {
  firstJobDate: Date | null;
  lastJobDate: Date | null;
  totalJobs: number;
  totalLifetimeValue: number;
} {
  if (jobs.length === 0) {
    return {
      firstJobDate: null,
      lastJobDate: null,
      totalJobs: 0,
      totalLifetimeValue: 0,
    };
  }

  const validJobs = jobs.filter(j => j.date);
  const firstJobDate = validJobs.length > 0 
    ? validJobs.reduce((min, j) => !min || (j.date && j.date < min) ? j.date! : min, null as Date | null)
    : null;
  
  const lastJobDate = validJobs.length > 0
    ? validJobs.reduce((max, j) => !max || (j.date && j.date > max) ? j.date! : max, null as Date | null)
    : null;

  const totalJobs = jobs.length;
  const totalLifetimeValue = jobs.reduce((sum, j) => sum + (j.value || 0), 0);

  return {
    firstJobDate,
    lastJobDate,
    totalJobs,
    totalLifetimeValue,
  };
}

/**
 * Build full address string from customer components
 */
function buildFullAddress(customer: IntermediateCustomer): string | null {
  const parts: string[] = [];
  
  if (customer.addressLine1) parts.push(customer.addressLine1);
  if (customer.addressLine2) parts.push(customer.addressLine2);
  if (customer.city && customer.state) {
    parts.push(`${customer.city}, ${customer.state}`);
  } else if (customer.city) {
    parts.push(customer.city);
  } else if (customer.state) {
    parts.push(customer.state);
  }
  if (customer.postalCode) parts.push(customer.postalCode);

  return parts.length > 0 ? parts.join(', ') : null;
}
