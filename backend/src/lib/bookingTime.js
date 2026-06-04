export function parseTimeToMinutes(t) {
  const match = String(t).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

/** Half-open [startMinutes, endMinutes) consistent with booking overlap checks. */
export function resolveBookingMinutes(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  let endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes == null || endMinutes == null) {
    return { error: 'Invalid time range' };
  }
  if (endMinutes <= startMinutes) {
    if (endTime === '12:00 AM') {
      endMinutes = 24 * 60;
    } else {
      return { error: 'Invalid time range' };
    }
  }
  return { startMinutes, endMinutes };
}

export function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

const EXCLUSION_CONSTRAINT = 'bookings_no_confirmed_overlap';

export const BOOKING_SLOT_CONFLICT_MESSAGE = 'Time slot is already booked';

function errorChainText(error) {
  const parts = [];
  const seen = new Set();
  for (let e = error; e && !seen.has(e); e = e.cause) {
    seen.add(e);
    if (typeof e.message === 'string') parts.push(e.message);
    if (e.meta && typeof e.meta === 'object') {
      try {
        parts.push(JSON.stringify(e.meta));
      } catch {
        /* ignore circular meta */
      }
    }
  }
  return parts.join('\n');
}

/** Detects PostgreSQL 23P01 / bookings_no_confirmed_overlap (any Prisma error variant). */
export function isPostgresExclusionViolation(error) {
  if (!error) return false;
  const text = errorChainText(error);
  return (
    text.includes(EXCLUSION_CONSTRAINT) ||
    text.includes('23P01') ||
    /exclusion constraint/i.test(text)
  );
}
