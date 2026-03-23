import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  Search,
  Calendar,
  Clock,
  User,
  Star,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  Timer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useParams, useNavigate } from 'react-router';
import { format, parseISO } from 'date-fns';
import { ImageWithFallback } from './ImageWithFallback';
import { toast } from 'sonner';
import { fetchSpace } from '../api/spaces';
import type { Space } from '../api/spaces';
import { fetchHostSpaceBookings, fetchHostGuestProfile } from '../api/host';
import type { HostSpaceBooking, HostGuestProfile } from '../api/host';
import { updateBookingStatus } from '../api/bookings';

function parseTimeToMinutes(t: string): number {
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function getDurationHours(startTime: string, endTime: string): number {
  let startM = parseTimeToMinutes(startTime);
  let endM = parseTimeToMinutes(endTime);
  if (endM <= startM && endTime === '12:00 AM') endM = 24 * 60;
  return (endM - startM) / 60;
}

export const ListingBookings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const spaceId = id ?? '';

  const [space, setSpace] = useState<Space | null>(null);
  const [bookings, setBookings] = useState<HostSpaceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'completed' | 'cancelled'>('all');
  const [selectedGuest, setSelectedGuest] = useState<HostSpaceBooking | null>(null);
  const [guestProfile, setGuestProfile] = useState<HostGuestProfile | null>(null);
  const [guestProfileLoading, setGuestProfileLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadBookings = useCallback(() => {
    if (!spaceId) return;
    fetchHostSpaceBookings(spaceId)
      .then(setBookings)
      .catch(() => setBookings([]));
  }, [spaceId]);

  useEffect(() => {
    if (!spaceId) {
      navigate('/host/manage-listings', { replace: true });
      return;
    }
    setLoading(true);
    Promise.all([fetchSpace(spaceId), fetchHostSpaceBookings(spaceId)])
      .then(([s, b]) => {
        setSpace(s);
        setBookings(b);
      })
      .catch(() => {
        setSpace(null);
        setBookings([]);
        navigate('/host/manage-listings', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [spaceId, navigate]);

  React.useEffect(() => {
    if (selectedGuest) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedGuest]);

  const filteredBookings = bookings.filter((booking) => {
    if (booking.status === 'cancelled') return false;
    const matchesSearch =
      booking.guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.guest.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const stats = {
    total: activeBookings.length,
    confirmed: activeBookings.filter((b) => b.status === 'confirmed').length,
    pending: activeBookings.filter((b) => b.status === 'pending').length,
    completed: activeBookings.filter((b) => b.status === 'completed').length,
    totalRevenue: activeBookings.reduce((sum, b) => sum + b.totalPrice, 0),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-brand-100 text-brand-700 border-brand-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const handleConfirm = (bookingId: string) => {
    setActioningId(bookingId);
    updateBookingStatus(bookingId, 'confirmed')
      .then(() => {
        toast.success('Booking confirmed!');
        loadBookings();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to confirm booking'))
      .finally(() => setActioningId(null));
  };

  const handleDecline = (bookingId: string) => {
    setActioningId(bookingId);
    updateBookingStatus(bookingId, 'cancelled')
      .then(() => {
        toast.error('Booking declined');
        loadBookings();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to decline booking'))
      .finally(() => setActioningId(null));
  };

  const spaceImage = space?.images?.length ? space.images[0] : space?.image ?? '';

  if (loading || !space) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-brand-50 flex items-center justify-center">
        {loading ? (
          <p className="text-brand-500 font-bold">Loading...</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-12">
        <div className="mb-12">
          <Link
            to="/host/manage-listings"
            className="flex items-center gap-2 text-brand-400 hover:text-brand-700 transition-colors font-black uppercase tracking-widest text-[10px] md:text-xs mb-6 group w-fit"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Listings
          </Link>

          <div className="bg-white rounded-[2.5rem] border border-brand-200 shadow-xl shadow-brand-700/5 overflow-hidden mb-8">
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-80 h-48 md:h-auto shrink-0">
                <ImageWithFallback src={spaceImage} alt={space.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-8 md:p-10 flex-1">
                <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-2 block">
                  {space.category}
                </span>
                <h1 className="text-3xl md:text-5xl font-black text-brand-700 tracking-tight mb-8">{space.title}</h1>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-brand-300 uppercase">Total Bookings</p>
                    <p className="text-2xl font-black text-brand-700">{stats.total}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-brand-300 uppercase">Confirmed</p>
                    <p className="text-2xl font-black text-green-600">{stats.confirmed}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-brand-300 uppercase">Pending</p>
                    <p className="text-2xl font-black text-yellow-600">{stats.pending}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-brand-300 uppercase">Total Revenue</p>
                    <p className="text-2xl font-black text-brand-700">${stats.totalRevenue}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-6 border border-brand-200 shadow-xl shadow-brand-700/5 mb-10">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
              <input
                type="text"
                placeholder="Search by guest name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-14 pr-6 py-4 bg-brand-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-400 focus:outline-none font-bold text-brand-700 placeholder:text-brand-300"
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${statusFilter === 'all' ? 'bg-brand-700 text-white shadow-lg' : 'bg-brand-50 text-brand-400 hover:bg-brand-100'}`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter('confirmed')}
                className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${statusFilter === 'confirmed' ? 'bg-green-600 text-white shadow-lg' : 'bg-brand-50 text-brand-400 hover:bg-brand-100'}`}
              >
                Confirmed ({stats.confirmed})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${statusFilter === 'pending' ? 'bg-yellow-600 text-white shadow-lg' : 'bg-brand-50 text-brand-400 hover:bg-brand-100'}`}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${statusFilter === 'completed' ? 'bg-blue-600 text-white shadow-lg' : 'bg-brand-50 text-brand-400 hover:bg-brand-100'}`}
              >
                Completed ({stats.completed})
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-[3rem] p-24 text-center border border-brand-100 shadow-xl shadow-brand-700/5">
              <div className="w-24 h-24 bg-brand-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
                <Calendar className="w-12 h-12 text-brand-200" />
              </div>
              <h3 className="text-3xl font-black text-brand-700 mb-4">No bookings found</h3>
              <p className="text-brand-400 font-medium text-lg max-w-md mx-auto">
                {searchQuery ? 'Try adjusting your search or filters.' : 'No bookings have been made for this space yet.'}
              </p>
            </div>
          ) : (
            filteredBookings.map((booking) => {
              const hours = getDurationHours(booking.startTime, booking.endTime);
              const dateFormatted = format(parseISO(booking.date), 'MMM d, yyyy');
              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[2.5rem] border border-brand-100 shadow-xl shadow-brand-700/5 overflow-hidden hover:border-brand-300 hover:shadow-2xl transition-all duration-500"
                >
                  <div className="p-8 md:p-10">
                    <div className="flex flex-col lg:flex-row gap-8">
                      <div className="w-full lg:w-80 shrink-0 space-y-6">
                        <div className="flex items-center gap-5">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-brand-50 shadow-lg shrink-0">
                            <ImageWithFallback
                              src={booking.guest.avatarUrl ?? ''}
                              alt={booking.guest.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-2xl font-black text-brand-700 leading-tight truncate">
                              {booking.guest.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Star className="w-4 h-4 text-brand-500 fill-brand-500" />
                              <span className="text-sm font-black text-brand-700">
                                {booking.guest.reviewCount === 0
                                  ? '— · 0 reviews'
                                  : booking.guest.reviewCount != null && booking.guest.avgRatingGiven != null
                                    ? `${Number(booking.guest.avgRatingGiven).toFixed(1)} · ${booking.guest.reviewCount} reviews`
                                    : '— · — reviews'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <button
                            onClick={() => {
                              navigate(`/dashboard?tab=Messages&with=${encodeURIComponent(booking.guest.id)}`);
                            }}
                            className="w-full py-4 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-3 shadow-lg shadow-brand-700/20"
                          >
                            <MessageSquare className="w-5 h-5" />
                            Message Guest
                          </button>
                          <button
                            onClick={() => {
                              setSelectedGuest(booking);
                              setGuestProfile(null);
                              setGuestProfileLoading(true);
                              fetchHostGuestProfile(booking.guest.id)
                                .then(setGuestProfile)
                                .finally(() => setGuestProfileLoading(false));
                            }}
                            className="w-full py-4 bg-brand-50 hover:bg-brand-100 text-brand-700 font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-3"
                          >
                            <User className="w-5 h-5" />
                            View Full Profile
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 space-y-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-brand-50">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border-2 flex items-center gap-2 ${getStatusColor(booking.status)}`}
                            >
                              {getStatusIcon(booking.status)}
                              {booking.status}
                            </span>
                          </div>
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1 block">
                              Total
                            </span>
                            <p className="text-3xl font-black text-brand-700">${booking.totalPrice}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                              <Calendar className="w-6 h-6 text-brand-500" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-brand-300 uppercase">Date</p>
                              <p className="font-black text-brand-700">{dateFormatted}</p>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                              <Clock className="w-6 h-6 text-brand-500" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-brand-300 uppercase">Time</p>
                              <p className="font-black text-brand-700">
                                {booking.startTime} - {booking.endTime}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                              <Timer className="w-6 h-6 text-brand-500" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-brand-300 uppercase">Duration</p>
                              <p className="font-black text-brand-700">{hours} hours</p>
                            </div>
                          </div>
                        </div>

                        {booking.status === 'pending' && (
                          <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button
                              onClick={() => handleDecline(booking.id)}
                              disabled={actioningId === booking.id}
                              className="flex-1 py-5 bg-brand-50 text-brand-400 hover:text-brand-700 hover:bg-brand-100 font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                              <XCircle className="w-6 h-6" />
                              Decline
                            </button>
                            <button
                              onClick={() => handleConfirm(booking.id)}
                              disabled={actioningId === booking.id}
                              className="flex-[2] py-5 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-2xl shadow-xl shadow-brand-700/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-6 h-6" />
                              Confirm Booking
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedGuest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedGuest(null);
                setGuestProfile(null);
              }}
              className="absolute inset-0 bg-brand-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <button
                onClick={() => {
                  setSelectedGuest(null);
                  setGuestProfile(null);
                }}
                className="absolute top-6 right-6 p-3 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-2xl transition-all z-10 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="overflow-y-auto custom-scrollbar">
                <div className="p-8 md:p-12 bg-gradient-to-b from-brand-50/50 to-white">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl shrink-0">
                      <ImageWithFallback
                        src={selectedGuest.guest.avatarUrl ?? ''}
                        alt={selectedGuest.guest.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-center md:text-left space-y-3">
                      <h2 className="text-3xl md:text-4xl font-black text-brand-700 tracking-tight">
                        {selectedGuest.guest.name}
                      </h2>
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <Star className="w-5 h-5 text-brand-500 fill-brand-500" />
                        <span className="text-lg font-black text-brand-700">
                          {guestProfileLoading
                            ? '— · — reviews'
                            : guestProfile
                              ? guestProfile.reviewCount === 0
                                ? '— · 0 reviews'
                                : `${(guestProfile.avgRatingGiven ?? 0).toFixed(1)} · ${guestProfile.reviewCount} reviews`
                              : '— · — reviews'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-center md:justify-start gap-2 text-brand-600 font-medium">
                          <Mail className="w-4 h-4 text-brand-400" />
                          {selectedGuest.guest.email}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {guestProfileLoading ? (
                  <div className="px-8 md:px-12 pb-12 flex items-center justify-center py-16">
                    <p className="text-brand-500 font-bold">Loading profile...</p>
                  </div>
                ) : (
                <div className="px-8 md:px-12 pb-12 space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-xl font-black text-brand-700">
                      About {selectedGuest.guest.name.split(' ')[0]}
                    </h3>
                    <p className="text-brand-600 font-medium leading-relaxed">
                      {guestProfile?.guest.bio?.trim() ? guestProfile.guest.bio : 'No bio provided.'}
                    </p>
                  </div>

                  {guestProfile?.withHost && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-black text-brand-700">Booking History with You</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-brand-50 rounded-2xl p-5 border border-brand-100">
                          <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Total Bookings</p>
                          <p className="text-2xl font-black text-brand-700">{guestProfile.withHost.totalBookings}</p>
                        </div>
                        <div className="bg-brand-50 rounded-2xl p-5 border border-brand-100">
                          <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Total Spent</p>
                          <p className="text-2xl font-black text-brand-700">
                            ${guestProfile.withHost.totalSpent.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-brand-50 rounded-2xl p-5 border border-brand-100">
                          <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Avg Rating</p>
                          <p className="text-2xl font-black text-brand-700">
                            {guestProfile.withHost.avgRating != null
                              ? guestProfile.withHost.avgRating.toFixed(1)
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      onClick={() => {
                        setSelectedGuest(null);
                        setGuestProfile(null);
                      navigate(`/dashboard?tab=Messages&with=${encodeURIComponent(selectedGuest.guest.id)}`);
                      }}
                      className="w-full py-5 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-2xl shadow-xl shadow-brand-700/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-3"
                    >
                      <MessageSquare className="w-6 h-6" />
                      Contact {selectedGuest.guest.name.split(' ')[0]}
                    </button>
                  </div>
                </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
