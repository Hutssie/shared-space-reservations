import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { Decimal } from '@prisma/client/runtime/library';
import {
  AMENITY_ID_TO_LABELS,
  amenityFilterClause,
  amenitiesForResponse,
  normalizeAmenityIds,
  spaceListInclude,
  syncSpaceAmenities,
} from '../lib/amenities.js';
import {
  normalizeForSearch,
  locationNormFromDisplay,
  buildLocationNormExactFilter,
  buildLocationNormPrefixFilter,
} from '../lib/textNormalize.js';
import {
  parseDateFilterQuery,
  searchSpacesWithDateAvailability,
} from '../lib/spaceAvailabilitySearch.js';
import { TIME_SLOTS } from '../lib/spaceAvailabilityCompute.js';
import {
  bannedDaysForResponse,
  blockedDatesForResponse,
  isDateBlocked,
  normalizeBlockedDatesPayload,
  spaceAvailabilityInclude,
  syncSpaceBannedDays,
  syncSpaceBlockedDates,
} from '../lib/spaceAvailabilityRules.js';
import { prisma } from '../lib/prisma.js';
import { HOME_RECOMMENDATION_LIMIT } from '../lib/recommendationConfig.js';
import {
  geoContextForLocationSearch,
  mergeWhereWithGeo,
  resolveGeoContext,
  searchSpacesRanked,
} from '../lib/rankedSpaceSearch.js';
import { buildSpaceEmbeddingText, embedDocument, toSqlVector } from '../lib/embeddings.js';

const router = Router();

/**
 * Best-effort regeneration of a space's semantic embedding. Runs out of band
 * (fire-and-forget) so listing writes are not blocked or failed by embedding errors.
 */
async function refreshSpaceEmbedding(spaceId) {
  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: {
        id: true,
        title: true,
        category: true,
        location: true,
        description: true,
        amenities: { select: { amenityId: true } },
      },
    });
    if (!space) return;
    const vector = await embedDocument(buildSpaceEmbeddingText(space));
    if (!vector) return;
    await prisma.$executeRawUnsafe(
      `UPDATE "Space" SET embedding = $1::vector WHERE id = $2`,
      toSqlVector(vector),
      spaceId
    );
  } catch (err) {
    console.error(`refreshSpaceEmbedding failed for ${spaceId}:`, err?.message || err);
  }
}

/** Listing fields whose change warrants regenerating the embedding. */
const EMBEDDING_RELEVANT_FIELDS = ['title', 'category', 'location', 'description'];

export { TIME_SLOTS, computeIsSpaceAvailableOnDate, computeIsSpaceAvailableInRange } from '../lib/spaceAvailabilityCompute.js';

export { AMENITY_ID_TO_LABELS } from '../lib/amenities.js';

/** Parse map viewport bounds from query; returns null if missing or invalid. */
export function parseMapBounds({ north, south, east, west } = {}) {
  if (north == null || south == null || east == null || west == null) return null;
  const n = parseFloat(north);
  const s = parseFloat(south);
  const e = parseFloat(east);
  const w = parseFloat(west);
  if ([n, s, e, w].some((v) => Number.isNaN(v))) return null;
  if (s > n) return null;
  if (Math.abs(e - w) > 360) return null;
  return { north: n, south: s, east: e, west: w };
}

