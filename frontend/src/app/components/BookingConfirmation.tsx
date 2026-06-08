import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { format, parse } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useUnreadBookings } from '../contexts/UnreadBookingsContext';

type ConfirmationState = {
  bookingId: string;
  spaceTitle: string;
  isInstantBookable: boolean;
  hostName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  total: number;
};

export function BookingConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addNewBooking } = useUnreadBookings();
  const state = location.state as ConfirmationState | null;

  useEffect(() => {
    if (!state?.bookingId) {
      navigate('/find', { replace: true });
      return;
    }
    addNewBooking(state.bookingId);
  }, [state, navigate, addNewBooking]);

  if (!state?.bookingId) {
    return null;
  }

  const selectedDate = state.date ? parse(state.date, 'yyyy-MM-dd', new Date()) : null;

  return (
    <div data-testid="booking-confirmation" className="pt-24 md:pt-32 pb-12 min-h-screen bg-brand-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full bg-white rounded-[1.5rem] md:rounded-[2rem] p-8 md:p-10 text-center shadow-2xl shadow-brand-700/5 border border-brand-200"
      >
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        {state.isInstantBookable ? (
          <>
            <h2 className="text-3xl md:text-4xl font-black text-brand-700 mb-3">Booking Confirmed!</h2>
            <p className="text-brand-500 font-medium text-base md:text-lg mb-8">
              Your spot is secured. We&apos;ve sent a confirmation email to you with the receipt and access instructions.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl md:text-4xl font-black text-brand-700 mb-3">Reservation Requested!</h2>
            <p className="text-brand-500 font-medium text-base md:text-lg mb-8">
              {state.hostName ?? 'The host'} has been notified. You&apos;ll receive an email confirmation once the host approves.
            </p>
          </>
        )}
        <div className="bg-brand-50 rounded-2xl p-5 md:p-6 mb-8 text-left space-y-4">
          <div className="flex justify-between items-center border-b border-brand-100 pb-4">
            <span className="text-brand-400 font-bold uppercase tracking-wider text-xs">Space</span>
            <span className="text-brand-700 font-bold">{state.spaceTitle}</span>
          </div>
          <div className="flex justify-between items-center border-b border-brand-100 pb-4">
            <span className="text-brand-400 font-bold uppercase tracking-wider text-xs">Date</span>
            <span className="text-brand-700 font-bold">
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : state.date}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-brand-100 pb-4">
            <span className="text-brand-400 font-bold uppercase tracking-wider text-xs">Time Window</span>
            <span className="text-brand-700 font-bold">{state.startTime} — {state.endTime}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-brand-400 font-bold uppercase tracking-wider text-xs">Total paid</span>
            <span className="text-brand-700 font-black text-xl">${state.total}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/dashboard"
            className="flex-1 py-4 border-2 border-brand-200 text-brand-700 font-black rounded-xl md:rounded-2xl hover:bg-brand-50 transition-all text-center"
          >
            View my bookings
          </Link>
          <Link
            to="/find"
            className="flex-1 py-4 bg-brand-700 text-white font-black rounded-xl md:rounded-2xl shadow-xl shadow-brand-700/20 hover:bg-brand-600 transition-all active:scale-95 text-center"
          >
            Explore more spaces
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
