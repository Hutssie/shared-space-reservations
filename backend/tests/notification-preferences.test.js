import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createNotification } from '../src/routes/notifications.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/index.js';

const prisma = new PrismaClient();

function unique() {
  return `np-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function setUserPrefs(userId, prefs) {
  const {
    bookingUpdatesEnabled = true,
    hostBookingUpdatesEnabled = true,
    messageAlertsEnabled = true,
    systemNotificationsEnabled = true,
  } = prefs ?? {};

  await prisma.$executeRaw`
    UPDATE "User"
    SET
      booking_updates_enabled = ${bookingUpdatesEnabled},
      host_booking_updates_enabled = ${hostBookingUpdatesEnabled},
      message_alerts_enabled = ${messageAlertsEnabled},
      system_notifications_enabled = ${systemNotificationsEnabled}
    WHERE id = ${userId}
  `;
}

async function countUserNotifications(userId) {
  return prisma.notification.count({ where: { userId } });
}

describe('Notification Preferences', () => {
  let userId;
  let email;
  const password = 'Password123';

  beforeAll(async () => {
    email = `${unique()}@test.com`;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Pref Test User',
        role: 'user',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.notification.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('blocks password-change notifications when System Notifications is OFF', async () => {
    await prisma.notification.deleteMany({ where: { userId } });
    await setUserPrefs(userId, { systemNotificationsEnabled: false });

    await createNotification(prisma, {
      userId,
      type: 'security_password_changed',
      title: 'Password changed',
      message: 'Your password has changed successfully.',
    });

    expect(await countUserNotifications(userId)).toBe(0);

    await setUserPrefs(userId, { systemNotificationsEnabled: true });
    await createNotification(prisma, {
      userId,
      type: 'security_password_changed',
      title: 'Password changed',
      message: 'Your password has changed successfully.',
    });
    expect(await countUserNotifications(userId)).toBe(1);
  });

  it('GET/PATCH /api/users/me/notification-preferences works with auth', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(loginRes.status).toBe(200);

    const token = loginRes.body.token;
    const headers = { Authorization: `Bearer ${token}` };

    const getRes = await request(app).get('/api/users/me/notification-preferences').set(headers);
    expect(getRes.status).toBe(200);
    expect(getRes.body.systemNotificationsEnabled).toBe(true);

    const patchRes = await request(app)
      .patch('/api/users/me/notification-preferences')
      .set(headers)
      .send({ systemNotificationsEnabled: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.systemNotificationsEnabled).toBe(false);

    const getRes2 = await request(app).get('/api/users/me/notification-preferences').set(headers);
    expect(getRes2.status).toBe(200);
    expect(getRes2.body.systemNotificationsEnabled).toBe(false);
  });

  it('blocks guest booking updates when Booking Updates is OFF', async () => {
    await prisma.notification.deleteMany({ where: { userId } });
    await setUserPrefs(userId, { bookingUpdatesEnabled: false, hostBookingUpdatesEnabled: true });

    await createNotification(prisma, {
      userId,
      type: 'booking_confirmed',
      title: 'Booking Confirmed',
      message: 'Reservation confirmed.',
      data: { spaceTitle: 'Space A' },
    });

    expect(await countUserNotifications(userId)).toBe(0);
  });

  it('blocks host booking updates when Host Booking Updates is OFF', async () => {
    await prisma.notification.deleteMany({ where: { userId } });
    await setUserPrefs(userId, { bookingUpdatesEnabled: true, hostBookingUpdatesEnabled: false });

    await createNotification(prisma, {
      userId,
      type: 'booking_confirmed',
      title: 'New Booking Confirmed',
      message: 'You have a new confirmed booking.',
      data: { destination: 'host_space_bookings', spaceTitle: 'Space A' },
    });

    expect(await countUserNotifications(userId)).toBe(0);
  });

  it('blocks message notifications when Message Alerts is OFF', async () => {
    await prisma.notification.deleteMany({ where: { userId } });
    await setUserPrefs(userId, { messageAlertsEnabled: false });

    await createNotification(prisma, {
      userId,
      type: 'message_received',
      title: 'New Message',
      message: 'Sender: "hello"',
      data: { threadId: 't1' },
    });

    expect(await countUserNotifications(userId)).toBe(0);
  });
});

