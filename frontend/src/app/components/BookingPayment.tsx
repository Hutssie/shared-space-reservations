import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { CreditCard, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import type { CreatePaymentIntentResponse } from '../api/payments';
import { createBooking } from '../api/bookings';
import { useAuth } from '../context/AuthContext';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey, {
      developerTools: {
        assistant: {
          enabled: false,
        },
      },
    })
  : null;

type BookingPaymentProps = {
  spaceId: string;
  date: string;
  startTime: string;
  endTime: string;
  intent: CreatePaymentIntentResponse;
  isInstantBookable: boolean;
  total: number;
  cancellationDescription: string;
  onSuccess: (bookingId: string) => void;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const paymentElementFieldOptions = {
  layout: 'tabs' as const,
  paymentMethodOrder: ['card'],
  wallets: {
    applePay: 'never' as const,
    googlePay: 'never' as const,
    link: 'never' as const,
  },
  fields: {
    billingDetails: {
      name: 'never' as const,
      email: 'never' as const,
      address: 'if_required' as const,
    },
  },
};

function confirmBillingDetails(user: { name?: string; email?: string } | null | undefined) {
  return {
    name: user?.name ?? undefined,
    email: user?.email ?? undefined,
  };
}

function isAcceptablePaymentStatus(status: string | undefined, isInstantBookable: boolean) {
  if (!status) return false;
  return isInstantBookable
    ? status === 'succeeded'
    : status === 'requires_capture' || status === 'succeeded';
}

async function resolvePaymentIntent(stripe: Stripe, clientSecret: string) {
  let { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
  let attempts = 0;
  while (paymentIntent?.status === 'processing' && attempts < 6) {
    await sleep(800);
    ({ paymentIntent } = await stripe.retrievePaymentIntent(clientSecret));
    attempts += 1;
  }
  return paymentIntent;
}

function PaymentForm({
  spaceId,
  date,
  startTime,
  endTime,
  intent,
  isInstantBookable,
  total,
  cancellationDescription,
  onSuccess,
}: BookingPaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentAlreadyAuthorized =
    !isInstantBookable && intent.paymentIntentStatus === 'requires_capture';

  const finalizeBooking = async (paymentIntentId: string) => {
    const booking = await createBooking(spaceId, date, startTime, endTime, paymentIntentId);
    onSuccess(booking.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    try {
      if (paymentAlreadyAuthorized) {
        await finalizeBooking(intent.paymentIntentId);
        return;
      }

      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? 'Please check your payment details');
        setSubmitting(false);
        return;
      }

      const returnUrl = window.location.href;

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: {
            billing_details: confirmBillingDetails(user),
          },
        },
      });

      if (confirmError) {
        setError(confirmError.message ?? 'Payment failed');
        setSubmitting(false);
        return;
      }

      const resolvedIntent =
        paymentIntent ?? (await resolvePaymentIntent(stripe, intent.clientSecret));
      const paymentIntentId = resolvedIntent?.id ?? intent.paymentIntentId;
      const status = resolvedIntent?.status ?? intent.paymentIntentStatus;

      if (!isAcceptablePaymentStatus(status, isInstantBookable)) {
        setError(
          status
            ? `Payment was not completed (status: ${status}). Please try again.`
            : 'Payment was not completed. Please try again.'
        );
        setSubmitting(false);
        return;
      }

      await finalizeBooking(paymentIntentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-brand-100 shadow-xl shadow-brand-700/5 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-black text-brand-700">Payment details</h2>
        </div>

        {paymentAlreadyAuthorized ? (
          <p className="text-sm text-brand-500 font-medium rounded-xl border border-brand-100 bg-brand-50 p-4">
            Your card is already authorized for this request. Submit below to send it to the host.
          </p>
        ) : (
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
            <PaymentElement options={paymentElementFieldOptions} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-brand-100 shadow-xl shadow-brand-700/5 p-6 md:p-8">
        <h2 className="text-base font-black text-brand-700 mb-3">Cancellation policy</h2>
        <p className="text-sm text-brand-500 font-medium leading-relaxed">{cancellationDescription}</p>
      </div>

      <div className="flex items-center gap-3 px-2">
        <Lock className="w-4 h-4 text-brand-300 shrink-0" />
        <p className="text-xs text-brand-300 font-medium">
          Payments are processed securely by Stripe. Your card details never touch our servers.
        </p>
      </div>

      {error && (
        <p className="text-center text-red-600 text-sm font-bold">{error}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting || (!paymentAlreadyAuthorized && !elements)}
        className="w-full py-5 bg-brand-700 hover:bg-brand-600 disabled:opacity-60 text-white font-black text-base rounded-2xl shadow-2xl shadow-brand-700/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-3"
      >
        {submitting ? (
          <>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="block w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
            Processing…
          </>
        ) : isInstantBookable ? (
          <>
            <Lock className="w-5 h-5" />
            Pay ${total.toFixed(2)}
          </>
        ) : paymentAlreadyAuthorized ? (
          'Submit request'
        ) : (
          <>
            <Lock className="w-5 h-5" />
            Authorize & submit request
          </>
        )}
      </button>
    </form>
  );
}

export function BookingPayment(props: BookingPaymentProps) {
  if (!stripePromise) {
    return (
      <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-bold mb-1">Stripe is not configured</p>
        <p>
          Add <code className="text-xs">VITE_STRIPE_PUBLISHABLE_KEY</code> to{' '}
          <code className="text-xs">frontend/.env</code> and restart the dev server.
        </p>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret: props.intent.clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#1e3a5f',
        colorBackground: '#f4f7fb',
        colorText: '#1e3a5f',
        colorDanger: '#dc2626',
        borderRadius: '12px',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      },
      rules: {
        '.Input': {
          backgroundColor: '#f4f7fb',
          border: '1px solid #e2e8f0',
          boxShadow: 'none',
        },
        '.Input:focus': {
          backgroundColor: '#ffffff',
          border: '1px solid #94a3b8',
        },
        '.Label': {
          fontSize: '10px',
          fontWeight: '800',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        },
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm {...props} />
    </Elements>
  );
}
