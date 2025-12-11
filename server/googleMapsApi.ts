import axios from 'axios';
import { getAuthClient } from './googleIntegration';
import type { TenantDb } from './db';
import { businessSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Central business location: 4644 S Troost Ave Tulsa, OK 74105
const BUSINESS_LOCATION = {
  lat: 36.09,
  lng: -95.975
};

// Default maximum drive time in minutes (can be overridden by business settings)
const DEFAULT_MAX_DRIVE_TIME_MINUTES = 26;

// We'll keep this for conversion if needed
const METERS_PER_MILE = 1609.34;

/**
 * Get max drive time from business settings or use default
 */
async function getMaxDriveTime(tenantDb: TenantDb): Promise<number> {
  try {
    const settings = await tenantDb.select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
    if (settings.length > 0 && settings[0].maxDriveTimeMinutes) {
      return settings[0].maxDriveTimeMinutes;
    }
  } catch (error) {
    console.warn('[MAPS API] Could not load max drive time from settings, using default:', error);
  }
  return DEFAULT_MAX_DRIVE_TIME_MINUTES;
}

/**
 * Smart address preprocessing to enhance incomplete addresses
 * - Adds "Tulsa, OK" if city/state missing
 * - Normalizes common abbreviations
 * - Makes validation smoother for customers
 * 
 * HOTFIX-SMS-CM: Guards against undefined/null address to prevent TypeError on .trim()
 */
function preprocessAddress(rawAddress: string | undefined | null): string {
  // HOTFIX-SMS-CM: Guard against missing or undefined address
  if (!rawAddress || typeof rawAddress !== 'string') {
    const err = new Error('Missing or empty address for preprocessAddress');
    (err as any).code = 'MISSING_ADDRESS';
    throw err;
  }
  
  const trimmed = rawAddress.trim();
  if (!trimmed) {
    const err = new Error('Address is empty after trimming');
    (err as any).code = 'MISSING_ADDRESS';
    throw err;
  }
  
  let address = trimmed;
  
  // Normalize common street abbreviations (case-insensitive)
  const abbreviations: Record<string, string> = {
    'pl': 'Pl',
    'place': 'Pl',
    'st': 'St',
    'street': 'St',
    'ave': 'Ave',
    'avenue': 'Ave',
    'rd': 'Rd',
    'road': 'Rd',
    'dr': 'Dr',
    'drive': 'Dr',
    'ln': 'Ln',
    'lane': 'Ln',
    'ct': 'Ct',
    'court': 'Ct',
    'blvd': 'Blvd',
    'boulevard': 'Blvd',
    'pkwy': 'Pkwy',
    'parkway': 'Pkwy',
    'cir': 'Cir',
    'circle': 'Cir'
  };
  
  // Replace street type abbreviations (match word boundaries)
  for (const [abbr, standard] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    address = address.replace(regex, standard);
  }
  
  // Check if address already has city and state
  const hasCity = /tulsa/i.test(address);
  const hasState = /\b(ok|oklahoma)\b/i.test(address);
  const hasZip = /\b74\d{3}\b/.test(address);
  
  // If missing city/state, append Tulsa, OK
  if (!hasCity && !hasState && !hasZip) {
    address = `${address}, Tulsa, OK`;
    console.log(`[ADDRESS PREPROCESSING] Enhanced "${rawAddress}" → "${address}"`);
  } else if (hasCity && !hasState) {
    // Has city but no state
    address = `${address}, OK`;
    console.log(`[ADDRESS PREPROCESSING] Added state: "${rawAddress}" → "${address}"`);
  }
  
  return address;
}

/**
 * Geocode an address to get its coordinates
 * Now includes smart preprocessing for incomplete addresses
 * 
 * HOTFIX-SMS-CM: Added error handling for MISSING_ADDRESS to return structured error
 */
export async function geocodeAddress(tenantDb: TenantDb, address: string | undefined | null) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('MAPS_GEOCODE_ERROR', { 
        address, 
        error: 'GOOGLE_MAPS_API_KEY is not set – cannot geocode address' 
      });
      return { success: false, error: 'Maps API key is missing on server' };
    }

    // Smart preprocessing: enhance incomplete addresses
    // HOTFIX-SMS-CM: This now throws with code='MISSING_ADDRESS' if address is undefined/empty
    let enhancedAddress: string;
    try {
      enhancedAddress = preprocessAddress(address);
    } catch (preprocessError: any) {
      if (preprocessError?.code === 'MISSING_ADDRESS') {
        console.error('MAPS_GEOCODE_ERROR', {
          error: preprocessError.message,
          code: 'MISSING_ADDRESS',
          address,
        });
        return {
          success: false,
          errorCode: 'MISSING_ADDRESS',
          error: 'No address was provided. Please share your full street address so I can check your location.',
          originalAddress: address,
        };
      }
      throw preprocessError; // Re-throw other errors
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: enhancedAddress,
        key: apiKey,
        components: 'locality:Tulsa|administrative_area:OK|country:US'  // Bias results to Tulsa, OK
      }
    });

    if (response.data.status !== 'OK') {
      // Structured error logging for better debugging
      console.error('MAPS_GEOCODE_ERROR', {
        address,
        enhancedAddress,
        httpStatus: response.status,
        mapsStatus: response.data.status,
        errorMessage: response.data.error_message || null
      });
      
      // Provide more helpful error messages based on status
      const errorMessages: Record<string, string> = {
        'ZERO_RESULTS': 'Address not found. Please check the address and try again.',
        'OVER_QUERY_LIMIT': 'Service temporarily unavailable. Please try again in a moment.',
        'REQUEST_DENIED': 'Maps API access denied. Please contact support.',
        'INVALID_REQUEST': 'Invalid address format. Please check the address.',
        'UNKNOWN_ERROR': 'Maps service error. Please try again.'
      };
      
      return { 
        success: false, 
        error: response.data.error_message || errorMessages[response.data.status] || 'Failed to geocode address',
        mapsStatus: response.data.status,
        originalAddress: address,
        enhancedAddress: enhancedAddress
      };
    }

    if (!response.data.results || response.data.results.length === 0) {
      return { 
        success: false, 
        error: 'No results found for address',
        originalAddress: address,
        enhancedAddress: enhancedAddress
      };
    }

    const location = response.data.results[0].geometry.location;
    const formattedAddress = response.data.results[0].formatted_address;

    return {
      success: true,
      location,
      formattedAddress,
      originalAddress: address,
      enhancedAddress: enhancedAddress
    };
  } catch (error: any) {
    console.error('MAPS_GEOCODE_ERROR', {
      address,
      error: error.message || String(error),
      stack: error.stack
    });
    return { success: false, error: error.message || 'Failed to geocode address' };
  }
}

