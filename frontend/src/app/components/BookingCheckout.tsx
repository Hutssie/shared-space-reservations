import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { format, parse } from 'date-fns';
import { ArrowLeft, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { fetchSpace } from '../api/spaces';
import { createPaymentIntent, type CreatePaymentIntentResponse } from '../api/payments';
import { createBooking } from '../api/bookings';
import { BookingPayment } from './BookingPayment';
import { ImageWithFallback } from './ImageWithFallback';
import { useAuth } from '../context/AuthContext';
import type { Space } from '../api/spaces';
import { formatRatingScore } from '../utils/formatRating';
import {
  CANCELLATION_POLICY_DESCRIPTIONS,
  CANCELLATION_POLICY_SUMMARY,
  cancellationPolicyKey,
} from '../constants/cancellation';

export function BookingCheckout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const date = searchParams.get('date') ?? '';
  const startTime = searchParams.get('startTime') ?? '';
  const endTime = searchParams.get('endTime') ?? '';
  const endTimeForApi = endTime === '12:00 AM+1' ? '12:00 AM' : endTime;

  const [space, setSpace] = useState<Space | null>(null);
  const [loadingSpace, setLoadingSpace] = useState(true);
  const [intent, setIntent] = useState<CreatePaymentIntentResponse | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [completingRedirect, setCompletingRedirect] = useState(false);

  const spaceQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (startTime) params.set('startTime', startTime);
    if (endTime) params.set('endTime', endTime);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [date, startTime, endTime]);

  const backUrl = useMemo(
    () => (id ? `/space/${id}${spaceQuery}` : '/find'),
    [id, spaceQuery]
  );

  const bookingSectionUrl = useMemo(
    () => (id ? `/space/${id}${spaceQuery}#booking` : '/find'),
    [id, spaceQuery]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!token) {
      navigate('/auth/login', { state: { from: { pathname: window.location.pathname + window.location.search } } });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!id || !date || !startTime || !endTime) {
      navigate(id ? `/space/${id}` : '/find', { replace: true });
      return;
    }
    let cancelled = false;
    setLoadingSpace(true);
    fetchSpace(id)
      .then((s) => {
        if (cancelled) return;
        setSpace(s);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error('Space not found');
        navigate('/find', { replace: true });
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingSpace(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, date, startTime, endTime, navigate]);

  useEffect(() => {
    if (!id || !space || !token) return;
    let cancelled = false;
    setLoadingIntent(true);
    createPaymentIntent(id, date, startTime, endTimeForApi)
      .then((res) => {
        if (cancelled) return;
        setIntent(res);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : 'Could not start payment');
        navigate(backUrl, { replace: true });
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingIntent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, space, token, date, startTime, endTime, endTimeForApi, backUrl, navigate]);

  const handleSuccess = (bookingId: string) => {
    if (!id || !space || !intent) {
      toast.error('Could not open confirmation page. Please check My Bookings.');
      return;
    }
    navigate(`/space/${id}/confirmation`, {
      replace: true,
      state: {
        bookingId,
        spaceTitle: space.title,
        isInstantBookable: space.isInstantBookable,
        hostName: space.host?.name ?? null,
        date,
        startTime,
        endTime,
        total: intent.breakdown.total,
      },
    });
  };

  useEffect(() => {
    if (!id || !space || !intent || completingRedirect) return;

    const params = new URLSearchParams(window.location.search);
    const redirectStatus = params.get('redirect_status');
    const paymentIntentId = params.get('payment_intent');
    if (!redirectStatus || !paymentIntentId) return;

    if (redirectStatus === 'failed') {
      toast.error('Payment authentication failed. Please try again.');
      const clean = new URLSearchParams({ date, startTime, endTime });
      window.history.replaceState(null, '', `/space/${id}/checkout?${clean.toString()}`);
      return;
    }

    if (redirectStatus !== 'succeeded' && redirectStatus !== 'pending') return;

    let cancelled = false;
    setCompletingRedirect(true);

    createBooking(id, date, startTime, endTimeForApi, paymentIntentId)
      .then((booking) => {
        if (cancelled) return;
        const clean = new URLSearchParams({ date, startTime, endTime });
        window.history.replaceState(null, '', `/space/${id}/checkout?${clean.toString()}`);
        handleSuccess(booking.id);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : 'Booking failed after payment');
        const clean = new URLSearchParams({ date, startTime, endTime });
        window.history.replaceState(null, '', `/space/${id}/checkout?${clean.toString()}`);
      })
      .finally(() => {
        if (cancelled) return;
        setCompletingRedirect(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, space, intent, date, startTime, endTime, endTimeForApi, completingRedirect]);

  const selectedDate = date ? parse(date, 'yyyy-MM-dd', new Date()) : null;
  const dateLabel = selectedDate ? format(selectedDate, 'MMMM d, yyyy') : date;
  const breakdown = intent?.breakdown;
  const policyKey = cancellationPolicyKey(space?.cancellationPolicy);
  const policySummary = CANCELLATION_POLICY_SUMMARY[policyKey];
  const policyDescription = CANCELLATION_POLICY_DESCRIPTIONS[policyKey];

  const duration =
    space && breakdown && space.price > 0
      ? Math.round((breakdown.subtotal / space.price) * 10) / 10
      : 0;

  if (loadingSpace || !space) {
    return (
      <div className="pt-28 pb-24 min-h-screen bg-brand-50 flex items-center justify-center">
        <div className="text-brand-500 font-medium">Loading checkout...</div>
      </div>
    );
  }

  const coverImage = space.image ?? space.images?.[0] ?? '';

  return (
    <div className="pt-28 pb-24 min-h-screen bg-brand-50">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <button
          type="button"
          onClick={() => navigate(backUrl)}
          className="flex items-center gap-2 text-brand-400 hover:text-brand-700 font-bold mb-8 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to space
        </button>

        <h1 className="text-3xl md:text-4xl font-black text-brand-700 mb-10 tracking-tight">
          {space.isInstantBookable ? 'Confirm & Pay' : 'Request to Book'}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 lg:gap-12 items-start">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {loadingIntent || !intent || completingRedirect ? (
              <div className="bg-white rounded-[2rem] border border-brand-100 shadow-xl shadow-brand-700/5 p-12 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-700 rounded-full animate-spin" />
                {completingRedirect && (
                  <p className="text-sm text-brand-500 font-medium">Completing your booking…</p>
                )}
              </div>
            ) : (
              <BookingPayment
                spaceId={id!}
                date={date}
                startTime={startTime}
                endTime={endTimeForApi}
                intent={intent}
                isInstantBookable={space.isInstantBookable}
                total={breakdown?.total ?? 0}
                cancellationDescription={policyDescription}
                onSuccess={handleSuccess}
              />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="lg:sticky lg:top-32"
          >
            <div className="bg-white rounded-[2rem] border border-brand-100 shadow-xl shadow-brand-700/5 overflow-hidden">
              <div className="flex gap-4 p-5 border-b border-brand-50">
                <div className="w-24 h-20 rounded-2xl overflow-hidden shrink-0">
                  <ImageWithFallback
                    src={coverImage}
                    alt={space.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-1">
                    {space.category}
                  </p>
                  <p className="font-black text-brand-700 text-sm leading-snug line-clamp-2">
                    {space.title}
                  </p>
                  {space.rating != null && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Star className="w-3 h-3 text-brand-500 fill-brand-500" />
                      <span className="text-xs font-black text-brand-700">
                        {formatRatingScore(space.rating)}
                      </span>
                      <span className="text-xs text-brand-300 font-medium">
                        ({space.reviews} reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-1">
                    Cancellation policy
                  </p>
                  <p className="text-sm font-bold text-brand-700">{policySummary.title}</p>
                  <p className="text-xs text-brand-400 font-medium mt-0.5">{policySummary.subtitle}</p>
                </div>

                <div className="border-t border-brand-50" />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-1">
                      Date & time
                    </p>
                    <p className="text-sm font-bold text-brand-700">{dateLabel}</p>
                    <p className="text-xs text-brand-400 font-medium mt-0.5">
                      {startTime} — {endTime}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(bookingSectionUrl)}
                    className="text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-700 border border-brand-100 hover:border-brand-300 px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0"
                  >
                    Change
                  </button>
                </div>

                {breakdown && (
                  <>
                    <div className="border-t border-brand-50" />

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-brand-500 font-medium">
                          ${space.price} × {duration} {duration === 1 ? 'hr' : 'hrs'}
                        </span>
                        <span className="text-sm font-bold text-brand-700">${breakdown.subtotal}</span>
                      </div>
                      {breakdown.cleaningFee > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-brand-500 font-medium">Cleaning fee</span>
                          <span className="text-sm font-bold text-brand-700">${breakdown.cleaningFee}</span>
                        </div>
                      )}
                      {breakdown.equipmentFee > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-brand-500 font-medium">Equipment fee</span>
                          <span className="text-sm font-bold text-brand-700">${breakdown.equipmentFee}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-brand-500 font-medium">
                          Service fee ({breakdown.serviceFeePercent ?? 12}%)
                        </span>
                        <span className="text-sm font-bold text-brand-700">${breakdown.serviceFee}</span>
                      </div>
                    </div>

                    <div className="border-t border-brand-200" />

                    <div className="flex justify-between items-center">
                      <span className="font-black text-brand-700">Total</span>
                      <span className="font-black text-brand-700 text-xl">${breakdown.total}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
