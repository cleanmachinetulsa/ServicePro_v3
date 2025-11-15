import { geocodeAddress, checkDistanceToBusinessLocation } from './googleMapsApi';

/**
 * Simple test for the Google Maps API functionality
 */
async function testMapsApi() {
  console.log('Testing Google Maps API with environment variable...');
  
  // Test geocoding
  const geocodeResult = await geocodeAddress('1234 Main St, Tulsa, OK');
  console.log('Geocode result:', geocodeResult);
  
  // Test distance calculation
  const distanceResult = await checkDistanceToBusinessLocation('1234 Main St, Tulsa, OK');
  console.log('Distance result:', distanceResult);
  
  return { geocodeResult, distanceResult };
}

// Run the test
testMapsApi()
  .then(results => {
    console.log('Tests completed successfully');
    if (results.geocodeResult.success && results.distanceResult.success) {
      console.log('✅ Google Maps API is working correctly with environment variable!');
    } else {
      console.log('❌ There were issues with the Google Maps API test:');
      if (!results.geocodeResult.success) {
        console.log('- Geocoding failed:', results.geocodeResult.error);
      }
      if (!results.distanceResult.success) {
        console.log('- Distance calculation failed:', results.distanceResult.error);
      }
    }
  })
  .catch(error => {
    console.error('Test error:', error);
  });