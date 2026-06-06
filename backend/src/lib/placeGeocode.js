import { fetchPhotonFeatures, parsePhotonFeature } from './photonClient.js';

const CACHE_MAX = 200;
const cache = new Map();

function normalizeKey(locationString) {
  return String(locationString).trim().toLowerCase();
}

/**
 * Resolve a location string to center, city name, and optional bbox.
 * Returns null fields when geocoding fails.
 */
export async function resolvePlace(locationString) {
  const trimmed = String(locationString || '').trim();
  if (!trimmed) return null;

  const key = normalizeKey(trimmed);
  if (cache.has(key)) return cache.get(key);

  let result = null;
  try {
    const features = await fetchPhotonFeatures(trimmed, { limit: 1 });
    const parsed = parsePhotonFeature(features[0]);
    if (parsed) {
      result = {
        lat: parsed.lat,
        lng: parsed.lng,
        cityName: parsed.cityName,
        bounds: parsed.bounds,
      };
    }
  } catch (e) {
    console.error('[placeGeocode]', e.message || e);
  }

  if (!result) {
    const firstPart = trimmed.split(',')[0]?.trim();
    result = { lat: null, lng: null, cityName: firstPart || trimmed, bounds: null };
  }

  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, result);
  return result;
}

/** @deprecated Use resolvePlace */
export async function resolvePlaceCenter(locationString) {
  return resolvePlace(locationString);
}