export function buildSpaceWhereClause({
  q,
  location,
  category,
  minPrice,
  maxPrice,
  minCapacity,
  minSquareMeters,
  maxSquareMeters,
  bounds,
} = {}) {
  const where = { status: 'active' };
  if (bounds) {
    where.latitude = { not: null, gte: bounds.south, lte: bounds.north };
    where.longitude = { not: null, gte: bounds.west, lte: bounds.east };
  }
  if (location) {
    Object.assign(where, buildLocationNormExactFilter(location));
  } else if (q) {
    const qNorm = normalizeForSearch(q);
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { locationNorm: { contains: qNorm } },
      { category: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (category) {
    const cats = String(category).split(',').map((c) => c.trim()).filter(Boolean);
    where.category = cats.length === 1 ? cats[0] : { in: cats };
  }
  if (minPrice != null) where.pricePerHour = { ...where.pricePerHour, gte: parseFloat(minPrice) };
  if (maxPrice != null) where.pricePerHour = { ...where.pricePerHour, lte: parseFloat(maxPrice) };
  if (minCapacity != null) where.capacity = { gte: parseInt(minCapacity, 10) };
  if (minSquareMeters != null) where.squareMeters = { ...where.squareMeters, gte: parseInt(minSquareMeters, 10) };
  if (maxSquareMeters != null) where.squareMeters = { ...where.squareMeters, lte: parseInt(maxSquareMeters, 10) };
  return where;
}

export function buildSpaceSearchWhere(params, amenityIds = []) {
  return {
    ...buildSpaceWhereClause(params),
    ...amenityFilterClause(amenityIds),
  };
}

export { parseTimeToMinutes } from '../lib/bookingTime.js';

export function spaceToResponse(space) {
  if (!space) return null;
  const host = space.host
    ? {
        id: space.host.id,
        name: space.host.name,
        avatar: space.host.avatarUrl,
        since: String(new Date(space.host.createdAt).getFullYear()),
        isSuperhost: false,
      }
    : null;
  const rating = space.reviews?.length
    ? space.reviews.reduce((s, r) => s + r.rating, 0) / space.reviews.length
    : null;
  const reviewsCount = space.reviews?.length ?? 0;
  return {
    id: space.id,
    image: space.imageUrl,
    category: space.category,
    title: space.title,
    location: space.location,
    capacity: space.capacity,
    price: Number(space.pricePerHour),
    squareMeters: space.squareMeters ?? null,
    rating: rating != null ? Math.round(rating * 100) / 100 : null,
    reviews: reviewsCount,
    isInstantBookable: space.isInstantBookable,
    description: space.description,
    amenities: amenitiesForResponse(space),
    images: space.imagesJson ? JSON.parse(space.imagesJson) : (space.imageUrl ? [space.imageUrl] : []),
    host,
    latitude: space.latitude != null ? space.latitude : null,
    longitude: space.longitude != null ? space.longitude : null,
    availabilityStartTime: space.availabilityStartTime ?? null,
    availabilityEndTime: space.availabilityEndTime ?? null,
    sameDayBookingAllowed: space.sameDayBookingAllowed ?? true,
    minDurationHours: space.minDurationHours ?? null,
    maxDurationHours: space.maxDurationHours ?? null,
    maxAdvanceBookingDays: space.maxAdvanceBookingDays ?? null,
    cancellationPolicy: space.cancellationPolicy ?? null,
    cleaningFeeCents: space.cleaningFeeCents ?? null,
    equipmentFeeCents: space.equipmentFeeCents ?? null,
    bannedDays: bannedDaysForResponse(space),
    blockedDates: blockedDatesForResponse(space),
    status: space.status ?? 'active',
  };
}

router.get('/category-counts', async (req, res, next) => {
  try {
    const groups = await prisma.space.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { status: 'active' },
    });
    const counts = {};
    for (const g of groups) counts[g.category] = g._count.id;
    res.json(counts);
  } catch (e) {
    next(e);
  }
});

router.get('/category-pricing', async (req, res, next) => {
  try {
    const groups = await prisma.space.groupBy({
      by: ['category'],
      _count: { id: true },
      _avg: { pricePerHour: true },
      _min: { pricePerHour: true },
      _max: { pricePerHour: true },
      where: { status: 'active' },
    });
    const pricing = {};
    for (const g of groups) {
      const count = g._count.id;
      const avg = g._avg.pricePerHour != null ? Number(g._avg.pricePerHour) : 0;
      const min = g._min.pricePerHour != null ? Number(g._min.pricePerHour) : 0;
      const max = g._max.pricePerHour != null ? Number(g._max.pricePerHour) : 0;
      pricing[g.category] = { avgPrice: avg, minPrice: min, maxPrice: max, count };
    }
    res.json(pricing);
  } catch (e) {
    next(e);
  }
});

