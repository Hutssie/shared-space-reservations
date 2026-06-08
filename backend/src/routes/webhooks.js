import { Router } from 'express';
import { requireStripe } from '../lib/stripe.js';
import { syncPaymentRecord } from '../lib/paymentHelpers.js';

const router = Router();

router.post('/', async (req, res) => {
  const stripe = requireStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return res.status(500).send('Webhook secret not configured');
  }

  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.amount_capturable_updated':
      case 'payment_intent.canceled':
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        await syncPaymentRecord(pi.id, pi.status);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export const webhooksRouter = router;
