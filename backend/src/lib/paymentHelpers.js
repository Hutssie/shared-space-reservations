import { requireStripe } from './stripe.js';
import { prisma } from './prisma.js';

const ACCEPTABLE_PI_STATUSES = {
  instant: new Set(['succeeded']),
  request: new Set(['requires_capture', 'succeeded']),
};

export async function getOrCreateStripeCustomer(userId) {
  const stripe = requireStripe();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

export function paymentBreakdownFromRules(rules) {
  return {
    subtotal: rules.subtotalCents / 100,
    cleaningFee: rules.cleaningCents / 100,
    equipmentFee: rules.equipmentCents / 100,
    serviceFee: rules.serviceFeeCents / 100,
    serviceFeePercent: rules.serviceFeePercent,
    total: rules.totalCents / 100,
  };
}

export async function verifyPaymentIntentForBooking({
  paymentIntentId,
  userId,
  spaceId,
  date,
  startTime,
  endTime,
  isInstantBookable,
  expectedAmountCents,
}) {
  const stripe = requireStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const allowedStatuses = isInstantBookable
    ? ACCEPTABLE_PI_STATUSES.instant
    : ACCEPTABLE_PI_STATUSES.request;

  if (pi.metadata?.userId !== userId) {
    const err = new Error('Payment does not belong to this user');
    err.status = 403;
    throw err;
  }
  if (pi.metadata?.spaceId !== spaceId) {
    const err = new Error('Payment does not match this space');
    err.status = 400;
    throw err;
  }
  if (pi.metadata?.date !== date) {
    const err = new Error('Payment does not match this date');
    err.status = 400;
    throw err;
  }
  if (pi.metadata?.startTime !== startTime || pi.metadata?.endTime !== endTime) {
    const err = new Error('Payment does not match the selected time slot');
    err.status = 400;
    throw err;
  }
  if (pi.amount !== expectedAmountCents) {
    const err = new Error('Payment amount does not match booking total');
    err.status = 400;
    throw err;
  }
  if (!allowedStatuses.has(pi.status)) {
    const err = new Error(`Payment is not complete (status: ${pi.status})`);
    err.status = 402;
    throw err;
  }

  return pi;
}

export async function syncPaymentRecord(paymentIntentId, status) {
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntentId },
    data: { status },
  });
}

export async function captureBookingPayment(bookingId) {
  const stripe = requireStripe();
  const payment = await prisma.payment.findFirst({
    where: { bookingId },
  });
  if (!payment) return null;
  if (payment.status === 'succeeded') return payment;

  const pi = await stripe.paymentIntents.capture(payment.stripePaymentIntentId);
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: pi.status },
  });
  return pi;
}

export async function cancelBookingPayment(bookingId) {
  const stripe = requireStripe();
  const payment = await prisma.payment.findFirst({
    where: { bookingId },
  });
  if (!payment) return null;
  if (payment.status === 'canceled') return payment;

  const pi = await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: pi.status },
  });
  return pi;
}
