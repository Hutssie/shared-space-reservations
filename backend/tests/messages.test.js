import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Messages', () => {
  let aEmail;
  let bEmail;
  let cEmail;
  let aToken;
  let bToken;
  let cToken;
  let aId;
  let bId;

  beforeAll(async () => {
    aEmail = `${unique()}@a.test`;
    bEmail = `${unique()}@b.test`;
    cEmail = `${unique()}@c.test`;

    const aReg = await request(app).post('/api/auth/register').send({ email: aEmail, password: 'Password123', name: 'User A' });
    const bReg = await request(app).post('/api/auth/register').send({ email: bEmail, password: 'Password123', name: 'User B' });
    const cReg = await request(app).post('/api/auth/register').send({ email: cEmail, password: 'Password123', name: 'User C' });

    aToken = aReg.body.token;
    bToken = bReg.body.token;
    cToken = cReg.body.token;
    aId = aReg.body.user.id;
    bId = bReg.body.user.id;
  });

  afterAll(async () => {
    // curatam conversatiile/mesajele create de userii respectivi.
    const users = await prisma.user.findMany({
      where: { email: { in: [aEmail, bEmail, cEmail] } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const participants = await prisma.conversationParticipant.findMany({
      where: { userId: { in: userIds } },
      select: { conversationId: true },
    });
    const convoIds = [...new Set(participants.map((p) => p.conversationId))];
    if (convoIds.length > 0) {
      await prisma.message.deleteMany({ where: { conversationId: { in: convoIds } } }).catch(() => {});
      await prisma.conversation.deleteMany({ where: { id: { in: convoIds } } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: { in: [aEmail, bEmail, cEmail] } } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('M1: GET /api/users/search returns other users and excludes self', async () => {
    const res = await request(app)
      .get('/api/users/search?q=User')
      .set('Authorization', `Bearer ${aToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.some((u) => u.id === aId)).toBe(false);
  });

  it('M2: POST /api/messages/conversations creates-or-returns 1:1 conversation', async () => {
    const first = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ otherUserId: bId });
    expect([200, 201]).toContain(first.status);
    expect(first.body.conversation).toHaveProperty('id');

    const second = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ otherUserId: bId });
    expect([200, 201]).toContain(second.status);
    expect(second.body.conversation.id).toBe(first.body.conversation.id);
  });

  it('M3: sending a message makes it appear in receiver conversations as unread', async () => {
    const convoRes = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ otherUserId: bId });
    const conversationId = convoRes.body.conversation.id;

    const sendRes = await request(app)
      .post(`/api/messages/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${aToken}`)
      .send({ text: 'Hello B' });
    expect(sendRes.status).toBe(201);
    expect(sendRes.body).toHaveProperty('id');

    const bList = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${bToken}`);
    expect(bList.status).toBe(200);
    const item = bList.body.conversations.find((c) => c.id === conversationId);
    expect(item).toBeTruthy();
    expect(item.unread).toBe(true);
    expect(item.lastMessage).toBe('Hello B');
  });

  it('M4: POST /read clears unread state', async () => {
    const convoRes = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ otherUserId: bId });
    const conversationId = convoRes.body.conversation.id;

    await request(app)
      .post(`/api/messages/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${aToken}`)
      .send({ text: 'Mark as read test' });

    const readRes = await request(app)
      .post(`/api/messages/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${bToken}`);
    expect(readRes.status).toBe(200);

    const bList2 = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${bToken}`);
    const item2 = bList2.body.conversations.find((c) => c.id === conversationId);
    expect(item2).toBeTruthy();
    expect(item2.unread).toBe(false);
  });

  it('M5: non-participant cannot read messages', async () => {
    const convoRes = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ otherUserId: bId });
    const conversationId = convoRes.body.conversation.id;

    const res = await request(app)
      .get(`/api/messages/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${cToken}`);
    expect(res.status).toBe(404);
  });

  it('M6: GET messages returns otherParticipantLastReadAt after they read', async () => {
    const convoRes = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ otherUserId: bId });
    const conversationId = convoRes.body.conversation.id;

    const sendRes = await request(app)
      .post(`/api/messages/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${aToken}`)
      .send({ text: 'Seen test' });
    expect(sendRes.status).toBe(201);

    // inainte sa citeasca B, A ar trebui sa vada null/gol la otherParticipantLastReadAt (B n-a deschis inca firul conversatiei)
    const before = await request(app)
      .get(`/api/messages/conversations/${conversationId}/messages?limit=10`)
      .set('Authorization', `Bearer ${aToken}`);
    expect(before.status).toBe(200);
    expect(before.body).toHaveProperty('otherParticipantLastReadAt');

    await request(app)
      .post(`/api/messages/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${bToken}`);

    const after = await request(app)
      .get(`/api/messages/conversations/${conversationId}/messages?limit=10`)
      .set('Authorization', `Bearer ${aToken}`);
    expect(after.status).toBe(200);
    expect(typeof after.body.otherParticipantLastReadAt === 'string' || after.body.otherParticipantLastReadAt === null).toBe(true);
    expect(after.body.otherParticipantLastReadAt).toBeTruthy();

    const lastReadMs = Date.parse(after.body.otherParticipantLastReadAt);
    expect(Number.isNaN(lastReadMs)).toBe(false);
  });
});

