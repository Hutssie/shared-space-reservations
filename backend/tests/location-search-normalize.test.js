import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';
import { buildSpaceSearchWhere } from '../src/routes/spaces.js';
import { locationNormFromDisplay } from '../src/lib/textNormalize.js';
import { extractKnownFilters } from '../src/lib/aiSearchPolicy.js';

const prisma = new PrismaClient();
const FIXTURE_PREFIX = 'LocNorm_';
let fixtureId;
let craiovaLabId;
let romaLabId;
let romeLabId;
let hostId;

async function createFixtureSpace(data) {
  return prisma.space.create({
    data: {
      hostId,
      capacity: 10,
      pricePerHour: new Decimal(75),
      description: 'D4 location norm fixture',
      status: 'active',
      weeklyScheduleEnabled: false,
      ...data,
    },
  });
}

describe('location search normalize (D4)', () => {
  before(async () => {
    const host = await prisma.user.findUnique({ where: { email: 'host@example.com' } });
    assert.ok(host, 'seed host required');
    hostId = host.id;

    const space = await createFixtureSpace({
      category: 'Art Studio',
      title: `${FIXTURE_PREFIX}Bailesti Studio`,
      location: 'Băilești, Dolj',
      locationNorm: locationNormFromDisplay('Băilești, Dolj'),
    });
    fixtureId = space.id;

    const craiovaLab = await createFixtureSpace({
      category: 'Laboratory',
      title: `${FIXTURE_PREFIX}Craiova Lab`,
      location: 'Craiova, Romania',
      locationNorm: locationNormFromDisplay('Craiova, Romania'),
    });
    craiovaLabId = craiovaLab.id;

    const romaLab = await createFixtureSpace({
      category: 'Laboratory',
      title: `${FIXTURE_PREFIX}Roma Lab`,
      location: 'Roma, Italy',
      locationNorm: locationNormFromDisplay('Roma, Italy'),
    });
    romaLabId = romaLab.id;

    const romeLab = await createFixtureSpace({
      category: 'Laboratory',
      title: `${FIXTURE_PREFIX}Rome Lab`,
      location: 'Rome, Italy',
      locationNorm: locationNormFromDisplay('Rome, Italy'),
    });
    romeLabId = romeLab.id;
  });

  after(async () => {
    const ids = [fixtureId, craiovaLabId, romaLabId, romeLabId].filter(Boolean);
    for (const id of ids) {
      await prisma.space.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('buildSpaceSearchWhere matches diacritic-insensitive location via locationNorm', async () => {
    const where = buildSpaceSearchWhere({ location: 'bailesti', category: 'Art Studio' });
    const rows = await prisma.space.findMany({ where, select: { id: true } });
    assert.ok(rows.some((r) => r.id === fixtureId));
  });

  it('buildSpaceSearchWhere does not match roma/rome against romania listings', async () => {
    for (const query of ['roma', 'rome']) {
      const where = buildSpaceSearchWhere({ location: query, category: 'Laboratory' });
      const rows = await prisma.space.findMany({ where, select: { id: true } });
      assert.ok(!rows.some((r) => r.id === craiovaLabId), `query "${query}" must not match Craiova, Romania`);
    }
  });

  it('buildSpaceSearchWhere matches roma and rome against distinct city listings', async () => {
    const romaWhere = buildSpaceSearchWhere({ location: 'roma', category: 'Laboratory' });
    const romaRows = await prisma.space.findMany({ where: romaWhere, select: { id: true } });
    assert.ok(romaRows.some((r) => r.id === romaLabId));

    const romeWhere = buildSpaceSearchWhere({ location: 'rome', category: 'Laboratory' });
    const romeRows = await prisma.space.findMany({ where: romeWhere, select: { id: true } });
    assert.ok(romeRows.some((r) => r.id === romeLabId));
  });

  it('buildSpaceSearchWhere matches country segment romania', async () => {
    const where = buildSpaceSearchWhere({ location: 'romania', category: 'Laboratory' });
    const rows = await prisma.space.findMany({ where, select: { id: true } });
    assert.ok(rows.some((r) => r.id === craiovaLabId));
  });

  it('extractKnownFilters resolves bailesti location from user text', () => {
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'art studio in bailesti' }],
      null
    );
    assert.equal(filters.category, 'Art Studio');
    assert.match(String(filters.location), /bailesti/i);
  });
});
