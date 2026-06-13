import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';
import { buildSpaceSearchWhere } from '../src/routes/spaces.js';
import {
  parseDateFilterQuery,
  searchSpacesWithDateAvailability,
} from '../src/lib/spaceAvailabilitySearch.js';
import {
  syncSpaceBannedDays,
  syncSpaceBlockedDates,
} from '../src/lib/spaceAvailabilityRules.js';
import {
  buildSearchParamsForLadder,
  extractKnownFilters,
} from '../src/lib/aiSearchPolicy.js';
import { locationNormFromDisplay } from '../src/lib/textNormalize.js';

const prisma = new PrismaClient();
const FIXTURE_PREFIX = 'D3Avail_';
// Computed relative to "today" so the fixture date is always in the future —
// host availability rules reject blocked dates in the past. Using local date
// parts (not toISOString) avoids any timezone off-by-one.
const TARGET_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
})();
const REFERENCE = new Date(`${TARGET_DATE}T12:00:00`);
const fixtureIds = [];
const bookingIds = [];

async function createFixtureSpace(hostId, title, { bannedDay = null, blockedDate = null } = {}) {
  const space = await prisma.space.create({
    data: {
      hostId,
      category: 'Art Studio',
      title: `${FIXTURE_PREFIX}${title}`,
      location: `${FIXTURE_PREFIX}Craiova`,
      locationNorm: locationNormFromDisplay(`${FIXTURE_PREFIX}Craiova`),
      capacity: 10,
      pricePerHour: new Decimal(75),
      description: 'D3 availability test fixture',
      status: 'active',
      weeklyScheduleEnabled: false,
    },
  });
  fixtureIds.push(space.id);
  if (bannedDay) {
    await syncSpaceBannedDays(prisma, space.id, [bannedDay]);
  }
  if (blockedDate) {
    await syncSpaceBlockedDates(prisma, space.id, [
      { id: `block_${space.id}`, startDate: blockedDate, endDate: blockedDate },
    ]);
  }
  return space;
}

describe('ai search availability (D3)', () => {
  let hostId;
  let guestId;
  let availableId;
  const { dateStart, dateEnd, dateCtx } = parseDateFilterQuery(TARGET_DATE);

  before(async () => {
    const host = await prisma.user.findUnique({ where: { email: 'host@example.com' } });
    const guest = await prisma.user.findUnique({ where: { email: 'guest@example.com' } });
    assert.ok(host, 'seed host required');
    assert.ok(guest, 'seed guest required');
    hostId = host.id;
    guestId = guest.id;

    await createFixtureSpace(hostId, 'banned', { bannedDay: dateCtx.dayName });
    await createFixtureSpace(hostId, 'blocked', { blockedDate: TARGET_DATE });
    const booked = await createFixtureSpace(hostId, 'booked');
    const available = await createFixtureSpace(hostId, 'available');
    availableId = available.id;

    const booking = await prisma.booking.create({
      data: {
        userId: guestId,
        spaceId: booked.id,
        date: new Date(`${TARGET_DATE}T12:00:00.000Z`),
        startTime: '12:00 AM',
        endTime: '12:00 AM',
        startMinutes: 0,
        endMinutes: 0,
        status: 'confirmed',
        totalPrice: new Decimal(75),
      },
    });
    bookingIds.push(booking.id);
  });

  after(async () => {
    for (const id of bookingIds) {
      await prisma.booking.delete({ where: { id } }).catch(() => {});
    }
    for (const id of fixtureIds) {
      await prisma.spaceBlockedDate.deleteMany({ where: { spaceId: id } });
      await prisma.spaceBannedDay.deleteMany({ where: { spaceId: id } });
      await prisma.spaceAmenity.deleteMany({ where: { spaceId: id } });
      await prisma.space.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('searchSpacesWithDateAvailability excludes banned, blocked, and fully booked spaces', async () => {
    const where = buildSpaceSearchWhere(
      { q: FIXTURE_PREFIX, category: 'Art Studio' },
      []
    );
    const result = await searchSpacesWithDateAvailability(prisma, {
      where,
      dateStart,
      dateEnd,
      dateCtx,
      skip: 0,
      take: 10,
    });
    assert.equal(result.total, 1);
    assert.equal(result.spaces[0]?.id, availableId);
  });

  it('extractKnownFilters and buildSearchParamsForLadder wire date for availability path', () => {
    const knownFilters = extractKnownFilters(
      [{ role: 'user', content: `art studio in craiova on ${TARGET_DATE.split('-').reverse().join('.')}` }],
      null,
      { referenceDate: REFERENCE }
    );
    assert.equal(knownFilters.date, TARGET_DATE);
    const ladder = buildSearchParamsForLadder(knownFilters, {
      location: 'Craiova',
      category: 'Art Studio',
    });
    assert.equal(ladder.date, TARGET_DATE);
    assert.equal(ladder.category, 'Art Studio');
  });
});
