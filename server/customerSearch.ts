import { google } from 'googleapis';
import { getAuthClient } from './googleIntegration';

// Get the sheets client
function getSheets() {
  const auth = getAuthClient();
  return auth ? google.sheets({ version: 'v4', auth }) : null;
}

// Constants for sheet names
const CUSTOMER_DATABASE_NAME = 'Customer Database';
const CUSTOMER_INFO_NAME = 'Customer Information';
const CUSTOMER_INFO_SHEET_NAME = 'Customer_Info_Sheet';
const LIVE_CLIENT_REQUESTS = 'Live Client Requests';
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Define customer record structure
interface CustomerRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  vehicleInfo: string;
  selectedServices: string;
  selectedAddOns: string;
  vehicleCondition: string;
  notes: string;
  lastContact: string;
  photoFolder: string;
  [key: string]: string; // Allow dynamic field access
}

/**
 * Search customer database with enhanced filtering capabilities
 * 
 * @param query The search query string
 * @param field The specific field to search (all, name, phone, email, vehicle, address)
 * @returns Array of matching customer records
 */
export async function searchCustomerDatabase(
  query: string, 
  field: string = 'all'
): Promise<CustomerRecord[]> {
  const sheets = getSheets();
  if (!sheets || !GOOGLE_SHEET_ID) {
    console.warn('Google Sheets not initialized or spreadsheet ID not set');
    return [];
  }

  try {
    // Get all records from Customer Database sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${CUSTOMER_DATABASE_NAME}!A1:L`
    });

    const values = response.data.values || [];
    if (values.length <= 1) {
      // Only header row or empty sheet
      return [];
    }

    // Extract headers from first row
    const headers = values[0];
    const records: CustomerRecord[] = [];

    // Convert remaining rows to CustomerRecord objects
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row || row.length === 0) continue;

      const record: CustomerRecord = {
        id: '',
        email: '',
        name: '',
        phone: '',
        address: '',
        vehicleInfo: '',
        selectedServices: '',
        selectedAddOns: '',
        vehicleCondition: '',
        notes: '',
        lastContact: '',
        photoFolder: ''
      };

      // Map each cell to its corresponding header
      headers.forEach((header: string, index: number) => {
        if (index < row.length) {
          const cleanHeader = header.trim().toLowerCase().replace(/\s+/g, '');
          record[cleanHeader] = row[index] || '';
          
          // Also map to our standardized property names
          if (cleanHeader.includes('id')) record.id = row[index] || '';
          else if (cleanHeader.includes('email')) record.email = row[index] || '';
          else if (cleanHeader.includes('name')) record.name = row[index] || '';
          else if (cleanHeader.includes('phone')) record.phone = row[index] || '';
          else if (cleanHeader.includes('address')) record.address = row[index] || '';
          else if (cleanHeader.includes('vehicle') && cleanHeader.includes('info')) 
            record.vehicleInfo = row[index] || '';
          else if (cleanHeader.includes('selected') && cleanHeader.includes('services')) 
            record.selectedServices = row[index] || '';
          else if (cleanHeader.includes('add') && cleanHeader.includes('on')) 
            record.selectedAddOns = row[index] || '';
          else if (cleanHeader.includes('condition')) 
            record.vehicleCondition = row[index] || '';
          else if (cleanHeader.includes('notes')) 
            record.notes = row[index] || '';
          else if (cleanHeader.includes('last') && cleanHeader.includes('contact')) 
            record.lastContact = row[index] || '';
          else if (cleanHeader.includes('photo')) 
            record.photoFolder = row[index] || '';
        }
      });

      records.push(record);
    }

    // Filter records based on search query and field
    const searchTermLower = query.toLowerCase().trim();
    
    return records.filter(record => {
      if (field === 'all') {
        // Search across all fields
        return Object.values(record).some(value => 
          value.toLowerCase().includes(searchTermLower)
        );
      } else {
        // Search specific field
        const fieldMapping: Record<string, string> = {
          'name': 'name',
          'phone': 'phone',
          'email': 'email',
          'vehicle': 'vehicleInfo',
          'address': 'address',
          'service': 'selectedServices'
        };
        
        const mappedField = fieldMapping[field] || field;
        return record[mappedField]?.toLowerCase().includes(searchTermLower);
      }
    });
  } catch (error) {
    console.error('Error searching customer database:', error);
    return [];
  }
}

/**
 * Get all customer records from the database
 * 
 * @param limit Optional limit on number of records to return
 * @returns Array of all customer records
 */
export async function getAllCustomers(limit?: number): Promise<CustomerRecord[]> {
  return searchCustomerDatabase('', 'all').then(results => {
    if (limit && limit > 0) {
      return results.slice(0, limit);
    }
    return results;
  });
}

/**
 * Find a customer by their phone number (exact match)
 * 
 * @param phone The phone number to search for
 * @returns The matching customer record or null if not found
 */
export async function findCustomerByPhone(phone: string): Promise<CustomerRecord | null> {
  // Normalize phone number by removing non-digit characters
  const normalizedPhone = phone.replace(/\D/g, '');
  
  const results = await searchCustomerDatabase(normalizedPhone, 'phone');
  
  // Find exact match by comparing normalized phone numbers
  const exactMatch = results.find(record => {
    const recordNormalizedPhone = record.phone.replace(/\D/g, '');
    return recordNormalizedPhone === normalizedPhone;
  });
  
  return exactMatch || null;
}

/**
 * Get customer service history from the database
 * 
 * @param phone The customer's phone number
 * @returns Array of service records for the customer
 */
export async function getCustomerServiceHistory(phone: string): Promise<{
  service: string;
  date: string;
  vehicle: string;
}[]> {
  const customer = await findCustomerByPhone(phone);
  if (!customer) return [];
  
  // Get all records for this customer to build service history
  const allRecords = await searchCustomerDatabase(phone, 'phone');
  
  return allRecords.map(record => ({
    service: record.selectedServices,
    date: record.lastContact,
    vehicle: record.vehicleInfo
  })).filter(record => record.service && record.date);
}