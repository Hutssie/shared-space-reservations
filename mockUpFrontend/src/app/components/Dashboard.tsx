import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router';
import {
  User,
  Settings,
  Package,
  Clock,
  ChevronRight,
  ChevronDown,
  Filter,
  Star,
  CreditCard,
  LogOut,
  Bell as BellIcon,
  Heart,
  MessageSquare,
  Search,
  Sparkles,
  Shield,
  Plus,
  MoreVertical,
  CheckCircle2,
  Trash2,
  Lock,
  Mail,
  Smartphone,
  Info,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { fetchBookings, cancelBooking } from '../api/bookings';
import { fetchFavorites, addFavorite, removeFavorite } from '../api/favorites';
import { useAuth } from '../context/AuthContext';
import { createSpaceReview, updateReview, deleteReview } from '../api/spaces';
import { fetchMyReviews, updateMe } from '../api/users';
import { apiUploadFile } from '../api/client';
import { getStoredToken, saveAuth, changePassword } from '../api/auth';
import { validatePassword } from '../utils/passwordValidation';
import { toast } from 'sonner';
import type { Booking } from '../api/bookings';
import type { MyReview } from '../api/users';
import type { Favorite } from '../api/favorites';
import { formatRatingScore } from '../utils/formatRating';
import { FractionalStars } from './ui/FractionalStars';
import { useUnreadBookings } from '../contexts/UnreadBookingsContext';
import { UnreadBadge } from './ui/UnreadBadge';

const messages = [
  {
    id: 'msg-1',
    user: 'Sarah Miller',
    role: 'Host',
    lastMessage: 'Looking forward to seeing you on Monday!',
    time: '2h ago',
    unread: true,
    online: true,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200',
    history: [
      { id: 1, type: 'received', text: 'Hi there! Thanks for your interest in the industrial loft. Are you planning a photo shoot or an event?', time: '10:42 AM' },
      { id: 2, type: 'sent', text: "Hi Sarah! Yes, it's for a product photo shoot for a new sustainable clothing brand. We loved the natural lighting in your space!", time: '10:45 AM' },
      { id: 3, type: 'received', text: 'That sounds wonderful. The light is indeed best between 11 AM and 3 PM. Looking forward to seeing you on Monday!', time: '10:48 AM' }
    ]
  },
  {
    id: 'msg-2',
    user: 'James Wilson',
    role: 'Host',
    lastMessage: 'The studio has been cleaned and is ready for your session.',
    time: '1d ago',
    unread: false,
    online: false,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200',
    history: [
      { id: 1, type: 'received', text: 'Hello! Just wanted to confirm your booking for tomorrow.', time: 'Yesterday' },
      { id: 2, type: 'sent', text: 'Confirmed, thank you!', time: 'Yesterday' },
      { id: 3, type: 'received', text: 'Great. The studio has been cleaned and is ready for your session.', time: 'Yesterday' }
    ]
  },
  {
    id: 'msg-3',
    user: 'Elena Rodriguez',
    role: 'Creative Director',
    lastMessage: 'Could we extend the booking by 2 hours?',
    time: '3h ago',
    unread: true,
    online: true,
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200',
    history: [
      { id: 1, type: 'received', text: 'Hi, we are running a bit behind on our setup.', time: '11:15 AM' },
      { id: 2, type: 'received', text: 'Could we extend the booking by 2 hours?', time: '11:16 AM' }
    ]
  },
  {
    id: 'msg-4',
    user: 'David Chen',
    role: 'Studio Manager',
    lastMessage: 'Sent you the door code for tomorrow.',
    time: '5h ago',
    unread: false,
    online: false,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200',
    history: [
      { id: 1, type: 'received', text: 'Sent you the door code for tomorrow.', time: '9:30 AM' }
    ]
  }
];

const transactions = [
  { id: 'TR-9821', date: 'Feb 15, 2026', amount: 380, status: 'Completed', method: 'Visa ending in 4242' },
  { id: 'TR-9820', date: 'Jan 28, 2026', amount: 125, status: 'Completed', method: 'Visa ending in 4242' },
  { id: 'TR-9819', date: 'Jan 12, 2026', amount: 450, status: 'Completed', method: 'Apple Pay' },
];

const CANCELLATION_NOTICE_HOURS: Record<string, number> = { flexible: 24, moderate: 48, strict: 168 };

function parseTimeTo24h(t: string): string {
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '23:59';
  let h = parseInt(match[1], 10);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${match[2]}`;
}

function canCancelBooking(b: Booking): boolean {
  const policy = (b.cancellationPolicy ?? 'flexible').toLowerCase();
  const noticeHours = CANCELLATION_NOTICE_HOURS[policy] ?? 24;
  const startStr = b.startTime ?? (b.time && (b.time.includes('—') || b.time.includes('-')) ? b.time.split(/[—-]/).map((s: string) => s.trim())[0] : null) ?? '12:00 AM';
  const time24 = parseTimeTo24h(startStr);
  const bookingStartMs = new Date(`${b.date}T${time24}:00`).getTime();
  const now = Date.now();
  return now + noticeHours * 60 * 60 * 1000 <= bookingStartMs;
}

const BookingsTab = ({ bookings, setBookings, newestBookingId }: { bookings: Booking[]; setBookings: React.Dispatch<React.SetStateAction<Booking[]>>; newestBookingId: string | null }) => {
  const [filter, setFilter] = useState('All Bookings');
  const [isOpen, setIsOpen] = useState(false);
  const [reviewBooking, setReviewBooking] = useState<any>(null);
  const [reviewText, setReviewText] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [reviewedSpaceIds, setReviewedSpaceIds] = useState<Set<string>>(new Set());
  const [cancelErrorPopup, setCancelErrorPopup] = useState<string | null>(null);
  const [cancelConfirmBooking, setCancelConfirmBooking] = useState<Booking | null>(null);
  const [cancelInProgressId, setCancelInProgressId] = useState<string | null>(null);
  const [cancelSuccessToast, setCancelSuccessToast] = useState(false);
  const [ratings, setRatings] = useState<{ [key: string]: number }>({
    cleanliness: 0,
    communication: 0,
    location: 0,
    value: 0
  });

  const options = ['All Bookings', 'Upcoming', 'Past', 'Cancelled'];

  useEffect(() => {
    fetchMyReviews()
      .then((reviews) => setReviewedSpaceIds(new Set(reviews.map((r) => r.spaceId))))
      .catch(() => {});
  }, []);

  const isBookingUpcoming = (b: Booking): boolean => {
    if (b.status?.toLowerCase() === 'cancelled') return false;
    const endTimeStr = b.endTime || (b.time && (b.time.includes('—') || b.time.includes('-')) ? b.time.split(/[—-]/).map((s: string) => s.trim()).pop() || null : null) || '23:59';
    const time24 = parseTimeTo24h(endTimeStr);
    const bookingEnd = new Date(`${b.date}T${time24}:00`);
    return bookingEnd > new Date();
  };

  const filteredBookings = bookings.filter((b) => {
    switch (filter) {
      case 'Upcoming':
        return isBookingUpcoming(b);
      case 'Past':
        return !isBookingUpcoming(b) && b.status?.toLowerCase() !== 'cancelled';
      case 'Cancelled':
        return b.status?.toLowerCase() === 'cancelled';
      default:
        return true;
    }
  });

  const hasMatch = filteredBookings.some((b) => String(b.id) === String(newestBookingId));

  const resetReview = () => {
    setShowConfirmDialog(false);
    setReviewBooking(null);
    setReviewText('');
    setRatings({
      cleanliness: 0,
      communication: 0,
      location: 0,
      value: 0
    });
  };

  const hasUnsavedReviewChanges = reviewText.trim() !== '' || Object.values(ratings).some((v) => v > 0);
  const allRated = ratings.cleanliness > 0 && ratings.communication > 0 && ratings.location > 0 && ratings.value > 0;
  const handleReviewClose = () => {
    if (hasUnsavedReviewChanges) setShowConfirmDialog(true);
    else resetReview();
  };

  return (
    <div className="space-y-8">
      {/* Cancel error popup */}
      <AnimatePresence>
        {cancelErrorPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCancelErrorPopup(null)}
              className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border-2 border-brand-200 p-8 sm:p-10"
            >
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-50 rounded-2xl shrink-0">
                    <Info className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-xl sm:text-2xl font-black text-brand-700">Cannot cancel</h3>
                    <p className="text-sm sm:text-base text-brand-600 font-medium leading-relaxed">{cancelErrorPopup}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelErrorPopup(null)}
                  className="w-full px-6 py-4 bg-brand-700 text-white font-black rounded-xl sm:rounded-2xl shadow-lg hover:bg-brand-600 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel booking confirmation modal */}
      <AnimatePresence>
        {cancelConfirmBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCancelConfirmBooking(null)}
              className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border-2 border-brand-200 p-8 sm:p-10"
            >
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-50 rounded-2xl shrink-0">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-xl sm:text-2xl font-black text-brand-700">Cancel Booking</h3>
                    <p className="text-sm sm:text-base text-brand-400 font-medium leading-relaxed">
                      Are you sure you want to cancel your booking for <span className="font-black text-brand-700">{cancelConfirmBooking.space}</span>? This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCancelConfirmBooking(null)}
                    className="flex-1 px-6 py-4 bg-brand-50 text-brand-700 font-black rounded-xl sm:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer"
                  >
                    Keep Booking
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!cancelConfirmBooking) return;
                      setCancelInProgressId(cancelConfirmBooking.id);
                      setCancelErrorPopup(null);
                      try {
                        await cancelBooking(cancelConfirmBooking.id);
                        const list = await fetchBookings();
                        setBookings(list);
                        setCancelSuccessToast(true);
                        setTimeout(() => setCancelSuccessToast(false), 3000);
                        setCancelConfirmBooking(null);
                      } catch (err) {
                        setCancelErrorPopup(err instanceof Error ? err.message : 'Cancellation failed');
                      } finally {
                        setCancelInProgressId(null);
                      }
                    }}
                    disabled={cancelInProgressId === cancelConfirmBooking?.id}
                    className="flex-1 px-6 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl sm:rounded-2xl shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                  >
                    {cancelInProgressId === cancelConfirmBooking?.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Cancelling...
                      </span>
                    ) : (
                      'Cancel Booking'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel success toast */}
      <AnimatePresence>
        {cancelSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[90] px-6 py-3 bg-green-600 text-white font-bold rounded-2xl shadow-xl flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Booking cancelled successfully.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleReviewClose}
              className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-brand-200 overflow-hidden max-h-[95vh] flex flex-col"
            >
              <div className="relative p-6 sm:p-10 space-y-6 sm:space-y-8 overflow-y-auto">
                {/* Unsaved Changes Confirmation Dialog */}
                <AnimatePresence>
                  {showConfirmDialog && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-brand-900/20"
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border-2 border-brand-200 p-8 sm:p-10"
                      >
                        <div className="space-y-6">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-brand-100 rounded-2xl">
                              <Info className="w-6 h-6 text-brand-700" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <h3 className="text-xl sm:text-2xl font-black text-brand-700">Unsaved Changes</h3>
                              <p className="text-sm sm:text-base text-brand-400 font-medium leading-relaxed">
                                You have unsaved changes to your review. Are you sure you want to discard them?
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowConfirmDialog(false)}
                              className="flex-1 px-6 py-4 bg-brand-700 text-white font-black rounded-xl sm:rounded-2xl shadow-lg shadow-brand-700/20 hover:bg-brand-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                            >
                              Keep Editing
                            </button>
                            <button
                              type="button"
                              onClick={resetReview}
                              className="flex-1 px-6 py-4 bg-brand-50 text-brand-700 font-black rounded-xl sm:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer"
                            >
                              Discard Changes
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-brand-700 tracking-tight">Leave a Review</h2>
                    <p className="text-sm sm:text-base text-brand-400 font-medium">Share your experience at <span className="text-brand-700 font-black">{reviewBooking.space}</span></p>
                  </div>
                  <button 
                    onClick={handleReviewClose}
                    className="p-2 sm:p-3 bg-brand-50 text-brand-400 hover:text-brand-700 hover:bg-brand-100 rounded-xl sm:rounded-2xl transition-all cursor-pointer"
                  >
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6 rotate-45" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 py-4 sm:py-8 bg-brand-50/50 rounded-[1.5rem] sm:rounded-[2.5rem] border border-brand-100 px-4 sm:px-8">
                  {[
                    { label: 'Cleanliness', key: 'cleanliness' },
                    { label: 'Communication', key: 'communication' },
                    { label: 'Location', key: 'location' },
                    { label: 'Value', key: 'value' }
                  ].map((category) => {
                    return (
                      <div key={category.key} className="flex flex-col items-center gap-2 sm:gap-3 rounded-2xl p-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">
                          {category.label}
                        </p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setRatings(prev => ({ ...prev, [category.key]: star }))}
                              className="p-1 transition-all hover:scale-125 group cursor-pointer"
                            >
                              <Star className={`w-5 h-5 sm:w-6 sm:h-6 transition-all duration-300 ${star <= (ratings[category.key] || 0) ? 'text-brand-500 fill-brand-500 scale-110' : 'text-brand-200 hover:text-brand-300'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!allRated && (
                  <p className="text-xs font-bold text-red-400 -mt-2">Please rate all 4 categories to submit your review.</p>
                )}

                <div className="space-y-4">
                  <label className="text-xs sm:text-sm font-black text-brand-400 uppercase tracking-widest">Share more details</label>
                  <textarea 
                    rows={4}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="What did you love about this space? How was the host?"
                    className="w-full px-4 py-3 sm:px-6 sm:py-5 bg-brand-50 border border-brand-100 rounded-[1.5rem] sm:rounded-3xl focus:ring-2 focus:ring-brand-200 focus:outline-none font-medium text-brand-700 resize-none placeholder:text-brand-300 transition-all"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
                  <button 
                    type="button"
                    onClick={handleReviewClose}
                    className="order-2 sm:order-1 px-6 py-3.5 sm:px-8 sm:py-5 bg-brand-50 text-brand-700 font-black rounded-xl sm:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!allRated}
                    onClick={async () => {
                      if (!reviewBooking?.spaceId || !allRated) return;
                      const overallRating = (ratings.cleanliness + ratings.communication + ratings.location + ratings.value) / 4;
                      try {
                        await createSpaceReview(
                          reviewBooking.spaceId,
                          overallRating,
                          reviewText,
                          { cleanliness: ratings.cleanliness, communication: ratings.communication, location: ratings.location, value: ratings.value }
                        );
                        setReviewedSpaceIds((prev) => new Set(prev).add(reviewBooking.spaceId));
                        resetReview();
                      } catch {
                        // keep modal open on error
                      }
                    }}
                    className="order-1 sm:order-2 flex-[2] px-6 py-3.5 sm:px-8 sm:py-5 bg-brand-700 text-white font-black rounded-xl sm:rounded-2xl shadow-xl shadow-brand-700/20 hover:bg-brand-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-brand-700"
                  >
                    Submit Review
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-brand-700 tracking-tight">My Bookings</h1>
          <p className="text-brand-400 font-bold mt-1 uppercase tracking-widest text-xs">Manage your creative sessions</p>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-4 px-6 py-3.5 bg-white border-2 border-brand-100 rounded-2xl text-brand-700 font-black hover:border-brand-400 hover:shadow-xl transition-all cursor-pointer min-w-[200px] justify-between group"
          >
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-brand-400 group-hover:text-brand-700 transition-colors" />
              <span>{filter}</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-brand-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-full bg-white border border-brand-100 rounded-[2rem] shadow-2xl overflow-hidden z-20 p-2"
                >
                  {options.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setFilter(option);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-6 py-4 rounded-xl font-black transition-all flex items-center justify-between group/item relative overflow-hidden ${
                        filter === option 
                          ? 'bg-brand-700 text-white shadow-lg' 
                          : 'text-brand-700 hover:bg-brand-50 hover:pl-8'
                      }`}
                    >
                      <span className="relative z-10 flex items-center gap-3">
                        {!filter === option && (
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-400 opacity-0 group-hover/item:opacity-100 transition-all absolute -left-4" />
                        )}
                        {option}
                      </span>
                      {filter === option ? (
                        <CheckCircle2 className="w-4 h-4 relative z-10" />
                      ) : (
                        <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all text-brand-300" />
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredBookings.map((booking, index) => {
          const hasMatchingBooking = filteredBookings.some((b) => String(b.id) === String(newestBookingId));
          const showNewBadge =
            newestBookingId != null &&
            (String(booking.id) === String(newestBookingId) || (!hasMatchingBooking && index === 0));
          return (
        <motion.div 
          key={booking.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-6 border border-brand-200 flex flex-col md:flex-row gap-8 items-center shadow-lg hover:shadow-2xl transition-all group relative overflow-hidden"
        >
          {/* NEW Badge */}
          {showNewBadge && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="absolute top-5 left-5 z-10"
            >
              <div className="px-3 py-1.5 bg-gradient-to-br from-red-500 to-red-600 text-white font-bold text-xs rounded-lg shadow-md flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
                NEW
              </div>
            </motion.div>
          )}

          {booking.spaceId ? (
            <Link to={`/space/${booking.spaceId}`} className="w-full md:w-48 h-32 rounded-3xl overflow-hidden shrink-0 block">
              <ImageWithFallback src={booking.image ?? ''} alt={booking.space} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </Link>
          ) : (
            <div className="w-full md:w-48 h-32 rounded-3xl overflow-hidden shrink-0">
              <ImageWithFallback src={booking.image ?? ''} alt={booking.space} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${(booking.status === 'Confirmed' || booking.status === 'confirmed') ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {booking.status}
              </span>
              <span className="text-brand-400 font-black text-xs">ID: {booking.id}</span>
            </div>
            {booking.spaceId ? (
              <Link to={`/space/${booking.spaceId}`} className="inline text-xl font-black text-brand-700 hover:text-brand-500 transition-colors">{booking.space}</Link>
            ) : (
              <h4 className="text-xl font-black text-brand-700">{booking.space}</h4>
            )}
            <div className="flex flex-wrap gap-6 text-brand-500 font-medium">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {booking.date} · {booking.time}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center md:items-end gap-4 shrink-0">
            <div className="text-center md:text-right">
              <span className="text-2xl font-black text-brand-700">${booking.price}</span>
              <p className="text-xs font-bold text-brand-400 uppercase tracking-widest">Total Paid</p>
            </div>
            {booking.status?.toLowerCase() === 'cancelled' ? (
              <div className="px-8 py-3 bg-brand-100 text-brand-400 font-black rounded-xl flex items-center gap-2 cursor-default border-2 border-brand-200">
                Cancelled
              </div>
            ) : isBookingUpcoming(booking) && canCancelBooking(booking) ? (
              <button
                onClick={() => setCancelConfirmBooking(booking)}
                className="px-8 py-3 bg-white border-2 border-brand-200 hover:border-red-300 hover:text-red-600 text-brand-700 font-black rounded-xl transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Cancel booking
              </button>
            ) : isBookingUpcoming(booking) ? null : booking.spaceId && reviewedSpaceIds.has(booking.spaceId) ? (
              <div className="px-8 py-3 bg-brand-50 text-brand-400 font-black rounded-xl flex items-center gap-2 cursor-default border-2 border-brand-100">
                <CheckCircle2 className="w-4 h-4" />
                Reviewed
              </div>
            ) : (
              <button 
                onClick={() => setReviewBooking(booking)}
                className="px-8 py-3 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-xl transition-all shadow-lg shadow-brand-700/10 active:scale-[0.98] flex items-center gap-2 cursor-pointer"
              >
                <Star className="w-4 h-4 fill-current" />
                Leave a review
              </button>
            )}
          </div>
        </motion.div>
          );
        })}
    </div>

    <div className="bg-brand-700 rounded-[3rem] p-12 relative overflow-hidden text-white shadow-2xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
      <div className="relative z-10 space-y-6">
        <h3 className="text-3xl font-black leading-tight">Host your own space and <br />earn up to $2,500 / month</h3>
        <p className="text-brand-100/70 font-medium text-lg max-w-lg">
          You have the creative eye. Why not turn your studio into a revenue stream? List your space for free.
        </p>
        <Link to="/earnings-calculator" className="px-10 py-4.5 bg-brand-200 hover:bg-white text-brand-700 font-black rounded-2xl shadow-xl transition-all active:scale-95 cursor-pointer inline-block">
          Learn More
        </Link>
      </div>
    </div>
  </div>
);
};

const FavoritesTab = ({
  favorites,
  removedFromFavorites,
  onFavoriteClick,
}: {
  favorites: Favorite[];
  removedFromFavorites: Set<string>;
  onFavoriteClick: (spaceId: string) => void;
}) => (
  <div className="space-y-8">
    <div className="flex items-center justify-between">
      <h1 className="text-4xl font-black text-brand-700 tracking-tight">My Favorites</h1>
      <p className="text-brand-400 font-bold">{favorites.length} saved spaces</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {favorites.map((space) => {
        const spaceId = space.spaceId ?? space.id;
        const isFavorite = !removedFromFavorites.has(spaceId);
        return (
        <motion.div
          key={space.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[2.5rem] overflow-hidden border border-brand-200 shadow-lg hover:shadow-2xl transition-all group"
        >
          <div className="relative h-64 overflow-hidden">
            <Link to={`/space/${spaceId}`} className="block w-full h-full">
              <ImageWithFallback src={space.image ?? ''} alt={space.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
            </Link>
            <button
              type="button"
              onClick={() => onFavoriteClick(spaceId)}
              className={`absolute top-6 right-6 p-3 rounded-2xl shadow-lg hover:scale-110 transition-all cursor-pointer ${
                isFavorite ? 'bg-red-500/90 text-white backdrop-blur-md' : 'bg-white/90 backdrop-blur-md text-red-500'
              }`}
            >
              <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : 'fill-none'}`} />
            </button>
          </div>
          <div className="p-8 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <Link to={`/space/${spaceId}`} className="inline text-2xl font-black text-brand-700 hover:text-brand-500 transition-colors">{space.name}</Link>
                <p className="text-brand-400 font-bold">{space.location}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-xl">
                <Star className="w-4 h-4 text-brand-500 fill-brand-500" />
                <span className="font-black text-brand-700">{formatRatingScore(space.rating)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-brand-100">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-brand-700">${space.price}</span>
                <span className="text-brand-400 font-bold">/hr</span>
              </div>
              <Link to={`/space/${spaceId}#booking`} className="px-6 py-3 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-xl transition-all cursor-pointer">
                Book Space
              </Link>
            </div>
          </div>
        </motion.div>
      );
      })}
    </div>
  </div>
);

