import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

async function attachUserIdFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { bannedAt: true },
    });
    if (user?.bannedAt) {
      return { banned: true };
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function authMiddleware(req, res, next) {
  const result = await attachUserIdFromToken(req);
  if (!result) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (result.banned) {
    return res.status(403).json({ error: 'Account suspended' });
  }
  req.userId = result.userId;
  next();
}

/** Sets req.userId when a valid token is present; continues without error when absent. */
export async function optionalAuthMiddleware(req, res, next) {
  const result = await attachUserIdFromToken(req);
  if (result?.banned) {
    return res.status(403).json({ error: 'Account suspended' });
  }
  if (result?.userId) {
    req.userId = result.userId;
  }
  next();
}

export async function attachUser(req, res, next) {
  if (req.userId) {
    req.user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true },
    });
  }
  next();
}

export async function requireAdmin(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true },
  });
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export { JWT_SECRET };
