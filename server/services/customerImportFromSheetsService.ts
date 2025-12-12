/**
 * SP-GSHEETS-CUSTOMER-RESYNC - Customer Import from Google Sheets Service
 * 
 * Imports/syncs customer data from Google Sheets into the multi-tenant customer database.
 * Designed to be tenant-aware and reusable across tenants that have Google Sheets configured.
 * 
 * Features:
 * - Reads customer rows from configurable Google Sheets tabs
 * - Normalizes phone numbers to E.164 format
 * - Deduplicates by phone/email match using unified Customer Identity Service
 * - Supports dry-run mode for safe preview
 * - Merges data without overwriting existing non-empty fields
 * 
 * Updated to use findOrCreateCustomer from customerIdentityService for proper deduplication
 */

import { db } from '../db';
import { wrapTenantDb, type TenantDb } from '../tenantDb';
import { sql } from 'drizzle-orm';
import { getGoogleSheetsClient } from '../googleSheetsConnector';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { findOrCreateCustomer, findOrCreateCustomerPreview, type CustomerIdentityInput } from './customerIdentityService';

const LOG_PREFIX = '[CUSTOMER SHEETS IMPORT]';

const DEFAULT_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1-xeX82TPoxxeyWXoCEXh-TdMkBHuJSXjoUSaiFjfv9g';

const DEFAULT_CUSTOMER_TABS = [
  'Customer Information',
  'Customer Database',
  'Customer_Info_Sheet',
  'Live Client Requests',
];

export interface SheetCustomerRow {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  vehicleInfo?: string;
  notes?: string;
  lastServiceDate?: string;
}

export interface NormalizedSheetCustomer {
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  vehicleInfo: string | null;
  notes: string | null;
  lastServiceAt: Date | null;
}

export interface CustomerSheetImportSummary {
  totalRows: number;
  normalizedRows: number;
  created: number;
  updated: number;
  skipped: number;
  normalizationFailures: number;
  errors: string[];
  sampleRows?: NormalizedSheetCustomer[];
}

