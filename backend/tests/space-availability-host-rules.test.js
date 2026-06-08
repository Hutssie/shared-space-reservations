import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeIsSpaceAvailableOnDate,
} from '../src/lib/spaceAvailabilityCompute.js';
import {
  dateAvailabilitySqlWhere,
  getTodayDateStrUtc,
  isDateBookableByHostRules,
  isSameDayBookingBlocked,
} from '../src/lib/spaceAvailabilityRules.js';
import { parseDateFilterQuery } from '../src/lib/spaceAvailabilitySearch.js';

describe('space availability host booking rules', () => {
  const todayStr = getTodayDateStrUtc();

  it('isSameDayBookingBlocked rejects today when same-day booking is disabled', () => {
    const space = { sameDayBookingAllowed: false };
    assert.equal(isSameDayBookingBlocked(space, todayStr, todayStr), true);
    assert.equal(isSameDayBookingBlocked(space, '2099-01-01', todayStr), false);
  });

  it('isDateBookableByHostRules allows today when same-day booking is enabled', () => {
    const space = { sameDayBookingAllowed: true, maxAdvanceBookingDays: null };
    assert.equal(isDateBookableByHostRules(space, todayStr, todayStr), true);
  });

  it('computeIsSpaceAvailableOnDate returns false for today when same-day booking is disabled', () => {
    const space = {
      sameDayBookingAllowed: false,
      maxAdvanceBookingDays: null,
      weeklyScheduleEnabled: false,
      bannedDays: [],
      blockedDates: [],
      availabilityStartTime: null,
      availabilityEndTime: null,
    };
    const available = computeIsSpaceAvailableOnDate(space, [], {
      dateStr: todayStr,
      dayName: 'Monday',
      todayStr,
    });
    assert.equal(available, false);
  });

  it('dateAvailabilitySqlWhere excludes same-day-disabled spaces when filtering today', () => {
    const { dateCtx, dateStart, dateEnd } = parseDateFilterQuery(todayStr);
    const where = dateAvailabilitySqlWhere(dateCtx, dateStart, dateEnd);
    const serialized = JSON.stringify(where);
    assert.match(serialized, /sameDayBookingAllowed/);
    assert.match(serialized, /false/);
  });

  it('dateAvailabilitySqlWhere does not add same-day filter for future dates', () => {
    const futureDate = '2099-06-15';
    const { dateCtx, dateStart, dateEnd } = parseDateFilterQuery(futureDate);
    const where = dateAvailabilitySqlWhere(dateCtx, dateStart, dateEnd);
    const serialized = JSON.stringify(where);
    assert.doesNotMatch(serialized, /sameDayBookingAllowed/);
  });
});
