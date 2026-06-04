import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  parseTimeToMinutes,
  resolveBookingMinutes,
  isPostgresExclusionViolation,
  BOOKING_SLOT_CONFLICT_MESSAGE,
} from '../lib/bookingTime.js';
import { lockSpaceRow, validateBookingAgainstSpace } from '../lib/bookingRules.js';
import { createNotification } from './notifications.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const CANCELLATION_NOTICE_HOURS = { flexible: 24, moderate: 48, strict: 168 };

function isBookingStartInPast(booking) {
  const startM = parseTimeToMinutes(booking.startTime);
  const bookingStartMs = booking.date.getTime() + (startM != null ? startM : 0) * 60 * 1000;
  return bookingStartMs <= Date.now();
}

function bookingRequestDates(dateInput) {
  const d = new Date(dateInput);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const requestDate = new Date(d);
  requestDate.setUTCHours(0, 0, 0, 0);
  return { d, today, requestDate };
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const pendingForUser = await prisma.booking.findMany({
      where: { userId: req.userId, status: 'pending' },
      select: { id: true, date: true, startTime: true },
    });
    const expiredIds = pendingForUser.filter((b) => isBookingStartInPast(b)).map((b) => b.id);
    if (expiredIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'cancelled' },
      });
    }

    const bookings = await prisma.booking.findMany({
      where: { userId: req.userId },
      include: {
        space: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            pricePerHour: true,
            cancellationPolicy: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    const list = bookings.map((b) => ({
      id: b.id,
      space: b.space.title,
      spaceId: b.spaceId,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      endTime: b.endTime,
      time: `${b.startTime} - ${b.endTime}`,
      status: b.status,
      image: b.space.imageUrl,
      price: Number(b.totalPrice),
      cancellationPolicy: b.space.cancellationPolicy ?? null,
    }));
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { space: true },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({
      id: booking.id,
      spaceId: booking.spaceId,
      space: booking.space,
      date: booking.date.toISOString().slice(0, 10),
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      totalPrice: Number(booking.totalPrice),
      createdAt: booking.createdAt,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { space_id: spaceId, date, start_time: startTime, end_time: endTime } = req.body;
    if (!spaceId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'space_id, date, start_time, end_time required' });
    }

    const { d, today, requestDate } = bookingRequestDates(date);
    if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid date' });

    const txResult = await prisma.$transaction(async (tx) => {
      const space = await lockSpaceRow(tx, spaceId);
      const rules = validateBookingAgainstSpace(space, {
        bookerUserId: req.userId,
        startTime,
        endTime,
        requestDate,
        today,
      });
      if (!rules.ok) {
        return { clientError: rules.error, status: rules.status };
      }

      const booking = await tx.booking.create({
        data: {
          userId: req.userId,
          spaceId,
          date: d,
          startTime,
          endTime,
          startMinutes: rules.startMinutes,
          endMinutes: rules.endMinutes,
          status: space.isInstantBookable ? 'confirmed' : 'pending',
          totalPrice: rules.totalPrice,
          cleaningFeeCents: rules.cleaningCents,
          equipmentFeeCents: rules.equipmentCents,
        },
        include: { space: true },
      });

      return { booking, space };
    });

    if (txResult.clientError) {
      return res.status(txResult.status).json({ error: txResult.clientError });
    }

    const { booking, space } = txResult;
    const dateStr = booking.date.toISOString().slice(0, 10);
    if (booking.status === 'confirmed') {
      await createNotification(prisma, {
        userId: booking.userId,
        type: 'booking_confirmed',
        title: 'Booking Confirmed',
        message: `Your reservation at ${space.title} is confirmed for ${dateStr} at ${booking.startTime}.`,
        data: { bookingId: booking.id, spaceId, spaceTitle: space.title },
      });
      if (space.hostId && space.hostId !== booking.userId) {
        await createNotification(prisma, {
          userId: space.hostId,
          type: 'booking_confirmed',
          title: 'New Booking Confirmed',
          message: `A new booking for "${space.title}" was confirmed for ${dateStr} at ${booking.startTime}.`,
          data: { bookingId: booking.id, spaceId, spaceTitle: space.title, destination: 'host_space_bookings' },
        });
      }
    } else {
      await createNotification(prisma, {
        userId: booking.userId,
        type: 'booking_request',
        title: 'Booking Request Sent',
        message: `Your request for ${space.title} on ${dateStr} is pending host approval.`,
        data: { bookingId: booking.id, spaceId, spaceTitle: space.title },
      });
      await createNotification(prisma, {
        userId: space.hostId,
        type: 'booking_request',
        title: 'New Booking Request',
        message: `You have a new request for "${space.title}" for ${dateStr} at ${booking.startTime}.`,
        data: { bookingId: booking.id, spaceId, spaceTitle: space.title, destination: 'host_space_bookings' },
      });
    }

    res.status(201).json({
      id: booking.id,
      spaceId: booking.spaceId,
      date: booking.date.toISOString().slice(0, 10),
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      totalPrice: Number(booking.totalPrice),
    });
  } catch (e) {
    if (isPostgresExclusionViolation(e)) {
      return res.status(409).json({ error: BOOKING_SLOT_CONFLICT_MESSAGE });
    }
    next(e);
  }
});

