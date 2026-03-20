import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { Decimal } from '@prisma/client/runtime/library';
import { createNotification } from './notifications.js';

const router = Router();
const prisma = new PrismaClient();

const CANCELLATION_NOTICE_HOURS = { flexible: 24, moderate: 48, strict: 168 };

function parseTimeToMinutes(t) {
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function isBookingStartInPast(booking) {
  const startM = parseTimeToMinutes(booking.startTime);
  const bookingStartMs = booking.date.getTime() + (startM != null ? startM : 0) * 60 * 1000;
  return bookingStartMs <= Date.now();
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
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });
    if (!space) return res.status(404).json({ error: 'Space not found' });
    if (space.status !== 'active') {
      return res.status(400).json({ error: 'This space is not currently available for booking' });
    }
    // Prevent hosts from booking their own listings.
    if (space.hostId && space.hostId === req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid date' });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const requestDate = new Date(d);
    requestDate.setUTCHours(0, 0, 0, 0);

    if (space.sameDayBookingAllowed === false) {
      if (requestDate.getTime() === today.getTime()) {
        return res.status(400).json({ error: 'Same-day booking is not allowed for this space' });
      }
    }

    if (space.maxAdvanceBookingDays != null) {
      const daysDiff = (requestDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
      if (daysDiff > space.maxAdvanceBookingDays) {
        return res.status(400).json({ error: 'Booking date is beyond the maximum advance booking window' });
      }
    }

    if (space.bannedDaysJson) {
      const bannedDays = JSON.parse(space.bannedDaysJson);
      if (Array.isArray(bannedDays) && bannedDays.length > 0) {
        const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = DAY_NAMES[requestDate.getDay()];
        if (bannedDays.includes(dayName)) {
          return res.status(400).json({ error: `This space is not available on ${dayName}s` });
        }
      }
    }

    if (space.blockedDatesJson) {
      const blockedDates = (() => {
        try {
          const a = JSON.parse(space.blockedDatesJson);
          return Array.isArray(a) ? a : [];
        } catch {
          return [];
        }
      })();
      const dateStr = requestDate.toISOString().slice(0, 10);
      for (const block of blockedDates) {
        const start = block.startDate || '';
        const end = block.endDate || block.startDate || '';
        if (dateStr >= start && dateStr <= end) {
          return res.status(400).json({ error: 'This date is not available for booking' });
        }
      }
    }

    const startM = parseTimeToMinutes(startTime);
    let endM = parseTimeToMinutes(endTime);
    if (startM == null || endM == null) {
      return res.status(400).json({ error: 'Invalid time range' });
    }
    if (endM <= startM) {
      // Treat midnight as next-day when it would otherwise wrap (including full-day 12 AM -> 12 AM).
      if (endTime === '12:00 AM') {
        endM = 24 * 60;
      } else {
        return res.status(400).json({ error: 'Invalid time range' });
      }
    }

    const windowStart = space.availabilityStartTime ?? null;
    const windowEnd = space.availabilityEndTime ?? null;
    if (windowStart != null && windowEnd != null) {
      const wStartM = parseTimeToMinutes(windowStart);
      let wEndM = parseTimeToMinutes(windowEnd);
      if (wEndM === 0) wEndM = 24 * 60;
      if (wStartM == null || wEndM == null) {
        return res.status(400).json({ error: 'Space availability window is invalid' });
      }
      const inWindow = startM >= wStartM && endM <= wEndM;
      if (!inWindow) {
        return res.status(400).json({ error: 'Requested time is outside the space\'s availability window' });
      }
    }

    const hours = (endM - startM) / 60;
    if (space.minDurationHours != null && hours < space.minDurationHours) {
      return res.status(400).json({ error: `Minimum booking duration is ${space.minDurationHours} hours` });
    }
    if (space.maxDurationHours != null && hours > space.maxDurationHours) {
      return res.status(400).json({ error: `Maximum booking duration is ${space.maxDurationHours} hours` });
    }

    const cleaningCents = space.cleaningFeeCents ?? 0;
    const equipmentCents = space.equipmentFeeCents ?? 0;
    const totalPrice = Number(space.pricePerHour) * hours + cleaningCents / 100 + equipmentCents / 100;

    const existing = await prisma.booking.findMany({
      // Allow overlapping *requests* (pending). Only confirmed bookings block a slot.
      where: { spaceId, date: d, status: 'confirmed' },
    });
    const overlaps = existing.some((b) => {
      const bStart = parseTimeToMinutes(b.startTime);
      let bEnd = parseTimeToMinutes(b.endTime);
      if (bEnd === 0) bEnd = 24 * 60;
      return startM < bEnd && endM > bStart;
    });
    if (overlaps) {
      return res.status(409).json({ error: 'Time slot is already booked' });
    }

    const booking = await prisma.booking.create({
      data: {
        userId: req.userId,
        spaceId,
        date: d,
        startTime,
        endTime,
        status: space.isInstantBookable ? 'confirmed' : 'pending',
        totalPrice: new Decimal(totalPrice),
        cleaningFeeCents: cleaningCents,
        equipmentFeeCents: equipmentCents,
      },
      include: { space: true },
    });

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
        const startM = parseTimeToMinutes(booking.startTime);
        let endM = parseTimeToMinutes(booking.endTime);
        if (endM === 0) endM = 24 * 60;
        const confirmed = await prisma.booking.findMany({
          where: {
            id: { not: booking.id },
            spaceId: booking.spaceId,
            date: booking.date,
            status: 'confirmed',
          },
          select: { startTime: true, endTime: true },
        });
        const overlaps = confirmed.some((b) => {
          const bStart = parseTimeToMinutes(b.startTime);
          let bEnd = parseTimeToMinutes(b.endTime);
          if (bEnd === 0) bEnd = 24 * 60;
          return (startM ?? 0) < bEnd && (endM ?? 0) > bStart;
        });
        if (overlaps) {
          return res.status(409).json({ error: 'Time slot is already booked' });
        }
        await prisma.booking.update({
          where: { id: req.params.id },
          data: { status: 'confirmed' },
        });
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
    next(e);
  }
});

export const bookingsRouter = router;
export { isBookingStartInPast };
