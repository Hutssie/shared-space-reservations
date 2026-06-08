import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhotonExtent, parsePhotonFeature } from '../src/lib/photonClient.js';
import {
  expandBounds,
  isPointInBounds,
  filterSpacesByGeo,
  haversineKm,
} from '../src/lib/geoSearch.js';

describe('photonClient parsePhotonFeature', () => {
  it('maps county/region features to state (e.g. Dolj, Romania)', () => {
    const parsed = parsePhotonFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [23.8, 44.3] },
      properties: {
        name: 'Dolj',
        country: 'Romania',
        osm_value: 'county',
        type: 'county',
      },
    });
    assert.equal(parsed.primary, 'Dolj');
    assert.equal(parsed.state, 'Dolj');
    assert.equal(parsed.country, 'Romania');
    assert.equal(parsed.city, undefined);
  });

  it('keeps country-only suggestions without a spurious state', () => {
    const parsed = parsePhotonFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [25.0, 45.9] },
      properties: {
        name: 'Romania',
        country: 'Romania',
        osm_value: 'country',
        type: 'country',
      },
    });
    assert.equal(parsed.primary, 'Romania');
    assert.equal(parsed.state, undefined);
    assert.equal(parsed.country, 'Romania');
  });

  it('keeps city suggestions unchanged', () => {
    const parsed = parsePhotonFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [23.8, 44.3] },
      properties: {
        name: 'Craiova',
        country: 'Romania',
        osm_value: 'city',
        type: 'city',
      },
    });
    assert.equal(parsed.city, 'Craiova');
    assert.equal(parsed.state, undefined);
    assert.equal(parsed.country, 'Romania');
  });
});

describe('photonClient parsePhotonExtent', () => {
  it('parses Photon extent order minLon maxLat maxLon minLat', () => {
    const bounds = parsePhotonExtent([13.23727, 52.5157151, 13.241757, 52.5135972]);
    assert.ok(bounds);
    assert.equal(bounds.west, 13.23727);
    assert.equal(bounds.north, 52.5157151);
    assert.equal(bounds.east, 13.241757);
    assert.equal(bounds.south, 52.5135972);
  });
});

describe('geoSearch bbox helpers', () => {
  const bounds = { north: 45, south: 44, east: 26, west: 25 };

  it('expandBounds adds 10% padding', () => {
    const expanded = expandBounds(bounds, 0.1);
    assert.equal(expanded.north, 45.1);
    assert.equal(expanded.south, 43.9);
    assert.equal(expanded.east, 26.1);
    assert.equal(expanded.west, 24.9);
  });

  it('isPointInBounds includes interior point', () => {
    assert.equal(isPointInBounds(44.5, 25.5, bounds), true);
    assert.equal(isPointInBounds(43, 25.5, bounds), false);
  });

  it('filterSpacesByGeo city bbox includes point beyond 25km from center', () => {
    const centerLat = 44.3191;
    const centerLng = 23.7936;
    const largeBounds = expandBounds(
      { north: 44.6, south: 44.0, east: 24.2, west: 23.2 },
      0.1
    );
    const outerLat = 44.55;
    const outerLng = 24.1;
    const dist = haversineKm(centerLat, centerLng, outerLat, outerLng);
    assert.ok(dist > 25);

    const spaces = [
      { id: 'in', latitude: outerLat, longitude: outerLng, location: 'Test' },
      { id: 'out', latitude: 40.6782, longitude: -73.9442, location: 'Brooklyn' },
    ];
    const filtered = filterSpacesByGeo(spaces, {
      mode: 'city',
      centerLat,
      centerLng,
      radiusKm: 25,
      cityName: 'Craiova',
      placeBounds: largeBounds,
    });
    assert.deepEqual(filtered.map((s) => s.id), ['in']);
  });
});
