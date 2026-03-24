import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { attachStream, isUserOnline, publishToUser } from '../realtime/messagesHub.js';
import { createNotification } from './notifications.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

async function requireParticipant(conversationId, userId) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { conversationId: true, userId: true, lastReadAt: true, hiddenAt: true, clearedAt: true },
  });
  return participant;
}

function toRelativeTimeShort(dt) {
  const ms = Date.now() - dt.getTime();
  if (ms < 60 * 1000) return 'now';
  const mins = Math.floor(ms / (60 * 1000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

router.get('/conversations', authMiddleware, async (req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: req.userId, hiddenAt: null } } },
      include: {
        participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        messages: { take: 1, orderBy: { createdAt: 'desc' }, select: { id: true, text: true, createdAt: true, senderId: true } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });

    const list = conversations.map((c) => {
      const other = c.participants.find((p) => p.userId !== req.userId)?.user ?? null;
      const me = c.participants.find((p) => p.userId === req.userId) ?? null;
      const last = c.messages[0] ?? null;
      const clearedAt = me?.clearedAt ?? null;
      const lastVisible = last && clearedAt && last.createdAt.getTime() <= clearedAt.getTime() ? null : last;
      const lastAt = last?.createdAt ?? c.lastMessageAt ?? c.updatedAt ?? c.createdAt;
      const lastReadAt = me?.lastReadAt ?? null;
      const unread = Boolean(
        lastVisible &&
          lastVisible.senderId !== req.userId &&
          (lastReadAt == null || lastVisible.createdAt.getTime() > lastReadAt.getTime())
      );

      return {
        id: c.id,
        user: other?.name ?? 'Unknown',
        role: 'User',
        avatar: other?.avatarUrl ?? null,
        online: other?.id ? isUserOnline(other.id) : false,
        lastMessage: lastVisible?.text ?? '',
        time: lastAt ? toRelativeTimeShort(lastAt) : '',
        unread,
        lastMessageAt: lastAt ? lastAt.toISOString() : null,
      };
    });

    res.json({ conversations: list });
  } catch (e) {
    next(e);
  }
});

