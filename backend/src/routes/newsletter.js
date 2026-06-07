import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../lib/email.js';
import { newsletterWelcomeEmail } from '../lib/emailTemplates.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/subscribe', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: normalized } });
    if (!existing) {
      await prisma.newsletterSubscriber.create({ data: { email: normalized } });
    }

    try {
      const template = newsletterWelcomeEmail();
      await sendEmail({ to: normalized, ...template });
    } catch (emailErr) {
      console.error('[Newsletter] Thank-you email failed:', emailErr);
    }

    res.json({ success: true, message: 'Thanks for subscribing!' });
  } catch (e) {
    next(e);
  }
});

export const newsletterRouter = router;
