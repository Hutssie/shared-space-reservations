import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { spaceToResponse } from './spaces.js';
import { createNotification } from './notifications.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const startOfToday = () => new Date(new Date().toISOString().slice(0, 10));

router.use(authMiddleware);
router.use(requireAdmin);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function pagination(req) {
  const limit = Math.min(parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  return { limit, offset };
}

// GET /api/admin/users - listam utilizatorii (paginat, cautare optionala)
router.get('/users', async (req, res, next) => {
  try {
    const { limit, offset } = pagination(req);
    const q = String(req.query.q ?? '').trim();
    const where = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true, avatarUrl: true, role: true, bannedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/users/:id - un user + numarari
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        professionalTitle: true,
        bio: true,
        bannedAt: true,
        createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const [spacesCount, bookingsCount, reviewsCount] = await Promise.all([
      prisma.space.count({ where: { hostId: user.id } }),
      prisma.booking.count({ where: { userId: user.id } }),
      prisma.review.count({ where: { userId: user.id } }),
    ]);
    res.json({
      ...user,
      spacesCount,
      bookingsCount,
      reviewsCount,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/users/:id/ban - ban user
router.post('/users/:id/ban', async (req, res, next) => {
  try {
    const cancelledStatus = 'cancelled';
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, role: true, bannedAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot ban an admin' });
    if (user.bannedAt) return res.json({ id: user.id, bannedAt: user.bannedAt });

    const now = new Date();
    await prisma.user.update({
      where: { id: req.params.id },
      data: { bannedAt: now },
    });

    const hostSpaces = await prisma.space.findMany({
      where: { hostId: req.params.id },
      select: { id: true, title: true },
    });
    const hostSpaceIds = hostSpaces.map((s) => s.id);

    if (hostSpaceIds.length > 0) {
      await prisma.space.updateMany({
        where: { hostId: req.params.id },
        data: { status: 'suspended' },
      });

      const futureBookingsOnHostSpaces = await prisma.booking.findMany({
        where: {
          spaceId: { in: hostSpaceIds },
          status: { in: ['pending', 'confirmed'] },
          date: { gte: startOfToday() },
        },
        include: {
          user: { select: { id: true } },
          space: { select: { id: true, title: true } },
        },
      });

      for (const b of futureBookingsOnHostSpaces) {
        await prisma.booking.update({ where: { id: b.id }, data: { status: cancelledStatus } });
        const dateStr = b.date.toISOString().slice(0, 10);
        await createNotification(prisma, {
          userId: b.userId,
          type: "booking_cancelled",
          title: "Booking cancelled",
          message: "Your reservation has been cancelled because the host account was suspended. Contact support for more information.",
          data: { bookingId: b.id, spaceId: b.spaceId, spaceTitle: b.space.title, date: dateStr },
        });
      }
    }

    await prisma.review.deleteMany({ where: { userId: req.params.id } });

    const futureBookingsByUser = await prisma.booking.findMany({
      where: {
        userId: req.params.id,
        status: { in: ['pending', 'confirmed'] },
        date: { gte: startOfToday() },
      },
      include: {
        space: { select: { id: true, title: true, hostId: true } },
      },
    });

    for (const b of futureBookingsByUser) {
      await prisma.booking.update({ where: { id: b.id }, data: { status: cancelledStatus } });
      const dateStr = b.date.toISOString().slice(0, 10);
      await createNotification(prisma, {
        userId: b.space.hostId,
        type: 'booking_cancelled',
        title: 'Booking cancelled',
        message: "A guest reservation at your space \"" + b.space.title + "\" has been cancelled because the guest account was suspended.",
        data: { bookingId: b.id, spaceId: b.spaceId, spaceTitle: b.space.title, date: dateStr, guestName: user.name },
      });
    }

    const updated = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, bannedAt: true, createdAt: true },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/users/:id/unban - scoate ban ul
router.post('/users/:id/unban', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, bannedAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await prisma.user.update({
      where: { id: req.params.id },
      data: { bannedAt: null },
    });
    const updated = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, bannedAt: true, createdAt: true },
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    next(e);
  }
});

// GET /api/admin/spaces - listam toate spatiiile (orice status), filtre optionale
router.get('/spaces', async (req, res, next) => {
  try {
    const { limit, offset } = pagination(req);
    const status = req.query.status ? String(req.query.status) : undefined;
    const hostId = req.query.hostId ? String(req.query.hostId) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const q = req.query.q != null ? String(req.query.q).trim() : undefined;
    const where = {};
    if (status) where.status = status;
    if (hostId) where.hostId = hostId;
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (q) where.title = { contains: q, mode: 'insensitive' };

    const [spaces, total] = await Promise.all([
      prisma.space.findMany({
        where,
        include: {
          host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
          reviews: { select: { rating: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.space.count({ where }),
    ]);
    res.json({
      spaces: spaces.map((s) => ({ ...spaceToResponse(s), status: s.status })),
      total,
      limit,
      offset,
    });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/admin/spaces/:id - schimb doar statusul spatiului
router.patch('/spaces/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'inactive', 'maintenance', 'suspended'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    const space = await prisma.space.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
        reviews: { select: { rating: true } },
      },
    });
    if (status === 'suspended') {
      await createNotification(prisma, {
        userId: space.hostId,
        type: 'space_suspended',
        title: 'Space suspended',
        message: `Your space "${space.title}" has been suspended by the platform. Contact support for more information.`,
        data: { spaceId: space.id, spaceTitle: space.title },
      });
    }
    res.json({ ...spaceToResponse(space), status: space.status });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Space not found' });
    next(e);
  }
});

// GET /api/admin/bookings - listam toate rezervarile (paginat)
router.get('/bookings', async (req, res, next) => {
  try {
    const { limit, offset } = pagination(req);
    const status = req.query.status ? String(req.query.status) : undefined;
    const spaceId = req.query.spaceId ? String(req.query.spaceId) : undefined;
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const where = {};
    if (status) where.status = status;
    if (spaceId) where.spaceId = spaceId;
    if (userId) where.userId = userId;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          space: { select: { id: true, title: true, location: true, hostId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.booking.count({ where }),
    ]);
    const list = bookings.map((b) => ({
      id: b.id,
      userId: b.userId,
      user: b.user,
      spaceId: b.spaceId,
      space: b.space,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      totalPrice: Number(b.totalPrice),
      createdAt: b.createdAt,
    }));
    res.json({ bookings: list, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/reviews - listam recenzii recente (paginat)
router.get('/reviews', async (req, res, next) => {
  try {
    const { limit, offset } = pagination(req);
    const spaceId = req.query.spaceId ? String(req.query.spaceId) : undefined;
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const where = {};
    if (spaceId) where.spaceId = spaceId;
    if (userId) where.userId = userId;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          space: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.review.count({ where }),
    ]);
    const list = reviews.map((r) => ({
      id: r.id,
      spaceId: r.spaceId,
      space: r.space,
      userId: r.userId,
      user: r.user,
      rating: r.rating,
      text: r.text,
      cleanliness: r.cleanliness,
      communication: r.communication,
      location: r.location,
      value: r.value,
      createdAt: r.createdAt,
    }));
    res.json({ reviews: list, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/admin/reviews/:id - sterge recenzie
router.delete('/reviews/:id', async (req, res, next) => {
  try {
    await prisma.review.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Review not found' });
    next(e);
  }
});

// GET /api/admin/stats - statistici extinse ale platformei
router.get('/stats', async (req, res, next) => {
  try {
    const [
      usersCount,
      spacesCount,
      spacesActive,
      bookingsCount,
      bookingsConfirmed,
      bookingsPending,
      reviewsCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.space.count(),
      prisma.space.count({ where: { status: 'active' } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'confirmed' } }),
      prisma.booking.count({ where: { status: 'pending' } }),
      prisma.review.count(),
    ]);
    const locationsGroup = await prisma.space.groupBy({
      by: ['location'],
      where: { status: 'active' },
      _count: { id: true },
    });
    res.json({
      users: usersCount,
      spaces: spacesCount,
      spacesActive,
      bookings: bookingsCount,
      bookingsConfirmed,
      bookingsPending,
      reviews: reviewsCount,
      cities: locationsGroup.length,
    });
  } catch (e) {
    next(e);
  }
});

export const adminRouter = router;
