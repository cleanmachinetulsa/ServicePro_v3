import { getGoogleSheetsReadClient } from './googleIntegration';

export interface ServiceInfo {
  name: string;
  priceRange: string;
  overview: string; // Short description for display
  detailedDescription: string; // Full description with details
  description: string; // Legacy field - kept for backwards compatibility
  duration: string;
  durationHours: number; // Average (deprecated but kept for backwards compatibility)
  minDurationHours: number; // Minimum time for service (best case)
  maxDurationHours: number; // Maximum time for service (worst case)
  included?: string;
  notes?: string;
}

// Google Sheet ID - centralized configuration
export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1-xeX82TPoxxeyWXoCEXh-TdMkBHuJSXjoUSaiFjfv9g';

// Process the raw data from the sheet to our format
function processSheetData(data: any[]): ServiceInfo[] {
  if (!data || data.length <= 1) {
    return []; // Empty array if no data
  }
  
  // Get headers from first row
  const headers = data[0];
  
  // Process the rest of the rows
  return data.slice(1)
    .map(row => {
      // Skip empty rows
      if (!row || !row.length || !row.some(cell => cell && cell.toString().trim())) {
        return null;
      }
      
      // Create object with both named and indexed properties
      const obj: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        if (header && header.trim()) {
          obj[header.trim()] = row[index] || '';
        }
        obj[index.toString()] = row[index] || '';
      });
      
      // Extract service information using various possible field names
      // Support multiple column header variants
      const name = obj['Service Name'] || obj['Service'] || obj['Add-On Service'] || obj['Add-On'] || obj['0'] || '';
      const category = obj['Category'] || obj['1'] || '';
      const priceRange = obj['Price Range'] || obj['Price'] || obj['2'] || '';
      
      // Extract both overview (short) and detailed description separately
      const overview = obj['Overview'] || obj['Short Description'] || obj['3'] || '';
      const detailedDescription = obj['Detailed Description'] || obj['Description'] || obj['4'] || '';
      const included = obj['Included'] || obj['5'] || '';
      const timeEstimate = obj['Time Estimate'] || obj['Duration'] || obj['6'] || '';
      const notes = obj['Notes'] || obj['7'] || '';
      
      // Combine fields for legacy 'description' field (backwards compatibility)
      // Use detailedDescription if available, otherwise overview, then add included/notes
      let fullDescription = detailedDescription || overview || '';
      if (included) fullDescription += `\n\nIncludes: ${included}`;
      if (notes) fullDescription += `\n\nNotes: ${notes}`;
      
      // Parse duration to hours for scheduling
      const durationString = timeEstimate.trim() || estimateDuration(name);
      const { min, max, average } = parseDurationToHours(durationString);
      
      // Create service object
      return {
        name: name.trim(),
        priceRange: formatPrice(priceRange.trim()),
        overview: overview.trim(),
        detailedDescription: detailedDescription.trim(),
        description: fullDescription.trim(), // Legacy field
        duration: durationString,
        durationHours: average, // Deprecated - kept for backwards compatibility
        minDurationHours: min,
        maxDurationHours: max,
        included: included.trim(),
        notes: notes.trim()
      };
    })
    .filter(service => service !== null && service.name)
    .map(service => service as ServiceInfo);
}

// Format price with $ if needed
function formatPrice(price: string): string {
  if (!price) return '';
  return price.includes('$') ? price : `$${price}`;
}

// Parse a duration string to hours - returns min, max, and average
function parseDurationToHours(durationStr: string): { min: number; max: number; average: number } {
  const defaultReturn = { min: 1.5, max: 1.5, average: 1.5 };
  
  if (!durationStr) return defaultReturn;
  
  // Match patterns like "2-3 hours" or "45 minutes"
  const hourRangeMatch = durationStr.match(/(\d+)[-–](\d+)\s*(?:hours?|hrs?)/i);
  const hourMatch = durationStr.match(/(\d+)\s*(?:hours?|hrs?)/i);
  const minuteRangeMatch = durationStr.match(/(\d+)[-–](\d+)\s*(?:minutes?|mins?)/i);
  const minuteMatch = durationStr.match(/(\d+)\s*(?:minutes?|mins?)/i);
  
  if (hourRangeMatch) {
    // Range like "2-4 hours"
    const min = parseInt(hourRangeMatch[1]);
    const max = parseInt(hourRangeMatch[2]);
    return { min, max, average: (min + max) / 2 };
  } else if (hourMatch) {
    // Direct hours like "3 hours"
    const hours = parseInt(hourMatch[1]);
    return { min: hours, max: hours, average: hours };
  } else if (minuteRangeMatch) {
    // Range in minutes like "45-60 minutes"
    const min = parseInt(minuteRangeMatch[1]) / 60;
    const max = parseInt(minuteRangeMatch[2]) / 60;
    return { min, max, average: (min + max) / 2 };
  } else if (minuteMatch) {
    // Direct minutes like "45 minutes"
    const hours = parseInt(minuteMatch[1]) / 60;
    return { min: hours, max: hours, average: hours };
  }
  
  return defaultReturn;
}

