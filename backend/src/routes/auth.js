import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, authMiddleware } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { prisma } from '../lib/prisma.js';
import { sendEmail, getFrontendUrl } from '../lib/email.js';
import {
  verificationEmail,
  passwordResetEmail,
} from '../lib/emailTemplates.js';

const router = Router();

const PASSWORD_MIN_LENGTH = 8;

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  return { valid: true };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role ?? 'user',
  };
}

async function createVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.emailVerificationToken.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const pwValidation = validatePassword(password);
    if (!pwValidation.valid) return res.status(400).json({ error: pwValidation.error });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, name: name.trim(), role: 'user' },
    });
    const token = await createVerificationToken(user.id);
    const verifyLink = `${getFrontendUrl()}/auth/verify-email?token=${token}`;
    const template = verificationEmail({ name: user.name, verifyLink });
    await sendEmail({ to: normalizedEmail, ...template });
    res.status(201).json({
      success: true,
      message: 'Check your email to verify your account.',
      email: normalizedEmail,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }
    const verification = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!verification || verification.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }
    if (verification.user.emailVerifiedAt) {
      return res.json({ success: true, message: 'Email verified. You can sign in now.' });
    }
    await prisma.user.update({
      where: { id: verification.userId },
      data: { emailVerifiedAt: new Date() },
    });
    res.json({ success: true, message: 'Email verified. You can sign in now.' });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        passwordHash: true,
        bannedAt: true,
        emailVerifiedAt: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.bannedAt) {
      return res.status(401).json({ error: 'Your account has been suspended. Contact support.' });
    }
    if (!user.emailVerifiedAt) {
      return res.status(403).json({
        error: 'Please verify your email before signing in. Check your inbox for the verification link.',
      });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: sanitizeUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });
      const resetLink = `${getFrontendUrl()}/auth/reset-password?token=${token}`;
      const template = passwordResetEmail({ resetLink });
      await sendEmail({ to: normalizedEmail, ...template });
    }
    res.json({ success: true, message: 'If an account exists, you will receive a reset link.' });
  } catch (e) {
    next(e);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }
    const pwValidation = validatePassword(newPassword);
    if (!pwValidation.valid) return res.status(400).json({ error: pwValidation.error });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({ where: { id: resetToken.id } }),
    ]);

    try {
      await createNotification(prisma, {
        userId: resetToken.userId,
        type: 'security_password_changed',
        title: 'Password changed',
        message: 'Your password has changed successfully.',
      });
    } catch {
      // resetarea parolei nu trebuie sa pice daca e problema la notificare.
    }

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const pwValidation = validatePassword(newPassword);
    if (!pwValidation.valid) return res.status(400).json({ error: pwValidation.error });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    try {
      await createNotification(prisma, {
        userId: user.id,
        type: 'security_password_changed',
        title: 'Password changed',
        message: 'Your password has changed successfully.',
      });
    } catch {
      // schimbarea parolei nu trebuie sa pice daca e problema la notificare.
    }

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export const authRouter = router;
