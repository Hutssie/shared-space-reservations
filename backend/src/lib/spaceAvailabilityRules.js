import { randomBytes } from 'crypto';

export const VALID_DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function generateId() {
  const t = Date.now().toString(36);
  const r = randomBytes(6).toString('hex');
  return `${t}${r}`;
}

export function dateToYmd(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateYmd(input) {
  if (input == null) return null;
  const s = String(input).slice(0, 10);
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return s;
}

/**
 * @returns {{ ok: true, weeklyScheduleEnabled: boolean, dayNames: string[] } | { ok: false, error: string }}
 */
export function normalizeBannedDaysPayload(v) {
  if (v == null) {
    return { ok: true, weeklyScheduleEnabled: false, dayNames: [] };
  }
  let arr;
  try {
    arr = Array.isArray(v) ? v : typeof v === 'string' ? JSON.parse(v) : null;
  } catch {
    return { ok: false, error: 'bannedDaysJson must be a valid JSON array' };
  }
  if (!Array.isArray(arr)) {
    return { ok: false, error: 'bannedDaysJson must be an array' };
  }
  const invalid = arr.find((d) => !VALID_DAY_NAMES.includes(d));
  if (invalid) {
    return {
      ok: false,
      error: `Invalid day: ${invalid}. Must be one of: ${VALID_DAY_NAMES.join(', ')}`,
    };
  }
  const dayNames = [...new Set(arr.filter((d) => typeof d === 'string'))];
  return { ok: true, weeklyScheduleEnabled: true, dayNames };
}

/**
 * @returns {{ ok: true, blocks: object[] } | { ok: false, error: string, status?: number }}
 */
export function normalizeBlockedDatesPayload(
  v,
  { todayStr = new Date().toISOString().slice(0, 10), forBackfill = false } = {}
) {
  if (v == null) {
    return { ok: true, blocks: [] };
  }
  let arr;
  try {
    arr = Array.isArray(v) ? v : typeof v === 'string' ? JSON.parse(v) : null;
  } catch {
    return { ok: false, error: 'blockedDatesJson must be a valid JSON array', status: 400 };
  }
  if (!Array.isArray(arr)) {
    return { ok: false, error: 'blockedDatesJson must be an array', status: 400 };
  }
  const blocks = [];
  for (const block of arr) {
    if (!block || typeof block !== 'object' || !block.startDate || !block.endDate) {
      return {
        ok: false,
        error: 'Each blocked date must have startDate and endDate (YYYY-MM-DD)',
        status: 400,
      };
    }
    const start = parseDateYmd(block.startDate);
    const end = parseDateYmd(block.endDate);
    if (!start || !end) {
      return { ok: false, error: 'Invalid startDate or endDate in blocked dates', status: 400 };
    }
    if (start > end) {
      return { ok: false, error: 'startDate must be <= endDate in blocked dates', status: 400 };
    }
    if (!forBackfill && (start < todayStr || end < todayStr)) {
      return { ok: false, error: 'Blocked dates must be today or in the future', status: 400 };
    }
    let createdAt = new Date();
    if (block.createdAt) {
      const parsed = new Date(block.createdAt);
      if (!isNaN(parsed.getTime())) createdAt = parsed;
    }
    blocks.push({
      id: typeof block.id === 'string' && block.id.trim() ? block.id.trim() : generateId(),
      startDate: start,
      endDate: end,
      createdAt,
    });
  }
  return { ok: true, blocks };
}

export function bannedDaysToJson({ weeklyScheduleEnabled, dayNames }) {
  if (!weeklyScheduleEnabled) return null;
  return JSON.stringify(dayNames ?? []);
}

export function blockedDatesToJson(blocks) {
  if (!blocks || blocks.length === 0) return null;
  return JSON.stringify(
    blocks.map((b) => ({
      id: b.id,
      startDate: typeof b.startDate === 'string' ? b.startDate : dateToYmd(b.startDate),
      endDate: typeof b.endDate === 'string' ? b.endDate : dateToYmd(b.endDate),
      createdAt:
        b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt ?? new Date().toISOString()),
    }))
  );
}

export async function syncSpaceBannedDays(tx, spaceId, payload) {
  const normalized = normalizeBannedDaysPayload(payload);
  if (!normalized.ok) {
    const err = new Error(normalized.error);
    err.status = 400;
    throw err;
  }
  const { weeklyScheduleEnabled, dayNames } = normalized;
  await tx.spaceBannedDay.deleteMany({ where: { spaceId } });
  if (dayNames.length > 0) {
    await tx.spaceBannedDay.createMany({
      data: dayNames.map((dayOfWeek) => ({ spaceId, dayOfWeek })),
      skipDuplicates: true,
    });
  }
  await tx.space.update({
    where: { id: spaceId },
    data: { weeklyScheduleEnabled },
  });
  return { weeklyScheduleEnabled, dayNames };
}

export async function syncSpaceBlockedDates(tx, spaceId, payload, { forBackfill = false } = {}) {
  const normalized = normalizeBlockedDatesPayload(payload, { forBackfill });
  if (!normalized.ok) {
    const err = new Error(normalized.error);
    err.status = normalized.status ?? 400;
    throw err;
  }
  const { blocks } = normalized;
  await tx.spaceBlockedDate.deleteMany({ where: { spaceId } });
  if (blocks.length > 0) {
    await tx.spaceBlockedDate.createMany({
      data: blocks.map((b) => ({
        id: b.id,
        spaceId,
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        createdAt: b.createdAt,
      })),
    });
  }
  return blocks;
}

