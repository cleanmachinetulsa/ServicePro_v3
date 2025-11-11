import { sheetsData } from './knowledge';

export interface ServiceInfo {
  name: string;
  priceRange: string;
  description: string;
  duration: string;
  durationHours: number;
}

// Helper function to extract duration hours from string
function extractDurationHours(durationStr: string): number {
  if (!durationStr) return 2; // Default
  
  // Try to extract hours 
  const hourMatch = durationStr.match(/(\d+)(?:\s*-\s*\d+)?\s*hours?/i);
  if (hourMatch && hourMatch[1]) {
    return parseInt(hourMatch[1], 10);
  }
  
  // Try to extract minutes and convert to hours
  const minuteMatch = durationStr.match(/(\d+)(?:\s*-\s*\d+)?\s*min/i);
  if (minuteMatch && minuteMatch[1]) {
    return Math.max(0.5, Math.round((parseInt(minuteMatch[1], 10) / 60) * 2) / 2);
  }
  
  return 2; // Default if no match
}

// Get services directly from the sheets data
// NOTE: Requires Google Sheets connection to be working
// TODO: Fix Google Sheets API connection if failing
export function getServicesFromSheets(): ServiceInfo[] {
  if (!sheetsData['Services'] || !Array.isArray(sheetsData['Services']) || sheetsData['Services'].length === 0) {
    console.error('❌ GOOGLE SHEETS NOT CONNECTED - No services found in sheets data');
    console.error('TODO: Verify Google Sheets API connection and "Services" tab exists');
    throw new Error('SHEETS_NOT_CONNECTED: Services data unavailable. Please contact support.');
  }
  
  console.log(`Found ${sheetsData['Services'].length} services in sheets data`);
  
  try {
    return sheetsData['Services'].map(service => {
      // Map the sheet columns to our service interface with exact column names
      const name = service['Service Name'] || service['Service'] || '';
      const priceRange = service['Price'] || service['Price Range'] || service['Cost'] || 'Contact for pricing';
      const description = service['Service Description'] || service['Description'] || '';
      const duration = service['Duration'] || service['Time Estimate'] || '';
      const durationHours = extractDurationHours(duration);

      console.log(`Loading service: ${name} with price: ${priceRange}`); // Debug log
      
      return {
        name,
        priceRange,
        description,
        duration,
        durationHours
      };
    }).filter(service => service.name); // Only include services with a name
  } catch (error) {
    console.error('❌ ERROR parsing services from sheets:', error);
    throw new Error('SHEETS_PARSE_ERROR: Unable to parse services data');
  }
}

/**
 * REMOVED: fallbackServices - No longer using hardcoded pricing fallback
 * All service data must come from real Google Sheets "Services" tab
 * TODO: Ensure Google Sheets API is properly connected and "Services" tab exists with columns:
 *   - Service Name
 *   - Price (or Price Range)
 *   - Service Description (or Description)
 *   - Duration (or Time Estimate)
 */

// Main function to get services - NO FALLBACK, errors if sheets unavailable
export function getAllServices(): ServiceInfo[] {
  return getServicesFromSheets(); // Will throw error if sheets not connected
}

// Define interface for add-on services
export interface AddOnService {
  name: string;
  priceRange: string;
  description: string;
}

// Get add-on services from Google Sheets
// NOTE: Requires Google Sheets connection to be working
// TODO: Fix Google Sheets API connection if failing
function getAddOnsFromSheets(): AddOnService[] {
  if (!sheetsData['Add-Ons'] || !Array.isArray(sheetsData['Add-Ons']) || sheetsData['Add-Ons'].length === 0) {
    console.error('❌ GOOGLE SHEETS NOT CONNECTED - No add-ons found in sheets data');
    console.error('TODO: Verify Google Sheets API connection and "Add-Ons" tab exists');
    throw new Error('SHEETS_NOT_CONNECTED: Add-on services data unavailable. Please contact support.');
  }
  
  console.log(`Found ${sheetsData['Add-Ons'].length} add-ons in sheets data`);
  
  try {
    return sheetsData['Add-Ons']
      .map(addon => {
        // Map the sheet columns using exact column names from the Google Sheet
        const name = addon['Add-On Service'] || '';
        const priceRange = addon['Price'] || 'Contact for pricing';
        const description = addon['Description'] || '';
        
        // Debug log to see what we're getting
        console.log('Processing add-on:', { name, priceRange, description });
        
        if (!addon['Add-On Service']) {
          console.warn('Skipping invalid add-on entry:', addon);
          return null;
        }
        
        console.log(`Loading add-on: ${name} with price: ${priceRange}`); // Debug log
        
        // Update Ceramic Coating price if needed based on input
        if (name === 'Ceramic Coating Protection' && priceRange !== '$400-800') {
          console.log('Updating Ceramic Coating pricing to accurate range');
          return {
            name,
            priceRange: '$400-800',
            description: description + ' (starts at $400 for partial, $800+ for full vehicle)'
          };
        }
        
        return {
          name,
          priceRange,
          description
        };
      })
      .filter(addon => 
        // Filter out null entries and Clay Bar Treatment
        addon && addon.name && addon.name.trim() !== '' && addon.name !== 'Clay Bar Treatment'
      );
  } catch (error) {
    console.error('❌ ERROR parsing add-ons from sheets:', error);
    throw new Error('SHEETS_PARSE_ERROR: Unable to parse add-on services data');
  }
}

/**
 * REMOVED: fallbackAddOns - No longer using hardcoded pricing fallback
 * All add-on data must come from real Google Sheets "Add-Ons" tab
 * TODO: Ensure Google Sheets API is properly connected and "Add-Ons" tab exists with columns:
 *   - Add-On Service
 *   - Price
 *   - Description
 */

// Main function to get add-on services - NO FALLBACK, errors if sheets unavailable
export function getAllAddOns(): AddOnService[] {
  return getAddOnsFromSheets(); // Will throw error if sheets not connected
}