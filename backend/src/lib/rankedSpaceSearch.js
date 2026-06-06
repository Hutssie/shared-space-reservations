import { spaceListInclude } from './amenities.js';
import {
  buildGeoCandidateFilter,
  expandBounds,
  filterSpacesByGeo,
  maxDistanceToBoundsCornersKm,
} from './geoSearch.js';
import { resolvePlace } from './placeGeocode.js';
import { rankSpaceIds } from './recommendations.js';
import {
  CITY_FILTER_RADIUS_KM,
  DEFAULT_CITY_LAT,
  DEFAULT_CITY_LNG,
  DEFAULT_CITY_NAME,
  NEARBY_RADIUS_KM,
  defaultRankingCenter,
} from './recommendationConfig.js';
import { collectAllAvailableSpaceIds } from './spaceAvailabilitySearch.js';

export function parsePlaceBounds({ placeNorth, placeSouth, placeEast, placeWest } = {}) {
  if (placeNorth == null || placeSouth == null || placeEast == null || placeWest == null) {
    return null;
  }
  const north = parseFloat(placeNorth);
  const south = parseFloat(placeSouth);
  const east = parseFloat(placeEast);
  const west = parseFloat(placeWest);
  if ([north, south, east, west].some((v) => Number.isNaN(v))) return null;
  if (south > north) return null;
  if (Math.abs(east - west) > 360) return null;
  return { north, south, east, west };
}

export async function resolveGeoContext({
  location,
  centerLat,
  centerLng,
  geoMode,
  placeNorth,
  placeSouth,
  placeEast,
  placeWest,
}) {
  const mode = geoMode || (location ? 'city' : 'nearby');

  if (mode === 'home_boost') {
    const center = defaultRankingCenter();
    return {
      mode,
      centerLat: center.lat,
      centerLng: center.lng,
      radiusKm: NEARBY_RADIUS_KM,
      cityName: DEFAULT_CITY_NAME,
      placeBounds: null,
      hardFilter: false,
      rankingMaxRadiusKm: NEARBY_RADIUS_KM,
    };
  }

  if (mode === 'nearby') {
    return {
      mode,
      centerLat: DEFAULT_CITY_LAT,
      centerLng: DEFAULT_CITY_LNG,
      radiusKm: NEARBY_RADIUS_KM,
      cityName: DEFAULT_CITY_NAME,
      placeBounds: null,
      hardFilter: true,
      rankingMaxRadiusKm: NEARBY_RADIUS_KM,
    };
  }

  let lat = centerLat != null && centerLat !== '' ? parseFloat(centerLat) : null;
  let lng = centerLng != null && centerLng !== '' ? parseFloat(centerLng) : null;
  let cityName = null;
  let rawBounds = parsePlaceBounds({ placeNorth, placeSouth, placeEast, placeWest });

  if (location) {
    if (!rawBounds || lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      const resolved = await resolvePlace(location);
      if (resolved) {
        if ((lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) &&
            resolved.lat != null && resolved.lng != null) {
          lat = resolved.lat;
          lng = resolved.lng;
        }
        if (!rawBounds && resolved.bounds) {
          rawBounds = resolved.bounds;
        }
        cityName = resolved.cityName;
      }
    }
    if (!cityName) {
      cityName = location.split(',')[0]?.trim() || location;
    }
  }

  const placeBounds = rawBounds ? expandBounds(rawBounds) : null;
  const useBbox = placeBounds != null;
  const radiusKm = useBbox ? null : CITY_FILTER_RADIUS_KM;
  let rankingMaxRadiusKm = CITY_FILTER_RADIUS_KM;
  if (useBbox && lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    const cornerMax = maxDistanceToBoundsCornersKm(lat, lng, placeBounds);
    if (cornerMax > 0) rankingMaxRadiusKm = cornerMax;
  }

  return {
    mode: 'city',
    centerLat: lat,
    centerLng: lng,
    radiusKm,
    cityName,
    placeBounds,
    hardFilter: true,
    rankingMaxRadiusKm,
  };
}

