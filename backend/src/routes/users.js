import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/search', authMiddleware, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json({ users: [] });
    const take = Math.min(parseInt(String(req.query.limit ?? '10'), 10) || 10, 25);

    const users = await prisma.user.findMany({
      where: {
        id: { not: req.userId },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, avatarUrl: true, email: true },
      take,
      orderBy: [{ name: 'asc' }],
    });

    res.json({ users });
  } catch (e) {
    next(e);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, avatarUrl: true, professionalTitle: true, bio: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

router.get('/me/reviews', authMiddleware, async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { userId: req.userId },
      include: { space: { select: { id: true, title: true, imageUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      reviews.map((r) => ({
        id: r.id,
        spaceId: r.space.id,
        spaceName: r.space.title,
        spaceImage: r.space.imageUrl,
        rating: r.rating,
        text: r.text,
        createdAt: r.createdAt,
        cleanliness: r.cleanliness,
        communication: r.communication,
        location: r.location,
        value: r.value,
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.patch('/me', authMiddleware, async (req, res, next) => {
  try {
    const { name, avatarUrl, professionalTitle, bio } = req.body;
    const data = {};
    if (name != null) data.name = name;
    if ('avatarUrl' in req.body) data.avatarUrl = avatarUrl === '' ? null : avatarUrl ?? null;
    if (professionalTitle !== undefined) data.professionalTitle = professionalTitle || null;
    if (bio !== undefined) data.bio = bio || null;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: { id: true, email: true, name: true, avatarUrl: true, professionalTitle: true, bio: true },
    });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

// Public host profile (used on space details page)
router.get('/:id/public', async (req, res, next) => {
  try {
    const id = String(req.params.id ?? '').trim();
    if (!id) return res.status(400).json({ error: 'Missing user id' });

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, avatarUrl: true, bio: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeBookings = await prisma.booking.count({
      where: {
        status: 'confirmed',
        space: { hostId: id },
      },
    });

    const spaces = await prisma.space.findMany({
      where: { hostId: id },
      select: { reviews: { select: { rating: true } } },
    });
    const perListingAverages = spaces
      .map((s) => (s.reviews.length ? s.reviews.reduce((sum, r) => sum + r.rating, 0) / s.reviews.length : null))
      .filter((v) => v != null);
    const avgListingRating =
      perListingAverages.length > 0
        ? Math.round((perListingAverages.reduce((sum, v) => sum + v, 0) / perListingAverages.length) * 100) / 100
        : null;

    res.json({
      user,
      hostStats: { activeBookings, avgListingRating },
    });
  } catch (e) {
    next(e);
  }
});

export const usersRouter = router;