router.get('/locations', async (req, res, next) => {
  try {
    const { q } = req.query;
    const baseWhere = { status: 'active' };
    const spaces = await prisma.space.findMany({
      where: q
        ? { ...baseWhere, ...buildLocationNormPrefixFilter(String(q)) }
        : baseWhere,
      select: { location: true },
      orderBy: { location: 'asc' },
    });
    const seen = new Set();
    const locations = [];
    for (const s of spaces) {
      const loc = (s.location || '').trim();
      if (loc && !seen.has(loc.toLowerCase())) {
        seen.add(loc.toLowerCase());
        locations.push(loc);
      }
    }
    res.json({ locations });
  } catch (e) {
    next(e);
  }
});

// Normalize category to the full display name for "Popular this week" (e.g. slug "photo" -> "Photo Studio").
const CATEGORY_DISPLAY_NAMES = {
  photo: 'Photo Studio',
  recording: 'Recording Studio',
  kitchen: 'Kitchen Studio',
  dance: 'Dancing Studio',
  dancing: 'Dancing Studio',
  classroom: 'Classroom',
  conference: 'Conference Room',
  it: 'IT Classroom',
  lab: 'Laboratory',
  art: 'Art Studio',
  sports: 'Sports Space',
  'photo studio': 'Photo Studio',
  'recording studio': 'Recording Studio',
  'kitchen studio': 'Kitchen Studio',
  'dancing studio': 'Dancing Studio',
  'conference room': 'Conference Room',
  'it classroom': 'IT Classroom',
  'art studio': 'Art Studio',
  'sports space': 'Sports Space',
};
function toCategoryDisplayName(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  return CATEGORY_DISPLAY_NAMES[trimmed] ?? CATEGORY_DISPLAY_NAMES[trimmed.toLowerCase()] ?? trimmed;
}

router.get('/popular-categories-week', async (req, res, next) => {
  try {
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    startDate.setUTCHours(0, 0, 0, 0);

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['confirmed', 'pending'] },
        date: { gte: startDate },
      },
      select: {
        spaceId: true,
        space: { select: { category: true } },
      },
    });

    const countByCategory = {};
    for (const b of bookings) {
      const raw = b.space?.category;
      if (raw) {
        const displayName = toCategoryDisplayName(raw);
        countByCategory[displayName] = (countByCategory[displayName] || 0) + 1;
      }
    }

    const categories = Object.entries(countByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category]) => category);

    res.json({ categories });
  } catch (e) {
    next(e);
  }
});

async function featuredThisMonthHandler(req, res, next) {
  try {
    const geoContext = await resolveGeoContext({ geoMode: 'home_boost' });
    const limit = Math.min(
      parseInt(req.query.limit, 10) || HOME_RECOMMENDATION_LIMIT,
      HOME_RECOMMENDATION_LIMIT
    );

    const { spaces, total } = await searchSpacesRanked(prisma, {
      buildWhere: () => ({ status: 'active' }),
      geoContext,
      userId: null,
      offset: 0,
      limit,
      forceColdStart: true,
    });

    res.json({ spaces: spaces.map(spaceToResponse), total });
  } catch (e) {
    next(e);
  }
}

router.get('/featured-this-month', featuredThisMonthHandler);

router.get('/featured-this-week', featuredThisMonthHandler);

router.get('/recommended', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const geoContext = await resolveGeoContext({ geoMode: 'home_boost' });
    const limit = Math.min(
      parseInt(req.query.limit, 10) || HOME_RECOMMENDATION_LIMIT,
      HOME_RECOMMENDATION_LIMIT
    );

    const { spaces, total } = await searchSpacesRanked(prisma, {
      buildWhere: () => ({ status: 'active' }),
      geoContext,
      userId: req.userId ?? null,
      offset: 0,
      limit,
      forceColdStart: false,
    });

    res.json({ spaces: spaces.map(spaceToResponse), total });
  } catch (e) {
    next(e);
  }
});