// Estimate duration based on service name if not provided
function estimateDuration(serviceName: string): string {
  const name = serviceName.toLowerCase();
  
  if (name.includes('full') && name.includes('detail')) {
    return '4-5 hours';
  } else if (name.includes('interior') && name.includes('detail')) {
    return '2-3 hours';
  } else if (name.includes('wash') || name.includes('express')) {
    return '45-60 minutes';
  } else if (name.includes('ceramic') || name.includes('coating')) {
    return '6-8 hours';
  } else if (name.includes('maintenance')) {
    return '1-1.5 hours';
  } else if (name.includes('polish') || name.includes('paint')) {
    return '2-4 hours';
  } else if (name.includes('headlight')) {
    return '1 hour';
  }
  
  return '1-2 hours'; // Default estimate
}

// Get service data directly from Google Sheet
export async function getServiceData(): Promise<ServiceInfo[]> {
  try {
    console.log(`Loading services from Google Sheet: ${SPREADSHEET_ID}`);
    
    const sheetsClient = await getGoogleSheetsReadClient();
    if (!sheetsClient) {
      console.error('Unable to initialize Google Sheets client');
      return getDefaultServices();
    }
    
    // Get sheet names first to confirm exact tab names
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheetNames = spreadsheet.data.sheets?.map(sheet => 
      sheet.properties?.title
    ) || [];
    
    console.log('Available sheets:', sheetNames);
    
    // Look for a sheet that contains the word "service" but not "add"
    const servicesSheet = sheetNames.find(name => 
      name && 
      name.toLowerCase().includes('service') && 
      !name.toLowerCase().includes('add')
    );
    
    if (!servicesSheet) {
      console.error('No services sheet found');
      return getDefaultServices();
    }
    
    console.log(`Found services sheet: "${servicesSheet}"`);
    
    // Get the data from the services sheet
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${servicesSheet}!A1:Z1000` // Get a large range
    });
    
    const data = response.data.values;
    if (!data || data.length === 0) {
      console.error('No data found in services sheet');
      return getDefaultServices();
    }
    
    console.log(`Loaded ${data.length} rows from services sheet`);
    
    // Process the data into our format
    const services = processSheetData(data);
    console.log(`Processed ${services.length} services`);
    
    // Debug output of first service
    if (services.length > 0) {
      console.log('First service:', JSON.stringify(services[0]).substring(0, 200) + '...');
    }
    
    return services;
  } catch (error) {
    console.error('Error fetching service data from Google Sheet:', error);
    return getDefaultServices();
  }
}

// Get add-on services directly from Google Sheet
export async function getAddonServices(): Promise<ServiceInfo[]> {
  try {
    console.log(`Loading add-on services from Google Sheet: ${SPREADSHEET_ID}`);
    
    const sheetsClient = await getGoogleSheetsReadClient();
    if (!sheetsClient) {
      console.error('Unable to initialize Google Sheets client');
      return getDefaultAddonServices();
    }
    
    // Get sheet names first to confirm exact tab names
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheetNames = spreadsheet.data.sheets?.map(sheet => 
      sheet.properties?.title
    ) || [];
    
    // Look for a sheet that contains both "add" and "on" or similar
    const addOnSheet = sheetNames.find(name => 
      name && (
        (name.toLowerCase().includes('add') && name.toLowerCase().includes('on')) ||
        name.toLowerCase().includes('addon')
      )
    );
    
    if (!addOnSheet) {
      console.error('No add-on services sheet found');
      return getDefaultAddonServices();
    }
    
    console.log(`Found add-on services sheet: "${addOnSheet}"`);
    
    // Get the data from the add-on services sheet
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${addOnSheet}!A1:Z1000` // Get a large range
    });
    
    const data = response.data.values;
    if (!data || data.length === 0) {
      console.error('No data found in add-on services sheet');
      return getDefaultAddonServices();
    }
    
    console.log(`Loaded ${data.length} rows from add-on services sheet`);
    
    // Process the data into our format
    const addons = processSheetData(data);
    console.log(`Processed ${addons.length} add-on services`);
    
    // Debug output of first add-on
    if (addons.length > 0) {
      console.log('First add-on:', JSON.stringify(addons[0]).substring(0, 200) + '...');
    }
    
    return addons;
  } catch (error) {
    console.error('Error fetching add-on services data from Google Sheet:', error);
    return getDefaultAddonServices();
  }
}