export function bannedDaysForResponse(space) {
  if (!space.weeklyScheduleEnabled) return null;
  const days = space.bannedDays?.map((d) => d.dayOfWeek) ?? [];
  return days;
}

export function blockedDatesForResponse(space) {
  const rows = space.blockedDates ?? [];
  if (rows.length === 0) return null;
  return rows.map((b) => ({
    id: b.id,
    startDate: dateToYmd(b.startDate instanceof Date ? b.startDate : new Date(b.startDate)),
    endDate: dateToYmd(b.endDate instanceof Date ? b.endDate : new Date(b.endDate)),
    createdAt: (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)).toISOString(),
  }));
}

export function isDayBanned(space, dayName) {
  if (!dayName || !space.weeklyScheduleEnabled) return false;
  const days = space.bannedDays?.map((d) => d.dayOfWeek) ?? [];
  return days.includes(dayName);
}

export function isDateBlocked(space, dateStr) {
  if (!dateStr) return false;
  const blocks = space.blockedDates ?? [];
  for (const block of blocks) {
    const start = dateToYmd(block.startDate instanceof Date ? block.startDate : new Date(block.startDate));
    const end = dateToYmd(block.endDate instanceof Date ? block.endDate : new Date(block.endDate));
    if (start && end && dateStr >= start && dateStr <= end) return true;
  }
  return false;
}

/** UTC calendar date (YYYY-MM-DD), aligned with booking request validation. */
export function getTodayDateStrUtc() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
}

export function isBookingDateToday(dateStr, todayStr = getTodayDateStrUtc()) {
  return Boolean(dateStr) && dateStr === todayStr;
}

export function isSameDayBookingBlocked(space, dateStr, todayStr = getTodayDateStrUtc()) {
  return isBookingDateToday(dateStr, todayStr) && space.sameDayBookingAllowed === false;
}

export function isBeyondMaxAdvanceBooking(space, dateStr, todayStr = getTodayDateStrUtc()) {
  if (space.maxAdvanceBookingDays == null || !dateStr) return false;
  const requestDate = new Date(`${dateStr}T00:00:00.000Z`);
  const today = new Date(`${todayStr}T00:00:00.000Z`);
  const daysDiff = (requestDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
  return daysDiff > space.maxAdvanceBookingDays;
}

export function isDateBookableByHostRules(space, dateStr, todayStr = getTodayDateStrUtc()) {
  if (isSameDayBookingBlocked(space, dateStr, todayStr)) return false;
  if (isBeyondMaxAdvanceBooking(space, dateStr, todayStr)) return false;
  return true;
}

/** Prisma include for list/detail reads and booking validation. */
export const spaceAvailabilityInclude = {
  bannedDays: { select: { dayOfWeek: true }, orderBy: { dayOfWeek: 'asc' } },
  blockedDates: {
    select: { id: true, startDate: true, endDate: true, createdAt: true },
    orderBy: { startDate: 'asc' },
  },
};

/** Lightweight select for availability scan batches. */
export const spaceSelectForAvailabilityRules = {
  weeklyScheduleEnabled: true,
  sameDayBookingAllowed: true,
  maxAdvanceBookingDays: true,
  bannedDays: { select: { dayOfWeek: true } },
  blockedDates: { select: { startDate: true, endDate: true } },
};

/**
 * SQL WHERE clauses for date-filtered search (blocked ranges + banned weekdays + host booking rules).
 */
export function dateAvailabilitySqlWhere(dateCtx, dateStart, dateEnd, todayStr = dateCtx.todayStr ?? getTodayDateStrUtc()) {
  const clauses = [
    {
      OR: [
        { weeklyScheduleEnabled: false },
        { bannedDays: { none: { dayOfWeek: dateCtx.dayName } } },
      ],
    },
    {
      blockedDates: {
        none: {
          startDate: { lte: dateEnd },
          endDate: { gte: dateStart },
        },
      },
    },
  ];

  if (isBookingDateToday(dateCtx.dateStr, todayStr)) {
    clauses.push({ NOT: { sameDayBookingAllowed: false } });
  }

  return { AND: clauses };
}

/** Parse legacy JSON from DB row (backfill / verify). */
export function parseBannedDaysFromJson(bannedDaysJson) {
  if (bannedDaysJson == null) {
    return { weeklyScheduleEnabled: false, dayNames: [] };
  }
  try {
    const arr = JSON.parse(bannedDaysJson);
    if (!Array.isArray(arr)) return { weeklyScheduleEnabled: false, dayNames: [] };
    const dayNames = arr.filter((d) => VALID_DAY_NAMES.includes(d));
    return { weeklyScheduleEnabled: true, dayNames: [...new Set(dayNames)] };
  } catch {
    return { weeklyScheduleEnabled: false, dayNames: [] };
  }
}

export function parseBlockedDatesFromJson(blockedDatesJson) {
  if (!blockedDatesJson) return [];
  try {
    const arr = JSON.parse(blockedDatesJson);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((b) => b && b.startDate && b.endDate)
      .map((b) => ({
        id: typeof b.id === 'string' ? b.id : generateId(),
        startDate: parseDateYmd(b.startDate),
        endDate: parseDateYmd(b.endDate || b.startDate),
        createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
      }))
      .filter((b) => b.startDate && b.endDate);
  } catch {
    return [];
  }
}
