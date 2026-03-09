import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Host', () => {
  let hostToken;
  const hostEmail = `${unique()}@host.com`;

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: hostEmail, password: 'pass', name: 'Host User' });
    hostToken = reg.body.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: hostEmail } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('H3: GET /api/host/spaces without auth returns 401', async () => {
    const res = await request(app).get('/api/host/spaces');
    expect(res.status).toBe(401);
  });

  it('H4: GET /api/host/spaces with auth returns 200 and only host spaces', async () => {
    const res = await request(app).get('/api/host/spaces').set('Authorization', `Bearer ${hostToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('H5: GET /api/host/bookings with auth returns 200', async () => {
    const res = await request(app).get('/api/host/bookings').set('Authorization', `Bearer ${hostToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