router.get('/', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const {
      q,
      location,
      category,
      date,
      minPrice,
      maxPrice,
      minCapacity,
      amenities: amenitiesParam,
      limit = 50,
      offset = 0,
      featured,
      north,
      south,
      east,
      west,
      sort,
      centerLat,
      centerLng,
      geoMode,
      placeNorth,
      placeSouth,
      placeEast,
      placeWest,
    } = req.query;
    const bounds = parseMapBounds({ north, south, east, west });
    const amenityIds = amenitiesParam
      ? String(amenitiesParam).split(',').map((a) => a.trim()).filter(Boolean)
      : [];

    const skip = bounds ? 0 : (parseInt(offset, 10) || 0);
    const defaultLimit = bounds ? 150 : 50;
    const maxLimit = bounds ? 200 : 100;
    const requestedTake = Math.min(parseInt(limit, 10) || defaultLimit, maxLimit);

    const { dateStart, dateEnd, dateCtx } = parseDateFilterQuery(date);

    if (sort === 'recommended') {
      const inferredGeoMode = geoMode || (location ? 'city' : 'nearby');
      const geoContext = await resolveGeoContext({
        location,
        centerLat,
        centerLng,
        geoMode: inferredGeoMode,
        placeNorth,
        placeSouth,
        placeEast,
        placeWest,
      });

      const searchLocation = inferredGeoMode === 'city' ? undefined : location;

      const { spaces, total } = await searchSpacesRanked(prisma, {
        buildWhere: () =>
          buildSpaceSearchWhere(
            { q, location: searchLocation, category, minPrice, maxPrice, minCapacity, bounds },
            amenityIds
          ),
        geoContext,
        userId: req.userId ?? null,
        dateStart,
        dateEnd,
        dateCtx,
        offset: skip,
        limit: requestedTake,
      });

      res.json({ spaces: spaces.map(spaceToResponse), total });
      return;
    }

    const locationGeo = await geoContextForLocationSearch({
      location,
      centerLat,
      centerLng,
      placeNorth,
      placeSouth,
      placeEast,
      placeWest,
    });
    const searchLocation = locationGeo ? undefined : location;
    let where = buildSpaceSearchWhere(
      { q, location: searchLocation, category, minPrice, maxPrice, minCapacity, bounds },
      amenityIds
    );
    if (locationGeo) {
      where = mergeWhereWithGeo(where, locationGeo);
    }

    if (dateStart && dateEnd && dateCtx) {
      const { spaces, total, availabilityScanCapped } = await searchSpacesWithDateAvailability(
        prisma,
        { where, dateStart, dateEnd, dateCtx, skip, take: requestedTake }
      );
      res.json({
        spaces: spaces.map(spaceToResponse),
        total,
        ...(availabilityScanCapped ? { availabilityScanCapped: true } : {}),
      });
      return;
    }

    const take = requestedTake;
    const [spaces, total] = await Promise.all([
      prisma.space.findMany({
        where,
        include: spaceListInclude,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.space.count({ where }),
    ]);

    res.json({ spaces: spaces.map(spaceToResponse), total });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/reviews', async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { spaceId: req.params.id },
      include: { user: { select: { name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const list = reviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.user.name,
      avatar: r.user.avatarUrl,
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt,
    }));
    const withScores = reviews.filter((r) => r.cleanliness != null || r.communication != null || r.location != null || r.value != null);
    const agg = {};
    for (const key of ['cleanliness', 'communication', 'location', 'value']) {
      const values = withScores.map((r) => r[key]).filter((v) => v != null);
      agg[key] = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null;
    }
    res.json({ reviews: list, aggregates: agg });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/reviews', authMiddleware, async (req, res, next) => {
  try {
    const { rating, text, cleanliness, communication, location, value } = req.body;
    if (rating == null || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be 1-5' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { name: true, avatarUrl: true },
    });
    const data = {
      spaceId: req.params.id,
      userId: req.userId,
      rating: parseFloat(rating),
      text: String(text || ''),
    };
    const opt = (v) => (v != null && v >= 1 && v <= 5 ? parseInt(v, 10) : undefined);
    if (opt(cleanliness) != null) data.cleanliness = opt(cleanliness);
    if (opt(communication) != null) data.communication = opt(communication);
    if (opt(location) != null) data.location = opt(location);
    if (opt(value) != null) data.value = opt(value);
    const review = await prisma.review.create({ data });
    res.status(201).json({
      id: review.id,
      userId: review.userId,
      name: user.name,
      avatar: user.avatarUrl,
      rating: review.rating,
      text: review.text,
      createdAt: review.createdAt,
    });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/reviews/:reviewId', authMiddleware, async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.reviewId } });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    const { rating, text, cleanliness, communication, location, value } = req.body;
    if (rating == null || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be 1-5' });
    }
    const opt = (v) => (v != null && v >= 1 && v <= 5 ? parseInt(v, 10) : null);
    const updated = await prisma.review.update({
      where: { id: req.params.reviewId },
      data: {
        rating: parseFloat(rating),
        text: String(text || ''),
        cleanliness: opt(cleanliness),
        communication: opt(communication),
        location: opt(location),
        value: opt(value),
      },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id/reviews/:reviewId', authMiddleware, async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.reviewId } });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    await prisma.review.delete({ where: { id: req.params.reviewId } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.post('/:id/share', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Space id is required' });

    // Build a frontend link and log it in the backend console.
    const baseUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
    const shareLink = `${baseUrl}/space/${id}`;
    console.log('[Share] Space link for', id, ':', shareLink);

    res.json({ success: true, link: shareLink });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const space = await prisma.space.findUnique({
      where: { id: req.params.id },
      include: spaceListInclude,
    });
    if (!space) return res.status(404).json({ error: 'Space not found' });
    res.json(spaceToResponse(space));
  } catch (e) {
    next(e);
  }
});