/**
 * Check if an address is within the service area
 * 
 * HOTFIX-SMS-CM: Added overload support - can be called as:
 * - checkDistanceToBusinessLocation(tenantDb, address) - original signature
 * - checkDistanceToBusinessLocation(address) - convenience signature (for schedulingTools.ts)
 * 
 * Also added guard against undefined address.
 */
export async function checkDistanceToBusinessLocation(tenantDbOrAddress: TenantDb | string | undefined | null, address?: string | undefined | null) {
  // HOTFIX-SMS-CM: Support both calling conventions
  // If first arg is a string, it's actually the address (old callers passed only address)
  let actualTenantDb: TenantDb;
  let actualAddress: string | undefined | null;
  
  // Import db and wrapTenantDb lazily to create fallback tenantDb
  const { db } = await import('./db');
  const { wrapTenantDb } = await import('./tenantDb');
  
  if (typeof tenantDbOrAddress === 'string' || tenantDbOrAddress === undefined || tenantDbOrAddress === null) {
    // Called as checkDistanceToBusinessLocation(address) - legacy pattern from schedulingTools.ts
    actualAddress = tenantDbOrAddress as string | undefined | null;
    // HOTFIX-SMS-CM: Create proper tenantDb for Clean Machine (root tenant) instead of null
    actualTenantDb = wrapTenantDb(db, 'root');
    console.log('[MAPS API] checkDistanceToBusinessLocation called with single argument (address only), using root tenant');
  } else {
    // Called as checkDistanceToBusinessLocation(tenantDb, address) - new pattern
    actualTenantDb = tenantDbOrAddress;
    actualAddress = address;
  }
  
  // HOTFIX-SMS-CM: Guard against missing address
  if (!actualAddress || typeof actualAddress !== 'string' || !actualAddress.trim()) {
    console.error('MAPS_DISTANCE_ERROR', { 
      address: actualAddress, 
      error: 'Missing or empty address parameter',
      code: 'MISSING_ADDRESS'
    });
    return { 
      success: false, 
      errorCode: 'MISSING_ADDRESS',
      error: 'No address was provided. Please share your full street address so I can check if we service your area.',
      originalAddress: actualAddress
    };
  }
  
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('MAPS_DISTANCE_ERROR', { 
        address: actualAddress, 
        error: 'GOOGLE_MAPS_API_KEY is not set – cannot check distance' 
      });
      return { success: false, error: 'Maps API key is missing on server' };
    }

    // First geocode the address
    const geocodeResult = await geocodeAddress(actualTenantDb, actualAddress);
    if (!geocodeResult.success) {
      return geocodeResult; // Return the error from geocoding
    }

    // Get coordinates for origin (business) and destination (customer)
    const origins = `${BUSINESS_LOCATION.lat},${BUSINESS_LOCATION.lng}`;
    const destinations = `${geocodeResult.location.lat},${geocodeResult.location.lng}`;

    // Call the Distance Matrix API
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: origins,
        destinations: destinations,
        mode: 'driving',
        units: 'imperial', // Using miles
        key: apiKey
      }
    });

    if (response.data.status !== 'OK') {
      console.error('MAPS_DISTANCE_ERROR', {
        address: actualAddress,
        httpStatus: response.status,
        mapsStatus: response.data.status,
        errorMessage: response.data.error_message || null
      });
      
      const errorMessages: Record<string, string> = {
        'OVER_QUERY_LIMIT': 'Service temporarily unavailable. Please try again in a moment.',
        'REQUEST_DENIED': 'Maps API access denied. Please contact support.',
        'INVALID_REQUEST': 'Invalid request. Please check the address.',
        'UNKNOWN_ERROR': 'Maps service error. Please try again.'
      };
      
      return { 
        success: false, 
        error: response.data.error_message || errorMessages[response.data.status] || 'Failed to check distance',
        mapsStatus: response.data.status
      };
    }

    if (!response.data.rows || response.data.rows.length === 0 || 
        !response.data.rows[0].elements || response.data.rows[0].elements.length === 0) {
      console.error('MAPS_DISTANCE_ERROR', {
        address: actualAddress,
        error: 'No distance results in response',
        responseData: JSON.stringify(response.data).slice(0, 500)
      });
      return { success: false, error: 'No distance results found' };
    }

    const distanceElement = response.data.rows[0].elements[0];
    if (distanceElement.status !== 'OK') {
      console.error('MAPS_DISTANCE_ERROR', {
        address: actualAddress,
        elementStatus: distanceElement.status,
        error: 'Distance element status not OK'
      });
      return { success: false, error: `Distance calculation failed: ${distanceElement.status}` };
    }

    // Extract driving time in minutes from the response
    const distanceText = distanceElement.distance.text;
    const driveTimeText = distanceElement.duration.text;
    const driveTimeMinutes = distanceElement.duration.value / 60; // Convert seconds to minutes

    // Get configurable max drive time from business settings
    // HOTFIX-SMS-CM: actualTenantDb is now always valid (we create one for single-arg calls)
    const maxDriveTime = await getMaxDriveTime(actualTenantDb);
    
    // Determine if the address is within the service area based on drive time
    const isInServiceArea = driveTimeMinutes <= maxDriveTime;

    return {
      success: true,
      distance: {
        text: distanceText
      },
      driveTime: {
        text: driveTimeText,
        minutes: driveTimeMinutes
      },
      isInServiceArea,
      formattedAddress: geocodeResult.formattedAddress
    };
  } catch (error: any) {
    console.error('MAPS_DISTANCE_ERROR', {
      address: actualAddress,
      error: error.message || String(error),
      stack: error.stack
    });
    return { success: false, error: error.message || 'Failed to check distance to business location' };
  }
}

