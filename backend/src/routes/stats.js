import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const [spacesCount, usersCount, locationsGroup] = await Promise.all([
      prisma.space.count({ where: { status: 'active' } }),
      prisma.user.count(),
      prisma.space.groupBy({
        by: ['location'],
        where: { status: 'active' },
        _count: { id: true },
      }),
    ]);

    const cities = locationsGroup.length;

    res.json({ spaces: spacesCount, users: usersCount, cities });
  } catch (e) {
    next(e);
  }
});

export const statsRouter = router;