router.get('/:id/availability', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query is required (YYYY-MM-DD)' });
    const d = new Date(date);
    if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid date' });
    const startOfDay = new Date(d);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(d);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const space = await prisma.space.findUnique({
      where: { id: req.params.id },
      include: spaceAvailabilityInclude,
    });
    if (!space) return res.status(404).json({ error: 'Space not found' });

    const dateStr = d.toISOString().slice(0, 10);
    if (isDateBlocked(space, dateStr)) {
      const slots = [
        '12:00 AM', '01:00 AM', '02:00 AM', '03:00 AM', '04:00 AM', '05:00 AM', '06:00 AM', '07:00 AM',
        '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
        '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
      ];
      return res.json({ slots: [], booked: [], unavailable: slots, bookedRanges: [] });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        spaceId: req.params.id,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['confirmed', 'pending'] },
      },
    });

    const slots = [
      '12:00 AM', '01:00 AM', '02:00 AM', '03:00 AM', '04:00 AM', '05:00 AM', '06:00 AM', '07:00 AM',
      '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
      '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
      '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
    ];
    const booked = new Set();
    for (const b of bookings) {
      const startIdx = slots.indexOf(b.startTime);
      const endIdx = slots.indexOf(b.endTime);
      if (startIdx === -1 || endIdx === -1) continue;
      if (startIdx < endIdx) {
        for (let i = startIdx; i < endIdx; i++) booked.add(slots[i]);
      } else if (startIdx === 0 && endIdx === 0) {
        // 12:00 AM -> 12:00 AM => whole-day booking
        for (let i = 0; i < slots.length; i++) booked.add(slots[i]);
      } else if (endIdx === 0 && startIdx > 0) {
        for (let i = startIdx; i < slots.length; i++) booked.add(slots[i]);
      }
    }

    const unavailable = [];
    const windowStart = space.availabilityStartTime ?? null;
    const windowEnd = space.availabilityEndTime ?? null;
    if (windowStart != null && windowEnd != null) {
      const startIdx = slots.indexOf(windowStart);
      const endIdx = slots.indexOf(windowEnd);
      if (startIdx !== -1 && endIdx !== -1) {
        for (let i = 0; i < slots.length; i++) {
          const inWindow = endIdx > startIdx
            ? (i >= startIdx && i <= endIdx)
            : (endIdx === 0 && startIdx > 0 ? (i >= startIdx) : false);
          if (!inWindow) unavailable.push(slots[i]);
        }
      }
    }

    const available = slots.filter((s) => !booked.has(s) && !unavailable.includes(s));

    const bookedRanges = bookings.map((b) => ({ start: b.startTime, end: b.endTime }));

    res.json({
      slots: available,
      booked: slots.filter((s) => booked.has(s)),
      unavailable,
      bookedRanges,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const body = req.body;
    const {
      category, title, location, capacity, pricePerHour, description,
      imageUrl, imagesJson, amenitiesJson, isInstantBookable, latitude, longitude, squareMeters,
    } = body;
    if (!category || !title || !location || capacity == null || pricePerHour == null || !description) {
      return res.status(400).json({ error: 'category, title, location, capacity, pricePerHour, description required' });
    }
    const amenityIds = normalizeAmenityIds(
      typeof amenitiesJson === 'string' ? amenitiesJson : amenitiesJson || []
    );

    const space = await prisma.$transaction(async (tx) => {
      const created = await tx.space.create({
        data: {
          hostId: req.userId,
          category,
          title,
          location,
          locationNorm: locationNormFromDisplay(location),
          capacity: parseInt(capacity, 10),
          pricePerHour: new Decimal(parseFloat(pricePerHour)),
          description,
          imageUrl: imageUrl || null,
          imagesJson: typeof imagesJson === 'string' ? imagesJson : JSON.stringify(imagesJson || []),
          isInstantBookable: Boolean(isInstantBookable),
          latitude: latitude != null ? parseFloat(latitude) : null,
          longitude: longitude != null ? parseFloat(longitude) : null,
          squareMeters: squareMeters != null ? parseInt(squareMeters, 10) : null,
          maxAdvanceBookingDays: (() => {
            const v = body.maxAdvanceBookingDays;
            if (v == null) return 365;
            const n = parseInt(v, 10);
            return (Number.isNaN(n) || n < 1) ? 365 : n;
          })(),
          cancellationPolicy: body.cancellationPolicy ?? 'moderate',
          status: 'active',
          weeklyScheduleEnabled: false,
        },
      });
      await syncSpaceAmenities(tx, created.id, amenityIds);
      return tx.space.findUnique({
        where: { id: created.id },
        include: spaceListInclude,
      });
    });
    res.status(201).json(spaceToResponse(space));
    void refreshSpaceEmbedding(space.id);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const space = await prisma.space.findUnique({ where: { id: req.params.id } });
    if (!space) return res.status(404).json({ error: 'Space not found' });
    if (space.hostId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const body = req.body;
    const data = {};
    const bannedDaysPayload = body.bannedDaysJson;
    const blockedDatesPayload = body.blockedDatesJson;
    const allowed = ['category', 'title', 'location', 'capacity', 'pricePerHour', 'squareMeters', 'description', 'imageUrl', 'imagesJson', 'isInstantBookable', 'latitude', 'longitude', 'availabilityStartTime', 'availabilityEndTime', 'sameDayBookingAllowed', 'minDurationHours', 'maxDurationHours', 'maxAdvanceBookingDays', 'cancellationPolicy', 'cleaningFeeCents', 'equipmentFeeCents', 'status'];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'pricePerHour') data[key] = new Decimal(parseFloat(body[key]));
        else if (key === 'capacity') data[key] = parseInt(body[key], 10);
        else if (key === 'squareMeters') data[key] = body[key] == null ? null : parseInt(body[key], 10);
        else if (key === 'latitude' || key === 'longitude') data[key] = body[key] == null ? null : parseFloat(body[key]);
        else if (key === 'imagesJson') data[key] = typeof body[key] === 'string' ? body[key] : JSON.stringify(body[key] || []);
        else if (key === 'availabilityStartTime' || key === 'availabilityEndTime') {
          const val = body[key] == null ? null : String(body[key]).trim();
          if (val !== null && !TIME_SLOTS.includes(val)) {
            return res.status(400).json({ error: `Invalid ${key}` });
          }
          data[key] = val || null;
        } else if (key === 'sameDayBookingAllowed') {
          data[key] = Boolean(body[key]);
        } else if (key === 'minDurationHours' || key === 'maxDurationHours') {
          const v = body[key];
          if (v == null) data[key] = null;
          else {
            const n = parseInt(v, 10);
            if (Number.isNaN(n) || n < 1 || n > 24) {
              return res.status(400).json({ error: `${key} must be an integer between 1 and 24` });
            }
            data[key] = n;
          }
        } else if (key === 'maxAdvanceBookingDays') {
          const v = body[key];
          if (v == null) data[key] = null;
          else {
            const n = parseInt(v, 10);
            if (Number.isNaN(n) || n < 1) return res.status(400).json({ error: 'maxAdvanceBookingDays must be a positive integer' });
            data[key] = n;
          }
        } else if (key === 'cancellationPolicy') {
          const val = body[key] == null ? null : String(body[key]).trim();
          if (val !== null && !['flexible', 'moderate', 'strict'].includes(val)) {
            return res.status(400).json({ error: 'cancellationPolicy must be flexible, moderate, or strict' });
          }
          data[key] = val || null;
        } else if (key === 'status') {
          const val = body[key] == null ? null : String(body[key]).trim();
          if (val !== null && !['active', 'maintenance', 'inactive'].includes(val)) {
            return res.status(400).json({ error: 'status must be active, maintenance, or inactive' });
          }
          data[key] = val ?? 'active';
        } else if (key === 'location') {
          data.location = body[key];
          data.locationNorm = locationNormFromDisplay(body[key]);
        } else if (key === 'cleaningFeeCents' || key === 'equipmentFeeCents') {
          const v = body[key];
          if (v == null) data[key] = null;
          else {
            const n = parseInt(v, 10);
            if (Number.isNaN(n) || n < 0) return res.status(400).json({ error: `${key} must be a non-negative integer` });
            data[key] = n;
          }
        } else data[key] = body[key];
      }
    }
    if (data.minDurationHours != null && data.maxDurationHours != null) {
      const min = data.minDurationHours;
      const max = data.maxDurationHours;
      if (min > max) return res.status(400).json({ error: 'minDurationHours must be less than or equal to maxDurationHours' });
    }
    const finalMin = data.minDurationHours !== undefined ? data.minDurationHours : space.minDurationHours;
    const finalMax = data.maxDurationHours !== undefined ? data.maxDurationHours : space.maxDurationHours;
    if (finalMin != null && finalMax != null && finalMin > finalMax) {
      return res.status(400).json({ error: 'minDurationHours must be less than or equal to maxDurationHours' });
    }
    const startVal = data.availabilityStartTime !== undefined ? data.availabilityStartTime : space.availabilityStartTime;
    const endVal = data.availabilityEndTime !== undefined ? data.availabilityEndTime : space.availabilityEndTime;
    if (startVal != null && endVal != null) {
      const startIdx = TIME_SLOTS.indexOf(startVal);
      const endIdx = TIME_SLOTS.indexOf(endVal);
      const valid = endIdx > startIdx || (endIdx === 0 && startIdx > 0);
      if (!valid) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }
    }

    if (blockedDatesPayload !== undefined) {
      const normalized = normalizeBlockedDatesPayload(blockedDatesPayload);
      if (!normalized.ok) {
        return res.status(normalized.status ?? 400).json({ error: normalized.error });
      }
    }

    const amenitiesPayload = body.amenitiesJson;
    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.space.update({
          where: { id: req.params.id },
          data,
        });
      }
      if (amenitiesPayload !== undefined) {
        await syncSpaceAmenities(tx, req.params.id, amenitiesPayload);
      }
      if (bannedDaysPayload !== undefined) {
        await syncSpaceBannedDays(tx, req.params.id, bannedDaysPayload);
      }
      if (blockedDatesPayload !== undefined) {
        await syncSpaceBlockedDates(tx, req.params.id, blockedDatesPayload);
      }
      return tx.space.findUnique({
        where: { id: req.params.id },
        include: spaceListInclude,
      });
    });
    res.json(spaceToResponse(updated));
    const embeddingRelevantChanged =
      EMBEDDING_RELEVANT_FIELDS.some((key) => key in data) || amenitiesPayload !== undefined;
    if (embeddingRelevantChanged) {
      void refreshSpaceEmbedding(req.params.id);
    }
  } catch (e) {
    if (e.status === 400) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const space = await prisma.space.findUnique({ where: { id: req.params.id } });
    if (!space) return res.status(404).json({ error: 'Space not found' });
    if (space.hostId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const activeBookingsCount = await prisma.booking.count({
      where: {
        spaceId: req.params.id,
        status: { in: ['confirmed', 'pending'] },
      },
    });
    if (activeBookingsCount > 0) {
      return res.status(409).json({
        error: 'This listing has active bookings that must be honored. Make the listing inactive until every booking is completed, then you can delete it.',
        activeBookingsCount,
      });
    }

    await prisma.space.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export const spacesRouter = router;
