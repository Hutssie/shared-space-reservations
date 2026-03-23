import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_NOTIFICATION_PREFS = {
  bookingUpdatesEnabled: true,
  hostBookingUpdatesEnabled: true,
  messageAlertsEnabled: true,
  systemNotificationsEnabled: true,
};

async function fetchNotificationPrefsRaw(prismaClient, userId) {
  try {
    const rows = await prismaClient.$queryRaw`
      SELECT
        booking_updates_enabled AS "bookingUpdatesEnabled",
        host_booking_updates_enabled AS "hostBookingUpdatesEnabled",
        message_alerts_enabled AS "messageAlertsEnabled",
        system_notifications_enabled AS "systemNotificationsEnabled"
      FROM "User"
      WHERE id = ${userId}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    return {
      bookingUpdatesEnabled: row?.bookingUpdatesEnabled ?? DEFAULT_NOTIFICATION_PREFS.bookingUpdatesEnabled,
      hostBookingUpdatesEnabled: row?.hostBookingUpdatesEnabled ?? DEFAULT_NOTIFICATION_PREFS.hostBookingUpdatesEnabled,
      messageAlertsEnabled: row?.messageAlertsEnabled ?? DEFAULT_NOTIFICATION_PREFS.messageAlertsEnabled,
      systemNotificationsEnabled: row?.systemNotificationsEnabled ?? DEFAULT_NOTIFICATION_PREFS.systemNotificationsEnabled,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

async function updateNotificationPrefsRaw(prismaClient, userId, prefs) {
  await prismaClient.$executeRaw`
    UPDATE "User"
    SET
      booking_updates_enabled = ${prefs.bookingUpdatesEnabled},
      host_booking_updates_enabled = ${prefs.hostBookingUpdatesEnabled},
      message_alerts_enabled = ${prefs.messageAlertsEnabled},
      system_notifications_enabled = ${prefs.systemNotificationsEnabled}
    WHERE id = ${userId}
  `;
}

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
      select: { id: true, email: true, name: true, avatarUrl: true, professionalTitle: true, bio: true, createdAt: true, role: true },
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
      select: { id: true, email: true, name: true, avatarUrl: true, professionalTitle: true, bio: true, role: true },
    });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

// GET pentru /api/users/me/notification-preferences
router.get('/me/notification-preferences', authMiddleware, async (req, res, next) => {
  try {
    const prefs = await fetchNotificationPrefsRaw(prisma, req.userId);
    res.json(prefs);
  } catch (e) {
    next(e);
  }
});

// PATCH pentru /api/users/me/notification-preferences
router.patch('/me/notification-preferences', authMiddleware, async (req, res, next) => {
  try {
    const current = await fetchNotificationPrefsRaw(prisma, req.userId);
    const {
      bookingUpdatesEnabled,
      hostBookingUpdatesEnabled,
      messageAlertsEnabled,
      systemNotificationsEnabled,
    } = req.body ?? {};

    const next = {
      bookingUpdatesEnabled: typeof bookingUpdatesEnabled === 'boolean' ? bookingUpdatesEnabled : current.bookingUpdatesEnabled,
      hostBookingUpdatesEnabled: typeof hostBookingUpdatesEnabled === 'boolean' ? hostBookingUpdatesEnabled : current.hostBookingUpdatesEnabled,
      messageAlertsEnabled: typeof messageAlertsEnabled === 'boolean' ? messageAlertsEnabled : current.messageAlertsEnabled,
      systemNotificationsEnabled: typeof systemNotificationsEnabled === 'boolean' ? systemNotificationsEnabled : current.systemNotificationsEnabled,
    };

    await updateNotificationPrefsRaw(prisma, req.userId, next);
    res.json(next);
  } catch (e) {
    next(e);
  }
});

// profil public de host folosit pe pagina de detalii a spatiului
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
