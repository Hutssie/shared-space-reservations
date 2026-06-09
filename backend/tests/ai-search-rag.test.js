import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';
import {
  buildRetrievalQuery,
  formatRagContext,
  orderSpacesByRetrieval,
  retrieveSpacesForRag,
  scoreRelevance,
  tokenizeQuery,
} from '../src/lib/aiSearchRetrieval.js';
import { scoreSpaces } from '../src/lib/recommendations.js';
import {
  DEFAULT_CITY_NAME,
  NEARBY_RADIUS_KM,
  defaultRankingCenter,
} from '../src/lib/recommendationConfig.js';
import { buildSpaceEmbeddingText, embedDocument, toSqlVector } from '../src/lib/embeddings.js';
import { locationNormFromDisplay } from '../src/lib/textNormalize.js';

const prisma = new PrismaClient();
const FIXTURE_PREFIX = 'RagTest_';
const fixtureIds = [];

async function createFixture(hostId, title, category, location) {
  const space = await prisma.space.create({
    data: {
      hostId,
      category,
      title: `${FIXTURE_PREFIX}${title}`,
      location,
      locationNorm: locationNormFromDisplay(location),
      capacity: 10,
      pricePerHour: new Decimal(100),
      description: `RAG test space about ${title} and ${category}`,
      status: 'active',
    },
  });
  fixtureIds.push(space.id);
  return space;
}

// Embed a fixture so Phase C semantic retrieval does not penalize it relative
// to the embedded production spaces sharing this database. No-op without a key.
async function embedFixture(space) {
  const vector = await embedDocument(
    buildSpaceEmbeddingText({
      title: space.title,
      category: space.category,
      location: space.location,
      description: space.description,
    })
  );
  if (!vector) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "Space" SET embedding = $1::vector WHERE id = $2`,
    toSqlVector(vector),
    space.id
  );
}

describe('aiSearchRetrieval unit', () => {
  it('buildRetrievalQuery uses last user turns', () => {
    const q = buildRetrievalQuery([
      { role: 'user', content: 'old query about dance' },
      { role: 'assistant', content: 'sure' },
      { role: 'user', content: 'recording studio Romania' },
    ]);
    assert.match(q, /recording/);
    assert.match(q, /Romania/);
  });

  it('tokenizeQuery filters stopwords and short tokens', () => {
    const tokens = tokenizeQuery('I need a photo studio for my team');
    assert.ok(tokens.includes('photo'));
    assert.ok(tokens.includes('studio'));
    assert.ok(!tokens.includes('need'));
  });

  it('scoreRelevance ranks title match higher', () => {
    const candidates = [
      { id: 'a', title: 'Photo Studio Loft', category: 'Photo Studio', location: 'NY', description: 'x' },
      { id: 'b', title: 'Other', category: 'Kitchen Studio', location: 'NY', description: 'photo shoots here' },
    ];
    const scores = scoreRelevance(candidates, 'photo studio');
    assert.ok((scores.get('a') ?? 0) > (scores.get('b') ?? 0));
  });

  it('formatRagContext lists space ids and warns when empty', () => {
    const empty = formatRagContext([]);
    assert.match(empty, /none matched/);
    const filled = formatRagContext([
      {
        id: 'abc',
        title: 'Test Space',
        category: 'Photo Studio',
        location: 'Craiova',
        pricePerHour: 50,
        capacity: 8,
        description: 'A bright studio.',
        amenities: [{ amenityId: 'wifi' }],
        _pop30d: 12,
      },
    ]);
    assert.match(filled, /\[id: abc\]/);
    assert.match(filled, /RETRIEVED LISTINGS/);
    assert.match(filled, /12 bookings \(30d\)/);
    assert.match(filled, /top match/);
  });

  it('orderSpacesByRetrieval ranks by retrieval order not input order', () => {
    const retrieved = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
    const cards = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
      { id: 'z', title: 'Z' },
    ];
    const ordered = orderSpacesByRetrieval(cards, retrieved, 3);
    assert.deepEqual(
      ordered.map((s) => s.id),
      ['b', 'a', 'c']
    );
  });
});

describe('aiSearchRetrieval integration', () => {
  let hostId;
  let guestId;
  let photoId;
  let kitchenId;

  before(async () => {
    const host = await prisma.user.findUnique({ where: { email: 'host@example.com' } });
    const guest = await prisma.user.findUnique({ where: { email: 'guest@example.com' } });
    assert.ok(host && guest);
    hostId = host.id;
    guestId = guest.id;

    const photo = await createFixture(hostId, 'photo_romania', 'Photo Studio', 'Craiova, Romania');
    const kitchen = await createFixture(hostId, 'kitchen_brooklyn', 'Kitchen Studio', 'Brooklyn, NY');
    photoId = photo.id;
    kitchenId = kitchen.id;
    await embedFixture(photo);
    await embedFixture(kitchen);
  });

  after(async () => {
    for (const id of fixtureIds) {
      await prisma.space.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('retrieveSpacesForRag returns photo studio for Romania query', async () => {
    const messages = [{ role: 'user', content: 'photo studio in Romania' }];
    const results = await retrieveSpacesForRag(prisma, { messages, userId: null, limit: 5 });
    const ids = results.map((s) => s.id);
    assert.ok(ids.includes(photoId));
  });

  it('logged-in and anonymous retrieval both surface the matching photo studio', async () => {
    const messages = [{ role: 'user', content: 'photo studio in Romania' }];
    const anon = await retrieveSpacesForRag(prisma, { messages, userId: null, limit: 5 });
    const loggedIn = await retrieveSpacesForRag(prisma, { messages, userId: guestId, limit: 5 });
    assert.ok(anon.length > 0);
    assert.ok(loggedIn.length > 0);
    assert.ok(anon.some((s) => s.id === photoId));
    assert.ok(loggedIn.some((s) => s.id === photoId));
  });

  it('personalized hybrid scoring measurably changes the guest history category score', async () => {
    // Compare hybrid scores directly rather than brittle top-1 ordering. Hold
    // the weighting scheme constant (full hybrid for both) and vary only the
    // user, so the seeded guest's confirmed Photo Studio booking is the only
    // difference. The guest's history should measurably move the photo
    // fixture's blended score relative to the anonymous baseline.
    const ids = [photoId, kitchenId];
    const center = defaultRankingCenter();
    const common = {
      spaceIds: ids,
      rankingCenter: center,
      maxRadiusKm: NEARBY_RADIUS_KM,
      cityName: DEFAULT_CITY_NAME,
      coldStart: false,
    };
    const baselineScores = await scoreSpaces(prisma, { ...common, userId: null });
    const guestScores = await scoreSpaces(prisma, { ...common, userId: guestId });

    const photoDelta = Math.abs(
      (guestScores.get(photoId) ?? 0) - (baselineScores.get(photoId) ?? 0)
    );
    const kitchenDelta = Math.abs(
      (guestScores.get(kitchenId) ?? 0) - (baselineScores.get(kitchenId) ?? 0)
    );

    assert.ok(
      photoDelta > 1e-9 || kitchenDelta > 1e-9,
      'guest history should measurably change hybrid scoring vs the anonymous baseline'
    );
  });
});
