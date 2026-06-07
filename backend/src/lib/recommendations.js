import {
  COLD_START_WEIGHTS,
  HYBRID_WEIGHTS,
} from './recommendationConfig.js';
import { computeLocationScoresForSpaces } from './geoSearch.js';

export function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function minMaxNormalize(values) {
  const entries = [...values.entries()];
  if (entries.length === 0) return new Map();
  let min = Infinity;
  let max = -Infinity;
  for (const [, v] of entries) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  const out = new Map();
  for (const [id, v] of entries) {
    out.set(id, range === 0 ? (v > 0 ? 1 : 0) : (v - min) / range);
  }
  return out;
}

export function stableSortByScore(spaceIds, scores) {
  return [...spaceIds].sort((a, b) => {
    const diff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
}

function pop30dStartDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 29);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function loadPop30dRawCounts(prisma, spaceIds) {
  if (spaceIds.length === 0) return new Map();

  const startDate = pop30dStartDate();
  const bookings = await prisma.booking.groupBy({
    by: ['spaceId'],
    where: {
      spaceId: { in: spaceIds },
      status: 'confirmed',
      date: { gte: startDate },
    },
    _count: { spaceId: true },
  });

  const counts = new Map(spaceIds.map((id) => [id, 0]));
  for (const row of bookings) {
    counts.set(row.spaceId, row._count.spaceId);
  }
  return counts;
}

async function loadPop30dCounts(prisma, spaceIds) {
  return minMaxNormalize(await loadPop30dRawCounts(prisma, spaceIds));
}

async function loadUserProfileFromSpaceIds(prisma, spaceIds) {
  const uniqueIds = [...new Set(spaceIds)];
  if (uniqueIds.length === 0) {
    return { spaceIds: [], categories: new Map(), amenityIds: new Set(), hasHistory: false };
  }

  const spaces = await prisma.space.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      category: true,
      amenities: { select: { amenityId: true } },
    },
  });

  const categories = new Map();
  const amenityIds = new Set();
  for (const space of spaces) {
    categories.set(space.category, (categories.get(space.category) || 0) + 1);
    for (const a of space.amenities) amenityIds.add(a.amenityId);
  }

  return { spaceIds: uniqueIds, categories, amenityIds, hasHistory: true };
}

async function loadUserProfile(prisma, userId) {
  const [bookings, favorites] = await Promise.all([
    prisma.booking.findMany({
      where: { userId, status: 'confirmed' },
      select: { spaceId: true },
    }),
    prisma.favorite.findMany({
      where: { userId },
      select: { spaceId: true },
    }),
  ]);

  const spaceIds = [...new Set([
    ...bookings.map((b) => b.spaceId),
    ...favorites.map((f) => f.spaceId),
  ])];

  if (spaceIds.length === 0) {
    return { spaceIds: [], categories: new Map(), amenityIds: new Set(), hasHistory: false };
  }

  const spaces = await prisma.space.findMany({
    where: { id: { in: spaceIds } },
    select: {
      id: true,
      category: true,
      amenities: { select: { amenityId: true } },
    },
  });

  const categories = new Map();
  const amenityIds = new Set();
  for (const space of spaces) {
    categories.set(space.category, (categories.get(space.category) || 0) + 1);
    for (const a of space.amenities) amenityIds.add(a.amenityId);
  }

  return { spaceIds, categories, amenityIds, hasHistory: true };
}

async function loadContentScores(prisma, spaceIds, userProfile) {
  const scores = new Map(spaceIds.map((id) => [id, 0]));
  if (!userProfile.hasHistory) return scores;

  const spaces = await prisma.space.findMany({
    where: { id: { in: spaceIds } },
    select: {
      id: true,
      category: true,
      amenities: { select: { amenityId: true } },
    },
  });

  const totalCat = [...userProfile.categories.values()].reduce((a, b) => a + b, 0) || 1;

  for (const space of spaces) {
    const catWeight = (userProfile.categories.get(space.category) || 0) / totalCat;
    const spaceAmenities = new Set(space.amenities.map((a) => a.amenityId));
    const amenitySim = jaccardSimilarity(userProfile.amenityIds, spaceAmenities);
    scores.set(space.id, 0.5 * catWeight + 0.5 * amenitySim);
  }
  return scores;
}