export function mergeWhereWithGeo(baseWhere, geoContext) {
  if (!geoContext?.hardFilter) return baseWhere;
  const geoClause = buildGeoCandidateFilter({
    mode: geoContext.mode,
    centerLat: geoContext.centerLat,
    centerLng: geoContext.centerLng,
    radiusKm: geoContext.radiusKm ?? CITY_FILTER_RADIUS_KM,
    cityName: geoContext.cityName,
    placeBounds: geoContext.placeBounds,
  });
  if (!geoClause) return baseWhere;
  return { AND: [baseWhere, geoClause] };
}

/** Apply city geo hard filter when location is set (map view, non-ranked search). */
export async function geoContextForLocationSearch({
  location,
  centerLat,
  centerLng,
  placeNorth,
  placeSouth,
  placeEast,
  placeWest,
}) {
  if (!location) return null;
  return resolveGeoContext({
    location,
    centerLat,
    centerLng,
    geoMode: 'city',
    placeNorth,
    placeSouth,
    placeEast,
    placeWest,
  });
}

async function collectCandidateRows(prisma, where, { dateStart, dateEnd, dateCtx, timeRange }) {
  if (dateStart && dateEnd && dateCtx) {
    const { ids, scanCapped } = await collectAllAvailableSpaceIds(prisma, {
      where,
      dateStart,
      dateEnd,
      dateCtx,
      timeRange,
    });
    if (scanCapped) {
      console.error('[rankedSpaceSearch] availability scan capped — ranked results may be incomplete');
    }
    if (ids.length === 0) return [];
    return prisma.space.findMany({
      where: { id: { in: ids } },
      select: { id: true, latitude: true, longitude: true, location: true },
    });
  }

  return prisma.space.findMany({
    where,
    select: { id: true, latitude: true, longitude: true, location: true },
  });
}

/**
 * Full-set ranked search: filter → score all → stable sort → paginate → hydrate.
 */
export async function searchSpacesRanked(
  prisma,
  {
    buildWhere,
    geoContext,
    userId = null,
    dateStart = null,
    dateEnd = null,
    dateCtx = null,
    timeRange = null,
    offset = 0,
    limit = 50,
    forceColdStart = false,
  }
) {
  const baseWhere = buildWhere();
  const where = mergeWhereWithGeo(baseWhere, geoContext);

  let rows = await collectCandidateRows(prisma, where, { dateStart, dateEnd, dateCtx, timeRange });

  if (geoContext.hardFilter) {
    rows = filterSpacesByGeo(rows, {
      centerLat: geoContext.centerLat,
      centerLng: geoContext.centerLng,
      radiusKm: geoContext.radiusKm ?? CITY_FILTER_RADIUS_KM,
      cityName: geoContext.cityName,
      mode: geoContext.mode,
      placeBounds: geoContext.placeBounds,
    });
  }

  const spaceIds = rows.map((r) => r.id);
  if (spaceIds.length === 0) {
    return { spaces: [], total: 0 };
  }

  const sortedIds = await rankSpaceIds(prisma, {
    spaceIds,
    spaceRows: rows,
    userId,
    rankingCenter: { lat: geoContext.centerLat, lng: geoContext.centerLng },
    maxRadiusKm: geoContext.rankingMaxRadiusKm,
    cityName: geoContext.cityName,
    placeBounds: geoContext.placeBounds,
    coldStart: forceColdStart,
  });

  const total = sortedIds.length;
  const pageIds = sortedIds.slice(offset, offset + limit);

  if (pageIds.length === 0) {
    return { spaces: [], total };
  }

  const hydrated = await prisma.space.findMany({
    where: { id: { in: pageIds } },
    include: spaceListInclude,
  });
  const byId = new Map(hydrated.map((s) => [s.id, s]));
  const spaces = pageIds.map((id) => byId.get(id)).filter(Boolean);

  return { spaces, total };
}
