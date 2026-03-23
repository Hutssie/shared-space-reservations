import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();
const prisma = new PrismaClient();

export const TIME_SLOTS = [
  '12:00 AM', '01:00 AM', '02:00 AM', '03:00 AM', '04:00 AM', '05:00 AM', '06:00 AM', '07:00 AM',
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
  '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
];

// mapez id-urile de amenity din frontend la label-urile posibile (ca seed/DB sa poata folosi label-uri si sa se potriveasca).
export const AMENITY_ID_TO_LABELS = {
  wifi: ['High-speed WiFi'],
  light: ['Natural Light'],
  coffee: ['Free Coffee'],
  parking: ['On-site Parking'],
  ac: ['Air Conditioning', 'AC & Heating'],
  access: ['24/7 Access'],
  sound: ['Soundproofed', 'Sound Isolation'],
  cyc: ['Cyclorama Wall'],
  green: ['Green Screen'],
  audio: ['Pro Sound System', 'Professional Sound System'],
  mics: ['Recording Gear', 'Pro Tools HD'],
  kitchen: ['Full Kitchen'],
  chef: ['Chef-grade Oven', 'Commercial Range', 'Double Ovens'],
  projector: ['Digital Projector'],
  conferencing: ['Video Conferencing'],
  monitors: ['Dual Monitors', 'Board Table'],
  easels: ['Art Easels', 'Track Lighting', 'White Walls'],
  mirrors: ['Full-length Mirrors', 'Full Mirrors'],
  gym: ['Gym Equipment'],
  showers: ['Locker Rooms'],
  lab: ['Lab Equipment'],
};

