import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const favs = await prisma.favorite.findMany({
      where: { userId: req.userId },
      include: {
        space: {
          include: {
            host: { select: { name: true } },
            reviews: { select: { rating: true } },
          },
        },
      },
    });
    const list = favs.map((f) => {
      const s = f.space;
      const rating = s.reviews?.length
        ? s.reviews.reduce((a, r) => a + r.rating, 0) / s.reviews.length
        : null;
      return {
        id: f.spaceId,
        spaceId: f.spaceId,
        name: s.title,
        location: s.location,
        rating: rating != null ? Math.round(rating * 100) / 100 : null,
        reviews: s.reviews?.length ?? 0,
        price: Number(s.pricePerHour),
        image: s.imageUrl,
      };
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { space_id: spaceId } = req.body;
    if (!spaceId) return res.status(400).json({ error: 'space_id required' });
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) return res.status(404).json({ error: 'Space not found' });
    await prisma.favorite.upsert({
      where: { userId_spaceId: { userId: req.userId, spaceId } },
      create: { userId: req.userId, spaceId },
      update: {},
    });
    res.status(201).json({ spaceId });
  } catch (e) {
    if (e.code === 'P2002') return res.status(200).json({ spaceId });
    next(e);
  }
});

router.delete('/:spaceId', authMiddleware, async (req, res, next) => {
  try {
    await prisma.favorite.deleteMany({
      where: { userId: req.userId, spaceId: req.params.spaceId },
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export const favoritesRouter = router;
