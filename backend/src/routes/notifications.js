import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * Helper to create a notification. Use from bookings, messages, etc.
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @param {{ userId: string, type: string, title: string, message: string, data?: object }} params
 */
export async function createNotification(prismaClient, { userId, type, title, message, data }) {
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
