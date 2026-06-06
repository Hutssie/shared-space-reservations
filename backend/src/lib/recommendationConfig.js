export const DEFAULT_CITY_NAME = process.env.DEFAULT_CITY_NAME || 'Craiova';
export const DEFAULT_CITY_LAT = parseFloat(process.env.DEFAULT_CITY_LAT || '44.3191');
export const DEFAULT_CITY_LNG = parseFloat(process.env.DEFAULT_CITY_LNG || '23.7936');
export const NEARBY_RADIUS_KM = parseFloat(process.env.NEARBY_RADIUS_KM || '100');
/** Fallback when geocoder bbox is unavailable for city search. */
export const CITY_FILTER_RADIUS_KM = parseFloat(process.env.CITY_FILTER_RADIUS_KM || '25');
export const CITY_BBOX_BUFFER_PCT = parseFloat(process.env.CITY_BBOX_BUFFER_PCT || '0.10');
export const HOME_RECOMMENDATION_LIMIT = parseInt(process.env.HOME_RECOMMENDATION_LIMIT || '15', 10);

export const HYBRID_WEIGHTS = {
  pop30d: 0.25,
  content: 0.30,
  collab: 0.25,
  location: 0.20,
};

export const COLD_START_WEIGHTS = {
  pop30d: 0.55,
  location: 0.45,
};

export function defaultRankingCenter() {
  return { lat: DEFAULT_CITY_LAT, lng: DEFAULT_CITY_LNG };
}
