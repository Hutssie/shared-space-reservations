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

  it('logged-in guest retrieval differs from anonymous for category-aligned query', async () => {
    const messages = [{ role: 'user', content: 'photo studio in Romania' }];
    const anon = await retrieveSpacesForRag(prisma, { messages, userId: null, limit: 5 });
    const loggedIn = await retrieveSpacesForRag(prisma, { messages, userId: guestId, limit: 5 });
    assert.ok(anon.length > 0);
    assert.ok(loggedIn.length > 0);
    assert.ok(anon.some((s) => s.id === photoId));
    assert.ok(loggedIn.some((s) => s.id === photoId));
    const anonTop = anon[0]?.id;
    const loggedTop = loggedIn[0]?.id;
    assert.notEqual(
      anonTop,
      loggedTop,
      'personalized hybrid weights should reorder at least the top result for a guest with photo-studio history'
    );
  });
});
