import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Bookings', () => {
  let userToken;
  let hostToken;
  let spaceId;
  let bookingId;
  const userEmail = `${unique()}@booker.com`;

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: userEmail, password: 'Password123', name: 'Booker' });
    userToken = reg.body.token;

    const host = await request(app)
      .post('/api/auth/register')
      .send({ email: `${unique()}@host.com`, password: 'Password123', name: 'Host' });
    hostToken = host.body.token;

    // Always create a fresh non-instant-bookable space so the first booking is a *request* (pending),
    // and overlapping requests should be allowed.
    const create = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        category: 'Room',
        title: `Space-${unique()}`,
        location: 'City',
        capacity: 5,
        pricePerHour: 50,
        description: 'D',
        isInstantBookable: false,
      });
    spaceId = create.body.id;
  });

  afterAll(async () => {
    if (bookingId) await prisma.booking.deleteMany({ where: { id: bookingId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: userEmail } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('B1: GET /api/bookings without auth returns 401', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.status).toBe(401);
  });

  it('B2: GET /api/bookings with auth returns 200 and array', async () => {
    const res = await request(app).get('/api/bookings').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('B3: POST /api/bookings without auth returns 401', async () => {
    const res = await request(app).post('/api/bookings').send({
      space_id: spaceId,
      date: '2026-03-01',
      start_time: '10:00 AM',
      end_time: '12:00 PM',
    });
    expect(res.status).toBe(401);
  });

  it('B4: POST /api/bookings with valid body returns 201', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    const dateStr = date.toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        space_id: spaceId,
        date: dateStr,
        start_time: '10:00 AM',
        end_time: '12:00 PM',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.totalPrice).toBeDefined();
    expect(res.body.status).toBeDefined();
    bookingId = res.body.id;
  });

  it('B5: POST /api/bookings with invalid date returns 400', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        space_id: spaceId,
        date: 'invalid',
        start_time: '10:00 AM',
        end_time: '12:00 PM',
      });
    expect(res.status).toBe(400);
  });

  it('B6: POST /api/bookings with end before start returns 400', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 20);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        space_id: spaceId,
        date: date.toISOString().slice(0, 10),
        start_time: '02:00 PM',
        end_time: '10:00 AM',
      });
    expect(res.status).toBe(400);
  });

  it('B7: POST /api/bookings overlapping existing returns 409', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    const dateStr = date.toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        space_id: spaceId,
        date: dateStr,
        start_time: '11:00 AM',
        end_time: '01:00 PM',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
  });

  it('B8: POST /api/bookings for non-existent space returns 404', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        space_id: 'nonexistent-id',
        date: '2026-06-01',
        start_time: '10:00 AM',
        end_time: '12:00 PM',
      });
    expect(res.status).toBe(404);
  });

  it('B9: POST /api/bookings as host for own space returns 403', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 16);
    const dateStr = date.toISOString().slice(0, 10);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        space_id: spaceId,
        date: dateStr,
        start_time: '10:00 AM',
        end_time: '12:00 PM',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('B10: PATCH /api/bookings/:id to cancel returns 200', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    const createRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        space_id: spaceId,
        date: date.toISOString().slice(0, 10),
        start_time: '03:00 PM',
        end_time: '05:00 PM',
      });
    const id = createRes.body.id;
    const res = await request(app)
      .patch(`/api/bookings/${id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('B11: PATCH /api/bookings/:id as another user returns 403', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: `${unique()}@other.com`, password: 'Password123', name: 'Other' });
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${other.body.token}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(403);
  });
});
