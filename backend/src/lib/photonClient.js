import https from 'https';

const PHOTON_HOST = 'photon.komoot.io';

/**
 * Photon extent: [minLon, maxLat, maxLon, minLat]
 * @returns {{ north: number, south: number, east: number, west: number } | null}
 */
export function parsePhotonExtent(extent) {
  if (!Array.isArray(extent) || extent.length < 4) return null;
  const [minLon, maxLat, maxLon, minLat] = extent.map(Number);
  if ([minLon, maxLat, maxLon, minLat].some((v) => Number.isNaN(v))) return null;
  if (minLat > maxLat) return null;
  if (Math.abs(maxLon - minLon) > 360) return null;
  return { north: maxLat, south: minLat, east: maxLon, west: minLon };
}

export function parsePhotonFeature(feature) {
  const p = feature?.properties || {};
  const name = p.name || '';
  const parts = [];
  if (p.city && p.city !== name) parts.push(p.city);
  if (p.county && !parts.includes(p.county)) parts.push(p.county);
  if (p.state && !parts.includes(p.state)) parts.push(p.state);
  if (p.country) parts.push(p.country);
  const secondary = parts.join(', ') || '';
  const label = secondary ? `${name}, ${secondary}` : name;
  const city =
    p.city ||
    (p.type === 'city' || p.osm_value === 'city' || p.osm_value === 'town' || p.osm_value === 'village'
      ? name
      : '');
  const state = p.state || p.county || '';
  const country = p.country || '';
  const coords =
    feature?.geometry?.coordinates?.length >= 2 ? feature.geometry.coordinates : null;
  const bounds = parsePhotonExtent(p.extent);

  return {
    label: label || 'Unknown',
    primary: name || 'Unknown',
    secondary,
    city: city || undefined,
    state: state || undefined,
    country: country || undefined,
    latitude: coords ? coords[1] : undefined,
    longitude: coords ? coords[0] : undefined,
    north: bounds?.north,
    south: bounds?.south,
    east: bounds?.east,
    west: bounds?.west,
    bounds,
    cityName: city || name || null,
    lat: coords ? coords[1] : null,
    lng: coords ? coords[0] : null,
  };
}

export function fetchPhotonFeatures(q, { limit = 8 } = {}) {
  return new Promise((resolve, reject) => {
    const path = `/api?${new URLSearchParams({
      q,
      limit: String(limit),
      lang: 'en',
    }).toString()}`;
    const req = https.request(
      { hostname: PHOTON_HOST, path, method: 'GET', headers: { Accept: 'application/json' } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Photon returned ${res.statusCode}`));
            return;
          }
          try {
            const data = JSON.parse(body);
            resolve(data.features || []);
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Photon request timeout'));
    });
    req.end();
  });
}

export async function fetchPhotonSuggestions(q, { limit = 8 } = {}) {
  const features = await fetchPhotonFeatures(q, { limit });
  return features.map(parsePhotonFeature);
}
