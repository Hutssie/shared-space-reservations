/**
 * Hold-out evaluation: precision@5 and recall@5 vs popularity-only baseline.
 * Users need at least 2 confirmed bookings; most recent booking is held out.
 */
import { PrismaClient } from '@prisma/client';
import {
  defaultRankingCenter,
  NEARBY_RADIUS_KM,
} from '../src/lib/recommendationConfig.js';
import { minMaxNormalize, scoreSpaces, stableSortByScore } from '../src/lib/recommendations.js';

const prisma = new PrismaClient();
const K = 5;

async function loadPopularityRanking(candidateIds) {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - 29);
  startDate.setUTCHours(0, 0, 0, 0);

  const bookings = await prisma.booking.groupBy({
    by: ['spaceId'],
    where: {
      spaceId: { in: candidateIds },
      status: 'confirmed',
      date: { gte: startDate },
    },
    _count: { spaceId: true },
  });

  const counts = new Map(candidateIds.map((id) => [id, 0]));
  for (const row of bookings) {
    counts.set(row.spaceId, row._count.spaceId);
  }
  const norm = minMaxNormalize(counts);
  return stableSortByScore(candidateIds, norm).slice(0, K);
}

async function main() {
  const center = defaultRankingCenter();
  const candidates = await prisma.space.findMany({
    where: { status: 'active' },
    select: { id: true, latitude: true, longitude: true, location: true },
  });
  const candidateIds = candidates.map((c) => c.id);

  const users = await prisma.booking.findMany({
    where: { status: 'confirmed' },
    select: { userId: true },
    distinct: ['userId'],
  });

  let evaluated = 0;
  let hybridHits = 0;
  let hybridPossible = 0;
  let popHits = 0;
  let popPossible = 0;

  for (const { userId } of users) {
    const bookings = await prisma.booking.findMany({
      where: { userId, status: 'confirmed' },
      select: { spaceId: true, date: true, createdAt: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    if (bookings.length < 2) continue;

    const holdOutSpaceId = bookings[0].spaceId;
    const trainingSpaceIds = [...new Set(bookings.slice(1).map((b) => b.spaceId))];

    const hybridScores = await scoreSpaces(prisma, {
      spaceIds: candidateIds,
      spaceRows: candidates,
      userId,
      rankingCenter: center,
      maxRadiusKm: NEARBY_RADIUS_KM,
      trainingSpaceIds,
    });
    const hybridTop = stableSortByScore(candidateIds, hybridScores).slice(0, K);
    const popTop = await loadPopularityRanking(candidateIds);

    evaluated++;
    if (hybridTop.includes(holdOutSpaceId)) hybridHits++;
    if (candidateIds.includes(holdOutSpaceId)) hybridPossible++;

    if (popTop.includes(holdOutSpaceId)) popHits++;
    if (candidateIds.includes(holdOutSpaceId)) popPossible++;
  }

  const precisionHybrid = evaluated > 0 ? hybridHits / (evaluated * K) : 0;
  const recallHybrid = hybridPossible > 0 ? hybridHits / hybridPossible : 0;
  const precisionPop = evaluated > 0 ? popHits / (evaluated * K) : 0;
  const recallPop = popPossible > 0 ? popHits / popPossible : 0;

  console.log('Recommendation evaluation (hold-out last booking)');
  console.log(`Users evaluated: ${evaluated}`);
  console.log(`K: ${K}`);
  console.log('');
  console.log('Hybrid recommender:');
  console.log(`  precision@${K}: ${precisionHybrid.toFixed(4)}`);
  console.log(`  recall@${K}: ${recallHybrid.toFixed(4)}`);
  console.log('');
  console.log('Popularity-only baseline:');
  console.log(`  precision@${K}: ${precisionPop.toFixed(4)}`);
  console.log(`  recall@${K}: ${recallPop.toFixed(4)}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
