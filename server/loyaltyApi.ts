/**
 * API routes for loyalty program integration with Google Sheets
 */
import express from 'express';
import { google } from 'googleapis';
import { getAuthClient } from './googleIntegration';

// Create a router for loyalty points routes
const loyaltyRouter = express.Router();

// Constants for sheet names
const CUSTOMER_DATABASE_NAME = 'Customer Database';
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Get the sheets client
function getSheets() {
  const auth = getAuthClient();
  return auth ? google.sheets({ version: 'v4', auth }) : null;
}

/**
 * Helper function to convert column number to letter (1 = A, 2 = B, etc.)
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

/**
 * Award loyalty points after invoice is sent
 * 1 point per $1 spent
 */
loyaltyRouter.post('/award-loyalty-points', async (req, res) => {
  try {
    const { customerPhone, invoiceId, amount } = req.body;
    
    if (!customerPhone || !invoiceId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Calculate points to add (1 point per $1)
    const pointsToAdd = Math.floor(Number(amount));
    
    // Get sheets client
    const sheets = getSheets();
    
    if (!sheets || !GOOGLE_SHEET_ID) {
      return res.status(500).json({ 
        success: false, 
        message: 'Google Sheets not initialized or spreadsheet ID not set' 
      });
    }
    
    // Get the sheet data to find the customer row
    const range = `${CUSTOMER_DATABASE_NAME}!A1:N1000`; // Get all data 
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No data found in customer sheet' 
      });
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
      return res.status(404).json({ 
        success: false, 
        message: 'Could not find phone column in sheet' 
      });
    }
    
    if (loyaltyPointsColIndex === -1 || loyaltyTierColIndex === -1 || lastInvoiceDateColIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Loyalty columns not found in sheet. Make sure to add Loyalty Points, Loyalty Tier, and Last Invoice Date columns' 
      });
    }

    // Find the customer row
    let customerRowIndex = -1;
    const normalizedSearchPhone = customerPhone.replace(/\D/g, ''); // Remove non-numeric characters
    
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
      return res.status(404).json({ 
        success: false, 
        message: `Customer with phone ${customerPhone} not found in sheet` 
      });
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
    
    return res.json({
      success: true,
      message: `Successfully awarded ${pointsToAdd} loyalty points`,
      data: {
        customerPhone,
        previousPoints: currentLoyaltyPoints,
        newPoints: newLoyaltyPoints,
        previousTier: currentLoyaltyTier,
        newTier: newLoyaltyTier,
        lastInvoiceDate: today
      }
    });
  } catch (error) {
    console.error('Error awarding loyalty points:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error awarding loyalty points',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get loyalty information by phone number
 */
loyaltyRouter.get('/customer/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required' 
      });
    }
    
    // Get sheets client
    const sheets = getSheets();
    
    if (!sheets || !GOOGLE_SHEET_ID) {
      return res.status(500).json({ 
        success: false, 
        message: 'Google Sheets not initialized or spreadsheet ID not set' 
      });
    }
    
    // Get the sheet data to find the customer row
    const range = `${CUSTOMER_DATABASE_NAME}!A1:N1000`; // Get all data 
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No data found in customer sheet' 
      });
    }

    const headerRow = rows[0]; // First row contains headers
    
    // Find column indexes for important fields
    const phoneColIndex = headerRow.findIndex((col: string) => 
      col && col.toString().toLowerCase().includes('phone'));
    
    const nameColIndex = headerRow.findIndex((col: string) => 
      col && col.toString().toLowerCase().includes('name') && !col.toString().toLowerCase().includes('last'));
    
    const emailColIndex = headerRow.findIndex((col: string) => 
      col && col.toString().toLowerCase().includes('email'));
    
    const loyaltyPointsColIndex = headerRow.findIndex((col: string) => 
      col && col.toString().toLowerCase().includes('loyalty points'));
    
    const loyaltyTierColIndex = headerRow.findIndex((col: string) => 
      col && col.toString().toLowerCase().includes('loyalty tier'));
    
    if (phoneColIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Could not find phone column in sheet' 
      });
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
      return res.status(404).json({ 
        success: false, 
        message: `Customer with phone ${phone} not found in sheet` 
      });
    }

    // Get customer data
    const currentRow = rows[customerRowIndex];
    const name = currentRow[nameColIndex] || '';
    const email = currentRow[emailColIndex] || '';
    const loyaltyPoints = parseInt(currentRow[loyaltyPointsColIndex] || '0') || 0;
    const loyaltyTier = currentRow[loyaltyTierColIndex] || 'Bronze';
    
    return res.json({
      success: true,
      data: {
        name,
        phone,
        email,
        loyaltyPoints,
        loyaltyTier
      }
    });
  } catch (error) {
    console.error('Error getting loyalty information:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error getting loyalty information',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default loyaltyRouter;