const MessagesTab = () => {
  const [activeMessageId, setActiveMessageId] = useState(messages[0].id);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  React.useEffect(() => {
    if (mobileView === 'chat') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileView]);

  const activeChat = messages.find(m => m.id === activeMessageId) || messages[0];
  const [inputValue, setInputValue] = useState('');

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    setInputValue('');
  };

  return (
    <div className={`h-[calc(100vh-120px)] lg:h-[calc(100vh-180px)] min-h-[600px] flex gap-0 md:gap-8 overflow-hidden relative ${mobileView === 'chat' ? 'fixed inset-0 z-50 md:relative md:inset-auto md:z-0 bg-white' : ''}`}>
      {/* Sidebar List */}
      <div 
        className={`w-full md:w-[350px] lg:w-[400px] flex flex-col bg-white rounded-none md:rounded-[3rem] border-r md:border border-brand-200 overflow-hidden shadow-2xl shadow-brand-700/5 transition-all duration-300
          ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
        `}
      >
        <div className="p-6 md:p-8 bg-white border-b border-brand-100">
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-brand-700 tracking-tight">Messages</h3>
            <button className="p-3 bg-brand-50 text-brand-500 rounded-2xl hover:bg-brand-700 hover:text-white transition-all cursor-pointer shadow-sm group">
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {messages.map((msg) => {
            const isActive = activeMessageId === msg.id;
            return (
              <button
                key={msg.id}
                onClick={() => {
                  setActiveMessageId(msg.id);
                  setMobileView('chat');
                }}
                className={`w-full flex items-center gap-4 p-5 rounded-[2rem] transition-all cursor-pointer relative group text-left
                  ${isActive 
                    ? 'bg-brand-700 text-white shadow-xl shadow-brand-700/20' 
                    : 'hover:bg-brand-50'
                  }
                `}
              >
                <div className="relative shrink-0">
                  <div className={`w-14 h-14 rounded-[1.25rem] overflow-hidden border-2 shadow-lg transition-transform group-hover:scale-105
                    ${isActive ? 'border-brand-600' : 'border-white'}
                  `}>
                    <ImageWithFallback src={msg.avatar} alt={msg.user} />
                  </div>
                  {msg.online && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                  )}
                  {msg.unread && !isActive && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 border-2 border-white rounded-full animate-pulse shadow-md" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h5 className={`font-black truncate text-base ${isActive ? 'text-white' : 'text-brand-700'}`}>
                      {msg.user}
                    </h5>
                    <span className={`text-[10px] font-black uppercase tracking-tighter shrink-0 ${isActive ? 'text-brand-200/80' : 'text-brand-300'}`}>
                      {msg.time}
                    </span>
                  </div>
                  <p className={`text-sm line-clamp-1 leading-snug
                    ${isActive 
                      ? 'text-brand-100/90 font-medium' 
                      : msg.unread ? 'font-black text-brand-700' : 'text-brand-400 font-medium'
                    }
                  `}>
                    {msg.lastMessage}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat View */}
      <div 
        className={`flex-1 flex flex-col bg-white rounded-none md:rounded-[3rem] border md:border-brand-200 overflow-hidden shadow-2xl shadow-brand-700/10 transition-all duration-300
          ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
        `}
      >
        {/* Header */}
        <div className="px-6 py-4 md:p-8 border-b border-brand-100 flex items-center justify-between bg-white/90 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-4 min-w-0">
            <button 
              onClick={() => setMobileView('list')}
              className="md:hidden p-3 bg-brand-50 text-brand-700 rounded-2xl active:scale-90 transition-transform"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-[1.5rem] overflow-hidden shadow-xl shrink-0 border-2 border-brand-50 relative group">
              <ImageWithFallback src={activeChat.avatar} alt={activeChat.user} />
              {activeChat.online && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
              )}
            </div>
            <div className="truncate">
              <h4 className="font-black text-brand-700 text-lg md:text-xl truncate leading-tight tracking-tight">{activeChat.user}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black text-brand-300 uppercase tracking-[0.1em]">{activeChat.role}</span>
                {activeChat.online && (
                  <>
                    <div className="w-1 h-1 bg-brand-200 rounded-full" />
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-green-500">
                      Active Now
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages History */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-12 bg-gradient-to-b from-brand-50/20 to-white custom-scrollbar">
          <div className="flex justify-center mb-4">
            <div className="px-5 py-2 bg-white/80 border border-brand-100 backdrop-blur-sm text-brand-300 text-[10px] font-black uppercase tracking-[0.25em] rounded-full shadow-sm">
              Today
            </div>
          </div>
          
          {activeChat.history.map((chat) => (
            <div 
              key={chat.id} 
              className={`flex gap-4 max-w-[85%] md:max-w-[75%] ${chat.type === 'sent' ? 'flex-row-reverse ml-auto' : ''}`}
            >
              {chat.type === 'received' && (
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shrink-0 mt-1 ring-2 ring-brand-50">
                  <ImageWithFallback src={activeChat.avatar} alt={activeChat.user} />
                </div>
              )}
              {chat.type === 'sent' && (
                <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center text-white shrink-0 mt-1 shadow-lg shadow-brand-700/20">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className={`space-y-2 ${chat.type === 'sent' ? 'text-right' : ''}`}>
                <div className={`px-5 py-4 md:px-7 md:py-5 shadow-xl rounded-[2rem] text-sm md:text-base leading-relaxed
                  ${chat.type === 'sent' 
                    ? 'bg-brand-700 text-white rounded-tr-none shadow-brand-700/10' 
                    : 'bg-white text-brand-700 rounded-tl-none border border-brand-100 shadow-brand-700/5'
                  }
                `}>
                  <p className="font-medium">{chat.text}</p>
                </div>
                <div className={`flex items-center gap-2 px-1 ${chat.type === 'sent' ? 'justify-end' : ''}`}>
                  <span className="text-[10px] font-black text-brand-200 uppercase tracking-tighter">{chat.time}</span>
                  {chat.type === 'sent' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-300" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-3 md:p-10 border-t border-brand-100 bg-white">
          <div className="flex items-center gap-2 md:gap-4 max-w-[1200px] mx-auto">
            <button className="p-3 md:p-4 bg-brand-50 text-brand-400 rounded-xl md:rounded-2xl hover:text-brand-700 hover:bg-brand-100 transition-all cursor-pointer shrink-0 active:scale-90 group">
              <Plus className="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-90 transition-transform" />
            </button>
            <div className="flex-1">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..." 
                className="w-full px-4 py-3 md:px-6 md:py-5 bg-brand-50 border-2 border-transparent rounded-[1.25rem] md:rounded-[1.75rem] focus:ring-0 focus:border-brand-700/10 focus:bg-white focus:shadow-inner transition-all font-medium text-xs md:text-base outline-none"
              />
            </div>
            <button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="px-5 md:px-12 py-3 md:py-5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-[1.25rem] md:rounded-[1.75rem] transition-all shadow-xl shadow-brand-700/20 active:scale-95 cursor-pointer text-xs md:text-base shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReviewsTab = () => {
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [editingReview, setEditingReview] = useState<MyReview | null>(null);
  const [editRatings, setEditRatings] = useState({ cleanliness: 0, communication: 0, location: 0, value: 0 });
  const [editText, setEditText] = useState('');
  const [editShowConfirm, setEditShowConfirm] = useState(false);
  const [deleteConfirmReview, setDeleteConfirmReview] = useState<MyReview | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMyReviews()
      .then(setMyReviews)
      .catch(() => setMyReviews([]));
  }, []);

  const openEdit = (review: MyReview) => {
    setEditingReview(review);
    setEditRatings({
      cleanliness: review.cleanliness ?? 0,
      communication: review.communication ?? 0,
      location: review.location ?? 0,
      value: review.value ?? 0,
    });
    setEditText(review.text);
    setEditShowConfirm(false);
  };

  const hasEditChanges = editingReview
    ? editText !== editingReview.text ||
      editRatings.cleanliness !== (editingReview.cleanliness ?? 0) ||
      editRatings.communication !== (editingReview.communication ?? 0) ||
      editRatings.location !== (editingReview.location ?? 0) ||
      editRatings.value !== (editingReview.value ?? 0)
    : false;

  const closeEdit = () => {
    if (hasEditChanges) { setEditShowConfirm(true); return; }
    setEditingReview(null);
  };

  const discardEdit = () => {
    setEditShowConfirm(false);
    setEditingReview(null);
  };

  const allEditRated = editRatings.cleanliness > 0 && editRatings.communication > 0 && editRatings.location > 0 && editRatings.value > 0;

  const handleEditSubmit = async () => {
    if (!editingReview || !allEditRated) return;
    setSubmitting(true);
    try {
      const overallRating = (editRatings.cleanliness + editRatings.communication + editRatings.location + editRatings.value) / 4;
      await updateReview(editingReview.spaceId, editingReview.id, {
        rating: overallRating,
        text: editText,
        cleanliness: editRatings.cleanliness,
        communication: editRatings.communication,
        location: editRatings.location,
        value: editRatings.value,
      });
      const updated = await fetchMyReviews();
      setMyReviews(updated);
      setEditingReview(null);
    } catch {
      // keep modal open on error
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (review: MyReview) => {
    try {
      await deleteReview(review.spaceId, review.id);
      setMyReviews((prev) => prev.filter((r) => r.id !== review.id));
      setDeleteConfirmReview(null);
    } catch {
      // keep dialog open on error
    }
  };

  return (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

    {/* Edit Review Modal */}
    <AnimatePresence>
      {editingReview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeEdit}
            className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-brand-200 overflow-hidden max-h-[95vh] flex flex-col"
          >
            <div className="relative p-6 sm:p-10 space-y-6 sm:space-y-8 overflow-y-auto">
              {/* Unsaved Changes Confirmation */}
              <AnimatePresence>
                {editShowConfirm && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-brand-900/20"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-md bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border-2 border-brand-200 p-8 sm:p-10"
                    >
                      <div className="space-y-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-brand-100 rounded-2xl">
                            <Info className="w-6 h-6 text-brand-700" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <h3 className="text-xl sm:text-2xl font-black text-brand-700">Unsaved Changes</h3>
                            <p className="text-sm sm:text-base text-brand-400 font-medium leading-relaxed">
                              You have unsaved changes to your review. Are you sure you want to discard them?
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setEditShowConfirm(false)}
                            className="flex-1 px-6 py-4 bg-brand-700 text-white font-black rounded-xl sm:rounded-2xl shadow-lg shadow-brand-700/20 hover:bg-brand-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Keep Editing
                          </button>
                          <button
                            type="button"
                            onClick={discardEdit}
                            className="flex-1 px-6 py-4 bg-brand-50 text-brand-700 font-black rounded-xl sm:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer"
                          >
                            Discard Changes
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-brand-700 tracking-tight">Edit Review</h2>
                  <p className="text-sm sm:text-base text-brand-400 font-medium">Editing your review for <span className="text-brand-700 font-black">{editingReview.spaceName}</span></p>
                </div>
                <button
                  onClick={closeEdit}
                  className="p-2 sm:p-3 bg-brand-50 text-brand-400 hover:text-brand-700 hover:bg-brand-100 rounded-xl sm:rounded-2xl transition-all cursor-pointer"
                >
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 rotate-45" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 py-4 sm:py-8 bg-brand-50/50 rounded-[1.5rem] sm:rounded-[2.5rem] border border-brand-100 px-4 sm:px-8">
                {[
                  { label: 'Cleanliness', key: 'cleanliness' },
                  { label: 'Communication', key: 'communication' },
                  { label: 'Location', key: 'location' },
                  { label: 'Value', key: 'value' },
                ].map((category) => {
                  return (
                    <div key={category.key} className="flex flex-col items-center gap-2 sm:gap-3 rounded-2xl p-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">
                        {category.label}
                      </p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setEditRatings((prev) => ({ ...prev, [category.key]: star }))}
                            className="p-1 transition-all hover:scale-125 cursor-pointer"
                          >
                            <Star className={`w-5 h-5 sm:w-6 sm:h-6 transition-all duration-300 ${star <= editRatings[category.key as keyof typeof editRatings] ? 'text-brand-500 fill-brand-500 scale-110' : 'text-brand-200 hover:text-brand-300'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!allEditRated && (
                <p className="text-xs font-bold text-red-400 -mt-2">Please rate all 4 categories to save your review.</p>
              )}

              <div className="space-y-4">
                <label className="text-xs sm:text-sm font-black text-brand-400 uppercase tracking-widest">Share more details</label>
                <textarea
                  rows={4}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="What did you love about this space? How was the host?"
                  className="w-full px-4 py-3 sm:px-6 sm:py-5 bg-brand-50 border border-brand-100 rounded-[1.5rem] sm:rounded-3xl focus:ring-2 focus:ring-brand-200 focus:outline-none font-medium text-brand-700 resize-none placeholder:text-brand-300 transition-all"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="order-2 sm:order-1 px-6 py-3.5 sm:px-8 sm:py-5 bg-brand-50 text-brand-700 font-black rounded-xl sm:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!allEditRated || submitting}
                  onClick={handleEditSubmit}
                  className="order-1 sm:order-2 flex-[2] px-6 py-3.5 sm:px-8 sm:py-5 bg-brand-700 text-white font-black rounded-xl sm:rounded-2xl shadow-xl shadow-brand-700/20 hover:bg-brand-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-brand-700"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Delete Confirmation Dialog */}
    <AnimatePresence>
      {deleteConfirmReview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteConfirmReview(null)}
            className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border-2 border-brand-200 p-8 sm:p-10"
          >
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl sm:text-2xl font-black text-brand-700">Delete Review</h3>
                  <p className="text-sm sm:text-base text-brand-400 font-medium leading-relaxed">
                    Are you sure you want to delete your review for <span className="font-black text-brand-700">{deleteConfirmReview.spaceName}</span>? This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmReview(null)}
                  className="flex-1 px-6 py-4 bg-brand-50 text-brand-700 font-black rounded-xl sm:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirmReview)}
                  className="flex-1 px-6 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl sm:rounded-2xl shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  Delete Review
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h2 className="text-4xl font-black text-brand-700 tracking-tight">Reviews I've Written</h2>
        <p className="text-brand-400 font-medium text-lg mt-2">Manage your feedback and help the community grow.</p>
      </div>
      <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-brand-100 shadow-sm">
        <Star className="w-5 h-5 text-brand-500 fill-brand-500" />
        <span className="text-brand-700 font-black">
          {myReviews.length > 0
            ? formatRatingScore(myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length)
            : '—'} Average Rating Given
        </span>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6">
      {myReviews.map((review) => (
        <motion.div 
          key={review.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-8 border border-brand-200 shadow-xl shadow-brand-700/5 group hover:shadow-2xl transition-all"
        >
          <div className="flex flex-col md:flex-row gap-8">
            <Link to={`/space/${review.spaceId}`} className="w-full md:w-40 h-28 rounded-2xl overflow-hidden shrink-0 block">
              <ImageWithFallback src={review.spaceImage ?? ''} alt={review.spaceName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </Link>
            
            <div className="flex-1 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <Link to={`/space/${review.spaceId}`} className="inline hover:text-brand-500 transition-colors">
                    <h4 className="text-xl font-black text-brand-700">{review.spaceName}</h4>
                  </Link>
                  <p className="text-brand-300 font-bold text-sm uppercase tracking-wider mt-1">
                    {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <FractionalStars rating={review.rating} />
              </div>
              
              <p className="text-brand-600 font-medium text-lg leading-relaxed italic">
                "{review.text}"
              </p>
              
              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={() => openEdit(review)}
                  className="text-sm font-black text-brand-700 hover:text-brand-400 transition-colors flex items-center gap-2 group/btn cursor-pointer"
                >
                  Edit Review
                  <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => setDeleteConfirmReview(review)}
                  className="text-sm font-black text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ))}

      {myReviews.length === 0 && (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border border-brand-100">
          <div className="w-24 h-24 bg-brand-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <Star className="w-12 h-12 text-brand-200" />
          </div>
          <h3 className="text-2xl font-black text-brand-700">No reviews written yet</h3>
          <p className="text-brand-400 font-medium mt-2 max-w-sm mx-auto">
            Once you complete a booking, you'll be able to share your experience with the community.
          </p>
          <button className="mt-8 px-10 py-4 bg-brand-700 text-white font-black rounded-2xl hover:bg-brand-600 transition-all cursor-pointer shadow-lg active:scale-95">
            Book a Space
          </button>
        </div>
      )}
    </div>
  </div>
  );
};

const BillingTab = () => (
  <div className="space-y-8 md:space-y-12">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl md:text-4xl font-black text-brand-700 tracking-tight">Billing & Payments</h1>
    </div>

    <div className="flex flex-col gap-8 md:gap-12">
      {/* Payment Methods */}
      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-brand-200 shadow-xl shadow-brand-700/5 space-y-6 md:space-y-8 max-w-3xl">
        <h3 className="text-lg md:text-2xl font-black text-brand-700 flex items-center gap-3">
          <CreditCard className="w-6 h-6 md:w-7 md:h-7 text-brand-500" />
          Payment Methods
        </h3>
        <div className="space-y-4">
          <div className="p-4 md:p-6 bg-brand-50 border-2 border-brand-700 rounded-xl md:rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-7 md:w-12 md:h-8 bg-brand-700 rounded-md flex items-center justify-center text-[6px] md:text-[8px] text-white font-black uppercase tracking-widest shrink-0">VISA</div>
              <div className="min-w-0">
                <p className="font-black text-brand-700 text-sm md:text-base truncate">•••• 4242</p>
                <p className="text-[10px] font-bold text-brand-400 mt-1 uppercase tracking-wider truncate">Expires 12/28 · Primary</p>
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-brand-700 shrink-0" />
          </div>
          <div className="p-4 md:p-6 bg-white border border-brand-100 rounded-xl md:rounded-2xl flex items-center justify-between hover:border-brand-300 transition-all cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-7 md:w-12 md:h-8 bg-black rounded-md flex items-center justify-center text-[8px] md:text-[10px] text-white font-black shrink-0">Pay</div>
              <div className="min-w-0">
                <p className="font-black text-brand-700 text-sm md:text-base truncate">Apple Pay</p>
                <p className="text-[10px] font-bold text-brand-400 mt-1 uppercase tracking-wider truncate">Default for mobile</p>
              </div>
            </div>
            <button className="text-brand-300 hover:text-red-500 transition-colors shrink-0">
              <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-brand-200 overflow-hidden shadow-xl shadow-brand-700/5">
      <div className="p-6 md:p-8 border-b border-brand-100 flex items-center justify-between">
        <h3 className="text-lg md:text-2xl font-black text-brand-700">Transaction History</h3>
        <button className="text-brand-500 font-bold hover:text-brand-700 flex items-center gap-2 text-xs md:text-sm">
          Download All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[600px] md:min-w-0">
          <thead>
            <tr className="bg-brand-50">
              <th className="px-6 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-black text-brand-400 uppercase tracking-widest">ID</th>
              <th className="px-6 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-black text-brand-400 uppercase tracking-widest">Date</th>
              <th className="px-6 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-black text-brand-400 uppercase tracking-widest">Method</th>
              <th className="px-6 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-black text-brand-400 uppercase tracking-widest text-right">Amount</th>
              <th className="px-6 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-black text-brand-400 uppercase tracking-widest text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-brand-50/50 transition-colors">
                <td className="px-6 md:px-8 py-4 md:py-6 font-bold text-brand-700 text-sm md:text-base">{t.id}</td>
                <td className="px-6 md:px-8 py-4 md:py-6 text-brand-500 font-medium text-sm md:text-base">{t.date}</td>
                <td className="px-6 md:px-8 py-4 md:py-6 text-brand-500 font-medium text-sm md:text-base">{t.method}</td>
                <td className="px-6 md:px-8 py-4 md:py-6 text-brand-700 font-black text-right text-sm md:text-base">${t.amount}</td>
                <td className="px-6 md:px-8 py-4 md:py-6 text-right">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
);

const allNotifications = [
  { id: 1, type: 'Booking', title: 'Booking Confirmed', message: 'Your reservation at Industrial Loft is confirmed for tomorrow at 10:00 AM.', time: '2 mins ago', unread: true, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 2, type: 'Message', title: 'New Message', message: 'Sarah Chen: "Hi! Looking forward to hosting you. Let me know if you need anything."', time: '1 hour ago', unread: true, icon: MessageSquare, color: 'text-brand-500', bg: 'bg-brand-50' },
  { id: 3, type: 'Reminder', title: 'Upcoming Session', message: 'Your creative workshop starts in 2 hours. Don\'t forget to bring your gear!', time: '3 hours ago', unread: false, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 4, type: 'System', title: 'New Space Nearby', message: 'A stunning new recording studio just opened up 2 blocks away from you.', time: '5 hours ago', unread: false, icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 5, type: 'Billing', title: 'Payment Successful', message: 'Payment of $240.00 for your last booking has been processed successfully.', time: '1 day ago', unread: false, icon: CreditCard, color: 'text-brand-700', bg: 'bg-brand-100' },
  { id: 6, type: 'Booking', title: 'Booking Request', message: 'You have a new request for your "Minimalist Photo Studio" for this weekend.', time: '2 days ago', unread: false, icon: Package, color: 'text-brand-400', bg: 'bg-brand-50' },
  { id: 7, type: 'Security', title: 'New Login Detected', message: 'A new login was detected from a Chrome browser on a Mac device.', time: '3 days ago', unread: false, icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 8, type: 'Review', title: 'New Review Received', message: 'Guest "Mark J." left you a 5-star review: "Amazing space, highly recommended!"', time: '4 days ago', unread: false, icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { id: 9, type: 'Booking', title: 'Booking Cancelled', message: 'Your reservation at Sunset Recording was cancelled. A full refund has been issued.', time: '5 days ago', unread: false, icon: Trash2, color: 'text-red-600', bg: 'bg-red-50' },
  { id: 10, type: 'System', title: 'Profile Updated', message: 'Your profile information has been successfully updated.', time: '1 week ago', unread: false, icon: User, color: 'text-brand-600', bg: 'bg-brand-50' },
  { id: 11, type: 'Billing', title: 'Payout Scheduled', message: 'A payout of $1,250.00 has been scheduled for your bank account ending in 8899.', time: '1 week ago', unread: false, icon: CreditCard, color: 'text-green-700', bg: 'bg-green-50' },
  { id: 12, type: 'Promotion', title: 'Host Referral Bonus', message: 'Refer a friend to host and earn $50 after their first booking is completed.', time: '2 weeks ago', unread: false, icon: Sparkles, color: 'text-brand-500', bg: 'bg-brand-100' },
];

const NotificationsTab = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(allNotifications.length / itemsPerPage);
  
  const currentNotifications = allNotifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-brand-700 tracking-tight">Notifications</h2>
          <p className="text-brand-400 font-medium text-sm md:text-lg mt-1 md:mt-2">Stay up to date with your activity.</p>
        </div>
        <button className="w-full md:w-auto px-6 md:px-8 py-2.5 md:py-3.5 bg-brand-100 hover:bg-brand-200 text-brand-700 font-black rounded-xl md:rounded-2xl transition-all active:scale-95 cursor-pointer text-xs md:text-base">
          Mark all as read
        </button>
      </div>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-2 md:p-8 border border-brand-200 shadow-xl shadow-brand-700/5 divide-y divide-brand-50">
        {currentNotifications.map((notif) => (
          <div key={notif.id} className={`p-4 md:p-6 flex gap-4 md:gap-6 transition-all hover:bg-brand-50/50 rounded-2xl md:rounded-3xl group ${notif.unread ? 'bg-brand-50/30' : ''}`}>
            <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] ${notif.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm`}>
              <notif.icon className={`w-6 h-6 md:w-8 md:h-8 ${notif.color}`} />
            </div>
            
            <div className="flex-1 space-y-1 md:space-y-2 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 md:gap-2">
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-[10px] md:text-sm font-black text-brand-400 uppercase tracking-widest leading-none">{notif.type}</span>
                  {notif.unread && <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-brand-500 shadow-[0_0_12px_rgba(180,131,106,0.6)] animate-pulse" />}
                </div>
                <span className="text-[10px] md:text-sm font-bold text-brand-300">{notif.time}</span>
              </div>
              <h4 className="text-base md:text-xl font-black text-brand-700 leading-tight truncate md:whitespace-normal">{notif.title}</h4>
              <p className="text-xs md:text-lg text-brand-500 font-medium leading-relaxed max-w-3xl line-clamp-2 md:line-clamp-none">
                {notif.message}
              </p>
              <div className="pt-1 md:pt-2 flex items-center gap-3 md:gap-4">
                <button className="text-[10px] md:text-sm font-black text-brand-700 hover:text-brand-400 transition-colors cursor-pointer flex items-center gap-1 group/btn">
                  View Details
                  <ChevronRight className="w-3 h-3 md:w-4 md:h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
                {notif.unread && (
                  <button className="text-[10px] md:text-sm font-black text-brand-300 hover:text-brand-700 transition-colors cursor-pointer">
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {allNotifications.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-brand-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <BellIcon className="w-10 h-10 text-brand-300" />
            </div>
            <h3 className="text-2xl font-black text-brand-700">No notifications yet</h3>
            <p className="text-brand-400 font-medium mt-2">We'll let you know when something important happens.</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button 
            onClick={() => {
              setCurrentPage(prev => Math.max(1, prev - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === 1}
            className="p-3 bg-white border border-brand-100 rounded-2xl text-brand-700 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md group cursor-pointer"
          >
            <ChevronDown className="w-6 h-6 rotate-90 group-hover:-translate-x-1 transition-transform" />
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                onClick={() => {
                  setCurrentPage(i + 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-12 h-12 rounded-2xl font-black transition-all cursor-pointer ${
                  currentPage === i + 1 
                    ? 'bg-brand-700 text-white shadow-lg' 
                    : 'bg-white border border-brand-100 text-brand-700 hover:bg-brand-50 shadow-sm'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button 
            onClick={() => {
              setCurrentPage(prev => Math.min(totalPages, prev + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === totalPages}
            className="p-3 bg-white border border-brand-100 rounded-2xl text-brand-700 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md group cursor-pointer"
          >
            <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
};

const SettingsTab = () => {
  const { user, setUser } = useAuth();
  const [activeSecurityAction, setActiveSecurityAction] = useState<string | null>(null);
  const [selected2FAMethod, setSelected2FAMethod] = useState<string>('app');
  const [passwordForm, setPasswordForm] = useState<[string, string, string]>(['', '', '']);
  const [passwordFormSubmitting, setPasswordFormSubmitting] = useState(false);

  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileTitle, setProfileTitle] = useState(user?.professionalTitle ?? '');
  const [profileBio, setProfileBio] = useState(user?.bio ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setProfileName(user?.name ?? '');
    setProfileTitle(user?.professionalTitle ?? '');
    setProfileBio(user?.bio ?? '');
  }, [user?.id, user?.name, user?.professionalTitle, user?.bio]);

  useEffect(() => {
    if (!activeSecurityAction) setPasswordForm(['', '', '']);
  }, [activeSecurityAction]);

  const hasProfileChanges =
    profileName !== (user?.name ?? '') ||
    profileTitle !== (user?.professionalTitle ?? '') ||
    profileBio !== (user?.bio ?? '');

  const handleApplyProfileChanges = async () => {
    if (!hasProfileChanges) return;
    setProfileError(null);
    setProfileSaving(true);
    try {
      const updated = await updateMe({
        name: profileName,
        professionalTitle: profileTitle || undefined,
        bio: profileBio || undefined
      });
      setUser(updated);
      const token = getStoredToken();
      if (token) saveAuth(token, updated);
    } catch (e: unknown) {
      setProfileError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async () => {
    const [current, newPw, confirm] = passwordForm;
    if (!current || !newPw || !confirm) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPw !== confirm) {
      toast.error('New password and confirmation do not match');
      return;
    }
    const pwValidation = validatePassword(newPw);
    if (!pwValidation.valid) {
      toast.error(pwValidation.error);
      return;
    }
    setPasswordFormSubmitting(true);
    try {
      await changePassword(current, newPw);
      setActiveSecurityAction(null);
      toast.success('Password updated successfully');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update password');
    } finally {
      setPasswordFormSubmitting(false);
    }
  };

  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);

  useEffect(() => {
    setDisplayAvatarUrl(user?.avatarUrl ?? null);
  }, [user?.avatarUrl]);

  const triggerAvatarFileInput = () => {
    setAvatarError(null);
    avatarFileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const { url } = await apiUploadFile(file);
      const updated = await updateMe({ avatarUrl: url });
      setUser(updated);
      setDisplayAvatarUrl(updated.avatarUrl ?? null);
      const token = getStoredToken();
      if (token) saveAuth(token, updated);
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const updated = await updateMe({ avatarUrl: null });
      setUser(updated);
      setDisplayAvatarUrl(null);
      const token = getStoredToken();
      if (token) saveAuth(token, updated);
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  const securityActions = {
    'Password': {
      title: 'Reset Password',
      desc: 'Create a new, secure password. Use at least 8 characters and at least one uppercase letter.',
      fields: [
        { label: 'Current Password', type: 'password', placeholder: '••••••••' },
        { label: 'New Password', type: 'password', placeholder: '••••••••' },
        { label: 'Confirm New Password', type: 'password', placeholder: '••••••••' }
      ]
    },
    'Two-factor Authentication': {
      title: 'Two-factor Authentication',
      desc: 'Enhance your account security by adding an extra layer of protection.',
      fields: [
        { 
          label: 'Authentication Method', 
          type: 'custom_selection', 
          options: [
            { id: 'app', label: 'Authenticator App', desc: 'Use an app like Google Authenticator or Authy to get codes.', icon: Shield },
            { id: 'sms', label: 'SMS Verification', desc: 'Receive a text message with a one-time code on your phone.', icon: Smartphone }
          ]
        }
      ]
    }
  };

  return (
    <div className="space-y-12 pb-12 relative">
      <AnimatePresence>
        {activeSecurityAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveSecurityAction(null)}
              className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl border border-brand-200 overflow-hidden"
            >
              <div className="p-10 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-brand-700 tracking-tight">{securityActions[activeSecurityAction as keyof typeof securityActions].title}</h2>
                    <p className="text-brand-400 font-medium">{securityActions[activeSecurityAction as keyof typeof securityActions].desc}</p>
                  </div>
                  <button 
                    onClick={() => setActiveSecurityAction(null)}
                    className="p-3 bg-brand-50 text-brand-400 hover:text-brand-700 hover:bg-brand-100 rounded-2xl transition-all cursor-pointer"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-6">
                  {securityActions[activeSecurityAction as keyof typeof securityActions].fields.map((field, idx) => (
                    <div key={idx} className="space-y-2">
                      <label className="text-sm font-black text-brand-400 uppercase tracking-widest">{field.label}</label>
                      {field.type === 'custom_selection' ? (
                        <div className="grid grid-cols-1 gap-4 mt-2">
                          {field.options?.map((opt: any) => (
                            <button 
                              key={opt.id}
                              onClick={() => setSelected2FAMethod(opt.id)}
                              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left group cursor-pointer ${
                                selected2FAMethod === opt.id 
                                  ? 'bg-white border-brand-700 shadow-lg shadow-brand-700/5' 
                                  : 'bg-brand-50 border-transparent hover:border-brand-200'
                              }`}
                            >
                              <div className={`p-3 rounded-xl shadow-sm transition-colors ${
                                selected2FAMethod === opt.id ? 'bg-brand-700 text-white' : 'bg-white text-brand-500 group-hover:text-brand-700'
                              }`}>
                                <opt.icon className="w-6 h-6" />
                              </div>
                              <div>
                                <p className={`font-black transition-colors ${selected2FAMethod === opt.id ? 'text-brand-700' : 'text-brand-700'}`}>{opt.label}</p>
                                <p className="text-xs text-brand-400 font-medium leading-relaxed">{opt.desc}</p>
                              </div>
                              {selected2FAMethod === opt.id && (
                                <div className="ml-auto">
                                  <div className="w-5 h-5 rounded-full bg-brand-700 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                  </div>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : field.type === 'select' ? (
                        <div className="relative group/select">
                          <select className="w-full px-6 py-4 bg-brand-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-200 focus:outline-none font-bold text-brand-700 appearance-none cursor-pointer">
                            {field.options?.map(opt => <option key={opt}>{opt}</option>)}
                          </select>
                          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-400 pointer-events-none group-hover/select:text-brand-700 transition-colors" />
                        </div>
                      ) : (
                        <input 
                          type={field.type}
                          placeholder={field.placeholder}
                          value={activeSecurityAction === 'Password' ? passwordForm[idx] : undefined}
                          onChange={(e) => activeSecurityAction === 'Password' && setPasswordForm(prev => {
                            const p = [...prev];
                            p[idx] = e.target.value;
                            return p as [string, string, string];
                          })}
                          className="w-full px-6 py-4 bg-brand-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-200 focus:outline-none font-bold text-brand-700 placeholder:text-brand-200"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setActiveSecurityAction(null)}
                    className="flex-1 px-8 py-4 bg-brand-50 text-brand-700 font-black rounded-xl hover:bg-brand-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={activeSecurityAction === 'Password' ? handlePasswordSubmit : undefined}
                    disabled={activeSecurityAction === 'Password' && passwordFormSubmitting}
                    className="flex-1 px-8 py-4 bg-brand-700 text-white font-black rounded-xl shadow-xl shadow-brand-700/20 hover:bg-brand-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {activeSecurityAction === 'Password' && passwordFormSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-6 md:mb-10">
        <h1 className="text-2xl md:text-4xl font-black text-brand-700 tracking-tight">Account Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 md:gap-12">
        <div className="space-y-2 md:space-y-4">
          <h3 className="text-lg md:text-xl font-black text-brand-700">Profile Information</h3>
          <p className="text-sm text-brand-400 font-medium">Update your photo and personal details here.</p>
        </div>
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-brand-200 shadow-xl shadow-brand-700/5 space-y-6 md:space-y-8 group/settings-card relative transition-all duration-500 hover:shadow-2xl hover:shadow-brand-700/10">
          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
          />
          <div className="flex flex-col sm:flex-row items-center gap-6 md:gap-8">
            <div
              role="button"
              tabIndex={0}
              onClick={triggerAvatarFileInput}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerAvatarFileInput(); } }}
              className="relative group cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded-2xl md:rounded-[2rem]"
              aria-label={(displayAvatarUrl ?? user?.avatarUrl) ? 'Change profile photo' : 'Add profile photo'}
            >
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl md:rounded-[2rem] bg-brand-100 overflow-hidden border-4 border-white shadow-xl">
                <ImageWithFallback
                  key={displayAvatarUrl ?? user?.avatarUrl ?? 'default'}
                  src={displayAvatarUrl ?? user?.avatarUrl ?? 'https://images.unsplash.com/photo-1535711905757-85180196c21a?q=80&w=200'}
                  alt="Avatar"
                />
              </div>
              {avatarUploading ? (
                <div className="absolute inset-0 bg-brand-700/80 rounded-2xl md:rounded-[2rem] flex items-center justify-center">
                  <span className="text-white text-xs md:text-sm font-bold">Uploading…</span>
                </div>
              ) : (
                <div className="absolute inset-0 bg-brand-700/60 rounded-2xl md:rounded-[2rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                  <Plus className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
              )}
            </div>
            <div className="text-center sm:text-left w-full">
              <h4 className="text-base md:text-lg font-black text-brand-700">Profile Photo</h4>
              <p className="text-xs md:text-sm text-brand-400 font-bold mb-4">Recommended size: 800x800px</p>
              {avatarError && <p className="text-sm text-red-500 font-medium mb-3">{avatarError}</p>}
              <div className="flex flex-wrap justify-center sm:justify-start gap-3 md:gap-4">
                <button
                  type="button"
                  onClick={triggerAvatarFileInput}
                  disabled={avatarUploading}
                  className="px-4 py-2 bg-brand-50 text-brand-700 font-black text-xs md:text-sm rounded-lg hover:bg-brand-100 transition-all cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
                >
                  {displayAvatarUrl ?? user?.avatarUrl ? 'Change' : 'Add photo'}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading || !(displayAvatarUrl ?? user?.avatarUrl)}
                  className="px-4 py-2 bg-red-50 text-red-500 font-black text-xs md:text-sm rounded-lg hover:bg-red-100 transition-all cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[10px] md:text-sm font-black text-brand-400 uppercase tracking-widest">Full Name</label>
              <input 
                type="text" 
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-brand-50 border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-brand-200 focus:outline-none font-bold text-brand-700 text-sm md:text-base"
              />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[10px] md:text-sm font-black text-brand-400 uppercase tracking-widest">Professional Title</label>
              <input 
                type="text" 
                value={profileTitle}
                onChange={(e) => setProfileTitle(e.target.value)}
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-brand-50 border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-brand-200 focus:outline-none font-bold text-brand-700 text-sm md:text-base"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5 md:space-y-2">
              <label className="text-[10px] md:text-sm font-black text-brand-400 uppercase tracking-widest">Bio</label>
              <textarea 
                rows={3}
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-brand-50 border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-brand-200 focus:outline-none font-bold text-brand-700 resize-none text-sm md:text-base"
              />
            </div>
          </div>

          {profileError && (
            <p className="text-sm text-red-500 font-medium">{profileError}</p>
          )}

          <div className={`grid transition-all duration-500 ease-in-out !mt-0 ${hasProfileChanges ? 'grid-rows-[1fr] opacity-100 !mt-6 md:!mt-8' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className={`pt-6 md:pt-8 border-t border-brand-100 flex justify-end transform transition-all duration-700 ${hasProfileChanges ? 'translate-y-0' : 'translate-y-8'}`}>
                <button 
                  onClick={handleApplyProfileChanges}
                  disabled={profileSaving}
                  className="flex items-center gap-2 px-6 md:px-10 py-3 md:py-4 bg-brand-700 text-white font-black rounded-xl md:rounded-2xl shadow-xl shadow-brand-700/20 hover:bg-brand-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-sm md:text-base disabled:opacity-70 disabled:pointer-events-none"
                >
                  <CheckCircle2 className="w-4 h-4 md:w-5 h-5" />
                  {profileSaving ? 'Saving…' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-brand-100 pt-8 md:pt-12" />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 md:gap-12">
        <div className="space-y-2 md:space-y-4">
          <h3 className="text-lg md:text-xl font-black text-brand-700">Account Security</h3>
          <p className="text-sm text-brand-400 font-medium">Manage your password and security preferences.</p>
        </div>
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-brand-200 shadow-xl shadow-brand-700/5 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between p-4 md:p-6 bg-brand-50 rounded-xl md:rounded-2xl">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 bg-white rounded-lg md:rounded-xl shadow-sm text-brand-500">
                <Mail className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="font-black text-brand-700 text-sm md:text-base">Email Address</p>
                <p className="text-xs md:text-sm text-brand-400 font-bold">{user?.email ?? '—'}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 md:p-6 bg-brand-50 rounded-xl md:rounded-2xl">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 bg-white rounded-lg md:rounded-xl shadow-sm text-brand-500">
                <Lock className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="font-black text-brand-700 text-sm md:text-base">Password</p>
                <p className="text-xs md:text-sm text-brand-400 font-bold">Last changed 3 months ago</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveSecurityAction('Password')}
              className="group relative px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-brand-700 to-brand-600 text-white font-black text-xs md:text-sm rounded-xl shadow-lg shadow-brand-700/20 hover:shadow-xl hover:shadow-brand-700/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:rotate-180 transition-transform duration-500" />
                Reset
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-brand-600 to-brand-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 md:p-6 bg-brand-50 rounded-xl md:rounded-2xl">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 bg-white rounded-lg md:rounded-xl shadow-sm text-brand-500">
                <Smartphone className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="font-black text-brand-700 text-sm md:text-base">Two-factor Authentication</p>
                <p className="text-[10px] md:text-sm text-green-500 font-bold">Enabled</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveSecurityAction('Two-factor Authentication')}
              className="px-3 md:px-4 py-1.5 md:py-2 bg-white text-brand-700 font-black text-[10px] md:text-xs rounded-lg shadow-sm cursor-pointer hover:bg-brand-50 transition-colors"
            >
              Manage
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-brand-100 pt-8 md:pt-12" />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 md:gap-12">
        <div className="space-y-2 md:space-y-4">
          <h3 className="text-lg md:text-xl font-black text-brand-700">Notifications</h3>
          <p className="text-sm text-brand-400 font-medium">Control how and when you receive updates.</p>
        </div>
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-brand-200 shadow-xl shadow-brand-700/5 space-y-4 md:space-y-6">
          {[
            { label: 'Booking Updates', desc: 'Get notified when a booking is confirmed or changed.', checked: true },
            { label: 'Message Alerts', desc: 'Instant notifications when you receive a message from a host.', checked: true },
            { label: 'Promotions', desc: 'Receive exclusive deals and news about new spaces.', checked: false },
            { label: 'Security Alerts', desc: 'Get notified about important account security changes.', checked: true },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 md:gap-8 pb-4 md:pb-6 border-b border-brand-100 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-black text-brand-700 text-sm md:text-base truncate">{item.label}</p>
                <p className="text-xs md:text-sm text-brand-400 font-medium mt-0.5 md:mt-1 line-clamp-2">{item.desc}</p>
              </div>
              <button className={`w-14 md:w-16 h-8 md:h-9 rounded-full transition-all relative shrink-0 ${item.checked ? 'bg-brand-700' : 'bg-brand-200'} cursor-pointer scale-110 md:scale-100`}>
                <div className={`absolute top-1 w-6 h-6 md:w-7 md:h-7 bg-white rounded-full transition-all ${item.checked ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Dashboard = () => {
  const { user, logout } = useAuth();
  const { hasUnreadBookings, markBookingsAsRead, newestBookingId, clearNewestBooking } = useUnreadBookings();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'My Bookings';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [removedFromFavorites, setRemovedFromFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBookings()
      .then(setBookings)
      .catch(() => setBookings([]));
    fetchFavorites()
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, []);

  // Refetch bookings when switching to My Bookings so the new booking is in the list
  useEffect(() => {
    if (activeTab === 'My Bookings') {
      fetchBookings()
        .then(setBookings)
        .catch(() => setBookings([]));
    }
  }, [activeTab]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const tab = searchParams.get('tab') || 'My Bookings';
    if (tab === 'My Bookings') markBookingsAsRead();
  }, [searchParams, markBookingsAsRead]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    if (tab === 'My Bookings') markBookingsAsRead();
    else clearNewestBooking();
  };

  const handleFavoritesTabFavoriteClick = (spaceId: string) => {
    const isFav = !removedFromFavorites.has(spaceId);
    if (isFav) {
      removeFavorite(spaceId).then(() => setRemovedFromFavorites((prev) => new Set(prev).add(spaceId))).catch(() => {});
    } else {
      addFavorite(spaceId).then(() => setRemovedFromFavorites((prev) => {
        const next = new Set(prev);
        next.delete(spaceId);
        return next;
      })).catch(() => {});
    }
  };

  const menuItems = [
    { label: 'My Bookings', icon: Package },
    { label: 'Favorites', icon: Heart },
    { label: 'Messages', icon: MessageSquare },
    { label: 'Notifications', icon: BellIcon },
    { label: 'Reviews', icon: Star },
    { label: 'Billing', icon: CreditCard },
    { label: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'My Bookings': return <BookingsTab bookings={bookings} setBookings={setBookings} newestBookingId={newestBookingId} />;
      case 'Favorites': return <FavoritesTab favorites={favorites} removedFromFavorites={removedFromFavorites} onFavoriteClick={handleFavoritesTabFavoriteClick} />;
      case 'Messages': return <MessagesTab />;
      case 'Notifications': return <NotificationsTab />;
      case 'Reviews': return <ReviewsTab />;
      case 'Billing': return <BillingTab />;
      case 'Settings': return <SettingsTab />;
      default: return <BookingsTab bookings={bookings} setBookings={setBookings} newestBookingId={newestBookingId} />;
    }
  };

  return (
    <div className="pt-24 md:pt-32 pb-24 min-h-screen bg-brand-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[350px_1fr] gap-8 md:gap-12">
          {/* Sidebar */}
          <aside className="lg:block">
            <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-8 border border-brand-200 shadow-xl shadow-brand-700/5 lg:sticky lg:top-32 lg:h-[calc(100vh-180px)] flex flex-col">
              <div className="flex flex-row lg:flex-col items-center gap-4 lg:text-center mb-6 lg:mb-8 border-b lg:border-none border-brand-100 pb-6 lg:pb-0 shrink-0">
                <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-brand-100 shrink-0 overflow-hidden border-2 md:border-4 border-white shadow-lg">
                  <ImageWithFallback src={user?.avatarUrl ?? 'https://images.unsplash.com/photo-1535711905757-85180196c21a?q=80&w=200'} alt={user?.name ?? 'Avatar'} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl md:text-2xl font-black text-brand-700">{user?.name ?? 'User'}</h3>
                  <p className="text-brand-400 font-bold text-sm md:text-base">{user?.professionalTitle || user?.email || ''}</p>
                </div>
              </div>

              <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto pb-4 lg:pb-0 scrollbar-hide flex-1">
                {menuItems.map((item) => (
                  <button 
                    key={item.label}
                    onClick={() => handleTabChange(item.label)}
                    className={`whitespace-nowrap flex-shrink-0 flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl font-bold transition-all cursor-pointer ${activeTab === item.label ? 'bg-brand-700 text-white shadow-lg' : 'text-brand-500 hover:bg-brand-50 hover:text-brand-700'}`}
                  >
                    <div className="flex items-center gap-3 relative">
                      <item.icon className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="text-sm md:text-base">{item.label}</span>
                      {item.label === 'My Bookings' && (
                        <UnreadBadge show={hasUnreadBookings} position="inline" size="sm" />
                      )}
                    </div>
                    {activeTab === item.label && (
                      <motion.div layoutId="activeTabIndicator" className="hidden lg:block">
                        <ChevronRight className="w-4 h-4" />
                      </motion.div>
                    )}
                  </button>
                ))}
              </nav>

              <div className="mt-4 lg:mt-8 pt-4 lg:pt-8 border-t border-brand-100 hidden lg:block shrink-0">
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
};
