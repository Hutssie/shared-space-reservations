import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';
import { app } from '../src/index.js';
import { DEFAULT_CITY_LAT, DEFAULT_CITY_LNG } from '../src/lib/recommendationConfig.js';
import { haversineKm } from '../src/lib/geoSearch.js';

const prisma = new PrismaClient();
const FIXTURE_PREFIX = 'RecSearch_';
const fixtureIds = [];

async function createGeoFixture(hostId, title, { latitude, longitude, location }) {
  const space = await prisma.space.create({
    data: {
      hostId,
      category: 'Photo Studio',
      title: `${FIXTURE_PREFIX}${title}`,
      location,
      capacity: 10,
      pricePerHour: new Decimal(100),
      description: 'Recommendation search fixture',
      status: 'active',
      latitude,
      longitude,
    },
  });
  fixtureIds.push(space.id);
  return space;
}

describe('recommendation search', () => {
  let hostId;
  let craiovaId;
  let farId;
  let outerBboxId;

  before(async () => {
    const host = await prisma.user.findUnique({ where: { email: 'host@example.com' } });
    assert.ok(host, 'seed host required');
    hostId = host.id;

    const craiova = await createGeoFixture(hostId, 'craiova', {
      latitude: DEFAULT_CITY_LAT,
      longitude: DEFAULT_CITY_LNG,
      location: 'Craiova, Romania',
    });
    craiovaId = craiova.id;

    const far = await createGeoFixture(hostId, 'far', {
      latitude: 40.6782,
      longitude: -73.9442,
      location: 'Brooklyn, NY',
    });
    farId = far.id;

    const outerLat = 44.55;
    const outerLng = 24.1;
    assert.ok(haversineKm(DEFAULT_CITY_LAT, DEFAULT_CITY_LNG, outerLat, outerLng) > 25);
    const outer = await createGeoFixture(hostId, 'outer_bbox', {
      latitude: outerLat,
      longitude: outerLng,
      location: 'Craiova outskirts, Romania',
    });
    outerBboxId = outer.id;
  });

  after(async () => {
    for (const id of fixtureIds) {
      await prisma.space.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('GET /api/spaces/recommended returns spaces', async () => {
    const res = await request(app).get('/api/spaces/recommended').expect(200);
    assert.ok(Array.isArray(res.body.spaces));
    assert.ok(res.body.spaces.length <= 15);
  });

  it('GET /api/spaces/featured-this-month returns up to 15 spaces', async () => {
    const res = await request(app).get('/api/spaces/featured-this-month').expect(200);
    assert.ok(Array.isArray(res.body.spaces));
    assert.ok(res.body.spaces.length <= 15);
  });

  it('sort=recommended nearby excludes far-away fixture', async () => {
    const res = await request(app)
      .get(`/api/spaces?sort=recommended&q=${encodeURIComponent(FIXTURE_PREFIX)}&limit=50`)
      .expect(200);
    const ids = res.body.spaces.map((s) => s.id);
    assert.ok(ids.includes(craiovaId));
    assert.ok(!ids.includes(farId));
  });

  it('sort=recommended pagination is consistent and disjoint', async () => {
    const p1 = await request(app)
      .get('/api/spaces?sort=recommended&limit=3&offset=0')
      .expect(200);
    const p2 = await request(app)
      .get('/api/spaces?sort=recommended&limit=3&offset=3')
      .expect(200);
    assert.equal(p1.body.total, p2.body.total);
    const ids1 = p1.body.spaces.map((s) => s.id);
    const ids2 = p2.body.spaces.map((s) => s.id);
    assert.equal(ids1.filter((id) => ids2.includes(id)).length, 0);
  });

  it('sort=recommended city bbox includes space beyond 25km but inside placeBounds', async () => {
    const res = await request(app)
      .get(
        `/api/spaces?sort=recommended&q=${encodeURIComponent(FIXTURE_PREFIX)}` +
          '&location=Craiova%2C%20Romania' +
          `&centerLat=${DEFAULT_CITY_LAT}&centerLng=${DEFAULT_CITY_LNG}` +
          '&placeNorth=44.6&placeSouth=44.0&placeEast=24.2&placeWest=23.2' +
          '&limit=50'
      )
      .expect(200);
    const ids = res.body.spaces.map((s) => s.id);
    assert.ok(ids.includes(outerBboxId));
    assert.ok(!ids.includes(farId));
  });

  it('sort=recommended city bbox excludes space outside placeBounds', async () => {
    const res = await request(app)
      .get(
        `/api/spaces?sort=recommended&q=${encodeURIComponent(FIXTURE_PREFIX)}` +
          '&location=Craiova%2C%20Romania' +
          `&centerLat=${DEFAULT_CITY_LAT}&centerLng=${DEFAULT_CITY_LNG}` +
          '&placeNorth=44.6&placeSouth=44.0&placeEast=24.2&placeWest=23.2' +
          '&limit=50'
      )
      .expect(200);
    const ids = res.body.spaces.map((s) => s.id);
    assert.ok(!ids.includes(farId));
  });

  it('sort=recommended city without placeBounds uses radius fallback', async () => {
    const res = await request(app)
      .get(
        `/api/spaces?sort=recommended&q=${encodeURIComponent(FIXTURE_PREFIX)}` +
          '&location=Craiova%2C%20Romania' +
          `&centerLat=${DEFAULT_CITY_LAT}&centerLng=${DEFAULT_CITY_LNG}` +
          '&limit=50'
      )
      .expect(200);
    const ids = res.body.spaces.map((s) => s.id);
    assert.ok(ids.includes(craiovaId));
    assert.ok(!ids.includes(outerBboxId));
    assert.ok(!ids.includes(farId));
  });

  it('sort=recommended with date does not cap availability scan under seed size', async () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/spaces?sort=recommended&date=${date}&limit=10`)
      .expect(200);
    assert.notEqual(res.body.availabilityScanCapped, true);
  });
});
