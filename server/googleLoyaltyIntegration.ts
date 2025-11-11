import { google } from 'googleapis';
import { getAuthClient } from './googleIntegration';

// Constants for sheet names
const CUSTOMER_DATABASE_NAME = 'Customer Database';
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Get the sheets client
function getSheets() {
  const auth = getAuthClient();
  return auth ? google.sheets({ version: 'v4', auth }) : null;
}

/**
 * Update loyalty points for a customer in Google Sheets
 * This function should only be called after an invoice is sent
 */
export async function updateLoyaltyPointsInSheets(
  phone: string,
  pointsToAdd: number,
  invoiceId: string,
  invoiceAmount: number
): Promise<boolean> {
  const sheets = getSheets();
  
  if (!sheets || !GOOGLE_SHEET_ID) {
    console.warn('Google Sheets not initialized or spreadsheet ID not set');
    return false;
  }

  try {
    console.log(`Updating loyalty points in Google Sheets for customer with phone: ${phone}`);
    
    // First, get the sheet data to find the customer row
    const range = `${CUSTOMER_DATABASE_NAME}!A1:N1000`; // Get all data including loyalty columns
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.error('No data found in customer sheet');
      return false;
    }

    const headerRow = rows[0]; // First row contains headers
    
    // Find column indexes for important fields
    const phoneColIndex = headerRow.findIndex((col: string) => 
      col && col.toString().toLowerCase().includes('phone'));
    
    const loyaltyPointsColIndex = headerRow.findIndex((col: string) => 
      col && col.toString().toLowerCase().includes('loyalty points'));
    
    const loyaltyTierColIndex = headerRow.findIndex((col: string) => 
      col && col.toString().toLowerCase().includes('loyalty tier'));
    
    const lastInvoiceDateColIndex = headerRow.findIndex((col: string) => 
      col && col.toString().toLowerCase().includes('last invoice date'));
    
    if (phoneColIndex === -1) {
      console.error('Could not find phone column in sheet');
      return false;
    }
    
    if (loyaltyPointsColIndex === -1 || loyaltyTierColIndex === -1 || lastInvoiceDateColIndex === -1) {
      console.error('Could not find all required loyalty columns in sheet');
      return false;
    }

    // Find the customer row
    let customerRowIndex = -1;
    const normalizedSearchPhone = phone.replace(/\D/g, ''); // Remove non-numeric characters
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row[phoneColIndex]) {
        const normalizedRowPhone = row[phoneColIndex].toString().replace(/\D/g, '');
        if (normalizedRowPhone === normalizedSearchPhone) {
          customerRowIndex = i;
          break;
        }
      }
    }

    if (customerRowIndex === -1) {
      console.error(`Customer with phone ${phone} not found in sheet`);
      return false;
    }

    // Get current values
    const currentRow = rows[customerRowIndex];
    const currentLoyaltyPoints = parseInt(currentRow[loyaltyPointsColIndex] || '0') || 0;
    const currentLoyaltyTier = currentRow[loyaltyTierColIndex] || 'Bronze';
    
    // Calculate new values
    const newLoyaltyPoints = currentLoyaltyPoints + pointsToAdd;
    let newLoyaltyTier = currentLoyaltyTier;
    
    // Determine tier based on points
    if (newLoyaltyPoints >= 5000) {
      newLoyaltyTier = 'Platinum';
    } else if (newLoyaltyPoints >= 2000) {
      newLoyaltyTier = 'Gold';
    } else if (newLoyaltyPoints >= 1000) {
      newLoyaltyTier = 'Silver';
    } else {
      newLoyaltyTier = 'Bronze';
    }
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Update the customer record in the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${CUSTOMER_DATABASE_NAME}!${getColumnLetter(loyaltyPointsColIndex+1)}${customerRowIndex+1}:${getColumnLetter(lastInvoiceDateColIndex+1)}${customerRowIndex+1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[
          newLoyaltyPoints.toString(), 
          newLoyaltyTier,
          today
        ]]
      }
    });
    
    console.log(`Updated loyalty points for customer ${phone} from ${currentLoyaltyPoints} to ${newLoyaltyPoints} (${newLoyaltyTier} tier)`);
    return true;
  } catch (error) {
    console.error('Error updating loyalty points in Google Sheets:', error);
    return false;
  }
}

/**
 * Convert column number to letter (1 = A, 2 = B, etc.)
 */
function getColumnLetter(column: number): string {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}