// Default services if Google Sheet fails
function getDefaultServices(): ServiceInfo[] {
  return [
    {
      name: "Full Detail",
      priceRange: "$299",
      overview: "Complete interior + exterior reconditioning",
      detailedDescription: "Complete interior and exterior detailing that restores your vehicle to showroom condition. Includes clay bar treatment, wax protection, interior deep cleaning, and leather/vinyl conditioning.",
      description: "Complete interior and exterior detailing that restores your vehicle to showroom condition. Includes clay bar treatment, wax protection, interior deep cleaning, and leather/vinyl conditioning.",
      duration: "4-5 hours",
      durationHours: 4.5,
      minDurationHours: 4,
      maxDurationHours: 5
    },
    {
      name: "Interior Detail",
      priceRange: "$179",
      overview: "Deep clean interior surfaces",
      detailedDescription: "Deep interior cleansing with steam cleaning, thorough vacuuming, stain removal, and conditioning of all interior surfaces including leather and plastics.",
      description: "Deep interior cleansing with steam cleaning, thorough vacuuming, stain removal, and conditioning of all interior surfaces including leather and plastics.",
      duration: "2-3 hours",
      durationHours: 2.5,
      minDurationHours: 2,
      maxDurationHours: 3
    },
    {
      name: "Exterior Detail",
      priceRange: "$169",
      overview: "Premium exterior wash and protection",
      detailedDescription: "Premium exterior wash, decontamination, polish, and protection with high-grade carnauba wax. Includes wheels, tires, and all exterior trim.",
      description: "Premium exterior wash, decontamination, polish, and protection with high-grade carnauba wax. Includes wheels, tires, and all exterior trim.",
      duration: "1.5-2 hours",
      durationHours: 1.75,
      minDurationHours: 1.5,
      maxDurationHours: 2
    },
    {
      name: "Express Wash",
      priceRange: "$59",
      overview: "Quick exterior hand wash",
      detailedDescription: "Quick but thorough exterior wash with hand drying, tire shine, and quick exterior protection. Perfect for regular maintenance.",
      description: "Quick but thorough exterior wash with hand drying, tire shine, and quick exterior protection. Perfect for regular maintenance.",
      duration: "45 minutes",
      durationHours: 0.75,
      minDurationHours: 0.75,
      maxDurationHours: 0.75
    },
    {
      name: "Ceramic Coating",
      priceRange: "$899",
      overview: "Long-lasting paint protection",
      detailedDescription: "Professional-grade ceramic coating application for superior paint protection that lasts 2+ years. Includes complete paint correction before application.",
      description: "Professional-grade ceramic coating application for superior paint protection that lasts 2+ years. Includes complete paint correction before application.",
      duration: "8-10 hours",
      durationHours: 9,
      minDurationHours: 8,
      maxDurationHours: 10
    }
  ];
}

// Default add-on services if Google Sheet fails
function getDefaultAddonServices(): ServiceInfo[] {
  return [
    {
      name: "Paint Protection",
      priceRange: "$199",
      overview: "Ceramic-based paint protection",
      detailedDescription: "Premium ceramic-based paint protection that guards against UV damage, minor scratches, and environmental contaminants for up to 12 months.",
      description: "Premium ceramic-based paint protection that guards against UV damage, minor scratches, and environmental contaminants for up to 12 months.",
      duration: "1-2 hours",
      durationHours: 1.5,
      minDurationHours: 1,
      maxDurationHours: 2
    },
    {
      name: "Headlight Restoration",
      priceRange: "$89",
      overview: "Restore headlight clarity",
      detailedDescription: "Complete restoration of foggy or yellowed headlights to like-new clarity with UV protection to prevent future oxidation.",
      description: "Complete restoration of foggy or yellowed headlights to like-new clarity with UV protection to prevent future oxidation.",
      duration: "1 hour",
      durationHours: 1,
      minDurationHours: 1,
      maxDurationHours: 1
    },
    {
      name: "Engine Bay Cleaning",
      priceRange: "$75",
      overview: "Deep engine bay detailing",
      detailedDescription: "Thorough cleaning and degreasing of your engine bay, followed by dressing of all plastic and rubber components for a showroom finish.",
      description: "Thorough cleaning and degreasing of your engine bay, followed by dressing of all plastic and rubber components for a showroom finish.",
      duration: "1 hour",
      durationHours: 1,
      minDurationHours: 1,
      maxDurationHours: 1
    },
    {
      name: "Leather/Upholstery Protection",
      priceRange: "$99",
      overview: "Stain-resistant fabric protectant",
      detailedDescription: "Premium fabric or leather protectant that repels liquids, prevents staining, and extends the life of your interior surfaces.",
      description: "Premium fabric or leather protectant that repels liquids, prevents staining, and extends the life of your interior surfaces.",
      duration: "45 minutes",
      durationHours: 0.75,
      minDurationHours: 0.75,
      maxDurationHours: 0.75
    }
  ];
}

// Search services by name, description, etc.
export function searchServices(query: string, services: ServiceInfo[]): ServiceInfo[] {
  if (!query || !services || services.length === 0) {
    return services || [];
  }
  
  const normalizedQuery = query.toLowerCase();
  
  return services.filter(service => 
    service.name.toLowerCase().includes(normalizedQuery) ||
    service.description.toLowerCase().includes(normalizedQuery)
  );
}