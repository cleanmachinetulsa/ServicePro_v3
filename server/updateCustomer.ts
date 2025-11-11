import { Request, Response } from 'express';
import { google } from 'googleapis';

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

/**
 * Update customer information in Google Sheets
 */
export async function updateCustomer(req: Request, res: Response) {
  try {
    const customer = req.body;
    
    if (!customer || !customer.phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing customer phone number'
      });
    }

    // Get auth client
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const authClient = await auth.getClient();
    
    // Create sheets instance with auth
    const authenticatedSheets = google.sheets({ version: 'v4', auth: authClient as any });
    
    // Search for the customer in multiple sheets
    const sheetsToCheck = ['Customer Database', 'Customer Information', 'SMS Knowledge Base'];
    let customerRow = -1;
    let targetSheet = '';
    
    for (const sheetName of sheetsToCheck) {
      try {
        // Get all data from the sheet
        const response = await authenticatedSheets.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: `${sheetName}!A:Z`
        });
        
        const rows = response.data.values || [];
        if (rows.length === 0) continue;
        
        // Find the phone column
        const headers = rows[0];
        const phoneColIndex = headers.findIndex((col: string) => 
          col && col.toLowerCase().includes('phone')
        );
        
        if (phoneColIndex === -1) continue;
        
        // Find the customer row
        const normalizedPhone = customer.phone.replace(/\D/g, '');
        for (let i = 1; i < rows.length; i++) {
          const rowPhone = (rows[i][phoneColIndex] || '').toString().replace(/\D/g, '');
          if (rowPhone === normalizedPhone) {
            customerRow = i + 1; // Google Sheets uses 1-based indexing
            targetSheet = sheetName;
            break;
          }
        }
        
        if (customerRow > -1) break;
      } catch (error) {
        console.error(`Error checking sheet ${sheetName}:`, error);
      }
    }
    
    if (customerRow === -1 || !targetSheet) {
      // Customer not found, add new customer to Customer Database
      targetSheet = 'Customer Database';
      
      // Check if Customer Database exists, create if not
      try {
        const spreadsheet = await authenticatedSheets.spreadsheets.get({
          spreadsheetId: GOOGLE_SHEET_ID
        });
        
        const sheetExists = spreadsheet.data.sheets?.some(
          (sheet: any) => sheet.properties?.title === targetSheet
        );
        
        if (!sheetExists) {
          // Create the sheet with headers
          await authenticatedSheets.spreadsheets.batchUpdate({
            spreadsheetId: GOOGLE_SHEET_ID,
            requestBody: {
              requests: [{
                addSheet: {
                  properties: {
                    title: targetSheet
                  }
                }
              }]
            }
          });
          
          // Add headers
          const headers = [
            'Phone Number', 'Name', 'Email', 'Vehicle Info', 
            'Address', 'Last Service Date', 'Services History', 
            'Photo Folder', 'Notes', 'Created At', 'Updated At',
            'Loyalty Points', 'Loyalty Tier', 'Last Invoice Date', 'SMS Consent'
          ];
          
          await authenticatedSheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `${targetSheet}!A1:O1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [headers]
            }
          });
        }
        
        // Append new customer
        const newRow = [
          customer.phone,
          customer.name || '',
          customer.email || '',
          customer.vehicleInfo || '',
          customer.address || '',
          customer.lastServiceDate || '',
          customer.servicesHistory || '',
          customer.photoFolder || '',
          customer.notes || '',
          new Date().toISOString(),
          new Date().toISOString(),
          customer.loyaltyPoints || 0,
          customer.loyaltyTier || 'Standard',
          '',
          customer.smsConsent ? 'Yes' : 'No'
        ];
        
        await authenticatedSheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: `${targetSheet}!A:O`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [newRow]
          }
        });
        
        return res.json({
          success: true,
          message: 'New customer added successfully'
        });
      } catch (error) {
        console.error('Error adding new customer:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to add new customer'
        });
      }
    }
    
    // Update existing customer
    try {
      // Get the headers to map field names to column indices
      const headerResponse = await authenticatedSheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${targetSheet}!1:1`
      });
      
      const headers = headerResponse.data.values?.[0] || [];
      const updates: Array<{ range: string; values: any[][] }> = [];
      
      // Map fields to update
      const fieldMapping: Record<string, string[]> = {
        name: ['name', 'customer name'],
        email: ['email', 'email address'],
        vehicleInfo: ['vehicle info', 'vehicle information', 'vehicle'],
        address: ['address', 'service address'],
        notes: ['notes', 'customer notes'],
        loyaltyPoints: ['loyalty points', 'points'],
        loyaltyTier: ['loyalty tier', 'tier'],
        smsConsent: ['sms consent', 'consent']
      };
      
      for (const [field, possibleHeaders] of Object.entries(fieldMapping)) {
        if (customer[field] !== undefined) {
          // Find the column index for this field
          const colIndex = headers.findIndex((header: string) => 
            possibleHeaders.some(ph => 
              header.toLowerCase().includes(ph.toLowerCase())
            )
          );
          
          if (colIndex > -1) {
            const colLetter = String.fromCharCode(65 + colIndex);
            updates.push({
              range: `${targetSheet}!${colLetter}${customerRow}`,
              values: [[field === 'smsConsent' ? (customer[field] ? 'Yes' : 'No') : customer[field]]]
            });
          }
        }
      }
      
      // Add Updated At timestamp
      const updatedAtIndex = headers.findIndex((header: string) => 
        header.toLowerCase().includes('updated')
      );
      if (updatedAtIndex > -1) {
        const colLetter = String.fromCharCode(65 + updatedAtIndex);
        updates.push({
          range: `${targetSheet}!${colLetter}${customerRow}`,
          values: [[new Date().toISOString()]]
        });
      }
      
      // Batch update all fields
      if (updates.length > 0) {
        await authenticatedSheets.spreadsheets.values.batchUpdate({
          spreadsheetId: GOOGLE_SHEET_ID,
          requestBody: {
            valueInputOption: 'RAW',
            data: updates
          }
        });
      }
      
      return res.json({
        success: true,
        message: 'Customer updated successfully'
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update customer'
      });
    }
  } catch (error) {
    console.error('Error in updateCustomer:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}