import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { getGoogleSheetsClient } from './googleSheetsConnector';
import { criticalMonitor } from './criticalMonitoring';

// Data store for sheet contents
export let sheetsData: Record<string, any[]> = {};

// Process sheet data into usable format
function processSheetData(sheetName: string, data: any[]): any[] {
  if (!data || data.length <= 1) {
    console.log(`Warning: Insufficient data in tab ${sheetName}`);
    return []; // Need at least headers + 1 row
  }

  // Convert to array of objects
  const headers = data[0];
  return data.slice(1).map((row: any) => {
    // Skip empty rows
    if (!row || row.length === 0) {
      return null;
    }

    const obj: any = {};

    // Add both header-keyed properties and numeric index properties
    headers.forEach((header: string, index: number) => {
      if (header && header.trim()) {
        obj[header] = row[index] || '';
      }
      // Always add numeric indices for easier access
      obj[index.toString()] = row[index] || '';
    });

    return obj;
  }).filter(item => item !== null); // Remove empty rows
}

// Format the knowledge base from all sheets
function formatKnowledgeBase(): string {
  let knowledgeBase = '# Clean Machine Auto Detail Information\n\n';

  // Add services information
  if (sheetsData['services'] && sheetsData['services'].length > 0) {
    knowledgeBase += '## Our Services\n\n';
    sheetsData['services'].forEach(service => {
      const name = service['Service'] || service['Service Name'] || service['0'] || 'Unnamed Service';
      const price = service['Price'] || service['Price Range'] || service['Cost'] || service['1'] || 'Price varies';
      const overview = service['Overview'] || service['Description'] || service['2'] || ''; // Use Overview, fallback to Description
      knowledgeBase += `- ${name}: ${price} - ${overview}\n`;
    });
    knowledgeBase += '\n';
  }

  // Add add-on services information
  if (sheetsData['addons'] && sheetsData['addons'].length > 0) {
    knowledgeBase += '## Add-on Services\n\n';
    sheetsData['addons'].forEach(addon => {
      // Check multiple column name variants for add-on service names
      const name = addon['Add-On Service'] || addon['Service'] || addon['Add-on'] || addon['Add-On'] || addon['0'] || 'Unnamed Add-on';
      const price = addon['Price'] || addon['Price Range'] || addon['Cost'] || addon['1'] || 'Price varies';
      const overview = addon['Overview'] || addon['Description'] || addon['2'] || ''; // Use Overview, fallback to Description
      knowledgeBase += `- ${name}: ${price} - ${overview}\n`;
    });
    knowledgeBase += '\n';
  }

  // Add business information
  knowledgeBase += `## Business Information\n`;
  knowledgeBase += `- Location: Mobile service in Tulsa, OK area (26-minute drive radius)\n`;
  knowledgeBase += `- Business Hours: 9 AM - 6 PM Monday through Friday\n`;
  knowledgeBase += `- Latest Appointment Start Time: 3 PM (we need time to complete services before 6 PM)\n`;
  knowledgeBase += `- Service Area: Within 26 minutes drive time from Tulsa\n`;
  knowledgeBase += `- Contact: cleanmachinetulsa@gmail.com\n\n`;

  // Add loyalty program information
  knowledgeBase += `## Loyalty Rewards Program\n\n`;
  knowledgeBase += `### How It Works\n`;
  knowledgeBase += `- Customers earn points for every dollar spent on services\n`;
  knowledgeBase += `- Points can be redeemed for free services and upgrades\n`;
  knowledgeBase += `- Points are valid for 2 years from the date earned\n`;
  knowledgeBase += `- Check points balance at cleanmachinetulsa.com/rewards using phone or email\n\n`;
  
  knowledgeBase += `### Loyalty Tiers\n`;
  knowledgeBase += `- **Bronze**: 500-999 points\n`;
  knowledgeBase += `- **Silver**: 1,000-1,999 points\n`;
  knowledgeBase += `- **Gold**: 2,000-2,999 points (VIP tier)\n`;
  knowledgeBase += `- **Platinum**: 3,000+ points (VIP tier)\n\n`;
  
  knowledgeBase += `### Available Rewards\n`;
  knowledgeBase += `- **500 Points**: Free Leather/Upholstery Protector or Engine Bay Cleaning\n`;
  knowledgeBase += `- **1,000 Points**: Free Maintenance Detail\n`;
  knowledgeBase += `- **2,000 Points**: Free Paint Enhancement\n`;
  knowledgeBase += `- **3,000 Points**: Free 1 Year Ceramic Coating\n\n`;
  
  knowledgeBase += `### How to Redeem\n`;
  knowledgeBase += `1. Visit cleanmachinetulsa.com/rewards and enter your phone or email\n`;
  knowledgeBase += `2. View your points balance and available rewards\n`;
  knowledgeBase += `3. Click "Redeem Offer" on any reward you qualify for\n`;
  knowledgeBase += `4. Book your appointment right away (rewards must be scheduled within 90 days)\n`;
  knowledgeBase += `5. Points are deducted immediately upon redemption\n\n`;
  
  knowledgeBase += `### Using Points During Booking\n`;
  knowledgeBase += `- Points can be used to upgrade existing appointments\n`;
  knowledgeBase += `- For example: Use 500 points to add free Leather Protector to your detail\n`;
  knowledgeBase += `- Call/text (918) 856-5711 to use points when booking\n`;
  knowledgeBase += `- Points are awarded ONLY after the service is completed\n\n`;
  
  knowledgeBase += `### Welcome Back Campaign\n`;
  knowledgeBase += `- VIP customers (Gold/Platinum) receive 500 bonus points\n`;
  knowledgeBase += `- Regular customers (Bronze/Silver) receive 200 bonus points\n`;
  knowledgeBase += `- Bonus points are added immediately when campaign is sent\n`;
  knowledgeBase += `- Check your points at cleanmachinetulsa.com/rewards\n\n`;

  return knowledgeBase;
}

