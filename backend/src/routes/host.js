import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { spaceToResponse } from './spaces.js';
import { isBookingStartInPast } from './bookings.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const TIME_SLOTS = [
  '12:00 AM', '01:00 AM', '02:00 AM', '03:00 AM', '04:00 AM', '05:00 AM', '06:00 AM', '07:00 AM',
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
  '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
];

router.get('/settings', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { availabilityStartTime: true, availabilityEndTime: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      availabilityStartTime: user.availabilityStartTime ?? null,
      availabilityEndTime: user.availabilityEndTime ?? null,
    });
  } catch (e) {
    next(e);
  }
});

router.patch('/settings', authMiddleware, async (req, res, next) => {
  try {
    const { availabilityStartTime, availabilityEndTime } = req.body;
    const data = {};
    if (availabilityStartTime !== undefined) {
      if (availabilityStartTime !== null && !TIME_SLOTS.includes(availabilityStartTime)) {
        return res.status(400).json({ error: 'Invalid availabilityStartTime' });
      }
      data.availabilityStartTime = availabilityStartTime ?? null;
    }
    if (availabilityEndTime !== undefined) {
      if (availabilityEndTime !== null && !TIME_SLOTS.includes(availabilityEndTime)) {
        return res.status(400).json({ error: 'Invalid availabilityEndTime' });
      }
      data.availabilityEndTime = availabilityEndTime ?? null;
    }
    if (Object.keys(data).length === 0) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { availabilityStartTime: true, availabilityEndTime: true },
      });
      return res.json({
        availabilityStartTime: user?.availabilityStartTime ?? null,
        availabilityEndTime: user?.availabilityEndTime ?? null,
      });
    }
    const current = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { availabilityStartTime: true, availabilityEndTime: true },
    });
    const startVal = data.availabilityStartTime !== undefined ? data.availabilityStartTime : current?.availabilityStartTime;
    const endVal = data.availabilityEndTime !== undefined ? data.availabilityEndTime : current?.availabilityEndTime;
    if (startVal != null && endVal != null) {
      const startIdx = TIME_SLOTS.indexOf(startVal);
      const endIdx = TIME_SLOTS.indexOf(endVal);
      if (startIdx === -1 || endIdx === -1) {
        return res.status(400).json({ error: 'Invalid time format' });
      }
      const valid = endIdx > startIdx || (endIdx === 0 && startIdx > 0);
      if (!valid) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }
    }
    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: { availabilityStartTime: true, availabilityEndTime: true },
    });
    res.json({
      availabilityStartTime: user.availabilityStartTime ?? null,
      availabilityEndTime: user.availabilityEndTime ?? null,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/spaces', authMiddleware, async (req, res, next) => {
  try {
    const [spaces, confirmedBookings, nonCancelledCounts, unseenBookings] = await Promise.all([
      prisma.space.findMany({
        where: { hostId: req.userId },
        orderBy: [{ title: 'asc' }],
        include: {
          host: { select: { name: true, avatarUrl: true, createdAt: true } },
          reviews: { select: { rating: true } },
        },
      }),
      prisma.booking.findMany({
        where: { space: { hostId: req.userId }, status: 'confirmed' },
        select: { totalPrice: true, spaceId: true },
      }),
      prisma.booking.groupBy({
        by: ['spaceId'],
        _count: { id: true },
        where: { space: { hostId: req.userId }, status: { not: 'cancelled' } },
      }),
      prisma.booking.findMany({
        where: { space: { hostId: req.userId }, status: { not: 'cancelled' } },
        select: { spaceId: true, createdAt: true },
      }),
    ]);
    const revenueBySpace = {};
    for (const b of confirmedBookings) {
      revenueBySpace[b.spaceId] = (revenueBySpace[b.spaceId] || 0) + Number(b.totalPrice);
    }
    const countBySpace = Object.fromEntries(nonCancelledCounts.map((c) => [c.spaceId, c._count.id]));
    const epoch = new Date(0);
    const unseenBySpace = {};
    for (const b of unseenBookings) {
      const space = spaces.find((s) => s.id === b.spaceId);
      const cutoff = space?.hostLastSeenBookingsAt ?? epoch;
      if (b.createdAt > cutoff) {
        unseenBySpace[b.spaceId] = (unseenBySpace[b.spaceId] || 0) + 1;
      }
    }
    const statusDisplay = (s) => {
      const v = s.status ?? 'active';
      return v === 'active' ? 'Active' : v === 'maintenance' ? 'Maintenance' : 'Inactive';
    };
    const list = spaces.map((s) => ({
      ...spaceToResponse(s),
      bookings: countBySpace[s.id] ?? 0,
      revenue: revenueBySpace[s.id] || 0,
      status: statusDisplay(s),
      unseenBookingsCount: unseenBySpace[s.id] ?? 0,
    }));
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.get('/bookings', authMiddleware, async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { space: { hostId: req.userId } },
      include: {
        space: { select: { id: true, title: true, imageUrl: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });
    res.json(
      bookings.map((b) => ({
        id: b.id,
        spaceId: b.spaceId,
        space: b.space.title,
        image: b.space.imageUrl,
        guest: b.user.name,
        guestId: b.user.id,
        date: b.date.toISOString().slice(0, 10),
        time: `${b.startTime} - ${b.endTime}`,
        status: b.status,
        totalPrice: Number(b.totalPrice),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/guests/:guestId/profile', authMiddleware, async (req, res, next) => {
  try {
    const { guestId } = req.params;
    const hostId = req.userId;

    const guest = await prisma.user.findUnique({
      where: { id: guestId },
      select: { id: true, name: true, email: true, avatarUrl: true, bio: true },
    });
    if (!guest) return res.status(404).json({ error: 'Guest not found' });

    const [reviewCount, reviewAvg, bookingsWithHost, reviewsForHost] = await Promise.all([
      prisma.review.count({ where: { userId: guestId } }),
      prisma.review.aggregate({ where: { userId: guestId }, _avg: { rating: true } }),
      prisma.booking.findMany({
        where: { userId: guestId, space: { hostId } },
        select: { totalPrice: true, status: true },
      }),
      prisma.review.findMany({
        where: { userId: guestId, space: { hostId } },
        select: { rating: true },
      }),
    ]);

    const totalSpent = bookingsWithHost
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);
    const totalBookings = bookingsWithHost.length;
    const avgRatingWithHost =
      reviewsForHost.length > 0
        ? reviewsForHost.reduce((s, r) => s + r.rating, 0) / reviewsForHost.length
        : null;

    res.json({
      guest: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        avatarUrl: guest.avatarUrl,
        bio: guest.bio,
      },
      reviewCount,
      avgRatingGiven: reviewAvg._avg?.rating ?? null,
      withHost: {
        totalBookings,
        totalSpent,
        avgRating: avgRatingWithHost,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/spaces/:spaceId/bookings/dates', authMiddleware, async (req, res, next) => {
  try {
    const { spaceId } = req.params;
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { hostId: true },
    });
    if (!space) return res.status(404).json({ error: 'Space not found' });
    if (space.hostId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const bookings = await prisma.booking.findMany({
      where: { spaceId, status: { not: 'cancelled' } },
      select: { date: true },
    });
    const dates = [...new Set(bookings.map((b) => b.date.toISOString().slice(0, 10)))];
    res.json({ dates });
  } catch (e) {
    next(e);
  }
});

router.get('/spaces/:spaceId/bookings', authMiddleware, async (req, res, next) => {
  try {
    const { spaceId } = req.params;
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true, hostId: true },
    });
    if (!space) return res.status(404).json({ error: 'Space not found' });
    if (space.hostId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const pendingForSpace = await prisma.booking.findMany({
      where: { spaceId, status: 'pending' },
      select: { id: true, date: true, startTime: true },
    });
    const expiredIds = pendingForSpace.filter((b) => isBookingStartInPast(b)).map((b) => b.id);
    if (expiredIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'cancelled' },
      });
    }

    const bookings = await prisma.booking.findMany({
      where: { spaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const guestIds = [...new Set(bookings.map((b) => b.user.id))];
    let guestStats = {};
    if (guestIds.length > 0) {
      const [counts, avgs] = await Promise.all([
        prisma.review.groupBy({
          by: ['userId'],
          _count: { id: true },
          where: { userId: { in: guestIds } },
        }),
        prisma.review.groupBy({
          by: ['userId'],
          _avg: { rating: true },
          where: { userId: { in: guestIds } },
        }),
      ]);
      guestStats = {};
      counts.forEach((c) => {
        guestStats[c.userId] = { reviewCount: c._count.id, avgRatingGiven: null };
      });
      avgs.forEach((a) => {
        if (guestStats[a.userId]) guestStats[a.userId].avgRatingGiven = a._avg?.rating ?? null;
      });
    }

    await prisma.space.update({
      where: { id: spaceId },
      data: { hostLastSeenBookingsAt: new Date() },
    });

    res.json(
      bookings.map((b) => {
        const stats = guestStats[b.user.id] || { reviewCount: 0, avgRatingGiven: null };
        return {
          id: b.id,
          spaceId: b.spaceId,
          date: b.date.toISOString().slice(0, 10),
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          totalPrice: Number(b.totalPrice),
          createdAt: b.createdAt,
          guest: {
            id: b.user.id,
            name: b.user.name,
            email: b.user.email,
            avatarUrl: b.user.avatarUrl,
            reviewCount: stats.reviewCount,
            avgRatingGiven: stats.avgRatingGiven,
          },
        };
      })
    );
  } catch (e) {
    next(e);
  }
});

export const hostRouter = router;
