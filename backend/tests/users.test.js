import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Users', () => {
  let token;
  let userEmail;

  beforeAll(async () => {
    userEmail = `${unique()}@test.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: userEmail, password: 'Password123', name: 'User Test' });
    token = res.body.token;
  });

  afterAll(async () => {
    if (userEmail) await prisma.user.deleteMany({ where: { email: userEmail } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('U1: GET /api/users/me with valid Bearer token returns 200 and user', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email', userEmail);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('avatarUrl');
  });

  it('U2: GET /api/users/me without Authorization returns 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('U3: GET /api/users/me with invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  it('U4: PATCH /api/users/me with name returns 200 and updated user', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  it('U5: PATCH /api/users/me with avatarUrl returns 200', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'https://example.com/avatar.png' });
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe('https://example.com/avatar.png');
  });
});
