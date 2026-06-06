import { CITY_BBOX_BUFFER_PCT } from './recommendationConfig.js';

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function locationScore(distanceKm, maxRadiusKm) {
  if (maxRadiusKm <= 0) return 0;
  return Math.max(0, 1 - distanceKm / maxRadiusKm);
}

/** Expand bounding box by bufferPct of each span (default 10%). */
export function expandBounds(bounds, bufferPct = CITY_BBOX_BUFFER_PCT) {
  if (!bounds) return null;
  const latSpan = bounds.north - bounds.south;
  const lngSpan = bounds.east - bounds.west;
  const latPad = latSpan * bufferPct;
  const lngPad = lngSpan * bufferPct;
  return {
    north: bounds.north + latPad,
    south: bounds.south - latPad,
    east: bounds.east + lngPad,
    west: bounds.west - lngPad,
  };
}

export function isPointInBounds(lat, lng, bounds) {
  if (bounds == null || lat == null || lng == null) return false;
  if (lat < bounds.south || lat > bounds.north) return false;
  if (bounds.west <= bounds.east) {
    return lng >= bounds.west && lng <= bounds.east;
  }
  return lng >= bounds.west || lng <= bounds.east;
}

/** Max distance in km from center to any corner of the bounds. */
export function maxDistanceToBoundsCornersKm(centerLat, centerLng, bounds) {
  if (!bounds || centerLat == null || centerLng == null) return 0;
  const corners = [
    [bounds.north, bounds.west],
    [bounds.north, bounds.east],
    [bounds.south, bounds.west],
    [bounds.south, bounds.east],
  ];
  let max = 0;
  for (const [lat, lng] of corners) {
    const d = haversineKm(centerLat, centerLng, lat, lng);
    if (d > max) max = d;
  }
  return max;
}

/** Approximate lat/lng delta for a given radius in km. */
function bboxDelta(radiusKm, centerLat = 45) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));
  return { latDelta, lngDelta };
}

function boundsSqlClause(bounds) {
  return {
    AND: [
      { latitude: { not: null } },
      { longitude: { not: null } },
      { latitude: { gte: bounds.south, lte: bounds.north } },
      { longitude: { gte: bounds.west, lte: bounds.east } },
    ],
  };
}

/**
 * Bounding-box or radius prefilter for spaces with coordinates.
 * Returns null for home_boost (no hard geo filter).
 */
export function buildGeoCandidateFilter({
  mode,
  centerLat,
  centerLng,
  radiusKm,
  cityName,
  placeBounds = null,
}) {
  if (mode === 'home_boost') return null;

  const clauses = [];

  if (placeBounds && mode === 'city') {
    clauses.push(boundsSqlClause(placeBounds));
  } else if (centerLat != null && centerLng != null && radiusKm > 0) {
    const { latDelta, lngDelta } = bboxDelta(radiusKm, centerLat);
    clauses.push({
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
        { latitude: { gte: centerLat - latDelta, lte: centerLat + latDelta } },
        { longitude: { gte: centerLng - lngDelta, lte: centerLng + lngDelta } },
      ],
    });
  }

  const name = cityName?.trim();
  if (name) {
    clauses.push({
      OR: [{ latitude: null }, { longitude: null }],
      location: { contains: name, mode: 'insensitive' },
    });
  }

  if (clauses.length === 0) return null;
  return { OR: clauses };
}

/**
 * Refine candidate rows after SQL prefilter.
 */
export function filterSpacesByGeo(
  spaces,
  { centerLat, centerLng, radiusKm, cityName, mode, placeBounds = null }
) {
  if (mode === 'home_boost') return spaces;

  const nameLower = cityName?.trim().toLowerCase() ?? '';

  return spaces.filter((space) => {
    if (placeBounds && mode === 'city' && space.latitude != null && space.longitude != null) {
      if (isPointInBounds(space.latitude, space.longitude, placeBounds)) return true;
    } else if (
      space.latitude != null &&
      space.longitude != null &&
      centerLat != null &&
      centerLng != null &&
      radiusKm > 0
    ) {
      const dist = haversineKm(centerLat, centerLng, space.latitude, space.longitude);
      if (dist <= radiusKm) return true;
    }
    if (nameLower && space.location) {
      return space.location.toLowerCase().includes(nameLower);
    }
    return false;
  });
}

export function computeLocationScoresForSpaces(
  spaces,
  { centerLat, centerLng, maxRadiusKm, cityName, placeBounds = null }
) {
  const scores = new Map();
  const nameLower = cityName?.trim().toLowerCase() ?? '';

  let effectiveMaxRadius = maxRadiusKm;
  if (placeBounds && centerLat != null && centerLng != null) {
    const cornerMax = maxDistanceToBoundsCornersKm(centerLat, centerLng, placeBounds);
    if (cornerMax > 0) effectiveMaxRadius = cornerMax;
  }

  for (const space of spaces) {
    if (space.latitude != null && space.longitude != null && centerLat != null && centerLng != null) {
      const dist = haversineKm(centerLat, centerLng, space.latitude, space.longitude);
      scores.set(space.id, locationScore(dist, effectiveMaxRadius));
    } else if (nameLower && space.location?.toLowerCase().includes(nameLower)) {
      scores.set(space.id, 0.5);
    } else {
      scores.set(space.id, 0);
    }
  }
  return scores;
}
