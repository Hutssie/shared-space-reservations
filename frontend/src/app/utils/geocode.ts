const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export type GeocodeResult = {
  lat: number;
  lng: number;
  zoom: number;
};

export type ReverseGeocodeResult = {
  country: string;
  region: string;
  city: string;
};

/**
 * Geocode an address with Google Geocoding API.
 * Returns { lat, lng, zoom } or null if it fails / query is empty.
 * Zoom is roughly ~5 for a country, ~13 for a city.
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
    // figure out city vs country and pick a zoom level
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

function pickComponent(components: any[], type: string): string {
  const c = components?.find((x) => Array.isArray(x?.types) && x.types.includes(type));
  return typeof c?.long_name === 'string' ? c.long_name : '';
}

function pickFirstComponent(components: any[], types: string[]): string {
  for (const t of types) {
    const v = pickComponent(components, t);
    if (v) return v;
  }
  return '';
}

/**
 * Reverse-geocode (lat, lng) with Google Geocoding API.
 * Returns { city, region, country } or null if it can't figure it out.
 */
export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  if (!API_KEY) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(String(lat))},${encodeURIComponent(String(lng))}&key=${API_KEY}`
    );
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;

    const components = data.results[0]?.address_components ?? [];
    const country = pickComponent(components, 'country');
    const region = pickComponent(components, 'administrative_area_level_1');
    // prefer locality, then postal_town (UK), then admin_area as fallback
    const city = pickFirstComponent(components, ['locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_3']);

    if (!country && !region && !city) return null;
    return { country, region, city };
  } catch {
    return null;
  }
}
