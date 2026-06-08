import Stripe from 'stripe';

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export function requireStripe() {
  if (!stripe) {
    const err = new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to backend/.env');
    err.status = 503;
    throw err;
  }
  return stripe;
}
