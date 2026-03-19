import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Spaces', () => {
  let hostToken;
  let hostId;
  let spaceId;
  let otherUserToken;
  const hostEmail = `${unique()}@host.com`;

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: hostEmail, password: 'Password123', name: 'Host User' });
    hostToken = reg.body.token;
    hostId = reg.body.user.id;

    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: `${unique()}@other.com`, password: 'Password123', name: 'Other' });
    otherUserToken = other.body.token;

    const createRes = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        category: 'Conference Room',
        title: 'Test Space',
        location: 'Test City',
        capacity: 10,
        pricePerHour: 100,
        description: 'A test space',
      });
    spaceId = createRes.body.id;
  });

  afterAll(async () => {
    if (spaceId) await prisma.space.deleteMany({ where: { id: spaceId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: hostEmail } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('S1: GET /api/spaces without auth returns 200 and array', async () => {
    const res = await request(app).get('/api/spaces');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('spaces');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.spaces)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('S2: GET /api/spaces?q=studio returns filtered list', async () => {
    const res = await request(app).get('/api/spaces?q=studio');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.spaces)).toBe(true);
  });

  it('S3: GET /api/spaces?category=Conference Room returns matching', async () => {
    const res = await request(app).get('/api/spaces?category=Conference%20Room');
    expect(res.status).toBe(200);
    res.body.spaces.forEach((s) => expect(s.category).toBe('Conference Room'));
  });

  it('S4: GET /api/spaces?minPrice=50&maxPrice=150 returns in range', async () => {
    const res = await request(app).get('/api/spaces?minPrice=50&maxPrice=150');
    expect(res.status).toBe(200);
    res.body.spaces.forEach((s) => {
      expect(s.price).toBeGreaterThanOrEqual(50);
      expect(s.price).toBeLessThanOrEqual(150);
    });
  });

  it('S4b: GET /api/spaces/category-pricing returns 200 and stats per category', async () => {
    const res = await request(app).get('/api/spaces/category-pricing');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.any(Object));
    for (const [category, stats] of Object.entries(res.body)) {
      expect(typeof category).toBe('string');
      expect(stats).toMatchObject({
        avgPrice: expect.any(Number),
        minPrice: expect.any(Number),
        maxPrice: expect.any(Number),
        count: expect.any(Number),
      });
      expect(stats.count).toBeGreaterThanOrEqual(0);
    }
    expect(res.body['Conference Room']).toBeDefined();
    expect(res.body['Conference Room'].count).toBeGreaterThanOrEqual(1);
    expect(res.body['Conference Room'].avgPrice).toBeGreaterThanOrEqual(0);
    expect(res.body['Conference Room'].minPrice).toBeGreaterThanOrEqual(0);
    expect(res.body['Conference Room'].maxPrice).toBeGreaterThanOrEqual(res.body['Conference Room'].minPrice);
  });

  it('S5: GET /api/spaces/:id with valid id returns 200 and space', async () => {
    const res = await request(app).get(`/api/spaces/${spaceId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(spaceId);
    expect(res.body.title).toBeDefined();
    expect(res.body.host).toBeDefined();
  });

  it('S6: GET /api/spaces/:id with invalid id returns 404', async () => {
    const res = await request(app).get('/api/spaces/nonexistent-id-12345');
    expect(res.status).toBe(404);
  });

  it('S7: GET /api/spaces/:id/availability?date= returns 200 with slots and booked', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    const dateStr = date.toISOString().slice(0, 10);
    const res = await request(app).get(`/api/spaces/${spaceId}/availability?date=${dateStr}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('slots');
    expect(res.body).toHaveProperty('booked');
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  it('S8: GET /api/spaces/:id/availability without date returns 400', async () => {
    const res = await request(app).get(`/api/spaces/${spaceId}/availability`);
    expect(res.status).toBe(400);
  });

  it('S9: GET /api/spaces/:id/reviews returns 200 and array', async () => {
    const res = await request(app).get(`/api/spaces/${spaceId}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reviews');
    expect(Array.isArray(res.body.reviews)).toBe(true);
  });

  it('S10: POST /api/spaces without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/spaces')
      .send({ category: 'Room', title: 'T', location: 'L', capacity: 5, pricePerHour: 50, description: 'D' });
    expect(res.status).toBe(401);
  });

  it('S11: POST /api/spaces with auth and valid body returns 201', async () => {
    const res = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        category: 'Lab',
        title: 'New Space',
        location: 'City',
        capacity: 8,
        pricePerHour: 80,
        description: 'Description',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('New Space');
    await prisma.space.delete({ where: { id: res.body.id } }).catch(() => {});
  });

  it('S12: POST /api/spaces with missing required field returns 400', async () => {
    const res = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ category: 'Room', title: 'T', location: 'L', capacity: 5, description: 'D' });
    expect(res.status).toBe(400);
  });

  it('S13: PATCH /api/spaces/:id without auth returns 401', async () => {
    const res = await request(app).patch(`/api/spaces/${spaceId}`).send({ title: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('S14: PATCH /api/spaces/:id as non-owner returns 403', async () => {
    const res = await request(app)
      .patch(`/api/spaces/${spaceId}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ title: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('S15: PATCH /api/spaces/:id as owner returns 200', async () => {
    const res = await request(app)
      .patch(`/api/spaces/${spaceId}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('S16: DELETE /api/spaces/:id as non-owner returns 403', async () => {
    const res = await request(app)
      .delete(`/api/spaces/${spaceId}`)
      .set('Authorization', `Bearer ${otherUserToken}`);
    expect(res.status).toBe(403);
  });

  it('S17: DELETE /api/spaces/:id as owner returns 204', async () => {
    const createRes = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        category: 'Room',
        title: 'To Delete',
        location: 'City',
        capacity: 5,
        pricePerHour: 50,
        description: 'Desc',
      });
    const id = createRes.body.id;
    const res = await request(app)
      .delete(`/api/spaces/${id}`)
      .set('Authorization', `Bearer ${hostToken}`);
    expect(res.status).toBe(204);
  });

  it('S18: POST /api/spaces/:id/reviews with auth and valid rating returns 201', async () => {
    const res = await request(app)
      .post(`/api/spaces/${spaceId}/reviews`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ rating: 5, text: 'Great space!' });
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
    expect(res.body.text).toBe('Great space!');
  });

  it('S19: POST review with rating out of range returns 400', async () => {
    const res = await request(app)
      .post(`/api/spaces/${spaceId}/reviews`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ rating: 0, text: 'Bad' });
    expect(res.status).toBe(400);
  });
});
