import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';
import { app } from '../src/index.js';
import { buildSpaceSearchWhere } from '../src/routes/spaces.js';
import { syncSpaceAmenities } from '../src/lib/amenities.js';
import {
  parseDateFilterQuery,
  searchSpacesWithDateAvailability,
} from '../src/lib/spaceAvailabilitySearch.js';
import {
  syncSpaceBannedDays,
  syncSpaceBlockedDates,
} from '../src/lib/spaceAvailabilityRules.js';

const prisma = new PrismaClient();
const FIXTURE_PREFIX = 'ScalVerify_';
const fixtureIds = [];

function tomorrowYmd() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function createFixtureSpace(hostId, title, { bannedDay = null, blockedDate = null } = {}) {
  const space = await prisma.space.create({
    data: {
      hostId,
      category: 'Photo Studio',
      title: `${FIXTURE_PREFIX}${title}`,
      location: 'Test City',
      capacity: 10,
      pricePerHour: new Decimal(100),
      description: 'Scalability test fixture',
      status: 'active',
      weeklyScheduleEnabled: false,
    },
  });
  fixtureIds.push(space.id);
  await syncSpaceAmenities(prisma, space.id, ['wifi', 'ac']);
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

describe('search scalability', () => {
  let hostId;
  let cleanId;
  const date = tomorrowYmd();
  const { dateStart, dateEnd, dateCtx } = parseDateFilterQuery(date);
  const dayName = dateCtx.dayName;

  before(async () => {
    const host = await prisma.user.findUnique({ where: { email: 'host@example.com' } });
    assert.ok(host, 'seed host required');
    hostId = host.id;

    await createFixtureSpace(hostId, 'banned', { bannedDay: dayName });
    await createFixtureSpace(hostId, 'blocked', { blockedDate: date });
    const clean = await createFixtureSpace(hostId, 'clean');
    cleanId = clean.id;
  });

  after(async () => {
    for (const id of fixtureIds) {
      await prisma.spaceBlockedDate.deleteMany({ where: { spaceId: id } });
      await prisma.spaceBannedDay.deleteMany({ where: { spaceId: id } });
      await prisma.spaceAmenity.deleteMany({ where: { spaceId: id } });
      await prisma.space.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('amenities wifi,ac total matches prisma count', async () => {
    const where = buildSpaceSearchWhere({}, ['wifi', 'ac']);
    const expected = await prisma.space.count({ where });
    const res = await request(app).get('/api/spaces?amenities=wifi,ac&limit=5').expect(200);
    assert.equal(res.body.total, expected);
  });

  it('pagination returns disjoint pages with same total', async () => {
    const p1 = await request(app).get('/api/spaces?limit=3&offset=0').expect(200);
    const p2 = await request(app).get('/api/spaces?limit=3&offset=3').expect(200);
    assert.equal(p1.body.total, p2.body.total);
    const ids1 = p1.body.spaces.map((s) => s.id);
    const ids2 = p2.body.spaces.map((s) => s.id);
    assert.equal(ids1.filter((id) => ids2.includes(id)).length, 0);
  });

  it('date filter excludes banned and blocked fixture spaces', async () => {
    const where = buildSpaceSearchWhere(
      { q: FIXTURE_PREFIX },
      []
    );
    const scan = await searchSpacesWithDateAvailability(prisma, {
      where,
      dateStart,
      dateEnd,
      dateCtx,
      skip: 0,
      take: 10,
    });
    assert.equal(scan.total, 1);
    assert.equal(scan.spaces[0]?.id, cleanId);

    const res = await request(app)
      .get(`/api/spaces?q=${encodeURIComponent(FIXTURE_PREFIX)}&date=${date}&limit=10`)
      .expect(200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.spaces[0]?.id, cleanId);
  });

  it('GET space returns bannedDays and blockedDates shape', async () => {
    const bannedSpace = fixtureIds[0];
    const res = await request(app).get(`/api/spaces/${bannedSpace}`).expect(200);
    assert.ok(Array.isArray(res.body.bannedDays));
    assert.ok(res.body.bannedDays.includes(dayName));
    assert.equal(res.body.blockedDates, null);
  });
});
