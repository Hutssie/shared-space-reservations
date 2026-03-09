const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export type GeocodeResult = {
  lat: number;
  lng: number;
  zoom: number;
};

/**
 * Geocode an address string using Google Geocoding API.
 * Returns { lat, lng, zoom } or null on failure/empty query.
 * zoom: ~5 for country, ~12 for locality/city.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed || !API_KEY) return null;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${API_KEY}`
    );
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;

    const result = data.results[0];
    const location = result.geometry?.location;
    if (!location) return null;

    const lat = Number(location.lat);
    const lng = Number(location.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    const types: string[] = result.types || [];
    // Order matters: check city/locality first so "Craiova" zooms in; country last.
    const zoom =
      types.some((t: string) => t === 'locality' || t === 'administrative_area_level_2' || t === 'administrative_area_level_3') ? 13 :
      types.some((t: string) => t === 'administrative_area_level_1') ? 8 :
      types.some((t: string) => t === 'country') ? 5 :
      12;

    return { lat, lng, zoom };
  } catch {
    return null;
  }
}
