import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { lockSpaceRow, validateBookingAgainstSpace } from '../lib/bookingRules.js';
import { requireStripe } from '../lib/stripe.js';
import {
  getOrCreateStripeCustomer,
  paymentBreakdownFromRules,
} from '../lib/paymentHelpers.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

function bookingRequestDates(dateInput) {
  const d = new Date(dateInput);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const requestDate = new Date(d);
  requestDate.setUTCHours(0, 0, 0, 0);
  return { d, today, requestDate };
}

const RESUMABLE_PAYMENT_INTENT_STATUSES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'requires_capture',
]);

function paymentIntentPayload({
  rules,
  customerId,
  captureMethod,
  isInstant,
  spaceId,
  dateStr,
  startTime,
  endTime,
  userId,
}) {
  return {
    amount: rules.totalCents,
    currency: 'usd',
    customer: customerId,
    capture_method: captureMethod,
    payment_method_types: ['card'],
    metadata: {
      userId,
      spaceId,
      date: dateStr,
      startTime,
      endTime,
      isInstantBookable: String(isInstant),
    },
  };
}

async function persistPaymentRecord({
  paymentIntent,
  userId,
  spaceId,
  rules,
  captureMethod,
  date,
  startTime,
  endTime,
}) {
  return prisma.payment.upsert({
    where: { stripePaymentIntentId: paymentIntent.id },
    create: {
      userId,
      spaceId,
      stripePaymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amountCents: rules.totalCents,
      captureMethod,
      date,
      startTime,
      endTime,
    },
    update: {
      status: paymentIntent.status,
      amountCents: rules.totalCents,
      captureMethod,
    },
  });
}

router.post('/create-intent', authMiddleware, async (req, res, next) => {
  try {
    const stripe = requireStripe();
    const { space_id: spaceId, date, start_time: startTime, end_time: endTime } = req.body;
    if (!spaceId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'space_id, date, start_time, end_time required' });
    }

    const { d, today, requestDate } = bookingRequestDates(date);
    if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid date' });

    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      include: { host: { select: { id: true } } },
    });
    const rules = validateBookingAgainstSpace(space, {
      bookerUserId: req.userId,
      startTime,
      endTime,
      requestDate,
      today,
    });
    if (!rules.ok) {
      return res.status(rules.status).json({ error: rules.error });
    }

    const isInstant = Boolean(space.isInstantBookable);
    const captureMethod = isInstant ? 'automatic' : 'manual';
    const customerId = await getOrCreateStripeCustomer(req.userId);
    const dateStr = requestDate.toISOString().slice(0, 10);
    const idempotencyBase = `pi-${req.userId}-${spaceId}-${dateStr}-${startTime}-${endTime}`;

    const existingPayment = await prisma.payment.findFirst({
      where: {
        userId: req.userId,
        spaceId,
        date: d,
        startTime,
        endTime,
        bookingId: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    let paymentIntent;

    if (existingPayment) {
      const existingIntent = await stripe.paymentIntents.retrieve(existingPayment.stripePaymentIntentId);
      const canResume =
        RESUMABLE_PAYMENT_INTENT_STATUSES.has(existingIntent.status) &&
        existingIntent.amount === rules.totalCents;

      if (canResume) {
        paymentIntent = existingIntent;
        await persistPaymentRecord({
          paymentIntent,
          userId: req.userId,
          spaceId,
          rules,
          captureMethod,
          date: d,
          startTime,
          endTime,
        });
      } else if (!['succeeded', 'canceled'].includes(existingIntent.status)) {
        try {
          await stripe.paymentIntents.cancel(existingIntent.id);
        } catch {
          // Ignore if Stripe already finalized this intent.
        }
      }
    }

    if (!paymentIntent) {
      const idempotencyKey = existingPayment ? `${idempotencyBase}-${Date.now()}` : idempotencyBase;
      paymentIntent = await stripe.paymentIntents.create(
        paymentIntentPayload({
          rules,
          customerId,
          captureMethod,
          isInstant,
          spaceId,
          dateStr,
          startTime,
          endTime,
          userId: req.userId,
        }),
        { idempotencyKey }
      );

      await persistPaymentRecord({
        paymentIntent,
        userId: req.userId,
        spaceId,
        rules,
        captureMethod,
        date: d,
        startTime,
        endTime,
      });
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentIntentStatus: paymentIntent.status,
      amountCents: rules.totalCents,
      captureMethod,
      isInstantBookable: isInstant,
      breakdown: paymentBreakdownFromRules(rules),
    });
  } catch (e) {
    next(e);
  }
});

export const paymentsRouter = router;