export function buildSpaceWhereClause({ q, location, category, minPrice, maxPrice, minCapacity, minSquareMeters, maxSquareMeters } = {}) {
  const where = { status: 'active' };
  if (location) {
    where.location = { contains: String(location), mode: 'insensitive' };
  } else if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
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

export function parseTimeToMinutes(t) {
  const match = String(t).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

export function computeIsSpaceAvailableOnDate(space, bookingsForSpace, { dateStr, dayName }) {
  if (!dateStr) return true;

  if (dayName && space.bannedDaysJson) {
    try {
      const banned = JSON.parse(space.bannedDaysJson);
      if (Array.isArray(banned) && banned.includes(dayName)) return false;
    } catch {}
  }

  if (space.blockedDatesJson) {
    try {
      const blocked = JSON.parse(space.blockedDatesJson);
      if (Array.isArray(blocked)) {
        for (const block of blocked) {
          const start = block?.startDate;
          const end = block?.endDate || block?.startDate;
          if (start && end && dateStr >= start && dateStr <= end) return false;
        }
      }
    } catch {}
  }

  const windowStart = space.availabilityStartTime ?? null;
  const windowEnd = space.availabilityEndTime ?? null;
  const wStartM = windowStart ? parseTimeToMinutes(windowStart) : null;
  let wEndM = windowEnd ? parseTimeToMinutes(windowEnd) : null;
  if (wEndM === 0) wEndM = 24 * 60;

  const unavailableSet = new Set();
  if (wStartM != null && wEndM != null) {
    for (const s of TIME_SLOTS) {
      const m = parseTimeToMinutes(s);
      if (m == null) continue;
      if (!(m >= wStartM && m <= wEndM)) unavailableSet.add(s);
    }
  }

  const bookedSet = new Set();
  for (const b of bookingsForSpace) {
    const sIdx = TIME_SLOTS.indexOf(b.startTime);
    const eIdx = TIME_SLOTS.indexOf(b.endTime);
    if (sIdx === -1 || eIdx === -1) continue;
    if (sIdx < eIdx) {
      for (let i = sIdx; i < eIdx; i++) bookedSet.add(TIME_SLOTS[i]);
    } else if (sIdx === 0 && eIdx === 0) {
      for (const slot of TIME_SLOTS) bookedSet.add(slot);
    } else if (eIdx === 0 && sIdx > 0) {
      for (let i = sIdx; i < TIME_SLOTS.length; i++) bookedSet.add(TIME_SLOTS[i]);
    }
  }

  return TIME_SLOTS.some((s) => !bookedSet.has(s) && !unavailableSet.has(s));
}

export function computeIsSpaceAvailableInRange(space, bookingsForSpace, { dateStr, dayName, startTime, endTime }) {
  if (!dateStr || !startTime || !endTime) return true;

  if (dayName && space.bannedDaysJson) {
    try {
      const banned = JSON.parse(space.bannedDaysJson);
      if (Array.isArray(banned) && banned.includes(dayName)) return false;
    } catch {}
  }

  if (space.blockedDatesJson) {
    try {
      const blocked = JSON.parse(space.blockedDatesJson);
      if (Array.isArray(blocked)) {
        for (const block of blocked) {
          const s = block?.startDate;
          const e = block?.endDate || block?.startDate;
          if (s && e && dateStr >= s && dateStr <= e) return false;
        }
      }
    } catch {}
  }

  const reqStartIdx = TIME_SLOTS.indexOf(startTime);
  const reqEndIdx = TIME_SLOTS.indexOf(endTime);
  if (reqStartIdx === -1 || reqEndIdx === -1 || reqStartIdx >= reqEndIdx) return false;

  const requestedSlots = TIME_SLOTS.slice(reqStartIdx, reqEndIdx);

  const windowStart = space.availabilityStartTime ?? null;
  const windowEnd = space.availabilityEndTime ?? null;
  const wStartM = windowStart ? parseTimeToMinutes(windowStart) : null;
  let wEndM = windowEnd ? parseTimeToMinutes(windowEnd) : null;
  if (wEndM === 0) wEndM = 24 * 60;

  if (wStartM != null && wEndM != null) {
    for (const slot of requestedSlots) {
      const m = parseTimeToMinutes(slot);
      if (m == null || m < wStartM || m > wEndM) return false;
    }
  }

  const bookedSet = new Set();
  for (const b of bookingsForSpace) {
    const sIdx = TIME_SLOTS.indexOf(b.startTime);
    const eIdx = TIME_SLOTS.indexOf(b.endTime);
    if (sIdx === -1 || eIdx === -1) continue;
    if (sIdx < eIdx) {
      for (let i = sIdx; i < eIdx; i++) bookedSet.add(TIME_SLOTS[i]);
    } else if (sIdx === 0 && eIdx === 0) {
      for (const slot of TIME_SLOTS) bookedSet.add(slot);
    } else if (eIdx === 0 && sIdx > 0) {
      for (let i = sIdx; i < TIME_SLOTS.length; i++) bookedSet.add(TIME_SLOTS[i]);
    }
  }

  return requestedSlots.every((slot) => !bookedSet.has(slot));
}

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
    amenities: space.amenitiesJson ? JSON.parse(space.amenitiesJson) : [],
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
    bannedDays: (() => {
      if (!space.bannedDaysJson) return null;
      try {
        const arr = JSON.parse(space.bannedDaysJson);
        return Array.isArray(arr) ? arr : null;
      } catch {
        return null;
      }
    })(),
    blockedDates: (() => {
      if (!space.blockedDatesJson) return null;
      try {
        const arr = JSON.parse(space.blockedDatesJson);
        return Array.isArray(arr) && arr.length > 0 ? arr : null;
      } catch {
        return null;
      }
    })(),
    status: space.status ?? 'active',
  };
}

