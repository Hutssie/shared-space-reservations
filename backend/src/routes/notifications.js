import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * helper ca sa creezi o notificare. folosire din bookings, messages, etc.
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @param {{ userId: string, type: string, title: string, message: string, data?: object }} params
 */
export async function createNotification(prismaClient, { userId, type, title, message, data }) {
  const DEFAULT_NOTIFICATION_PREFS = {
    bookingUpdatesEnabled: true,
    hostBookingUpdatesEnabled: true,
    messageAlertsEnabled: true,
    systemNotificationsEnabled: true,
  };

  async function fetchNotificationPrefsRaw() {
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

  const prefs = await fetchNotificationPrefsRaw();
  const destination = data?.destination;

  // decide ce toggle al userului controleaza tipul asta de notificare.
  let enabled = true;
  if (type?.startsWith('booking_')) {
    enabled = destination === 'host_space_bookings' ? prefs.hostBookingUpdatesEnabled : prefs.bookingUpdatesEnabled;
  } else if (type === 'message_received' || type?.startsWith('message_')) {
    enabled = prefs.messageAlertsEnabled;
  } else if (type === 'system' || type?.startsWith('security')) {
    // flow-urile de reset/schimbare parola folosesc tipul de notificare `security_password_changed`,
    // trebuie controlat doar de toggle-ul pentru „System Notifications”.
    enabled = prefs.systemNotificationsEnabled;
  } else {
    // tipurile necunoscute de notificari le tratez ca „System Notifications”.
    enabled = prefs.systemNotificationsEnabled;
  }

  if (!enabled) return { skipped: true };

  const dataJson = data != null ? JSON.stringify(data) : null;
  return prismaClient.notification.create({
    data: { userId, type, title, message, dataJson },
  });
}

router.get('/unread-count', authMiddleware, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.userId, readAt: null },
    });
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const cursor = req.query.cursor || undefined;
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = notifications.length > limit;
    const list = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? list[list.length - 1].id : null;
    res.json({
      notifications: list.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.dataJson ? JSON.parse(n.dataJson) : null,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      nextCursor,
    });
  } catch (e) {
    next(e);
  }
});

router.patch('/read-all', authMiddleware, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/read', authMiddleware, async (req, res, next) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
    });
    res.json({ id: notification.id, readAt: new Date().toISOString() });
  } catch (e) {
    next(e);
  }
});

export const notificationsRouter = router;
