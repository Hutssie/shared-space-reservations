import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [spacesCount, hostsGroup, locationsGroup, creatorsCount] = await Promise.all([
      prisma.space.count({ where: { status: 'active' } }),
      prisma.space.groupBy({
        by: ['hostId'],
        where: { status: 'active' },
        _count: { id: true },
      }),
      prisma.space.groupBy({
        by: ['location'],
        where: { status: 'active' },
        _count: { id: true },
      }),
      prisma.user.count({
        where: {
          emailVerifiedAt: { not: null },
          bannedAt: null,
        },
      }),
    ]);

    const cities = locationsGroup.length;
    const hostsCount = hostsGroup.length;

    res.json({ spaces: spacesCount, cities, hosts: hostsCount, creators: creatorsCount });
  } catch (e) {
    next(e);
  }
});

export const statsRouter = router;
