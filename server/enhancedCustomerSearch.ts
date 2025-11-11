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
  loyaltyPoints: string;
  loyaltyTier: string;
  lastInvoiceDate: string;
  source: string; // Which sheet this record came from
  [key: string]: string; // Allow dynamic field access
}

/**
 * Normalize phone number for consistent searching
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Search customer database with enhanced filtering capabilities across all sheets
 * 
 * @param query The search query string
 * @param field The specific field to search (all, name, phone, email, vehicle, address)
 * @returns Array of matching customer records
 */
export async function searchAllCustomerData(
  query: string, 
  field: string = 'all'
): Promise<CustomerRecord[]> {
  const sheets = getSheets();
  if (!sheets || !GOOGLE_SHEET_ID) {
    console.warn('Google Sheets not initialized or spreadsheet ID not set');
    return [];
  }

  try {
    const allRecords: CustomerRecord[] = [];
    
    // Get all sheet names to search through
    const sheetsToSearch = [
      CUSTOMER_DATABASE_NAME,
      CUSTOMER_INFO_NAME,
      CUSTOMER_INFO_SHEET_NAME,
      LIVE_CLIENT_REQUESTS
    ];
    
    // Search through all relevant sheets
    for (const sheetName of sheetsToSearch) {
      try {
        console.log(`Searching sheet: ${sheetName}`);
        
        // Get all records from current sheet
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: `${sheetName}!A1:Z`  // Expanded range to capture more columns
        });
        
        const values = response.data.values || [];
        if (values.length <= 1) {
          // Only header row or empty sheet
          console.log(`Sheet ${sheetName} has no data or only headers`);
          continue;
        }
        
        // Extract headers from first row
        const headers = values[0].map((header: string) => 
          header.trim().toLowerCase().replace(/\s+/g, '')
        );
        
        console.log(`Found ${values.length - 1} records in ${sheetName}`);
        
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
            photoFolder: '',
            loyaltyPoints: '',
            loyaltyTier: '',
            lastInvoiceDate: '',
            source: sheetName // Add source sheet for reference
          };
          
          // Map each cell to its corresponding header
          headers.forEach((header: string, index: number) => {
            if (index < row.length && row[index]) {
              // Store the original value in the record under the header name
              record[header] = row[index] || '';
              
              // Map standard field names based on common headers across sheets
              if (['id', 'customerid', 'clientid'].includes(header)) {
                record.id = row[index];
              }
              else if (['email', 'emailaddress', 'customeremail'].includes(header)) {
                record.email = row[index];
              }
              else if (['name', 'customername', 'clientname', 'fullname'].includes(header)) {
                record.name = row[index];
              }
              else if (['phone', 'phonenumber', 'customerphone', 'mobilenumber'].includes(header)) {
                record.phone = row[index];
              }
              else if (['address', 'customeraddress', 'clientaddress', 'location'].includes(header)) {
                record.address = row[index];
              }
              else if (['vehicle', 'vehicleinfo', 'car', 'automobileinfo'].includes(header)) {
                record.vehicleInfo = row[index];
              }
              else if (['services', 'selectedservices', 'requestedservices'].includes(header)) {
                record.selectedServices = row[index];
              }
              else if (['addons', 'selectedaddons', 'additionalservices'].includes(header)) {
                record.selectedAddOns = row[index];
              }
              else if (['condition', 'vehiclecondition', 'carcondition'].includes(header)) {
                record.vehicleCondition = row[index];
              }
              else if (['notes', 'customernotes', 'comments', 'additionalinfo'].includes(header)) {
                record.notes = row[index];
              }
              else if (['lastcontact', 'lastinteraction', 'lastcommunication'].includes(header)) {
                record.lastContact = row[index];
              }
              else if (['photofolder', 'photolink', 'images', 'photos'].includes(header)) {
                record.photoFolder = row[index];
              }
            }
          });
          
          // Apply filter based on search query and field
          const lowerQuery = query.toLowerCase();
          const normalizedQuery = normalizePhone(query);
          
          // Skip this record if it doesn't match the search criteria
          if (query) {
            if (field === 'name' && !record.name.toLowerCase().includes(lowerQuery)) continue;
            else if (field === 'phone' && !normalizePhone(record.phone).includes(normalizedQuery)) continue;
            else if (field === 'email' && !record.email.toLowerCase().includes(lowerQuery)) continue;
            else if (field === 'vehicle' && !record.vehicleInfo.toLowerCase().includes(lowerQuery)) continue;
            else if (field === 'address' && !record.address.toLowerCase().includes(lowerQuery)) continue;
            else if (field === 'all') {
              // Search through all fields in the record for matches
              let matchesAny = false;
              
              // Special check for phone number with normalization
              if (normalizePhone(record.phone).includes(normalizedQuery)) {
                matchesAny = true;
              } else {
                // Check all other record fields for matches
                for (const key in record) {
                  if (
                    record[key] && 
                    typeof record[key] === 'string' && 
                    key !== 'phone' && // Skip phone since we handled it above
                    record[key].toLowerCase().includes(lowerQuery)
                  ) {
                    matchesAny = true;
                    break;
                  }
                }
              }
              
              if (!matchesAny) continue;
            }
          }
          
          // Add the matched record
          allRecords.push(record);
        }
      } catch (error) {
        console.warn(`Error searching sheet ${sheetName}:`, error);
        // Continue with other sheets even if one fails
      }
    }
    
    // Remove duplicates (based on phone number if exists)
    const uniqueRecords: CustomerRecord[] = [];
    const phoneMap = new Map<string, boolean>();
    
    allRecords.forEach(record => {
      // If phone exists and is not already in map, add to unique records
      if (record.phone && !phoneMap.has(record.phone)) {
        phoneMap.set(record.phone, true);
        uniqueRecords.push(record);
      } 
      // If no phone number, use email as unique identifier
      else if (!record.phone && record.email && !uniqueRecords.some(r => r.email === record.email)) {
        uniqueRecords.push(record);
      }
      // If neither phone nor email, add as is (may create duplicates but preserves data)
      else if (!record.phone && !record.email) {
        uniqueRecords.push(record);
      }
    });
    
    console.log(`Total unique records found: ${uniqueRecords.length}`);
    return uniqueRecords;
    
  } catch (error) {
    console.error('Error searching customer database:', error);
    return [];
  }
}