function isDateInBlockedRanges(dateStr, blockedDates) {
  if (!blockedDates || !Array.isArray(blockedDates) || blockedDates.length === 0) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const target = `${yyyy}-${mm}-${dd}`;
  for (const block of blockedDates) {
    const start = block.startDate;
    const end = block.endDate || block.startDate;
    if (target >= start && target <= end) return true;
  }
  return false;
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
      where: q ? { ...baseWhere, location: { contains: String(q), mode: 'insensitive' } } : baseWhere,
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

// normalizez categoria la numele complet afisat pentru "Popular this week" (gen slug "photo" -> "Photo Studio").
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

router.get('/featured-this-week', async (req, res, next) => {
  try {
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    startDate.setUTCHours(0, 0, 0, 0);

    const bookings = await prisma.booking.findMany({
      where: { status: 'confirmed', date: { gte: startDate } },
      select: { spaceId: true },
    });

    const countBySpaceId = {};
    for (const b of bookings) {
      const sid = b.spaceId;
      countBySpaceId[sid] = (countBySpaceId[sid] || 0) + 1;
    }

    // aleg candidati mai multi ca sa pot completa pana la 6 cand unele spatii top sunt inactive
    const CANDIDATE_SIZE = 15;
    const candidateIds = Object.entries(countBySpaceId)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, CANDIDATE_SIZE)
      .map(([id]) => id);

    if (candidateIds.length === 0) {
      return res.json({ spaces: [], total: 0 });
    }

    const spacesRaw = await prisma.space.findMany({
      where: { id: { in: candidateIds }, status: 'active' },
      include: {
        host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
        reviews: { select: { rating: true } },
      },
    });

    const byId = new Map(spacesRaw.map((s) => [s.id, s]));
    // pastrez ordinea dupa numarul de rezervari: ia primele 6 active din lista de candidati
    const spaces = candidateIds.map((id) => byId.get(id)).filter(Boolean).slice(0, 6);
    res.json({ spaces: spaces.map(spaceToResponse), total: spaces.length });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { q, location, category, date, minPrice, maxPrice, minCapacity, amenities: amenitiesParam, limit = 50, offset = 0, featured } = req.query;
    const where = buildSpaceWhereClause({ q, location, category, minPrice, maxPrice, minCapacity });

    const skip = parseInt(offset, 10) || 0;
    const requestedTake = Math.min(parseInt(limit, 10) || 50, 100);
    const amenityIds = amenitiesParam
      ? String(amenitiesParam).split(',').map((a) => a.trim()).filter(Boolean)
      : [];

    // daca exista filtru pe data, scot spatiiile care n-au niciun slot orar disponibil in ziua aia.
    // asta e la fel ca pe pagina "Space" (12 AM -> 11 PM) si tratez 12 AM -> 12 AM ca "toata ziua".
    const dateStrFilter = date ? String(date) : null;
    let dateStart = null;
    let dateEnd = null;
    let dayName = null;
    if (dateStrFilter) {
      const parsed = new Date(dateStrFilter);
      if (!isNaN(parsed.getTime())) {
        dateStart = new Date(parsed);
        dateStart.setUTCHours(0, 0, 0, 0);
        dateEnd = new Date(parsed);
        dateEnd.setUTCHours(23, 59, 59, 999);
        const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        dayName = DAY_NAMES[parsed.getDay()];
      }
    }

    const dateCtx = dateStrFilter ? { dateStr: dateStart.toISOString().slice(0, 10), dayName } : null;
    const isAvailableOnDate = (space, bookings) =>
      dateCtx ? computeIsSpaceAvailableOnDate(space, bookings, dateCtx) : true;

    if (amenityIds.length > 0) {
      const takePool = 500;
      const spaces = await prisma.space.findMany({
        where,
        include: {
          host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
          reviews: { select: { rating: true } },
        },
        take: takePool,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      const filtered = spaces.filter((space) => {
        const spaceAmenities = space.amenitiesJson ? JSON.parse(space.amenitiesJson) : [];
        return amenityIds.every((id) => {
          const labels = AMENITY_ID_TO_LABELS[id];
          return spaceAmenities.some(
            (a) => a === id || (Array.isArray(labels) && labels.includes(a))
          );
        });
      });

      if (dateStrFilter && dateStart && dateEnd) {
        const ids = filtered.map((s) => s.id);
        const bookings = await prisma.booking.findMany({
          where: {
            spaceId: { in: ids },
            date: { gte: dateStart, lte: dateEnd },
            status: { in: ['confirmed', 'pending'] },
          },
          select: { spaceId: true, startTime: true, endTime: true },
        });
        const bySpaceId = new Map();
        for (const b of bookings) {
          if (!bySpaceId.has(b.spaceId)) bySpaceId.set(b.spaceId, []);
          bySpaceId.get(b.spaceId).push(b);
        }
        const dateFiltered = filtered.filter((s) => isAvailableOnDate(s, bySpaceId.get(s.id) ?? []));
        const total = dateFiltered.length;
        const paginated = dateFiltered.slice(skip, skip + requestedTake);
        res.json({ spaces: paginated.map(spaceToResponse), total });
        return;
      }

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + requestedTake);
      res.json({ spaces: paginated.map(spaceToResponse), total });
      return;
    }

    if (dateStrFilter && dateStart && dateEnd) {
      // ia mai multe elemente dintr un pool, filtreaza dupa disponibilitate, apoi pagineaza.
      const takePool = Math.max(skip + requestedTake, 200);
      const spacesPool = await prisma.space.findMany({
        where,
        include: {
          host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
          reviews: { select: { rating: true } },
        },
        take: Math.min(takePool, 1000),
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });

      const ids = spacesPool.map((s) => s.id);
      const bookings = await prisma.booking.findMany({
        where: {
          spaceId: { in: ids },
          date: { gte: dateStart, lte: dateEnd },
          status: { in: ['confirmed', 'pending'] },
        },
        select: { spaceId: true, startTime: true, endTime: true },
      });
      const bySpaceId = new Map();
      for (const b of bookings) {
        if (!bySpaceId.has(b.spaceId)) bySpaceId.set(b.spaceId, []);
        bySpaceId.get(b.spaceId).push(b);
      }

      const dateFiltered = spacesPool.filter((s) => isAvailableOnDate(s, bySpaceId.get(s.id) ?? []));
      const total = dateFiltered.length;
      const paginated = dateFiltered.slice(skip, skip + requestedTake);
      res.json({ spaces: paginated.map(spaceToResponse), total });
      return;
    }

    const take = requestedTake;
    const [spaces, total] = await Promise.all([
      prisma.space.findMany({
        where,
        include: {
          host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
          reviews: { select: { rating: true } },
        },
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

    // generez un link de frontend si l loghez in consola backend-ului.
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
      include: {
        host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
        reviews: { select: { rating: true } },
      },
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
    });
    if (!space) return res.status(404).json({ error: 'Space not found' });

    const dateStr = d.toISOString().slice(0, 10);
    const blockedDates = space.blockedDatesJson
      ? (() => { try { const a = JSON.parse(space.blockedDatesJson); return Array.isArray(a) ? a : []; } catch { return []; } })()
      : [];
    if (isDateInBlockedRanges(dateStr, blockedDates)) {
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
        // 12:00 AM -> 12:00 AM => toata ziua
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
    const space = await prisma.space.create({
      data: {
        hostId: req.userId,
        category,
        title,
        location,
        capacity: parseInt(capacity, 10),
        pricePerHour: new Decimal(parseFloat(pricePerHour)),
        description,
        imageUrl: imageUrl || null,
        imagesJson: typeof imagesJson === 'string' ? imagesJson : JSON.stringify(imagesJson || []),
        amenitiesJson: typeof amenitiesJson === 'string' ? amenitiesJson : JSON.stringify(amenitiesJson || []),
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
        blockedDatesJson: null,
      },
      include: {
        host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
        reviews: { select: { rating: true } },
      },
    });
    res.status(201).json(spaceToResponse(space));
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
    const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const allowed = ['category', 'title', 'location', 'capacity', 'pricePerHour', 'squareMeters', 'description', 'imageUrl', 'imagesJson', 'amenitiesJson', 'isInstantBookable', 'latitude', 'longitude', 'availabilityStartTime', 'availabilityEndTime', 'sameDayBookingAllowed', 'minDurationHours', 'maxDurationHours', 'maxAdvanceBookingDays', 'cancellationPolicy', 'cleaningFeeCents', 'equipmentFeeCents', 'bannedDaysJson', 'blockedDatesJson', 'status'];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'pricePerHour') data[key] = new Decimal(parseFloat(body[key]));
        else if (key === 'capacity') data[key] = parseInt(body[key], 10);
        else if (key === 'squareMeters') data[key] = body[key] == null ? null : parseInt(body[key], 10);
        else if (key === 'latitude' || key === 'longitude') data[key] = body[key] == null ? null : parseFloat(body[key]);
        else if (key === 'imagesJson' || key === 'amenitiesJson') data[key] = typeof body[key] === 'string' ? body[key] : JSON.stringify(body[key] || []);
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
        } else if (key === 'cleaningFeeCents' || key === 'equipmentFeeCents') {
          const v = body[key];
          if (v == null) data[key] = null;
          else {
            const n = parseInt(v, 10);
            if (Number.isNaN(n) || n < 0) return res.status(400).json({ error: `${key} must be a non-negative integer` });
            data[key] = n;
          }
        } else if (key === 'bannedDaysJson') {
          const v = body[key];
          if (v == null) data[key] = null;
          else {
            let arr;
            try {
              arr = Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : null);
            } catch {
              return res.status(400).json({ error: 'bannedDaysJson must be a valid JSON array' });
            }
            if (!Array.isArray(arr)) return res.status(400).json({ error: 'bannedDaysJson must be an array' });
            const invalid = arr.find((d) => !VALID_DAYS.includes(d));
            if (invalid) return res.status(400).json({ error: `Invalid day: ${invalid}. Must be one of: ${VALID_DAYS.join(', ')}` });
            data[key] = JSON.stringify(arr);
          }
        } else if (key === 'blockedDatesJson') {
          const v = body[key];
          if (v == null) data[key] = null;
          else {
            let arr;
            try {
              arr = Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : null);
            } catch {
              return res.status(400).json({ error: 'blockedDatesJson must be a valid JSON array' });
            }
            if (!Array.isArray(arr)) return res.status(400).json({ error: 'blockedDatesJson must be an array' });
            const todayStr = new Date().toISOString().slice(0, 10);
            for (const block of arr) {
              if (!block || typeof block !== 'object' || !block.startDate || !block.endDate) {
                return res.status(400).json({ error: 'Each blocked date must have startDate and endDate (YYYY-MM-DD)' });
              }
              const start = String(block.startDate).slice(0, 10);
              const end = String(block.endDate).slice(0, 10);
              if (start > end) return res.status(400).json({ error: 'startDate must be <= endDate in blocked dates' });
              if (start < todayStr || end < todayStr) return res.status(400).json({ error: 'Blocked dates must be today or in the future' });
            }
            const bookingsOnBlocked = await prisma.booking.findMany({
              where: { spaceId: req.params.id, status: { not: 'cancelled' } },
              select: { date: true },
            });
            const bookedDateStrs = new Set(bookingsOnBlocked.map((b) => b.date.toISOString().slice(0, 10)));
            for (const block of arr) {
              const start = new Date(block.startDate);
              const end = new Date(block.endDate);
              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const ds = d.toISOString().slice(0, 10);
                if (bookedDateStrs.has(ds)) {
                  return res.status(400).json({ error: `Cannot block dates that have existing bookings (e.g. ${ds})` });
                }
              }
            }
            data[key] = JSON.stringify(arr);
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

    const updated = await prisma.space.update({
      where: { id: req.params.id },
      data,
      include: {
        host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
        reviews: { select: { rating: true } },
      },
    });
    res.json(spaceToResponse(updated));
  } catch (e) {
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