async function loadCollabScores(prisma, spaceIds, userId, userProfile) {
  const scores = new Map(spaceIds.map((id) => [id, 0]));
  if (!userProfile.hasHistory || !userId) return scores;

  const userSpaceIds = userProfile.spaceIds;
  if (userSpaceIds.length === 0) return scores;

  const coBookings = await prisma.booking.findMany({
    where: {
      spaceId: { in: userSpaceIds },
      status: 'confirmed',
      userId: { not: userId },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  const similarUserIds = coBookings.map((b) => b.userId);
  if (similarUserIds.length === 0) return scores;

  const theirBookings = await prisma.booking.groupBy({
    by: ['spaceId'],
    where: {
      userId: { in: similarUserIds },
      status: 'confirmed',
      spaceId: { in: spaceIds },
    },
    _count: { spaceId: true },
  });

  const raw = new Map(spaceIds.map((id) => [id, 0]));
  for (const row of theirBookings) {
    raw.set(row.spaceId, row._count.spaceId);
  }
  return minMaxNormalize(raw);
}

function combineScores({ spaceIds, popScores, contentScores, collabScores, locationScores, coldStart }) {
  const weights = coldStart ? COLD_START_WEIGHTS : HYBRID_WEIGHTS;
  const finalScores = new Map();

  for (const id of spaceIds) {
    const pop = popScores.get(id) ?? 0;
    const loc = locationScores.get(id) ?? 0;

    if (coldStart) {
      finalScores.set(id, weights.pop30d * pop + weights.location * loc);
    } else {
      const content = contentScores.get(id) ?? 0;
      const collab = collabScores.get(id) ?? 0;
      finalScores.set(
        id,
        weights.pop30d * pop +
          weights.content * content +
          weights.collab * collab +
          weights.location * loc
      );
    }
  }
  return finalScores;
}

/**
 * Score a set of space ids. Returns Map<spaceId, finalScore>.
 */
export async function scoreSpaces(
  prisma,
  {
    spaceIds,
    spaceRows = null,
    userId = null,
    rankingCenter,
    maxRadiusKm,
    cityName = null,
    placeBounds = null,
    coldStart: forceColdStart = false,
    trainingSpaceIds = null,
  }
) {
  if (spaceIds.length === 0) return new Map();

  const rows =
    spaceRows ??
    (await prisma.space.findMany({
      where: { id: { in: spaceIds } },
      select: { id: true, latitude: true, longitude: true, location: true },
    }));

  const profilePromise =
    trainingSpaceIds != null
      ? loadUserProfileFromSpaceIds(prisma, trainingSpaceIds)
      : userId && !forceColdStart
        ? loadUserProfile(prisma, userId)
        : Promise.resolve({ hasHistory: false, spaceIds: [], categories: new Map(), amenityIds: new Set() });

  const [popScores, userProfile] = await Promise.all([
    loadPop30dCounts(prisma, spaceIds),
    profilePromise,
  ]);

  const coldStart = forceColdStart || !userId || !userProfile.hasHistory;

  const [contentScores, collabScores] = coldStart
    ? [new Map(), new Map()]
    : await Promise.all([
        loadContentScores(prisma, spaceIds, userProfile),
        loadCollabScores(prisma, spaceIds, userId, userProfile),
      ]);

  const locationScores = computeLocationScoresForSpaces(rows, {
    centerLat: rankingCenter.lat,
    centerLng: rankingCenter.lng,
    maxRadiusKm,
    cityName,
    placeBounds,
  });

  return combineScores({
    spaceIds,
    popScores,
    contentScores,
    collabScores,
    locationScores,
    coldStart,
  });
}

export async function rankSpaceIds(prisma, options) {
  const { spaceIds, spaceRows, ...scoreOpts } = options;
  const scores = await scoreSpaces(prisma, { spaceIds, spaceRows, ...scoreOpts });
  return stableSortByScore(spaceIds, scores);
}