/**
 * Get customer service history by combining information from all sheets
 * 
 * @param phone The customer's phone number
 * @returns Combined customer information with service history
 */
export async function getEnhancedCustomerServiceHistory(phone: string): Promise<any> {
  try {
    const allCustomerData = await searchAllCustomerData('', 'all');
    
    // Normalize the search phone number
    const normalizedSearchPhone = normalizePhone(phone);
    
    // Find all records matching this phone number across all sheets
    const customerRecords = allCustomerData.filter(record => 
      normalizePhone(record.phone) === normalizedSearchPhone
    );
    
    if (customerRecords.length === 0) {
      return { found: false, message: 'No customer records found' };
    }
    
    // Combine information from all matching records
    const combinedCustomerInfo: any = {
      found: true,
      name: '',
      phone: phone,
      email: '',
      address: '',
      vehicleInfo: '',
      notes: '',
      serviceHistory: [],
      interactionHistory: [],
      photoFolder: '',
      loyaltyPoints: '0',
      loyaltyTier: 'Bronze',
      lastInvoiceDate: '',
      sources: [] // Which sheets provided information
    };
    
    // Prioritize records from the Customer Database sheet
    const primaryRecord = customerRecords.find(r => r.source === CUSTOMER_DATABASE_NAME) || customerRecords[0];
    
    // Use primary record for basic info
    combinedCustomerInfo.name = primaryRecord.name || '';
    combinedCustomerInfo.email = primaryRecord.email || '';
    combinedCustomerInfo.address = primaryRecord.address || '';
    combinedCustomerInfo.vehicleInfo = primaryRecord.vehicleInfo || '';
    combinedCustomerInfo.loyaltyPoints = primaryRecord.loyaltyPoints || '0';
    combinedCustomerInfo.loyaltyTier = primaryRecord.loyaltyTier || 'Bronze';
    combinedCustomerInfo.lastInvoiceDate = primaryRecord.lastInvoiceDate || '';
    combinedCustomerInfo.photoFolder = primaryRecord.photoFolder || '';
    
    // Combine all notes
    const allNotes = customerRecords
      .filter(r => r.notes)
      .map(r => `[From ${r.source}] ${r.notes}`)
      .join('\n\n');
    
    combinedCustomerInfo.notes = allNotes;
    
    // Gather all sources
    combinedCustomerInfo.sources = [...new Set(customerRecords.map(r => r.source))];
    
    // Gather all service-related information
    customerRecords.forEach(record => {
      if (record.selectedServices) {
        combinedCustomerInfo.serviceHistory.push({
          services: record.selectedServices,
          addons: record.selectedAddOns || '',
          date: record.lastContact || 'Unknown date',
          source: record.source
        });
      }
      
      // Add any record as an interaction
      combinedCustomerInfo.interactionHistory.push({
        date: record.lastContact || 'Unknown date',
        source: record.source,
        details: `Record found in ${record.source} sheet`
      });
    });
    
    return combinedCustomerInfo;
  } catch (error) {
    console.error('Error getting enhanced customer service history:', error);
    return { found: false, error: 'Error retrieving customer data' };
  }
}