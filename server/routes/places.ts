import { Router } from "express";

export const placesRouter = Router();

/**
 * /api/places/autocomplete?input=123 ma
 * Proxies Google Places API to avoid exposing client-key.
 * Multi-tenant safe (no tenant data)
 */
placesRouter.get("/autocomplete", async (req, res) => {
  try {
    const input = req.query.input?.toString() ?? "";
    if (!input.trim()) {
      return res.json({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("⚠ GOOGLE_MAPS_API_KEY not configured.");
      return res.json({ predictions: [] });
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input
    )}&types=address&components=country:us&key=${apiKey}`;

    const r = await fetch(url);
    const json = await r.json() as any;

    // Never leak Google error messages
    return res.json({
      predictions: json.predictions ?? [],
    });
  } catch (err) {
    console.error("[PLACES AUTOCOMPLETE ERROR]", err);
    return res.json({ predictions: [] });
  }
});

/**
 * For resolving a prediction → place details → lat/lng + formatted address
 */
placesRouter.get("/details", async (req, res) => {
  try {
    const placeId = req.query.placeId?.toString() ?? "";
    if (!placeId) return res.json(null);

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.json(null);

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;

    const r = await fetch(url);
    const json = await r.json() as any;

    const result = json?.result;
    if (!result) return res.json(null);

    const lat = result.geometry?.location?.lat ?? null;
    const lng = result.geometry?.location?.lng ?? null;
    const formatted = result.formatted_address ?? null;

    return res.json({
      lat,
      lng,
      formatted,
    });
  } catch (err) {
    console.error("[PLACES DETAILS ERROR]", err);
    return res.json(null);
  }
});
