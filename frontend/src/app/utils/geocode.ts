const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export type GeocodeResult = {
  lat: number;
  lng: number;
  zoom: number;
};

/**
 * Geocode cu Google Geocoding API.
 * returneaza { lat, lng, zoom } sau `null` daca failuieste sau query gol.
 * zoom: ~5 pentru tara, ~12 pentru localitate/oras.
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
    // verificare oras -> tara si zoom in
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
