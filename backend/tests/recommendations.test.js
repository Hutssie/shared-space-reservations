import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  jaccardSimilarity,
  minMaxNormalize,
  stableSortByScore,
} from '../src/lib/recommendations.js';
import { locationScore, haversineKm } from '../src/lib/geoSearch.js';
import { COLD_START_WEIGHTS, HYBRID_WEIGHTS } from '../src/lib/recommendationConfig.js';

describe('geoSearch', () => {
  it('locationScore decreases with distance', () => {
    assert.equal(locationScore(0, 100), 1);
    assert.equal(locationScore(50, 100), 0.5);
    assert.equal(locationScore(100, 100), 0);
    assert.equal(locationScore(150, 100), 0);
  });

  it('haversineKm returns reasonable distance', () => {
    const dist = haversineKm(44.3191, 23.7936, 44.4268, 26.1025);
    assert.ok(dist > 150 && dist < 250);
  });
});

describe('recommendations utils', () => {
  it('jaccardSimilarity handles empty and overlapping sets', () => {
    assert.equal(jaccardSimilarity(new Set(), new Set()), 0);
    assert.equal(jaccardSimilarity(new Set(['a']), new Set(['a'])), 1);
    assert.equal(jaccardSimilarity(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3);
  });

  it('minMaxNormalize scales to 0-1', () => {
    const raw = new Map([['a', 2], ['b', 4], ['c', 6]]);
    const norm = minMaxNormalize(raw);
    assert.equal(norm.get('a'), 0);
    assert.equal(norm.get('b'), 0.5);
    assert.equal(norm.get('c'), 1);
  });

  it('minMaxNormalize gives 1 for equal positive values', () => {
    const raw = new Map([['a', 3], ['b', 3]]);
    const norm = minMaxNormalize(raw);
    assert.equal(norm.get('a'), 1);
    assert.equal(norm.get('b'), 1);
  });

  it('stableSortByScore breaks ties by id ASC', () => {
    const scores = new Map([['b', 0.5], ['a', 0.5], ['c', 0.9]]);
    const sorted = stableSortByScore(['b', 'a', 'c'], scores);
    assert.deepEqual(sorted, ['c', 'a', 'b']);
  });

  it('hybrid and cold-start weights sum to 1', () => {
    const hybridSum = Object.values(HYBRID_WEIGHTS).reduce((a, b) => a + b, 0);
    const coldSum = Object.values(COLD_START_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.equal(hybridSum, 1);
    assert.equal(coldSum, 1);
  });
});
