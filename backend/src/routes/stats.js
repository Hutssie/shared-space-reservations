import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    // "users" here represents hosts: distinct users who have at least one active space.
    const [spacesCount, hostsGroup, locationsGroup] = await Promise.all([
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
    ]);

    const cities = locationsGroup.length;
    const usersCount = hostsGroup.length;

    res.json({ spaces: spacesCount, users: usersCount, cities });
  } catch (e) {
    next(e);
  }
});

export const statsRouter = router;
