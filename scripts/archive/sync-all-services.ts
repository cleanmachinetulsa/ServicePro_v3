import { db } from './db.js';
import { services } from '../shared/schema.js';
import { getServiceData } from './pricing.js';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { eq } from 'drizzle-orm';

const SPREADSHEET_ID = '1-xeX82TPoxxeyWXoCEXh-TdMkBHuJSXjoUSaiFjfv9g';

async function getGoogleSheetsClient() {
  try {
    // Get credentials from environment variable ONLY (never from files for security)
    if (!process.env.GOOGLE_API_CREDENTIALS) {
      throw new Error('CRITICAL: GOOGLE_API_CREDENTIALS environment variable is not set. Service sync cannot proceed.');
    }
    
    let credentials: any = null;
    try {
      credentials = JSON.parse(process.env.GOOGLE_API_CREDENTIALS);
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
    return null;
  }
}

(async () => {
  try {
    console.log('=== SYNCING ALL SERVICES AND ADD-ONS ===\n');
    
    // 1. Get main services
    console.log('1. Fetching main services from Google Sheets...');
    const mainServices = await getServiceData();
    console.log(`   Found ${mainServices.length} main services\n`);
    
    // 2. Get add-ons
    console.log('2. Fetching add-ons from Google Sheets...');
    const sheetsClient = await getGoogleSheetsClient();
    const response = await sheetsClient!.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Add-Ons!A1:Z1000'
    });
    
    const addonsData = response.data.values || [];
    const headers = addonsData[0];
    const addons = addonsData.slice(1).map((row: any[]) => ({
      name: row[0] || '',
      priceRange: row[1] || '',
      description: row[2] || '',
    })).filter(a => a.name);
    
    console.log(`   Found ${addons.length} add-ons\n`);
    
    // 3. Sync main services
    console.log('3. Syncing main services to database...');
    for (const service of mainServices) {
      const existing = await db.select().from(services).where(eq(services.name, service.name));
      
      if (existing.length > 0) {
        await db.update(services)
          .set({
            priceRange: service.priceRange,
            overview: service.description.substring(0, 500),
            detailedDescription: service.description,
            duration: service.duration,
            durationHours: service.durationHours.toString(),
            minDurationHours: service.minDurationHours.toString(),
            maxDurationHours: service.maxDurationHours.toString(),
          })
          .where(eq(services.id, existing[0].id));
        console.log(`   ✓ Updated: ${service.name}`);
      } else {
        await db.insert(services).values({
          name: service.name,
          priceRange: service.priceRange,
          overview: service.description.substring(0, 500),
          detailedDescription: service.description,
          duration: service.duration,
          durationHours: service.durationHours.toString(),
          minDurationHours: service.minDurationHours.toString(),
          maxDurationHours: service.maxDurationHours.toString(),
        });
        console.log(`   ✓ Inserted: ${service.name}`);
      }
    }
    
    // 4. Sync add-ons
    console.log('\n4. Syncing add-ons to database...');
    for (const addon of addons) {
      const existing = await db.select().from(services).where(eq(services.name, addon.name));
      
      if (existing.length > 0) {
        await db.update(services)
          .set({
            priceRange: addon.priceRange,
            overview: addon.description,
            detailedDescription: addon.description,
            duration: '30-60 minutes',
            durationHours: '0.75',
            minDurationHours: '0.5',
            maxDurationHours: '1',
          })
          .where(eq(services.id, existing[0].id));
        console.log(`   ✓ Updated: ${addon.name}`);
      } else {
        await db.insert(services).values({
          name: addon.name,
          priceRange: addon.priceRange,
          overview: addon.description,
          detailedDescription: addon.description,
          duration: '30-60 minutes',
          durationHours: '0.75',
          minDurationHours: '0.5',
          maxDurationHours: '1',
        });
        console.log(`   ✓ Inserted: ${addon.name}`);
      }
    }
    
    console.log('\n✅ ALL SERVICES SYNCED!\n');
    
    // Display all
    const allServices = await db.select().from(services);
    console.log('Complete Service List:');
    allServices.forEach(s => console.log(`  ID ${s.id}: ${s.name} - ${s.priceRange}`));
    
  } catch (error) {
    console.error('Error syncing:', error);
  }
})();
