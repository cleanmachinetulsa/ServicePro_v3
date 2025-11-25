/**
 * Geocoding Service
 * Uses Google Geocoding API to convert addresses to lat/lng coordinates
 */

export async function geocodeAddress(address: string): Promise<{
  lat: number | null;
  lng: number | null;
  formatted: string | null;
}> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('[GEOCODE] Google Maps API key not configured');
      return { lat: null, lng: null, formatted: null };
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${apiKey}`;

    const res = await fetch(url);
    const json = await res.json();

    const result = json?.results?.[0];
    if (!result) {
      console.warn('[GEOCODE] No results returned for address:', address);
      return { lat: null, lng: null, formatted: null };
    }

    const { lat, lng } = result.geometry.location;
    const formatted = result.formatted_address;

    return { lat, lng, formatted };
  } catch (err) {
    console.error('[GEOCODE ERROR]', err);
    return { lat: null, lng: null, formatted: null };
  }
}
