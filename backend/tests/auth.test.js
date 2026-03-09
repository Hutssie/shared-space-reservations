import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Auth', () => {
  let createdEmail;

  afterAll(async () => {
    if (createdEmail) {
      await prisma.user.deleteMany({ where: { email: createdEmail } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('A1: Register with valid email, password, name returns 201, token and user', async () => {
    createdEmail = `${unique()}@test.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: createdEmail, password: 'Password123', name: 'Test User' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.email).toBe(createdEmail);
    expect(res.body.user.name).toBe('Test User');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('A2: Register with missing email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'Password123', name: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('A3: Register with missing password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `${unique()}@test.com`, name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('A4: Register with missing name returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `${unique()}@test.com`, password: 'Password123' });
    expect(res.status).toBe(400);
  });

  it('A5: Register with duplicate email returns 400', async () => {
    const email = `${unique()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Password123', name: 'A' });
    const res = await request(app).post('/api/auth/register').send({ email, password: 'Password456', name: 'B' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('A6: Login with valid credentials returns 200, token and user', async () => {
    const email = `${unique()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Password123', name: 'Login Test' });
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('A7: Login with wrong password returns 401', async () => {
    const email = `${unique()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Password123', name: 'Wrong' });
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Wrongpass1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid|password/i);
  });

  it('A8: Login with non-existent email returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@test.com', password: 'any' });
    expect(res.status).toBe(401);
  });

  it('A9: Login with missing email or password returns 400', async () => {
    const r1 = await request(app).post('/api/auth/login').send({ password: 'p' });
    const r2 = await request(app).post('/api/auth/login').send({ email: 'e@e.com' });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
  });

  it('A10: Token from login works for GET /api/users/me', async () => {
    const email = `${unique()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Password123', name: 'Me Test' });
    const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
    const token = loginRes.body.token;
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(email);
  });
});
