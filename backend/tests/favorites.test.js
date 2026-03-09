import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Favorites', () => {
  let userToken;
  let hostToken;
  let spaceId;
  const userEmail = `${unique()}@fav.com`;
  const hostEmail = `${unique()}@favhost.com`;

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: userEmail, password: 'pass', name: 'Fav User' });
    userToken = reg.body.token;

    const hostReg = await request(app)
      .post('/api/auth/register')
      .send({ email: hostEmail, password: 'pass', name: 'Fav Host' });
    hostToken = hostReg.body.token;

    const createRes = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        category: 'Conference Room',
        title: 'Fav Test Space',
        location: 'Test City',
        capacity: 5,
        pricePerHour: 50,
        description: 'For favorites test',
      });
    if (createRes.status !== 201 || !createRes.body?.id) throw new Error('Failed to create space for favorites test');
    spaceId = createRes.body.id;
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: userEmail } }).catch(() => null);
    if (user) await prisma.favorite.deleteMany({ where: { userId: user.id } }).catch(() => {});
    if (spaceId) await prisma.space.deleteMany({ where: { id: spaceId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: [userEmail, hostEmail] } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('F1: GET /api/favorites without auth returns 401', async () => {
    const res = await request(app).get('/api/favorites');
    expect(res.status).toBe(401);
  });

  it('F2: GET /api/favorites with auth returns 200 and array', async () => {
    const res = await request(app).get('/api/favorites').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('F3: POST /api/favorites with space_id returns 201 or 200', async () => {
    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ space_id: spaceId });
    expect([200, 201]).toContain(res.status);
    expect(res.body.spaceId).toBe(spaceId);
  });

  it('F4: POST /api/favorites without auth returns 401', async () => {
    const res = await request(app).post('/api/favorites').send({ space_id: spaceId });
    expect(res.status).toBe(401);
  });

  it('F5: POST /api/favorites with invalid space_id returns 404', async () => {
    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ space_id: 'nonexistent-id' });
    expect(res.status).toBe(404);
  });

  it('F6: DELETE /api/favorites/:spaceId with auth returns 204', async () => {
    const res = await request(app)
      .delete(`/api/favorites/${spaceId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(204);
  });
});
