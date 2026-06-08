import { parseTimeToMinutes } from './bookingTime.js';
import {
  getTodayDateStrUtc,
  isDateBookableByHostRules,
  isDayBanned,
  isDateBlocked,
} from './spaceAvailabilityRules.js';

export const TIME_SLOTS = [
  '12:00 AM', '01:00 AM', '02:00 AM', '03:00 AM', '04:00 AM', '05:00 AM', '06:00 AM', '07:00 AM',
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
  '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
];

export function computeIsSpaceAvailableOnDate(space, bookingsForSpace, { dateStr, dayName, todayStr }) {
  if (!dateStr) return true;

  const today = todayStr ?? getTodayDateStrUtc();
  if (!isDateBookableByHostRules(space, dateStr, today)) return false;
  if (isDayBanned(space, dayName)) return false;
  if (isDateBlocked(space, dateStr)) return false;

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

export function computeIsSpaceAvailableInRange(space, bookingsForSpace, { dateStr, dayName, startTime, endTime, todayStr }) {
  if (!dateStr || !startTime || !endTime) return true;

  const today = todayStr ?? getTodayDateStrUtc();
  if (!isDateBookableByHostRules(space, dateStr, today)) return false;
  if (isDayBanned(space, dayName)) return false;
  if (isDateBlocked(space, dateStr)) return false;

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