// REMOVED: Legacy JWT-based Sheets client (replaced with Replit OAuth connector)
// Now uses googleSheetsConnector.ts with auto-refreshing OAuth tokens

// Force reload of sheets data
export async function forceReloadSheets(): Promise<boolean> {
  console.log('Force reloading sheets data...');
  return await loadAllSheets(true);
}

// Load all sheets from Google Sheets
async function loadAllSheets(forceReload: boolean = false): Promise<boolean> {
  // Use the spreadsheet ID from your shared Google Sheet
  const spreadsheetId = '1-xeX82TPoxxeyWXoCEXh-TdMkBHuJSXjoUSaiFjfv9g';

  console.log(`Loading spreadsheet with ID: ${spreadsheetId}`);

  try {
    const sheetsClient = await getGoogleSheetsClient();
    if (!sheetsClient) {
      await criticalMonitor.reportFailure('Google Sheets', 'Sheets client not initialized');
      return false;
    }

    // First, get the list of sheets
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId
    });
    
    criticalMonitor.reportSuccess('Google Sheets'); // Report success after successful API call

    // Extract the sheet names
    const sheetNames = spreadsheet.data.sheets?.map((sheet: any) => 
      sheet.properties?.title
    ) || [];

    console.log('Google Sheets found:', JSON.stringify(sheetNames));

    // Define the exact tab names we're looking for
    const serviceTabNames = ["Services", "services", "Service", "service"];
    const addOnTabNames = ["Add-Ons", "Add-ons", "Add-on Services", "add-on services", "Addons"];

    // Try to find the services tab
    let servicesTab = null;
    for (const tabName of serviceTabNames) {
      const found = sheetNames.find(name => name === tabName);
      if (found) {
        servicesTab = found;
        break;
      }
    }

    // Try to find the add-on services tab
    let addOnsTab = null;
    for (const tabName of addOnTabNames) {
      const found = sheetNames.find(name => name === tabName);
      if (found) {
        addOnsTab = found;
        break;
      }
    }

    console.log(`Found tabs - Services: ${servicesTab}, Add-ons: ${addOnsTab}`);

    // Load Services tab
    if (servicesTab) {
      try {
        console.log(`Loading services from tab: ${servicesTab}`);

        // Get data from the sheet
        const response = await sheetsClient.spreadsheets.values.get({
          spreadsheetId,
          range: `${servicesTab}!A1:Z1000` // Get a large range
        });

        const sheetData = response.data.values || [];
        console.log(`Services tab has ${sheetData.length} rows of data`);

        // Process the data
        sheetsData['services'] = processSheetData('services', sheetData);

        // Transform data to include Overview and Detailed Description
        sheetsData['services'] = sheetsData['services'].map((service: any) => {
            const name = service['Service Name'] || service['0'] || 'Unnamed Service';
            const priceRange = service['Price Range'] || service['1'] || 'Price varies';
            const overview = service['Overview'] || service['Description'] || service['2'] || ''; // Fallback to Description for backwards compatibility
            // Try multiple possible column names for detailed description
            const detailedDescription = service['Detailed Description'] || 
                                       service['DetailedDescription'] || 
                                       service['Detailed_Description'] ||
                                       service['3'] || ''; // New field with fallbacks
            const duration = service['Time Estimate'] || service['4'] || '';

            console.log(`Service ${name} - Detailed Description: "${detailedDescription}"`);

            return {
                'Service Name': name,
                'Price Range': priceRange,
                'Overview': overview,
                'Detailed Description': detailedDescription,
                'Time Estimate': duration
            };
        });

        console.log(`Successfully loaded ${servicesTab} tab with ${sheetsData['services'].length} rows`);

        if (sheetsData['services'].length > 0) {
          console.log(`Sample services data: ${JSON.stringify(sheetsData['services'][0]).substring(0, 100)}...`);
        }
      } catch (error) {
        console.error(`Error loading services tab ${servicesTab}:`, error);
      }
    } else {
      console.log(`Services tab not found in the provided sheet`);
    }

    // Load Add-On Services tab
    if (addOnsTab) {
      try {
        console.log(`Loading add-on services from tab: ${addOnsTab}`);

        // Get data from the sheet
        const response = await sheetsClient.spreadsheets.values.get({
          spreadsheetId,
          range: `${addOnsTab}!A1:Z1000` // Get a large range
        });

        const sheetData = response.data.values || [];
        console.log(`Add-on services tab has ${sheetData.length} rows of data`);

        // Process the data
        sheetsData['addons'] = processSheetData('addons', sheetData);

        // Transform data to include Overview and Detailed Description for add-ons
        sheetsData['addons'] = sheetsData['addons'].map((addon: any) => {
            const name = addon['Add-On Service'] || addon['0'] || 'Unnamed Add-on';
            const priceRange = addon['Price'] || addon['1'] || 'Price varies';
            const overview = addon['Overview'] || addon['Description'] || addon['2'] || ''; // Fallback to Description for backwards compatibility
            // Try multiple possible column names for detailed description
            const detailedDescription = addon['Detailed Description'] || 
                                       addon['DetailedDescription'] || 
                                       addon['Detailed_Description'] ||
                                       addon['3'] || ''; // New field with fallbacks
            const duration = addon['Time Estimate'] || addon['4'] || '';

            console.log(`Add-on ${name} - Detailed Description: "${detailedDescription}"`);

            return {
                'Add-On Service': name,
                'Price': priceRange,
                'Overview': overview,
                'Detailed Description': detailedDescription,
                'Time Estimate': duration
            };
        });


        console.log(`Successfully loaded ${addOnsTab} tab with ${sheetsData['addons'].length} rows`);

        if (sheetsData['addons'].length > 0) {
          console.log(`Sample add-on data: ${JSON.stringify(sheetsData['addons'][0]).substring(0, 100)}...`);
        }
      } catch (error) {
        console.error(`Error loading add-on services tab ${addOnsTab}:`, error);
      }
    } else {
      console.log(`Add-on services tab not found in the provided sheet`);
    }

    console.log('Finished loading sheets from Google Sheets');
    criticalMonitor.reportSuccess('Google Sheets'); // Report success after all sheets loaded
    return true;
  } catch (error: any) {
    console.error('Error loading sheets from Google Sheets:', error);
    await criticalMonitor.reportFailure('Google Sheets', error.message || 'Failed to load sheets');
    return false;
  }
}

