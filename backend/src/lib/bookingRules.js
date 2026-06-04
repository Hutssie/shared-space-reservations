import { Decimal } from '@prisma/client/runtime/library';
import { parseTimeToMinutes, resolveBookingMinutes } from './bookingTime.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Row lock so host listing edits and guest booking are serialized on the same space. */
export async function lockSpaceRow(tx, spaceId) {
  const locked = await tx.$queryRaw`
    SELECT id FROM "Space" WHERE id = ${spaceId} FOR UPDATE
  `;
  if (!Array.isArray(locked) || locked.length === 0) return null;
  return tx.space.findUnique({ where: { id: spaceId } });
}

function parseBlockedDates(blockedDatesJson) {
  if (!blockedDatesJson) return [];
  try {
    const a = JSON.parse(blockedDatesJson);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

/**
 * Validates booking rules against the current space row (call after lockSpaceRow).
 * @returns {{ error: string, status: number } | { ok: true, startMinutes, endMinutes, hours, totalPrice, cleaningCents, equipmentCents }}
 */
export function validateBookingAgainstSpace(
  space,
  { bookerUserId, startTime, endTime, requestDate, today, skipHostSelfCheck = false }
) {
  if (!space) {
    return { error: 'Space not found', status: 404 };
  }
  if (space.status !== 'active') {
    return { error: 'This space is not currently available for booking', status: 400 };
  }
  if (!skipHostSelfCheck && space.hostId && space.hostId === bookerUserId) {
    return { error: 'Forbidden', status: 403 };
  }

  if (space.sameDayBookingAllowed === false) {
    if (requestDate.getTime() === today.getTime()) {
      return { error: 'Same-day booking is not allowed for this space', status: 400 };
    }
  }

  if (space.maxAdvanceBookingDays != null) {
    const daysDiff = (requestDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
    if (daysDiff > space.maxAdvanceBookingDays) {
      return {
        error: 'Booking date is beyond the maximum advance booking window',
        status: 400,
      };
    }
  }

  if (space.bannedDaysJson) {
    try {
      const bannedDays = JSON.parse(space.bannedDaysJson);
      if (Array.isArray(bannedDays) && bannedDays.length > 0) {
        const dayName = DAY_NAMES[requestDate.getDay()];
        if (bannedDays.includes(dayName)) {
          return { error: `This space is not available on ${dayName}s`, status: 400 };
        }
      }
    } catch {
      /* ignore invalid json */
    }
  }

  const dateStr = requestDate.toISOString().slice(0, 10);
  for (const block of parseBlockedDates(space.blockedDatesJson)) {
    const start = block.startDate || '';
    const end = block.endDate || block.startDate || '';
    if (dateStr >= start && dateStr <= end) {
      return { error: 'This date is not available for booking', status: 400 };
    }
  }

  const minutes = resolveBookingMinutes(startTime, endTime);
  if (minutes.error) {
    return { error: minutes.error, status: 400 };
  }
  const { startMinutes, endMinutes } = minutes;
  const startM = startMinutes;
  const endM = endMinutes;

  const windowStart = space.availabilityStartTime ?? null;
  const windowEnd = space.availabilityEndTime ?? null;
  if (windowStart != null && windowEnd != null) {
    const wStartM = parseTimeToMinutes(windowStart);
    let wEndM = parseTimeToMinutes(windowEnd);
    if (wEndM === 0) wEndM = 24 * 60;
    if (wStartM == null || wEndM == null) {
      return { error: 'Space availability window is invalid', status: 400 };
    }
    const inWindow = startM >= wStartM && endM <= wEndM;
    if (!inWindow) {
      return {
        error: 'Requested time is outside the space\'s availability window',
        status: 400,
      };
    }
  }

  const hours = (endM - startM) / 60;
  if (space.minDurationHours != null && hours < space.minDurationHours) {
    return {
      error: `Minimum booking duration is ${space.minDurationHours} hours`,
      status: 400,
    };
  }
  if (space.maxDurationHours != null && hours > space.maxDurationHours) {
    return {
      error: `Maximum booking duration is ${space.maxDurationHours} hours`,
      status: 400,
    };
  }

  const cleaningCents = space.cleaningFeeCents ?? 0;
  const equipmentCents = space.equipmentFeeCents ?? 0;
  const totalPrice =
    Number(space.pricePerHour) * hours + cleaningCents / 100 + equipmentCents / 100;

  return {
    ok: true,
    startMinutes,
    endMinutes,
    hours,
    totalPrice: new Decimal(totalPrice),
    cleaningCents,
    equipmentCents,
  };
}
