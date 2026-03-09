import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

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

export const usersRouter = router;