// Generate a GPT prompt from user input and sheet data 
export function generatePrompt(userInput: string): string {
  const promptParts = [
    "You are Clean Machine Auto Detail in Tulsa. Answer with a friendly, professional, and knowledgeable tone. Always use proper grammar and complete sentences with correct punctuation. Do not refer to yourself by name or in the first person.",
    `Customer asked: ${userInput.trim()}`
  ];

  // Add knowledge base
  promptParts.push(extractKnowledgeBase());

  return promptParts.join('\n\n');
}

// Extract knowledge base for AI context
export function extractKnowledgeBase(): string {
  // ONLY use Google Sheets data - no fallback with wrong pricing
  if (Object.keys(sheetsData).length > 0) {
    return formatKnowledgeBase();
  }

  // If Google Sheets fails to load, return minimal business info only (NO pricing)
  return `
# Clean Machine Auto Detail Information

## Business Information
- Location: Mobile service in Tulsa, OK area
- Business Hours: 9 AM - 6 PM Monday through Friday
- Latest Appointment Start Time: 3 PM (we need time to complete services before 6 PM)
- Service Area: Within 26 minutes drive time from Tulsa
- Contact Phone: 918-856-5711
- Contact Email: cleanmachinetulsa@gmail.com

Note: For current service pricing and details, please visit cleanmachinetulsa.com or ask for specific services.
`;
}

// Load sheets data on module load
(async () => {
  await loadAllSheets();
})();