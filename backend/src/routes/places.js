import { Router } from 'express';
import { fetchPhotonSuggestions } from '../lib/photonClient.js';

const router = Router();

router.get('/suggest', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await fetchPhotonSuggestions(q, { limit: 8 });
    res.json({ suggestions });
  } catch (e) {
    console.error('[places/suggest]', e.message || e);
    res.json({ suggestions: [] });
  }
});

export const placesRouter = router;