/**
 * Calculate ETA and generate navigation link for an appointment
 * Returns ETA time and Google Maps navigation URL
 */
export async function calculateETAAndGenerateNavLink(tenantDb: TenantDb, address: string) {
  try {
    // Get distance and drive time information
    const distanceResult = await checkDistanceToBusinessLocation(tenantDb, address);
    
    if (!distanceResult.success || !('driveTime' in distanceResult)) {
      return distanceResult; // Return the error
    }
    
    // Calculate ETA (current time + drive time)
    const now = new Date();
    const etaMinutes = Math.ceil(distanceResult.driveTime?.minutes || 0);
    const etaTime = new Date(now.getTime() + etaMinutes * 60000);
    
    // Format ETA time nicely (e.g., "12:45 PM")
    const etaFormatted = etaTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Generate Google Maps navigation URL
    // This uses the mobile-friendly Google Maps URL scheme
    const encodedAddress = encodeURIComponent(address);
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&origin=${BUSINESS_LOCATION.lat},${BUSINESS_LOCATION.lng}&destination=${encodedAddress}&travelmode=driving`;
    
    return {
      success: true,
      eta: {
        time: etaTime.toISOString(),
        formatted: etaFormatted,
        minutes: etaMinutes,
        driveTimeText: distanceResult.driveTime?.text || 'Unknown'
      },
      navigation: {
        url: navigationUrl,
        shortUrl: navigationUrl // Can implement URL shortening if needed
      },
      distance: distanceResult.distance,
      formattedAddress: distanceResult.formattedAddress
    };
  } catch (error) {
    console.error('Error calculating ETA and navigation:', error);
    return { success: false, error: 'Failed to calculate ETA and navigation' };
  }
}

/**
 * Health check for Maps API - verifies API key is present and geocoding works
 * Tests with a known good address (Tulsa, OK)
 */
export async function checkMapsHealth(): Promise<{
  success: boolean;
  hasApiKey: boolean;
  geocodeStatus?: string;
  sampleAddressLat?: number;
  sampleAddressLng?: number;
  error?: string;
}> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('MAPS_HEALTH_CHECK', { 
      hasApiKey: false, 
      error: 'GOOGLE_MAPS_API_KEY is not set' 
    });
    return {
      success: false,
      hasApiKey: false,
      error: 'Maps API key is not configured on server'
    };
  }
  
  try {
    // Test with a known good address
    const testAddress = 'Tulsa, OK';
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: testAddress,
        key: apiKey
      }
    });
    
    if (response.data.status !== 'OK') {
      console.error('MAPS_HEALTH_CHECK', {
        hasApiKey: true,
        geocodeStatus: response.data.status,
        errorMessage: response.data.error_message
      });
      return {
        success: false,
        hasApiKey: true,
        geocodeStatus: response.data.status,
        error: response.data.error_message || `Geocode test failed: ${response.data.status}`
      };
    }
    
    const location = response.data.results[0]?.geometry?.location;
    
    console.log('MAPS_HEALTH_CHECK', { 
      success: true, 
      hasApiKey: true, 
      geocodeStatus: 'OK',
      lat: location?.lat,
      lng: location?.lng
    });
    
    return {
      success: true,
      hasApiKey: true,
      geocodeStatus: 'OK',
      sampleAddressLat: location?.lat,
      sampleAddressLng: location?.lng
    };
  } catch (error: any) {
    console.error('MAPS_HEALTH_CHECK', {
      hasApiKey: true,
      error: error.message || String(error)
    });
    return {
      success: false,
      hasApiKey: true,
      error: error.message || 'Health check failed'
    };
  }
}