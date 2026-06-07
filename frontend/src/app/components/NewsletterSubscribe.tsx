import React, { useState } from 'react';
import { toast } from 'sonner';
import { subscribeNewsletter } from '../api/newsletter';

export const NewsletterSubscribe = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      toast.error('Please enter your email');
      return;
    }
    setSubmitting(true);
    try {
      await subscribeNewsletter(trimmed);
      setSubscribed(true);
      toast.success('Thanks for subscribing!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-10 border-2 border-brand-100 rounded-[2.5rem] p-10 hover:border-brand-300 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <div className="text-center md:text-left">
            <h3 className="text-2xl md:text-3xl font-black text-brand-700 mb-3">Stay in the loop</h3>
            <p className="text-brand-500 font-medium text-base">
              {subscribed
                ? 'Thank you for subscribing to our newsletter!'
                : 'Subscribe to get notified about new unique spaces and exclusive offers.'}
            </p>
          </div>
          {!subscribed ? (
            <form
              onSubmit={handleSubscribe}
              className="w-full md:max-w-md flex flex-col gap-3"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                  className="flex-1 px-5 py-3 bg-brand-100 border-none rounded-xl focus:ring-2 focus:ring-brand-400 focus:outline-none text-brand-700 font-medium text-base placeholder:text-brand-400/70"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-brand-700 hover:bg-brand-600 text-white font-black text-base rounded-xl transition-all active:scale-95 shadow-lg shadow-brand-700/20 cursor-pointer disabled:opacity-70"
                >
                  {submitting ? 'Subscribing...' : 'Subscribe'}
                </button>
              </div>
              {error && (
                <p className="text-sm font-bold text-red-600 text-center sm:text-left" role="alert">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <p className="text-brand-600 font-black text-lg break-all">{email.trim()}</p>
          )}
        </div>
      </div>
    </section>
  );
};