function normalizeE164(phone: string | undefined): string | null {
  if (!phone) return null;
  try {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 0) return null;
    
    if (isValidPhoneNumber(cleaned, 'US')) {
      const parsed = parsePhoneNumber(cleaned, 'US');
      return parsed.format('E.164');
    }
    if (isValidPhoneNumber(`+${cleaned}`)) {
      const parsed = parsePhoneNumber(`+${cleaned}`);
      return parsed.format('E.164');
    }
    if (cleaned.length === 10) {
      const withCountry = `+1${cleaned}`;
      if (isValidPhoneNumber(withCountry)) {
        const parsed = parsePhoneNumber(withCountry);
        return parsed.format('E.164');
      }
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeEmail(email: string | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return null;
  return trimmed;
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
    if (index >= 0) return index;
  }
  return -1;
}

function parseRowToCustomer(row: string[], headers: string[]): SheetCustomerRow {
  const phoneIdx = findColumnIndex(headers, ['phone', 'cell', 'mobile', 'telephone']);
  const emailIdx = findColumnIndex(headers, ['email', 'e-mail']);
  const nameIdx = findColumnIndex(headers, ['name', 'customer name', 'client name', 'full name']);
  const addressIdx = findColumnIndex(headers, ['address', 'street', 'full address']);
  const cityIdx = findColumnIndex(headers, ['city']);
  const stateIdx = findColumnIndex(headers, ['state']);
  const zipIdx = findColumnIndex(headers, ['zip', 'postal', 'zipcode', 'postal code']);
  const vehicleIdx = findColumnIndex(headers, ['vehicle', 'car', 'vehicle info']);
  const notesIdx = findColumnIndex(headers, ['notes', 'comment', 'remarks']);
  const lastServiceIdx = findColumnIndex(headers, ['last service', 'last date', 'date']);
  
  return {
    phone: phoneIdx >= 0 ? row[phoneIdx]?.trim() : undefined,
    email: emailIdx >= 0 ? row[emailIdx]?.trim() : undefined,
    name: nameIdx >= 0 ? row[nameIdx]?.trim() : undefined,
    address: addressIdx >= 0 ? row[addressIdx]?.trim() : undefined,
    city: cityIdx >= 0 ? row[cityIdx]?.trim() : undefined,
    state: stateIdx >= 0 ? row[stateIdx]?.trim() : undefined,
    postalCode: zipIdx >= 0 ? row[zipIdx]?.trim() : undefined,
    vehicleInfo: vehicleIdx >= 0 ? row[vehicleIdx]?.trim() : undefined,
    notes: notesIdx >= 0 ? row[notesIdx]?.trim() : undefined,
    lastServiceDate: lastServiceIdx >= 0 ? row[lastServiceIdx]?.trim() : undefined,
  };
}

function normalizeCustomer(raw: SheetCustomerRow): NormalizedSheetCustomer | null {
  const phone = normalizeE164(raw.phone);
  const email = normalizeEmail(raw.email);
  
  if (!phone && !email) {
    return null;
  }
  
  let fullAddress = raw.address || '';
  if (raw.city) fullAddress += (fullAddress ? ', ' : '') + raw.city;
  if (raw.state) fullAddress += (fullAddress ? ', ' : '') + raw.state;
  if (raw.postalCode) fullAddress += (fullAddress ? ' ' : '') + raw.postalCode;
  
  let lastServiceAt: Date | null = null;
  if (raw.lastServiceDate) {
    try {
      const parsed = new Date(raw.lastServiceDate);
      if (!isNaN(parsed.getTime())) {
        lastServiceAt = parsed;
      }
    } catch {
    }
  }
  
  return {
    name: raw.name?.trim() || null,
    phone,
    email,
    address: fullAddress.trim() || null,
    vehicleInfo: raw.vehicleInfo?.trim() || null,
    notes: raw.notes?.trim() || null,
    lastServiceAt,
  };
}

async function readCustomersFromSheets(
  spreadsheetId: string,
  tabNames: string[]
): Promise<{ rows: SheetCustomerRow[]; errors: string[] }> {
  const allRows: SheetCustomerRow[] = [];
  const errors: string[] = [];
  
  try {
    const sheetsClient = await getGoogleSheetsClient();
    if (!sheetsClient) {
      errors.push('Unable to initialize Google Sheets client');
      return { rows: allRows, errors };
    }
    
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId,
    });
    
    const availableSheets = spreadsheet.data.sheets?.map(s => s.properties?.title || '') || [];
    console.log(`${LOG_PREFIX} Available sheets:`, availableSheets);
    
    for (const tabName of tabNames) {
      const matchingTab = availableSheets.find(s => 
        s.toLowerCase() === tabName.toLowerCase() ||
        s.toLowerCase().includes(tabName.toLowerCase())
      );
      
      if (!matchingTab) {
        console.log(`${LOG_PREFIX} Tab "${tabName}" not found, skipping`);
        continue;
      }
      
      try {
        const response = await sheetsClient.spreadsheets.values.get({
          spreadsheetId,
          range: `${matchingTab}!A1:Z1000`,
        });
        
        const data = response.data.values;
        if (!data || data.length <= 1) {
          console.log(`${LOG_PREFIX} Tab "${matchingTab}" has no data rows`);
          continue;
        }
        
        const headers = data[0].map((h: any) => String(h || '').toLowerCase().trim());
        console.log(`${LOG_PREFIX} Processing ${data.length - 1} rows from "${matchingTab}"`);
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0 || !row.some((cell: any) => cell && String(cell).trim())) {
            continue;
          }
          
          const customerRow = parseRowToCustomer(row.map((c: any) => String(c || '')), headers);
          allRows.push(customerRow);
        }
        
        console.log(`${LOG_PREFIX} Loaded ${data.length - 1} rows from "${matchingTab}"`);
      } catch (tabError: any) {
        console.error(`${LOG_PREFIX} Error reading tab "${matchingTab}":`, tabError);
        errors.push(`Error reading tab "${matchingTab}": ${tabError.message}`);
      }
    }
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error reading from Google Sheets:`, error);
    errors.push(`Google Sheets error: ${error.message}`);
  }
  
  return { rows: allRows, errors };
}

export interface ImportOptions {
  dryRun?: boolean;
  spreadsheetId?: string;
  tabNames?: string[];
}

export async function importCustomersFromSheet(
  tenantId: string,
  options: ImportOptions = {}
): Promise<CustomerSheetImportSummary> {
  const { 
    dryRun = true, 
    spreadsheetId = DEFAULT_SPREADSHEET_ID,
    tabNames = DEFAULT_CUSTOMER_TABS 
  } = options;
  
  const summary: CustomerSheetImportSummary = {
    totalRows: 0,
    normalizedRows: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    normalizationFailures: 0,
    errors: [],
    sampleRows: [],
  };
  
  console.log(`${LOG_PREFIX} Starting import for tenant "${tenantId}" (dryRun: ${dryRun})`);
  console.log(`${LOG_PREFIX} Using spreadsheet: ${spreadsheetId}`);
  console.log(`${LOG_PREFIX} Searching tabs: ${tabNames.join(', ')}`);
  
  const { rows: sheetRows, errors: readErrors } = await readCustomersFromSheets(spreadsheetId, tabNames);
  summary.errors.push(...readErrors);
  summary.totalRows = sheetRows.length;
  
  console.log(`${LOG_PREFIX} Read ${sheetRows.length} total rows from sheets`);
  
  const normalizedCustomers: NormalizedSheetCustomer[] = [];
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  
  for (const row of sheetRows) {
    const normalized = normalizeCustomer(row);
    if (!normalized) {
      summary.normalizationFailures++;
      continue;
    }
    
    if (normalized.phone && seenPhones.has(normalized.phone)) {
      continue;
    }
    if (normalized.email && seenEmails.has(normalized.email)) {
      continue;
    }
    
    if (normalized.phone) seenPhones.add(normalized.phone);
    if (normalized.email) seenEmails.add(normalized.email);
    
    normalizedCustomers.push(normalized);
  }
  
  summary.normalizedRows = normalizedCustomers.length;
  summary.sampleRows = normalizedCustomers.slice(0, 5);
  
  console.log(`${LOG_PREFIX} Normalized ${normalizedCustomers.length} unique customers`);
  
  if (normalizedCustomers.length === 0) {
    console.log(`${LOG_PREFIX} No valid customers to import`);
    return summary;
  }
  
  const tenantDb = wrapTenantDb(db, tenantId);
  
  for (const customer of normalizedCustomers) {
    try {
      const identityInput: CustomerIdentityInput = {
        tenantId,
        phone: customer.phone,
        email: customer.email,
        fullName: customer.name,
        address: customer.address,
        vehicleDescription: customer.vehicleInfo,
        notes: customer.notes,
        source: 'google_sheets',
      };
      
      if (dryRun) {
        // Use preview mode for accurate dry-run metrics
        const preview = await findOrCreateCustomerPreview(tenantDb, identityInput);
        if (preview.wouldCreate) {
          summary.created++;
        } else if (preview.wouldUpdate) {
          summary.updated++;
        } else {
          summary.skipped++;
        }
        continue;
      }
      
      // Actual import mode
      const result = await findOrCreateCustomer(tenantDb, identityInput);
      
      if (result.createdNew) {
        summary.created++;
      } else if (result.updatedExisting) {
        summary.updated++;
      } else {
        summary.skipped++;
      }
    } catch (error: any) {
      // Log at WARN level for duplicate constraint errors, ERROR for others
      const isDuplicateError = error.code === '23505' || error.message?.includes('unique constraint');
      const logLevel = isDuplicateError ? 'warn' : 'error';
      
      if (isDuplicateError) {
        console.warn(`${LOG_PREFIX} Duplicate customer (${customer.phone || customer.email}): ${error.message}`);
      } else {
        console.error(`${LOG_PREFIX} Error processing customer:`, error);
      }
      
      summary.errors.push(`Customer error (${customer.phone || customer.email}): ${error.message}`);
      summary.skipped++;
    }
  }
  
  console.log(`${LOG_PREFIX} Import complete:`, {
    totalRows: summary.totalRows,
    normalizedRows: summary.normalizedRows,
    normalizationFailures: summary.normalizationFailures,
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    errors: summary.errors.length,
  });
  
  return summary;
}

export async function previewCustomersFromSheet(
  tenantId: string,
  options: ImportOptions = {}
): Promise<{
  sampleRows: NormalizedSheetCustomer[];
  totalRows: number;
  normalizedRows: number;
  tabsFound: string[];
}> {
  const { 
    spreadsheetId = DEFAULT_SPREADSHEET_ID,
    tabNames = DEFAULT_CUSTOMER_TABS 
  } = options;
  
  const tabsFound: string[] = [];
  
  try {
    const sheetsClient = await getGoogleSheetsClient();
    if (!sheetsClient) {
      return { sampleRows: [], totalRows: 0, normalizedRows: 0, tabsFound: [] };
    }
    
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId,
    });
    
    const availableSheets = spreadsheet.data.sheets?.map(s => s.properties?.title || '') || [];
    
    for (const tabName of tabNames) {
      const matchingTab = availableSheets.find(s => 
        s.toLowerCase() === tabName.toLowerCase() ||
        s.toLowerCase().includes(tabName.toLowerCase())
      );
      if (matchingTab) {
        tabsFound.push(matchingTab);
      }
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error previewing sheets:`, error);
  }
  
  const result = await importCustomersFromSheet(tenantId, { ...options, dryRun: true });
  
  return {
    sampleRows: result.sampleRows || [],
    totalRows: result.totalRows,
    normalizedRows: result.normalizedRows,
    tabsFound,
  };
}