router.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id },
      include: {
        space: { select: { hostId: true, cancellationPolicy: true, title: true } },
        user: { select: { name: true } },
      },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { status } = req.body;
    const isHost = booking.space.hostId === req.userId;
    const isBooker = booking.userId === req.userId;
    const spaceTitle = booking.space.title;
    const dateStr = booking.date.toISOString().slice(0, 10);

    if (isHost && (status === 'confirmed' || status === 'cancelled')) {
      if (status === 'cancelled') {
        await prisma.booking.update({
          where: { id: req.params.id },
          data: { status: 'cancelled' },
        });
        await createNotification(prisma, {
          userId: booking.userId,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: `Your reservation at ${spaceTitle} for ${dateStr} was cancelled by the host.`,
          data: { bookingId: booking.id, spaceId: booking.spaceId, spaceTitle },
        });
        return res.json({ id: booking.id, status: 'cancelled' });
      }
      if (status === 'confirmed') {
        if (isBookingStartInPast(booking)) {
          return res.status(400).json({ error: 'Cannot confirm a booking that has already passed.' });
        }

        const { today, requestDate } = bookingRequestDates(booking.date);

        try {
          await prisma.$transaction(async (tx) => {
            const space = await lockSpaceRow(tx, booking.spaceId);
            const rules = validateBookingAgainstSpace(space, {
              bookerUserId: booking.userId,
              startTime: booking.startTime,
              endTime: booking.endTime,
              requestDate,
              today,
              skipHostSelfCheck: true,
            });
            if (!rules.ok) {
              const err = new Error(rules.error);
              err.status = rules.status;
              throw err;
            }

            let { startMinutes, endMinutes } = booking;
            if (startMinutes == null || endMinutes == null) {
              startMinutes = rules.startMinutes;
              endMinutes = rules.endMinutes;
            }

            await tx.booking.update({
              where: { id: req.params.id },
              data: { status: 'confirmed', startMinutes, endMinutes },
            });
          });
        } catch (e) {
          if (e.status && e.message) {
            return res.status(e.status).json({ error: e.message });
          }
          if (isPostgresExclusionViolation(e)) {
            return res.status(409).json({ error: BOOKING_SLOT_CONFLICT_MESSAGE });
          }
          throw e;
        }

        await createNotification(prisma, {
          userId: booking.userId,
          type: 'booking_confirmed',
          title: 'Booking Confirmed',
          message: `Your reservation at ${spaceTitle} is confirmed for ${dateStr} at ${booking.startTime}.`,
          data: { bookingId: booking.id, spaceId: booking.spaceId, spaceTitle },
        });
        return res.json({ id: booking.id, status: 'confirmed' });
      }
    }

    if (isBooker && status === 'cancelled') {
      const policy = booking.space.cancellationPolicy ?? 'flexible';
      const noticeHours = CANCELLATION_NOTICE_HOURS[policy] ?? 24;
      const startM = parseTimeToMinutes(booking.startTime);
      const bookingStartMs = booking.date.getTime() + (startM != null ? startM : 0) * 60 * 1000;
      const now = Date.now();
      if (now + noticeHours * 60 * 60 * 1000 > bookingStartMs) {
        const noticeText = noticeHours >= 24
          ? `${noticeHours / 24} day(s)`
          : `${noticeHours} hour(s)`;
        return res.status(400).json({
          error: `Cancellation is not allowed. This booking requires ${noticeText} notice.`,
        });
      }
      await prisma.booking.update({
        where: { id: req.params.id },
        data: { status: 'cancelled' },
      });
      await createNotification(prisma, {
        userId: booking.space.hostId,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `${booking.user?.name ?? 'A guest'}'s reservation for "${spaceTitle}" on ${dateStr} was cancelled.`,
        data: { bookingId: booking.id, spaceId: booking.spaceId, spaceTitle, destination: 'host_space_bookings' },
      });
      return res.json({ id: booking.id, status: 'cancelled' });
    }

    res.status(403).json({ error: 'Forbidden' });
  } catch (e) {
    if (isPostgresExclusionViolation(e)) {
      return res.status(409).json({ error: BOOKING_SLOT_CONFLICT_MESSAGE });
    }
    next(e);
  }
});

export const bookingsRouter = router;
export { isBookingStartInPast };
