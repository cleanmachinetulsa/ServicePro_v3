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

// Estimate duration based on service name if not provided.
// CM-6: updated to recognise new package names.
function estimateDuration(serviceName: string): string {
  const name = serviceName.toLowerCase();

  // New package names (CM-6)
  if (name.includes('force field pro') || (name.includes('force field') && name.includes('pro'))) {
    return '6-10 hours';
  } else if (name.includes('force field')) {
    return '4-6 hours';
  } else if (name.includes('showstopper')) {
    return '5-7 hours';
  } else if (name.includes('showroom')) {
    return '3-5 hours';
  } else if (name.includes('paint restoration')) {
    return '3-5 hours';
  } else if (name.includes('paint revival')) {
    return '2-4 hours';
  } else if (name.includes('deep clean')) {
    return '2-4 hours';
  } else if (name.includes('pit stop')) {
    return '1.5-2 hours';
  }

  // Legacy / add-on names
  if (name.includes('wash') || name.includes('express')) {
    return '45-60 minutes';
  } else if (name.includes('ceramic') || name.includes('coating')) {
    return '6-8 hours';
  } else if (name.includes('headlight')) {
    return '30-60 minutes';
  } else if (name.includes('engine bay')) {
    return '30-45 minutes';
  } else if (name.includes('trim')) {
    return '30-45 minutes';
  } else if (name.includes('glass') || name.includes('windshield')) {
    return '20-30 minutes';
  } else if (name.includes('ozone') || name.includes('odor')) {
    return '30-60 minutes';
  } else if (name.includes('carpet') || name.includes('shampoo') || name.includes('upholstery')) {
    return '1-2 hours';
  } else if (name.includes('protector') || name.includes('protectant')) {
    return '30-45 minutes';
  } else if (name.includes('motorcycle')) {
    return '1-2 hours';
  } else if (name.includes('polish') || name.includes('paint')) {
    return '2-4 hours';
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

// Default services if Google Sheet fails.
// CM-6: updated to match new package names and prices.
function getDefaultServices(): ServiceInfo[] {
  return [
    {
      name: "Pit Stop",
      priceRange: "$179",
      overview: "For vehicles already in great shape. A professional refresh to keep your car looking its best.",
      detailedDescription: "The Pit Stop is designed for vehicles that are already in good shape and just need a professional refresh. In 1.5–2 hours we hand wash, apply ceramic spray wax, clean wheels and tires, do a quick interior wipedown, treat any small stains, and clean all glass.\n\nRecommended every 90 days to protect your prior detail investment.\n\nImportant: The Pit Stop is for regularly maintained vehicles. If your car has heavy soil, pet hair, or hasn't been detailed in over a year, The Deep Clean is the right starting point.",
      description: "Professional refresh for vehicles already in good shape. Hand wash, ceramic spray wax, quick interior wipedown, and glass cleaning.",
      duration: "1.5-2 hours",
      durationHours: 1.75,
      minDurationHours: 1,
      maxDurationHours: 2
    },
    {
      name: "The Deep Clean",
      priceRange: "$249",
      overview: "A thorough deep clean of every interior surface. Our most popular service — because life happens inside your car.",
      detailedDescription: "The Deep Clean is a thorough, multi-hour restoration of your vehicle's interior. Includes deep vacuum, upholstery and carpet shampoo with steam, leather cleaned and conditioned, headliner spot treatment, all interior glass cleaned, and plastics dressed with UV protectant.\n\nPricing: Standard vehicles $249. Heavily soiled vehicles $299–349 depending on condition.",
      description: "Full interior deep clean: shampoo, steam, leather conditioning, glass, and UV protectant.",
      duration: "2-4 hours",
      durationHours: 3,
      minDurationHours: 2,
      maxDurationHours: 4
    },
    {
      name: "Showroom",
      priceRange: "$349",
      overview: "The complete package. Interior and exterior restored to showroom condition.",
      detailedDescription: "The Showroom is our signature full detail — everything inside and out, done right.\n\nInterior: carpet and upholstery shampooed, leather cleaned and conditioned, headliner spot treated, all glass cleaned, plastics dressed with UV protectant.\n\nExterior: hand wash, clay bar decontamination, ceramic spray wax, wheels cleaned, tires dressed.\n\nMost vehicles complete in 3–5 hours. Our most popular full-service detail.",
      description: "Complete interior + exterior detail. Shampoo, leather conditioning, clay bar, ceramic spray wax.",
      duration: "3-5 hours",
      durationHours: 4,
      minDurationHours: 3,
      maxDurationHours: 5
    },
    {
      name: "Showstopper",
      priceRange: "$549",
      overview: "The best we do. Full interior and exterior detail plus single-stage paint enhancement.",
      detailedDescription: "The Showstopper includes everything in the Showroom detail, plus single-stage machine paint enhancement to remove light swirls and water spots and restore maximum gloss.\n\nTakes 5–7 hours. Engine Bay Detail and Headlight Restore available as add-ons.",
      description: "Full detail + single-stage machine polish. The complete premium package.",
      duration: "5-7 hours",
      durationHours: 6,
      minDurationHours: 5,
      maxDurationHours: 7
    },
    {
      name: "Paint Revival",
      priceRange: "$249",
      overview: "Single-stage machine polish. Removes light swirls, water spots, and oxidation — restores deep shine.",
      detailedDescription: "Single-stage machine polish to remove light swirl marks, water spots, minor scratches, and oxidation. Includes hand wash, decontamination, clay bar, single-stage polish, and window/wheel sealant.\n\nExterior service only. Takes 2–4 hours.",
      description: "Single-stage machine polish: removes light swirls and oxidation. Exterior only.",
      duration: "2-4 hours",
      durationHours: 3,
      minDurationHours: 2,
      maxDurationHours: 4
    },
    {
      name: "Paint Restoration",
      priceRange: "$399",
      overview: "Two-stage paint correction. Removes moderate scratches, heavy swirls, and significant oxidation.",
      detailedDescription: "Two-stage machine polish process for more serious paint defects. Cutting stage removes defects; finishing stage restores maximum gloss. Includes full decontamination, clay bar, and sealants.\n\nExterior service only. Takes 3–5 hours.",
      description: "Two-stage paint correction for moderate-to-heavy defects. Exterior only.",
      duration: "3-5 hours",
      durationHours: 4,
      minDurationHours: 3,
      maxDurationHours: 5
    },
    {
      name: "Force Field",
      priceRange: "$499",
      overview: "Protection that lasts. True SiO2 ceramic coating with 1–2 year durability and exceptional gloss.",
      detailedDescription: "Genuine SiO2 ceramic coating applied to paint and wheels. Hydrophobic protection, enhanced gloss, 1–2 year durability. Includes full decontamination, clay bar, single-stage correction as needed.\n\nSedans $499. SUVs/trucks add $75–150.",
      description: "SiO2 ceramic coating, 1–2 year protection. Hydrophobic, high-gloss finish.",
      duration: "4-6 hours",
      durationHours: 5,
      minDurationHours: 4,
      maxDurationHours: 6
    },
    {
      name: "Force Field Pro",
      priceRange: "$950",
      overview: "Serious long-term protection. Two-stage polished, professionally guaranteed SiO2 coating built to last 3 years.",
      detailedDescription: "Full 2-stage machine polish before ceramic application — up to 90% paint correction. Nasial SiO2 coating on all painted surfaces. Guaranteed by Clean Machine for up to 3 years.\n\nSedans $950. SUVs/trucks quoted individually.",
      description: "2-stage paint correction + premium SiO2 ceramic coating. 3-year protection guarantee.",
      duration: "6-10 hours",
      durationHours: 8,
      minDurationHours: 6,
      maxDurationHours: 10
    },
    {
      name: "Premium Wash",
      priceRange: "$99",
      overview: "A proper hand wash. Not a drive-through — thorough exterior cleaning with ceramic wax protection.",
      detailedDescription: "Real hand wash: all exterior surfaces, wheels and tires, all exterior glass, finished with ceramic spray wax. Takes 45–60 minutes.",
      description: "Hand wash + ceramic spray wax. Wheels, tires, and glass included.",
      duration: "45-60 minutes",
      durationHours: 0.75,
      minDurationHours: 0.75,
      maxDurationHours: 1
    },
    {
      name: "Motorcycle Detail",
      priceRange: "$199",
      overview: "Your motorcycle, detailed right. Machine polished, hand washed, waxed, and fully protected.",
      detailedDescription: "Machine polish, hand wash, wax, seat conditioning, and trim dressing. Takes 1–2 hours.",
      description: "Full motorcycle detail: machine polish, hand wash, wax, and trim care.",
      duration: "1-2 hours",
      durationHours: 1.5,
      minDurationHours: 1,
      maxDurationHours: 2
    }
  ];
}

// Default add-on services if Google Sheet fails.
// CM-6: updated to match new add-on names and prices.
function getDefaultAddonServices(): ServiceInfo[] {
  return [
    {
      name: "Headlight Restore",
      priceRange: "$90",
      overview: "Clear, bright lenses. We restore foggy or yellowed headlights to factory clarity.",
      detailedDescription: "We sand away oxidation, polish the lens to clarity, and apply a UV sealant to slow re-oxidation. Results typically last 1–2 years. Takes 30–60 minutes.",
      description: "Sand, polish, and UV-seal foggy or yellowed headlights. Lasts 1–2 years.",
      duration: "30-60 minutes",
      durationHours: 0.75,
      minDurationHours: 0.5,
      maxDurationHours: 1
    },
    {
      name: "Engine Bay Detail",
      priceRange: "$75",
      overview: "Clean under the hood. Cosmetic degreasing and dressing for a showroom-ready engine bay.",
      detailedDescription: "Careful degreasing, rinsing, and dressing of all engine bay surfaces. Safe for all modern engines. Takes 30–45 minutes.",
      description: "Degrease, rinse, and dress engine bay surfaces. Safe for modern engines.",
      duration: "30-45 minutes",
      durationHours: 0.5,
      minDurationHours: 0.5,
      maxDurationHours: 0.75
    },
    {
      name: "Carpet & Upholstery Shampoo",
      priceRange: "$100",
      overview: "Deep carpet and seat cleaning. Steam, shampoo, and extraction for a truly fresh interior.",
      detailedDescription: "Professional shampoo, steam agitation, and high-powered extraction for carpets, floor mats, and fabric seats. Leather seats receive steam cleaning and conditioning. Takes 1–2 hours.",
      description: "Steam shampoo and extraction for carpets, mats, and fabric seats.",
      duration: "1-2 hours",
      durationHours: 1.5,
      minDurationHours: 1,
      maxDurationHours: 2
    },
    {
      name: "Ozone Odor Removal",
      priceRange: "$75",
      overview: "Eliminate stubborn odors at the source. Ozone treatment reaches where cleaning cannot.",
      detailedDescription: "O3 treatment neutralizes pet smells, smoke, food, and mildew throughout the vehicle including HVAC, headliner, and seating. Vehicle must be unoccupied. Takes 30–60 minutes after cleaning.",
      description: "Ozone treatment for pet, smoke, and mildew odors. Reaches HVAC and headliner.",
      duration: "30-60 minutes",
      durationHours: 0.75,
      minDurationHours: 0.5,
      maxDurationHours: 1
    },
    {
      name: "Fabric & Leather Protector",
      priceRange: "$79",
      overview: "A nano-coating for your interior. Repels liquids and stains before they can set.",
      detailedDescription: "Professional-grade nano-ceramic protectant applied to fabric, carpet, or leather surfaces. Repels water, oil, and stains. Lasts up to 12 months. Takes 30–45 minutes.",
      description: "Nano-ceramic protectant for fabric, carpet, or leather. Stain and liquid resistant.",
      duration: "30-45 minutes",
      durationHours: 0.5,
      minDurationHours: 0.5,
      maxDurationHours: 0.75
    },
    {
      name: "Plastic Trim Restore",
      priceRange: "$65",
      overview: "Bring back the black. We restore faded plastic trim to its original deep, rich finish.",
      detailedDescription: "Premium trim restorer revives color, adds lasting shine, and provides UV protection. Takes 30–45 minutes.",
      description: "Restore faded exterior plastic trim to deep, rich original color with UV protection.",
      duration: "30-45 minutes",
      durationHours: 0.5,
      minDurationHours: 0.5,
      maxDurationHours: 0.75
    },
    {
      name: "Glass & Windshield Protector",
      priceRange: "$49",
      overview: "Hydrophobic glass treatment. Rain beads and rolls off so you can see clearly.",
      detailedDescription: "Professional hydrophobic glass sealant applied to windshield and all windows. Water beads at highway speeds. Rated 1+ year. Takes 20–30 minutes.",
      description: "Hydrophobic sealant for windshield and all glass. 1+ year water-beading protection.",
      duration: "20-30 minutes",
      durationHours: 0.4,
      minDurationHours: 0.33,
      maxDurationHours: 0.5
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