router.post('/conversations', authMiddleware, async (req, res, next) => {
  try {
    const otherUserId = String(req.body?.otherUserId ?? '').trim();
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });
    if (otherUserId === req.userId) return res.status(400).json({ error: 'Cannot message yourself' });

    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, name: true, avatarUrl: true },
    });
    if (!otherUser) return res.status(404).json({ error: 'User not found' });

    const candidate = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId: req.userId },
        },
      },
      include: {
        participants: { select: { userId: true } },
      },
      take: 200,
    });
    const existing = candidate.find((c) => {
      const ids = c.participants.map((p) => p.userId).sort();
      const pair = [req.userId, otherUserId].sort();
      return ids.length === 2 && ids[0] === pair[0] && ids[1] === pair[1];
    });

    const conversation = existing
      ? await prisma.conversation.findUnique({
          where: { id: existing.id },
          include: {
            participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
            messages: { take: 1, orderBy: { createdAt: 'desc' }, select: { id: true, text: true, createdAt: true, senderId: true } },
          },
        })
      : await prisma.conversation.create({
          data: {
            participants: {
              create: [
                { userId: req.userId, lastReadAt: new Date() },
                { userId: otherUserId, lastReadAt: null },
              ],
            },
          },
          include: {
            participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
            messages: { take: 1, orderBy: { createdAt: 'desc' }, select: { id: true, text: true, createdAt: true, senderId: true } },
          },
        });

    // daca cel care a cerut a sters/ascuns conversatia inainte, o readuc la loc
    // dar ii sterg istoricul din vedere (celalalt user il pastreaza).
    if (existing) {
      const me = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: conversation.id, userId: req.userId } },
        select: { hiddenAt: true },
      });
      if (me?.hiddenAt) {
        await prisma.conversationParticipant.update({
          where: { conversationId_userId: { conversationId: conversation.id, userId: req.userId } },
          data: { hiddenAt: null, clearedAt: new Date(), lastReadAt: new Date() },
        });
      }
    }

    const other = conversation.participants.find((p) => p.userId !== req.userId)?.user ?? otherUser;
    res.status(existing ? 200 : 201).json({
      conversation: {
        id: conversation.id,
        user: other?.name ?? 'Unknown',
        role: 'User',
        avatar: other?.avatarUrl ?? null,
        online: false,
        lastMessage: conversation.messages[0]?.text ?? '',
        time: conversation.messages[0]?.createdAt ? toRelativeTimeShort(conversation.messages[0].createdAt) : '',
        unread: false,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/conversations/:id/messages', authMiddleware, async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const participant = await requireParticipant(conversationId, req.userId);
    if (!participant || participant.hiddenAt) return res.status(404).json({ error: 'Conversation not found' });

    const other = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: { not: req.userId } },
      select: { lastReadAt: true },
    });

    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 100);
    const cursor = String(req.query.cursor ?? '').trim();

    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(participant.clearedAt ? { createdAt: { gt: participant.clearedAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, senderId: true, text: true, createdAt: true },
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? rows[limit].id : null;

    res.json({
      otherParticipantLastReadAt: other?.lastReadAt ? other.lastReadAt.toISOString() : null,
      messages: page
        .map((m) => ({
          id: m.id,
          type: m.senderId === req.userId ? 'sent' : 'received',
          text: m.text,
          time: m.createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          createdAt: m.createdAt.toISOString(),
        }))
        .reverse(),
      nextCursor,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/conversations/:id/messages', authMiddleware, async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const text = String(req.body?.text ?? '').trim();
    if (!text) return res.status(400).json({ error: 'text is required' });

    const participant = await requireParticipant(conversationId, req.userId);
    if (!participant || participant.hiddenAt) return res.status(404).json({ error: 'Conversation not found' });

    const message = await prisma.message.create({
      data: { conversationId, senderId: req.userId, text },
      select: { id: true, senderId: true, text: true, createdAt: true, conversationId: true },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
      select: { id: true },
    });

    // nu marchez ca 'read' pentru receiver; actualizez doar lastReadAt-ul senderului.
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: req.userId } },
      data: { lastReadAt: message.createdAt },
    });

    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true, hiddenAt: true },
    });
    // redau conversatia la vedere pentru destinatari (dar pastrez clearedAt).
    const hiddenUserIds = participants.filter((p) => p.hiddenAt).map((p) => p.userId);
    if (hiddenUserIds.length > 0) {
      await prisma.conversationParticipant.updateMany({
        where: { conversationId, userId: { in: hiddenUserIds } },
        data: { hiddenAt: null },
      });
    }
    const sender = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { name: true },
    });
    const senderName = sender?.name ?? 'Someone';
    const preview = message.text.length > 60 ? message.text.slice(0, 60) + '…' : message.text;

    for (const p of participants) {
      publishToUser(p.userId, 'message.created', {
        conversationId,
        message: {
          id: message.id,
          senderId: message.senderId,
          text: message.text,
          createdAt: message.createdAt.toISOString(),
        },
      });
      publishToUser(p.userId, 'conversation.updated', { conversationId });
      if (p.userId !== req.userId) {
        await createNotification(prisma, {
          userId: p.userId,
          type: 'message_received',
          title: 'New Message',
          message: `${senderName}: "${preview}"`,
          data: { threadId: conversationId, senderId: req.userId },
        });
      }
    }

    res.status(201).json({
      id: message.id,
      conversationId,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/conversations/:id/read', authMiddleware, async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const participant = await requireParticipant(conversationId, req.userId);
    if (!participant || participant.hiddenAt) return res.status(404).json({ error: 'Conversation not found' });
    const now = new Date();
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: req.userId } },
      data: { lastReadAt: now },
    });

    const others = await prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: req.userId } },
      select: { userId: true },
    });
    for (const o of others) {
      publishToUser(o.userId, 'conversation.read', { conversationId, lastReadAt: now.toISOString() });
    }

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.post('/conversations/:id/delete', authMiddleware, async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const participant = await requireParticipant(conversationId, req.userId);
    if (!participant) return res.status(404).json({ error: 'Conversation not found' });
    const now = new Date();
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: req.userId } },
      data: { hiddenAt: now, clearedAt: now, lastReadAt: now },
    });
    publishToUser(req.userId, 'conversation.updated', { conversationId });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.get('/stream', authMiddleware, async (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  // unele proxy uri buffer uiesc pana apare o scriere initiala.
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  attachStream(req.userId, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    } catch {
      // ignor
    }
  }, 25_000);

  res.on('close', () => {
    clearInterval(heartbeat);
  });
});

export const messagesRouter = router;

