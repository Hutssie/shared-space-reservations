import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSpaceEmbeddingText, toSqlVector } from '../src/lib/embeddings.js';
import { fetchSemanticCandidates } from '../src/lib/aiSearchRetrieval.js';

describe('embeddings text builder (Phase C)', () => {
  it('combines title, category, location, amenities, and description', () => {
    const text = buildSpaceEmbeddingText({
      title: 'Bright Loft',
      category: 'Photo Studio',
      location: 'Craiova, Dolj, Romania',
      amenities: [{ amenityId: 'wifi' }, { amenityId: 'light' }],
      description: 'A sunny corner space.',
    });
    assert.match(text, /Title: Bright Loft/);
    assert.match(text, /Category: Photo Studio/);
    assert.match(text, /Location: Craiova, Dolj, Romania/);
    // amenity ids resolve to human-readable labels
    assert.match(text, /Amenities: High-speed WiFi, Natural Light/);
    assert.match(text, /Description: A sunny corner space\./);
  });

  it('accepts pre-resolved amenityLabels and bare amenityIds', () => {
    const fromLabels = buildSpaceEmbeddingText({
      title: 'A',
      amenityLabels: ['Free Coffee', 'On-site Parking'],
    });
    assert.match(fromLabels, /Amenities: Free Coffee, On-site Parking/);

    const fromIds = buildSpaceEmbeddingText({ title: 'A', amenityIds: ['coffee', 'parking'] });
    assert.match(fromIds, /Amenities: Free Coffee, On-site Parking/);
  });

  it('omits empty sections and never throws on sparse input', () => {
    assert.equal(buildSpaceEmbeddingText({ title: 'Only Title' }), 'Title: Only Title');
    assert.equal(buildSpaceEmbeddingText({}), '');
    assert.equal(buildSpaceEmbeddingText(null), '');
    assert.equal(buildSpaceEmbeddingText(undefined), '');
  });

  it('falls back to the raw id when an amenity id is unknown', () => {
    const text = buildSpaceEmbeddingText({ title: 'A', amenityIds: ['totally-unknown'] });
    assert.match(text, /Amenities: totally-unknown/);
  });
});

describe('toSqlVector (Phase C)', () => {
  it('formats a numeric array as a pgvector literal', () => {
    assert.equal(toSqlVector([0.1, 0.2, 0.3]), '[0.1,0.2,0.3]');
    assert.equal(toSqlVector([1, 2, 3]), '[1,2,3]');
  });

  it('throws on empty or non-array input', () => {
    assert.throws(() => toSqlVector([]), /non-empty/);
    assert.throws(() => toSqlVector(null), /non-empty/);
    assert.throws(() => toSqlVector('nope'), /non-empty/);
  });
});

describe('fetchSemanticCandidates fallback (Phase C)', () => {
  it('returns an empty result for blank queries without touching the DB', async () => {
    const prismaStub = {
      $queryRawUnsafe: async () => {
        throw new Error('DB should not be queried for a blank query');
      },
    };
    const result = await fetchSemanticCandidates(prismaStub, '   ');
    assert.deepEqual(result.ids, []);
    assert.equal(result.similarity.size, 0);
  });
});
