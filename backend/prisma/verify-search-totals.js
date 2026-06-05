/**
 * Cross-check GET /api/spaces total with Prisma ground truth (same where / scan helpers).
 */
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { app } from '../src/index.js';
import { buildSpaceSearchWhere } from '../src/routes/spaces.js';
import {
  parseDateFilterQuery,
  searchSpacesWithDateAvailability,
} from '../src/lib/spaceAvailabilitySearch.js';

const prisma = new PrismaClient();

function tomorrowYmd() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function expectTotal(label, query, expectedTotal) {
  const res = await request(app).get(`/api/spaces?${query}`).expect(200);
  const apiTotal = res.body.total;
  if (apiTotal !== expectedTotal) {
    console.error(`FAIL [${label}]: API total=${apiTotal} expected=${expectedTotal}`);
    process.exit(1);
  }
  console.log(`PASS [${label}]: total=${apiTotal}`);
}

async function main() {
  process.env.NODE_ENV = 'test';

  const date = tomorrowYmd();

  const wifiWhere = buildSpaceSearchWhere({}, ['wifi']);
  await expectTotal('amenities=wifi', 'amenities=wifi&limit=5', await prisma.space.count({ where: wifiWhere }));

  const wifiAcWhere = buildSpaceSearchWhere({}, ['wifi', 'ac']);
  await expectTotal(
    'amenities=wifi,ac',
    'amenities=wifi,ac&limit=5',
    await prisma.space.count({ where: wifiAcWhere })
  );

  const photoWhere = buildSpaceSearchWhere({ category: 'Photo Studio' }, []);
  await expectTotal(
    'category=Photo Studio',
    `category=${encodeURIComponent('Photo Studio')}&limit=5`,
    await prisma.space.count({ where: photoWhere })
  );

  const { dateStart, dateEnd, dateCtx } = parseDateFilterQuery(date);
  const dateWhere = buildSpaceSearchWhere({}, []);
  const dateScan = await searchSpacesWithDateAvailability(prisma, {
    where: dateWhere,
    dateStart,
    dateEnd,
    dateCtx,
    skip: 0,
    take: 50,
  });
  await expectTotal('date=tomorrow', `date=${date}&limit=50`, dateScan.total);

  const dateWifiWhere = buildSpaceSearchWhere({}, ['wifi']);
  const dateWifiScan = await searchSpacesWithDateAvailability(prisma, {
    where: dateWifiWhere,
    dateStart,
    dateEnd,
    dateCtx,
    skip: 0,
    take: 50,
  });
  await expectTotal(
    'date=tomorrow&amenities=wifi',
    `date=${date}&amenities=wifi&limit=50`,
    dateWifiScan.total
  );

  console.log('PASS: all search totals match ground truth.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
