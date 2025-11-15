import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_ID = '1-xeX82TPoxxeyWXoCEXh-TdMkBHuJSXjoUSaiFjfv9g';

async function getGoogleSheetsClient() {
  try {
    // Get credentials from environment variable ONLY (never from files for security)
    if (!process.env.GOOGLE_API_CREDENTIALS) {
      throw new Error('CRITICAL: GOOGLE_API_CREDENTIALS environment variable is not set. Please configure it in Replit Secrets.');
    }
    
    let credentials: any = null;
    try {
      credentials = JSON.parse(process.env.GOOGLE_API_CREDENTIALS);
      console.log('Using Google credentials from environment variable');
    } catch (parseError) {
      throw new Error('CRITICAL: Failed to parse GOOGLE_API_CREDENTIALS. Please ensure it contains valid JSON.');
    }
    
    if (!credentials || !credentials.client_email || !credentials.private_key) {
      throw new Error('CRITICAL: GOOGLE_API_CREDENTIALS is missing required fields (client_email, private_key)');
    }
    
    const auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    
    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('Error initializing Google Sheets client:', error);
    return null;
  }
}

(async () => {
  try {
    console.log('Fetching Add-Ons from Google Sheets...');
    const sheetsClient = await getGoogleSheetsClient();
    
    if (!sheetsClient) {
      console.error('Failed to initialize Google Sheets client');
      return;
    }
    
    // Get the data from the Add-Ons sheet
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Add-Ons!A1:Z1000'
    });
    
    const data = response.data.values;
    if (!data || data.length === 0) {
      console.error('No data found in Add-Ons sheet');
      return;
    }
    
    console.log(`Found ${data.length} rows in Add-Ons sheet`);
    console.log('Headers:', data[0]);
    console.log('\nAll Add-Ons:');
    
    // Process rows
    const headers = data[0];
    const addons = data.slice(1).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        if (header && header.trim()) {
          obj[header.trim()] = row[index] || '';
        }
      });
      return obj;
    });
    
    console.log(JSON.stringify(addons, null, 2));
    
  } catch (error) {
    console.error('Error fetching add-ons:', error);
  }
})();
