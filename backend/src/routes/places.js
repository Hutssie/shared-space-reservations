import { Router } from 'express';
import https from 'https';

const router = Router();
const PHOTON_HOST = 'photon.komoot.io';

/**
 * Photon (Komoot) is used for place search. The public Nominatim API
 * forbids autocomplete use ("you must not implement such a service on the client side").
 * Photon is OSM-based and supports search-as-you-type.
 */
function buildSuggestionsFromPhoton(features) {
  if (!Array.isArray(features)) return [];
  return features.map((f) => {
    const p = f.properties || {};
    const name = p.name || '';
    const parts = [];
    if (p.city && p.city !== name) parts.push(p.city);
    if (p.county && !parts.includes(p.county)) parts.push(p.county);
    if (p.state && !parts.includes(p.state)) parts.push(p.state);
    if (p.country) parts.push(p.country);
    const secondary = parts.join(', ') || '';
    const label = secondary ? `${name}, ${secondary}` : name;
    // For city-level results, primary/name is the city; for country/state, use name as-is
    const city = p.city || (p.type === 'city' || p.osm_value === 'city' || p.osm_value === 'town' || p.osm_value === 'village' ? name : '');
    const state = p.state || p.county || '';
    const country = p.country || '';
    const coords = f.geometry && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length >= 2
      ? f.geometry.coordinates
      : null;
    return {
      label: label || 'Unknown',
      primary: name || 'Unknown',
      secondary,
      city: city || undefined,
      state: state || undefined,
      country: country || undefined,
      latitude: coords ? coords[1] : undefined,
      longitude: coords ? coords[0] : undefined,
    };
  });
}

function fetchPhoton(q) {
  return new Promise((resolve, reject) => {
    const path = `/api?${new URLSearchParams({
      q,
      limit: '8',
      lang: 'en',
    }).toString()}`;
    const opts = {
      hostname: PHOTON_HOST,
      path,
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Photon returned ${res.statusCode}`));
          return;
        }
        try {
          const data = JSON.parse(body);
          const features = data.features || [];
          resolve(buildSuggestionsFromPhoton(features));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Photon request timeout'));
    });
    req.end();
  });
}

router.get('/suggest', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await fetchPhoton(q);
    res.json({ suggestions });
  } catch (e) {
    console.error('[places/suggest]', e.message || e);
    res.json({ suggestions: [] });
  }
});

export const placesRouter = router;
