import { spaceListInclude } from './amenities.js';
import {
  computeIsSpaceAvailableOnDate,
  computeIsSpaceAvailableInRange,
} from './spaceAvailabilityCompute.js';
import {
  dateAvailabilitySqlWhere,
  spaceSelectForAvailabilityRules,
} from './spaceAvailabilityRules.js';

/** Max listing rows considered for date availability (replaces single 1000-row pool). */
export const MAX_SCAN_DATE_FILTER = 2000;

/** Spaces loaded per DB round-trip during availability scan. */
export const DATE_FILTER_BATCH_SIZE = 100;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const spaceSelectForAvailability = {
  id: true,
  availabilityStartTime: true,
  availabilityEndTime: true,
  ...spaceSelectForAvailabilityRules,
};

export function parseDateFilterQuery(dateInput) {
  if (dateInput == null || String(dateInput).trim() === '') {
    return { dateStart: null, dateEnd: null, dateCtx: null };
  }
  const parsed = new Date(String(dateInput));
  if (isNaN(parsed.getTime())) {
    return { dateStart: null, dateEnd: null, dateCtx: null };
  }
  const dateStart = new Date(parsed);
  dateStart.setUTCHours(0, 0, 0, 0);
  const dateEnd = new Date(parsed);
  dateEnd.setUTCHours(23, 59, 59, 999);
  const dateCtx = {
    dateStr: dateStart.toISOString().slice(0, 10),
    dayName: DAY_NAMES[parsed.getDay()],
  };
  return { dateStart, dateEnd, dateCtx };
}

function isSpaceAvailable(space, bookings, dateCtx, timeRange) {
  if (timeRange?.startTime && timeRange?.endTime) {
    return computeIsSpaceAvailableInRange(space, bookings, {
      ...dateCtx,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
    });
  }
  return computeIsSpaceAvailableOnDate(space, bookings, dateCtx);
}

async function loadBookingsBySpaceId(prisma, spaceIds, dateStart, dateEnd) {
  if (spaceIds.length === 0) return new Map();
  const bookings = await prisma.booking.findMany({
    where: {
      spaceId: { in: spaceIds },
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
  return bySpaceId;
}

/**
 * Scan candidates in batches; load bookings per batch only; hydrate full rows for the result page.
 */
export async function searchSpacesWithDateAvailability(
  prisma,
  {
    where,
    dateStart,
    dateEnd,
    dateCtx,
    skip = 0,
    take = 50,
    timeRange = null,
    maxScan = MAX_SCAN_DATE_FILTER,
    batchSize = DATE_FILTER_BATCH_SIZE,
    targetAvailable = null,
  }
) {
  const scanWhere = {
    AND: [where, dateAvailabilitySqlWhere(dateCtx, dateStart, dateEnd)],
  };

  const availableIds = [];
  let dbSkip = 0;
  let scanned = 0;
  let dbExhausted = false;

  while (scanned < maxScan) {
    const batch = await prisma.space.findMany({
      where: scanWhere,
      select: spaceSelectForAvailability,
      take: batchSize,
      skip: dbSkip,
      orderBy: { createdAt: 'desc' },
    });
    if (batch.length === 0) {
      dbExhausted = true;
      break;
    }
    scanned += batch.length;
    dbSkip += batch.length;

    const bySpaceId = await loadBookingsBySpaceId(
      prisma,
      batch.map((s) => s.id),
      dateStart,
      dateEnd
    );

    for (const space of batch) {
      const bookings = bySpaceId.get(space.id) ?? [];
      if (isSpaceAvailable(space, bookings, dateCtx, timeRange)) {
        availableIds.push(space.id);
      }
    }

    if (targetAvailable != null && availableIds.length >= targetAvailable) break;
    if (batch.length < batchSize) {
      dbExhausted = true;
      break;
    }
  }

  const scanCapped = !dbExhausted && scanned >= maxScan;
  const pageIds = availableIds.slice(skip, skip + take);

  if (pageIds.length === 0) {
    return {
      spaces: [],
      total: availableIds.length,
      availabilityScanCapped: scanCapped,
    };
  }

  const hydrated = await prisma.space.findMany({
    where: { id: { in: pageIds } },
    include: spaceListInclude,
  });
  const byId = new Map(hydrated.map((s) => [s.id, s]));
  const spaces = pageIds.map((id) => byId.get(id)).filter(Boolean);

  return {
    spaces,
    total: availableIds.length,
    availabilityScanCapped: scanCapped,
  };
}
