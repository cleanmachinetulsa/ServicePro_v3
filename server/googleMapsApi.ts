import axios from 'axios';
import { getAuthClient } from './googleIntegration';
import { db } from './db';
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
async function getMaxDriveTime(): Promise<number> {
  try {
    const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
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
 */
function preprocessAddress(rawAddress: string): string {
  let address = rawAddress.trim();
  
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
 */
export async function geocodeAddress(address: string) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key not found in environment variables');
      return { success: false, error: 'API key configuration error' };
    }

    // Smart preprocessing: enhance incomplete addresses
    const enhancedAddress = preprocessAddress(address);

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: enhancedAddress,
        key: apiKey,
        components: 'locality:Tulsa|administrative_area:OK|country:US'  // Bias results to Tulsa, OK
      }
    });

    if (response.data.status !== 'OK') {
      console.error('Geocoding error:', response.data.status, response.data.error_message);
      
      // Provide more helpful error messages
      if (response.data.status === 'ZERO_RESULTS') {
        return { 
          success: false, 
          error: 'Address not found',
          originalAddress: address,
          enhancedAddress: enhancedAddress
        };
      }
      
      return { success: false, error: 'Failed to geocode address' };
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
  } catch (error) {
    console.error('Error geocoding address:', error);
    return { success: false, error: 'Failed to geocode address' };
  }
}

/**
 * Check if an address is within the service area
 */
export async function checkDistanceToBusinessLocation(address: string) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key not found in environment variables');
      return { success: false, error: 'API key configuration error' };
    }

    // First geocode the address
    const geocodeResult = await geocodeAddress(address);
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
      console.error('Distance Matrix API error:', response.data.status, response.data.error_message);
      return { success: false, error: 'Failed to check distance' };
    }

    if (!response.data.rows || response.data.rows.length === 0 || 
        !response.data.rows[0].elements || response.data.rows[0].elements.length === 0) {
      return { success: false, error: 'No distance results found' };
    }

    const distanceElement = response.data.rows[0].elements[0];
    if (distanceElement.status !== 'OK') {
      console.error('Distance calculation error:', distanceElement.status);
      return { success: false, error: 'Failed to calculate distance' };
    }

    // Extract driving time in minutes from the response
    const distanceText = distanceElement.distance.text;
    const driveTimeText = distanceElement.duration.text;
    const driveTimeMinutes = distanceElement.duration.value / 60; // Convert seconds to minutes

    // Get configurable max drive time from business settings
    const maxDriveTime = await getMaxDriveTime();
    
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
  } catch (error) {
    console.error('Error checking distance:', error);
    return { success: false, error: 'Failed to check distance to business location' };
  }
}

/**
 * Calculate ETA and generate navigation link for an appointment
 * Returns ETA time and Google Maps navigation URL
 */
export async function calculateETAAndGenerateNavLink(address: string) {
  try {
    // Get distance and drive time information
    const distanceResult = await checkDistanceToBusinessLocation(address);
    
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