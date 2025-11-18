import axios from 'axios';

/**
 * Health check for Google Maps API
 * Tests both environment variables and validates API key works
 */
export async function checkGoogleMapsAPIHealth(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    const googleApiKey = process.env.GOOGLE_API_KEY;

    // Check if at least one key is configured
    if (!mapsApiKey && !googleApiKey) {
      return {
        success: false,
        message: 'Google Maps API keys not configured. Need GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY',
        details: {
          GOOGLE_MAPS_API_KEY: 'missing',
          GOOGLE_API_KEY: 'missing'
        }
      };
    }

    // Warn if inconsistent (different keys for different services)
    if (mapsApiKey && googleApiKey && mapsApiKey !== googleApiKey) {
      console.warn('[HEALTH CHECK] Warning: GOOGLE_MAPS_API_KEY and GOOGLE_API_KEY are different. Using GOOGLE_MAPS_API_KEY for validation.');
    }

    const apiKey = mapsApiKey || googleApiKey;

    // Test geocoding API with a simple request
    const testAddress = 'Tulsa, OK';
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: testAddress,
        key: apiKey
      },
      timeout: 5000
    });

    if (response.data.status === 'OK') {
      return {
        success: true,
        message: 'Google Maps API is healthy and responding',
        details: {
          GOOGLE_MAPS_API_KEY: mapsApiKey ? 'configured' : 'missing',
          GOOGLE_API_KEY: googleApiKey ? 'configured' : 'missing',
          apiStatus: 'OK',
          testAddress,
          resultCount: response.data.results?.length || 0
        }
      };
    } else if (response.data.status === 'REQUEST_DENIED') {
      return {
        success: false,
        message: 'Google Maps API request denied - check API key permissions',
        details: {
          status: response.data.status,
          errorMessage: response.data.error_message
        }
      };
    } else {
      return {
        success: false,
        message: `Google Maps API returned status: ${response.data.status}`,
        details: {
          status: response.data.status,
          errorMessage: response.data.error_message
        }
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: 'Google Maps API health check failed',
      details: {
        error: error.message,
        code: error.code
      }
    };
  }
}

/**
 * Run all health checks on server startup
 */
export async function runStartupHealthChecks(): Promise<void> {
  console.log('\n=== STARTUP HEALTH CHECKS ===\n');

  // Google Maps API
  const mapsHealth = await checkGoogleMapsAPIHealth();
  if (mapsHealth.success) {
    console.log('✅ Google Maps API:', mapsHealth.message);
    if (mapsHealth.details) {
      console.log('   Details:', JSON.stringify(mapsHealth.details, null, 2));
    }
  } else {
    console.error('❌ Google Maps API:', mapsHealth.message);
    if (mapsHealth.details) {
      console.error('   Details:', JSON.stringify(mapsHealth.details, null, 2));
    }
  }

  console.log('\n=== HEALTH CHECKS COMPLETE ===\n');
}
