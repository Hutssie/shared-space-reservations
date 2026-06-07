import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMENITY_EXTRA_PHRASES,
  AMENITY_ID_TOKEN_BLOCKLIST,
  AMENITY_ID_TO_LABELS,
  AMENITY_USER_PATTERNS,
  inferAmenityIdsFromText,
  resolveEntryToAmenityId,
} from '../src/lib/amenities.js';

describe('amenity patterns (D4)', () => {
  it('AMENITY_USER_PATTERNS covers every canonical amenity id', () => {
    const patternIds = new Set(AMENITY_USER_PATTERNS.map((p) => p.id));
    for (const id of Object.keys(AMENITY_ID_TO_LABELS)) {
      assert.ok(patternIds.has(id), `missing pattern for amenity id: ${id}`);
    }
  });

  it('every catalog label matches inferAmenityIdsFromText', () => {
    for (const [id, labels] of Object.entries(AMENITY_ID_TO_LABELS)) {
      for (const label of labels) {
        const ids = inferAmenityIdsFromText(`space with ${label} please`);
        assert.ok(ids.includes(id), `label "${label}" should map to ${id}`);
      }
    }
  });

  it('every AMENITY_EXTRA_PHRASES entry matches', () => {
    for (const [id, phrases] of Object.entries(AMENITY_EXTRA_PHRASES)) {
      for (const phrase of phrases) {
        const ids = inferAmenityIdsFromText(`need ${phrase} for my session`);
        assert.ok(ids.includes(id), `phrase "${phrase}" should map to ${id}`);
      }
    }
  });

  it('legacy labels resolve on read but ghost labels are not AI patterns', () => {
    assert.equal(resolveEntryToAmenityId('Track Lighting'), 'easels');
    assert.equal(resolveEntryToAmenityId('Sound Isolation'), 'sound');
    assert.equal(resolveEntryToAmenityId('Board Table'), 'monitors');
    const ids = inferAmenityIdsFromText('art studio with track lighting');
    assert.equal(ids.includes('easels'), false);
    assert.equal(ids.includes('light'), false);
  });

  it('regression: colloquial audio and light phrasing (#12, #13)', () => {
    assert.ok(inferAmenityIdsFromText('with good sound system').includes('audio'));
    assert.ok(inferAmenityIdsFromText('photo studio with lighting').includes('light'));
    assert.ok(inferAmenityIdsFromText('with pro sound system').includes('audio'));
  });

  it('regression: bare wifi and colloquial parking (D4.1)', () => {
    assert.ok(inferAmenityIdsFromText('It classroom with wifi in romania').includes('wifi'));
    assert.ok(
      inferAmenityIdsFromText('art studio in romania with a place to park my car').includes('parking')
    );
  });

  it('sound isolation and soundproofing map to sound', () => {
    assert.ok(inferAmenityIdsFromText('recording studio with sound isolation').includes('sound'));
    assert.ok(inferAmenityIdsFromText('recording studio with soundproofing').includes('sound'));
  });

  it('recording studio category does not spuriously infer mics', () => {
    const ids = inferAmenityIdsFromText('recording studio in craiova');
    assert.equal(ids.includes('mics'), false);
  });

  it('art easels phrases map to easels', () => {
    assert.ok(inferAmenityIdsFromText('art studio with art easels').includes('easels'));
    assert.ok(inferAmenityIdsFromText('space with art easel').includes('easels'));
  });

  it('good sound system maps to audio only, not sound isolation', () => {
    const ids = inferAmenityIdsFromText('art studio in craiova with good sound system');
    assert.ok(ids.includes('audio'));
    assert.equal(ids.includes('sound'), false);
  });

  it('highlight does not infer light id token', () => {
    const ids = inferAmenityIdsFromText('art studio with highlight');
    assert.equal(ids.includes('light'), false);
  });

  it('safe canonical id tokens match synthetic sentences', () => {
    for (const id of Object.keys(AMENITY_ID_TO_LABELS)) {
      if (AMENITY_ID_TOKEN_BLOCKLIST.has(id)) continue;
      const ids = inferAmenityIdsFromText(`space with ${id} please`);
      assert.ok(ids.includes(id), `bare id token "${id}" should be inferred`);
    }
  });

  it('track lighting does not infer light', () => {
    const ids = inferAmenityIdsFromText('art studio with track lighting');
    assert.equal(ids.includes('light'), false);
  });
});
