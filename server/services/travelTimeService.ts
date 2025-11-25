/**
 * Travel Time Service
 * Uses Google Distance Matrix API to calculate travel time between two locations
 */

export async function getTravelTimeMinutes(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<number | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('[TRAVEL TIME] Google Maps API key not configured');
      return null;
    }

    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${lat1},${lng1}` +
      `&destinations=${lat2},${lng2}` +
      `&key=${apiKey}`;

    const res = await fetch(url);
    const json = await res.json();

    const duration = json.rows?.[0]?.elements?.[0]?.duration?.value;
    if (!duration) {
      console.warn('[TRAVEL TIME] No duration data returned from Google Maps API');
      return null;
    }

    return Math.round(duration / 60); // convert seconds → minutes
  } catch (err) {
    console.error('[TRAVEL TIME ERROR]', err);
    return null;
  }
}
