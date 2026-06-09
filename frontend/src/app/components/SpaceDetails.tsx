import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { 
  Star, 
  MapPin, 
  Users, 
  Heart, 
  Share2, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Info, 
  ChevronRight, 
  ChevronLeft,
  Plus, 
  Minus, 
  Calendar as CalendarIcon,
  ArrowLeft,
  ChevronDown,
  ListFilter,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  History,
  Check,
  X,
  Lock,
  AlertCircle,
  XCircle,
  MessageSquare
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { ImageWithFallback } from './ImageWithFallback';
import { ListingGalleryLightbox } from './ListingGalleryLightbox';
import { SpaceLocationMap } from './MapView';
import { motion, AnimatePresence } from 'motion/react';
import { format, addHours, addDays, differenceInHours, parse } from 'date-fns';
import { useParams, useNavigate, Link, useSearchParams, useLocation } from 'react-router';
import { toast } from 'sonner';
import { fetchSpace, fetchAvailability, fetchSpaceReviews, shareSpaceLink } from '../api/spaces';
import { fetchFavorites, addFavorite, removeFavorite } from '../api/favorites';
import { AmenitiesList } from './FilterDropdowns';
import { formatRatingScore } from '../utils/formatRating';
import { useAuth } from '../context/AuthContext';
import { MarkdownContent } from './MarkdownContent';
import { fetchPublicHostProfile } from '../api/users';
import type { Space, BookedRange } from '../api/spaces';
import { calculateServiceFee, PLATFORM_SERVICE_FEE_PERCENT } from '../constants/billing';

// daily slots (12 AM–11 PM) plus midnight on the next day
const allTimeSlots = [
  '12:00 AM', '01:00 AM', '02:00 AM', '03:00 AM', '04:00 AM', '05:00 AM', '06:00 AM', '07:00 AM',
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
  '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
  '12:00 AM+1',
];

/** Turn a time string into a comparable number (+1 = next day). */
function timeToNumber(time: string): number {
  const isNextDay = time.includes('+1');
  const cleanTime = time.replace('+1', '').trim();
  const [timePart, period] = cleanTime.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  if (isNextDay) hours += 24;
  return hours + (minutes ?? 0) / 60;
}

/** Normalize end time from API — late start + 12:00 AM end means next-day midnight. */
function normalizeRangeEnd(start: string, end: string): string {
  if (end === '12:00 AM' && timeToNumber(start) >= timeToNumber(end)) return '12:00 AM+1';
  return end;
}

/** Check if two time ranges overlap. */
function rangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const e1 = normalizeRangeEnd(start1, end1);
  const e2 = normalizeRangeEnd(start2, end2);
  const s1 = timeToNumber(start1);
  const e1n = timeToNumber(e1);
  const s2 = timeToNumber(start2);
  const e2n = timeToNumber(e2);
  return s1 < e2n && s2 < e1n;
}

/** Check if the proposed slot is free (no overlap with bookings). */
function isRangeAvailable(proposedStart: string, proposedEnd: string, bookedRanges: BookedRange[]): boolean {
  const normalized = bookedRanges.map((r) => ({ start: r.start, end: normalizeRangeEnd(r.start, r.end) }));
  return !normalized.some((r) => rangesOverlap(proposedStart, proposedEnd, r.start, r.end));
}

/** Check if a time falls inside an existing booking. */
function isTimeInBookedRange(time: string, bookedRanges: BookedRange[]): boolean {
  const t = timeToNumber(time);
  return bookedRanges.some((r) => {
    const start = timeToNumber(r.start);
    const end = timeToNumber(normalizeRangeEnd(r.start, r.end));
    return t >= start && t < end;
  });
}

/** Tailwind classes for the colored rating badge. */
function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (rating >= 4.0) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (rating >= 3.5) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-orange-50 text-orange-700 border-orange-200';
}

function slotToDateTime(selectedDate: Date, slot: string): Date | null {
  const isNextDay = slot.includes('+1');
  const cleanTime = slot.replace('+1', '').trim();
  const parsed = parse(cleanTime, 'hh:mm a', selectedDate);
  if (isNaN(parsed.getTime())) return null;
  return isNextDay ? addDays(parsed, 1) : parsed;
}

/** Star row for rating (5 stars, filled based on score). */
function renderStars(rating: number) {
  return Array.from({ length: 5 }).map((_, idx) => (
    <Star
      key={idx}
      className={`w-3.5 h-3.5 transition-all ${
        idx < rating
          ? 'text-brand-700 fill-brand-700'
          : 'text-brand-200 fill-brand-50'
      }`}
    />
  ));
}

/** End index must be after start in the extended slot list (no wrap-around). */
const isEndAfterStart = (startIdx: number, endIdx: number) => endIdx > startIdx;

/** Slots between start and end (end not included). */
const getSlotsInRange = (startIdx: number, endIdx: number) =>
  allTimeSlots.slice(startIdx, endIdx);

/** Duration in hours. */
const getDuration = (startIdx: number, endIdx: number) => endIdx - startIdx;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CANCELLATION_POLICY_DESCRIPTIONS: Record<string, string> = {
  flexible: 'Cancel up to 24 hours before your booking for a full refund.',
  moderate: 'Cancel up to 48 hours before your booking for a full refund.',
  strict: 'Cancel up to 7 days before your booking for a full refund.',
};

function isDateInBlockedRanges(dateStr: string, blockedDates: { startDate: string; endDate: string }[] | null | undefined): boolean {
  if (!blockedDates || blockedDates.length === 0) return false;
  for (const block of blockedDates) {
    const start = block.startDate;
    const end = block.endDate || block.startDate;
    if (dateStr >= start && dateStr <= end) return true;
  }
  return false;
}

function isDateBookable(date: Date, space: Space | null): boolean {
  if (!space) return true;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const isPast = d < todayStart;
  const isToday = d.getTime() === todayStart.getTime();
  const daysFromToday = (d.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000);
  const isBeyondAdvance = (space.maxAdvanceBookingDays ?? null) != null && daysFromToday > (space.maxAdvanceBookingDays ?? 0);
  const dayName = DAY_NAMES[d.getDay()];
  const isBannedDay = (space.bannedDays?.length ?? 0) > 0 && space.bannedDays?.includes(dayName);
  const dateStr = format(d, 'yyyy-MM-dd');
  const isBlockedDate = isDateInBlockedRanges(dateStr, space.blockedDates ?? null);
  const isDisabled = isPast || (isToday && space.sameDayBookingAllowed === false) || isBeyondAdvance || isBannedDay || isBlockedDate;
  return !isDisabled;
}

function getFirstBookableDate(space: Space): Date {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const bannedDays = space.bannedDays ?? [];
  const blockedDates = space.blockedDates ?? [];
  const maxAdvance = space.maxAdvanceBookingDays ?? null;
  const sameDayAllowed = space.sameDayBookingAllowed !== false;

  for (let i = 0; i < 400; i++) {
    const d = addDays(todayStart, i);
    const isToday = i === 0;
    const daysFromToday = i;
    const isBeyondAdvance = maxAdvance != null && daysFromToday > maxAdvance;
    const dayName = DAY_NAMES[d.getDay()];
    const isBannedDay = bannedDays.length > 0 && bannedDays.includes(dayName);
    const dateStr = format(d, 'yyyy-MM-dd');
    const isBlockedDate = isDateInBlockedRanges(dateStr, blockedDates);
    const isDisabled = (isToday && !sameDayAllowed) || isBeyondAdvance || isBannedDay || isBlockedDate;
    if (!isDisabled) return d;
  }
  return addDays(todayStart, 1);
}

export const SpaceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { token, user } = useAuth();

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // map YYYY-MM-DD → whether the whole day is unavailable (booked or outside hours)
  const [fullyBookedByDate, setFullyBookedByDate] = useState<Record<string, boolean>>({});

  const [spaceDetails, setSpaceDetails] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviewAggregates, setReviewAggregates] = useState<{ cleanliness: number | null; communication: number | null; location: number | null; value: number | null }>({ cleanliness: null, communication: null, location: null, value: null });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Array<{ id: string; name: string; date: string; timestamp: number; rating: number; avatar: string | null; text: string }>>([]);
  const [showHostProfile, setShowHostProfile] = useState(false);
  const [hostProfileLoading, setHostProfileLoading] = useState(false);
  const [hostBio, setHostBio] = useState<string | null>(null);
  const [hostActiveBookings, setHostActiveBookings] = useState<number | null>(null);
  const [hostAvgRating, setHostAvgRating] = useState<number | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = new Date(dateParam);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startTime, setStartTime] = useState<string>(() => {
    const st = searchParams.get('startTime');
    return st && allTimeSlots.includes(st) ? st : '';
  });
  const [endTime, setEndTime] = useState<string>(() => {
    const et = searchParams.get('endTime');
    return et && allTimeSlots.includes(et) ? et : '';
  });
  useEffect(() => {
    const dp = searchParams.get('date');
    if (dp) {
      const parsed = new Date(dp);
      if (!isNaN(parsed.getTime())) setSelectedDate(parsed);
    }
    const st = searchParams.get('startTime');
    setStartTime(st && allTimeSlots.includes(st) ? st : '');
    const et = searchParams.get('endTime');
    setEndTime(et && allTimeSlots.includes(et) ? et : '');
  }, [searchParams]);

  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  const [bookingConflict, setBookingConflict] = useState(false);
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [hasMoreContent, setHasMoreContent] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'highest' | 'lowest'>('recent');
  const reviewsPerPage = 4;
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if (!showHostProfile) return;
    const hostId = spaceDetails?.host?.id;
    if (!hostId) return;

    let cancelled = false;
    setHostProfileLoading(true);
    fetchPublicHostProfile(hostId)
      .then((res) => {
        if (cancelled) return;
        const bio = res.user.bio?.trim() ? res.user.bio : null;
        setHostBio(bio);
        setHostActiveBookings(res.hostStats.activeBookings);
        setHostAvgRating(res.hostStats.avgListingRating);
      })
      .catch(() => {
        if (cancelled) return;
        setHostBio(null);
        setHostActiveBookings(null);
        setHostAvgRating(null);
      })
      .finally(() => {
        if (cancelled) return;
        setHostProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showHostProfile, spaceDetails?.host?.id]);

  useLayoutEffect(() => {
    if (isDescriptionOpen) return;
    const el = descriptionRef.current;
    if (!el) return;
    const check = () => {
      if (descriptionRef.current && !isDescriptionOpen) {
        setHasMoreContent(descriptionRef.current.scrollHeight > descriptionRef.current.clientHeight);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [spaceDetails?.description, isDescriptionOpen]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchSpace(id)
      .then(setSpaceDetails)
      .catch(() => setSpaceDetails(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!spaceDetails || !selectedDate) return;
    if (!isDateBookable(selectedDate, spaceDetails)) {
      const first = getFirstBookableDate(spaceDetails);
      setSelectedDate(first);
      setCurrentMonth(first);
    }
  }, [spaceDetails, selectedDate]);

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  useEffect(() => {
    if (!id || !dateStr) {
      setAvailableSlots([...allTimeSlots]);
      setBookedSlots([]);
      setBookedRanges([]);
      setUnavailableSlots([]);
      return;
    }
    fetchAvailability(id, dateStr)
      .then(({ slots, booked, unavailable, bookedRanges: ranges }) => {
        setAvailableSlots(slots.length ? slots : [...allTimeSlots]);
        setBookedSlots(booked ?? []);
        setBookedRanges(ranges ?? []);
        setUnavailableSlots(unavailable ?? []);
      })
      .catch(() => {
        setAvailableSlots([...allTimeSlots]);
        setBookedSlots([]);
        setBookedRanges([]);
        setUnavailableSlots([]);
      });
  }, [id, dateStr]);

  useEffect(() => {
    if (!id) return;
    fetchSpaceReviews(id)
      .then(({ reviews: list, aggregates }) => {
        setReviewAggregates(aggregates || { cleanliness: null, communication: null, location: null, value: null });
        setReviews(
          list.map((r) => ({
            id: r.id,
            name: r.name,
            date: format(new Date(r.createdAt), 'MMMM yyyy'),
            timestamp: new Date(r.createdAt).getTime(),
            rating: r.rating,
            avatar: r.avatar,
            text: r.text,
          }))
        );
      })
      .catch(() => setReviews([]));
  }, [id]);

  useEffect(() => {
    if (!token || !id) {
      setIsFavorite(false);
      return;
    }
    fetchFavorites()
      .then((list) => setIsFavorite(list.some((f) => (f.spaceId ?? f.id) === id)))
      .catch(() => setIsFavorite(false));
  }, [token, id]);

  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      if (sortBy === 'recent') return b.timestamp - a.timestamp;
      if (sortBy === 'oldest') return a.timestamp - b.timestamp;
      if (sortBy === 'highest') return b.rating - a.rating;
      if (sortBy === 'lowest') return a.rating - b.rating;
      return 0;
    });
  }, [reviews, sortBy]);

  const ratingDistribution = useMemo(() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((review) => {
      const rounded = Math.floor(review.rating);
      if (rounded >= 1 && rounded <= 5) {
        dist[rounded as keyof typeof dist]++;
      }
    });
    return dist;
  }, [reviews]);

  const totalReviewPages = Math.ceil(sortedReviews.length / reviewsPerPage);
  const currentReviews = sortedReviews.slice((reviewPage - 1) * reviewsPerPage, reviewPage * reviewsPerPage);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const calendarRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCalendarOpen]);

  const daysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const daySlotsForBookingCheck = useMemo(
    () => allTimeSlots.filter((t) => !t.includes('+1')),
    []
  );

  // prefetch "fully booked" days for the visible month so the date picker can disable them
  useEffect(() => {
    if (!id || !spaceDetails) return;

    let cancelled = false;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = daysInMonth(currentMonth);

    const dateStrings: string[] = [];
    for (let day = 1; day <= days; day++) {
      const d = new Date(year, month, day);
      dateStrings.push(format(d, 'yyyy-MM-dd'));
    }

    const missing = dateStrings.filter((ds) => fullyBookedByDate[ds] === undefined);
    if (missing.length === 0) return;

    (async () => {
      const results = await Promise.allSettled(
        missing.map(async (ds) => {
          const { booked, unavailable } = await fetchAvailability(id, ds);
          const bookedSet = new Set(booked ?? []);
          const unavailableSet = new Set(unavailable ?? []);
          const isFullyBooked = daySlotsForBookingCheck.every((slot) => bookedSet.has(slot) || unavailableSet.has(slot));
          return { ds, isFullyBooked };
        })
      );

      if (cancelled) return;
      setFullyBookedByDate((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === 'fulfilled') {
            next[r.value.ds] = r.value.isFullyBooked;
          }
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [id, spaceDetails, currentMonth, daySlotsForBookingCheck, fullyBookedByDate]);

  const changeMonth = (offset: number) => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + offset);
    setCurrentMonth(next);
  };

  const calendarDays = useMemo(() => {
    const days = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);
    const result = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let i = 1; i <= days; i++) result.push(i);
    return result;
  }, [currentMonth]);

  useEffect(() => {
    if (location.hash === '#booking') {
      const tryScroll = (attemptsLeft: number) => {
        const bookingEl = document.getElementById('booking');
        if (bookingEl) {
          const top = bookingEl.getBoundingClientRect().top + window.scrollY - 112;
          window.scrollTo({ top, behavior: 'smooth' });
        } else if (attemptsLeft > 0) {
          setTimeout(() => tryScroll(attemptsLeft - 1), 100);
        }
      };
      tryScroll(10);
    } else {
      window.scrollTo(0, 0);
    }
  }, [id, location.hash]);

  const unavailableForGrid = useMemo(() => {
    const start = spaceDetails?.availabilityStartTime ?? null;
    const end = spaceDetails?.availabilityEndTime ?? null;
    if (start == null || end == null) return [];
    const startN = timeToNumber(start);
    const endN = timeToNumber(normalizeRangeEnd(start, end));
    return allTimeSlots.filter((slot) => {
      const n = timeToNumber(slot);
      return n < startN || n > endN;
    });
  }, [spaceDetails?.availabilityStartTime, spaceDetails?.availabilityEndTime]);

  const duration = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const startIdx = allTimeSlots.indexOf(startTime);
    const endIdx = allTimeSlots.indexOf(endTime);
    if (startIdx === -1 || endIdx === -1) return 0;
    return getDuration(startIdx, endIdx);
  }, [startTime, endTime]);

  const subtotal = (spaceDetails?.price ?? 0) * duration;
  const cleaningFee = duration > 0 ? (spaceDetails?.cleaningFeeCents ?? 0) / 100 : 0;
  const equipmentFee = duration > 0 ? (spaceDetails?.equipmentFeeCents ?? 0) / 100 : 0;
  const serviceFee = duration > 0 ? calculateServiceFee(subtotal) : 0;
  const total = subtotal + cleaningFee + equipmentFee + serviceFee;

  const minH = spaceDetails?.minDurationHours ?? null;
  const maxH = spaceDetails?.maxDurationHours ?? null;
  const durationValid = duration <= 0 || (
    (minH == null || duration >= minH) &&
    (maxH == null || duration <= maxH)
  );
  const durationError = startTime && endTime && duration > 0 && !durationValid
    ? (minH != null && duration < minH
        ? `Minimum booking duration is ${minH} hours`
        : maxH != null && duration > maxH
          ? `Maximum booking duration is ${maxH} hours`
          : null)
    : null;

  const isHostOfSpace = Boolean(user?.id && spaceDetails?.host?.id && user.id === spaceDetails?.host?.id);

  const endTimeForApi = endTime === '12:00 AM+1' ? '12:00 AM' : endTime;

  const handleBook = () => {
    if (!spaceDetails || !id || !startTime || !endTime || duration <= 0 || !durationValid) return;
    if ((spaceDetails?.status ?? 'active') !== 'active') return;
    if (isHostOfSpace) {
      toast.error('You cannot book your own space.');
      return;
    }
    if (!token) {
      navigate('/auth/login', { state: { from: { pathname: window.location.pathname + window.location.search } } });
      return;
    }
    const params = new URLSearchParams({
      date: dateStr,
      startTime,
      endTime: endTimeForApi,
    });
    navigate(`/space/${id}/checkout?${params.toString()}`);
  };

  const handleTimeClick = (time: string) => {
    if (unavailableForGrid.includes(time)) return;
    if (selectedDate) {
      const dt = slotToDateTime(selectedDate, time);
      if (dt && dt.getTime() <= nowMs) return;
    }

    setBookingConflict(false);

    if (!startTime || (startTime && endTime)) {
      setStartTime(time);
      setEndTime('');
      return;
    }

    const startIdx = allTimeSlots.indexOf(startTime);
    const clickedIdx = allTimeSlots.indexOf(time);

    if (!isEndAfterStart(startIdx, clickedIdx)) {
      setStartTime(time);
      setEndTime('');
      return;
    }

    if (isRangeAvailable(startTime, time, bookedRanges)) {
      setEndTime(time);
      setBookingConflict(false);
    } else {
      setBookingConflict(true);
      setTimeout(() => {
        setStartTime(time);
        setEndTime('');
        setBookingConflict(false);
      }, 2000);
    }
  };

  const isTimeInRange = (time: string) => {
    if (!startTime || !endTime) return false;
    const startIdx = allTimeSlots.indexOf(startTime);
    const endIdx = allTimeSlots.indexOf(endTime);
    const currentIdx = allTimeSlots.indexOf(time);
    if (startIdx === -1 || endIdx === -1 || currentIdx === -1) return false;
    return currentIdx > startIdx && currentIdx < endIdx;
  };

  if (loading && !spaceDetails) {
    return (
      <div className="pt-24 md:pt-32 pb-12 min-h-screen flex items-center justify-center">
        <div className="text-brand-500 font-medium">Loading space...</div>
      </div>
    );
  }
  if (!spaceDetails && !loading) {
    return (
      <div className="pt-24 md:pt-32 pb-12 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-black text-brand-700 mb-2">Space not found</h2>
          <Link to="/find" className="text-brand-500 font-medium hover:underline">Browse spaces</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 md:pt-32 pb-12 min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* breadcrumbs */}
        <div className="flex items-center gap-2 mb-6 text-sm font-bold">
          <Link to="/" className="text-brand-400 hover:text-brand-700 transition-colors">Home</Link>
          <ChevronRight className="w-4 h-4 text-brand-200" />
          <Link to="/find" className="text-brand-400 hover:text-brand-700 transition-colors">Find a Space</Link>
          <ChevronRight className="w-4 h-4 text-brand-200" />
          <span className="text-brand-700">{spaceDetails.category}</span>
        </div>

        {/* header actions */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-brand-500 font-bold hover:text-brand-700 transition-colors group cursor-pointer"
          >
            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center group-hover:bg-brand-200 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </div>
            Back to results
          </button>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={async () => {
                if (!id) return;
                try {
                  const { link } = await shareSpaceLink(id);
                  // also log to browser console for easy debugging
                  console.log('[Share] Space link:', link);
                  toast.success('Share link printed in backend console');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to share');
                }
              }}
              className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-brand-50 border border-brand-200 rounded-xl text-brand-700 font-bold text-sm hover:bg-brand-100 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button 
              onClick={() => {
                if (!token) {
                  navigate('/auth/login');
                  return;
                }
                if (!id) return;
                if (isFavorite) {
                  removeFavorite(id).then(() => setIsFavorite(false));
                } else {
                  addFavorite(id).then(() => setIsFavorite(true));
                }
              }}
              className={`flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 border rounded-xl font-bold text-sm transition-all cursor-pointer ${
                isFavorite 
                  ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' 
                  : 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} /> Save
            </button>
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-brand-700 mb-4 md:mb-5 tracking-tight leading-tight">{spaceDetails.title}</h1>
        
        <div className="flex flex-wrap items-center gap-4 md:gap-5 mb-8 md:mb-10">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-brand-500 fill-brand-500" />
            <span className="font-black text-brand-700 text-base md:text-lg">{formatRatingScore(spaceDetails.rating)}</span>
            <span
              className="text-brand-400 font-bold underline cursor-pointer hover:text-brand-700 transition-colors"
              onClick={() => {
                const el = document.getElementById('reviews-section');
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 112;
                  window.scrollTo({ top, behavior: 'smooth' });
                }
              }}
            >{spaceDetails.reviews} reviews</span>
          </div>
          <div className="h-6 w-px bg-brand-200" />
          <div className="flex items-center gap-2 text-brand-500">
            <MapPin className="w-5 h-5" />
            <span
              className="font-bold underline cursor-pointer hover:text-brand-700 transition-colors"
              onClick={() => {
                const el = document.getElementById('location-map');
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 112;
                  window.scrollTo({ top, behavior: 'smooth' });
                }
              }}
            >{spaceDetails.location}</span>
          </div>
        </div>

        {/* photo gallery */}
        {(() => {
          const images = spaceDetails.images?.length ? spaceDetails.images : (spaceDetails.image ? [spaceDetails.image] : []);
          const imageCount = images.length;
          const openGallery = (index: number) => {
            setGalleryIndex(index);
            setGalleryOpen(true);
          };
          const cellClass = 'overflow-hidden group cursor-pointer shadow-xl shadow-brand-700/5';
          const imgClass = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-700';
          const galleryShellClass = 'mb-10 md:mb-12 w-full aspect-[16/9] md:aspect-[21/9]';
          const galleryGapClass = 'gap-2 md:gap-3';
          const roundedClass = 'rounded-[1.5rem] md:rounded-[2rem]';

          if (imageCount === 0) {
            return (
              <div className={`${galleryShellClass} bg-brand-100 flex items-center justify-center`}>
                <span className="text-brand-400 font-bold">No photos</span>
              </div>
            );
          }

          if (imageCount === 1) {
            return (
              <div className={galleryShellClass}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openGallery(0)}
                  onKeyDown={(e) => e.key === 'Enter' && openGallery(0)}
                  className={`h-full w-full relative ${roundedClass} ${cellClass}`}
                >
                  <ImageWithFallback src={images[0]} alt="Space" className={imgClass} />
                </div>
              </div>
            );
          }

          if (imageCount === 2) {
            return (
              <div className={galleryShellClass}>
                <div className={`grid h-full min-h-0 grid-cols-2 ${galleryGapClass}`}>
                  {images.slice(0, 2).map((img, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => openGallery(idx)}
                      onKeyDown={(e) => e.key === 'Enter' && openGallery(idx)}
                      className={`h-full min-h-0 relative ${roundedClass} ${cellClass}`}
                    >
                      <ImageWithFallback src={img} alt={`Space ${idx + 1}`} className={imgClass} />
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (imageCount === 3) {
            return (
              <div className={galleryShellClass}>
                <div className={`grid h-full min-h-0 grid-cols-1 md:grid-cols-2 ${galleryGapClass}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openGallery(0)}
                    onKeyDown={(e) => e.key === 'Enter' && openGallery(0)}
                    className={`h-full min-h-0 relative ${roundedClass} ${cellClass}`}
                  >
                    <ImageWithFallback src={images[0]} alt="Space 1" className={imgClass} />
                  </div>
                  <div className={`grid h-full min-h-0 grid-rows-2 ${galleryGapClass}`}>
                    {images.slice(1, 3).map((img, idx) => (
                      <div
                        key={idx}
                        role="button"
                        tabIndex={0}
                        onClick={() => openGallery(idx + 1)}
                        onKeyDown={(e) => e.key === 'Enter' && openGallery(idx + 1)}
                        className={`h-full min-h-0 relative ${roundedClass} ${cellClass}`}
                      >
                        <ImageWithFallback src={img} alt={`Space ${idx + 2}`} className={imgClass} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className={galleryShellClass}>
              <div className={`hidden md:grid h-full min-h-0 grid-cols-4 ${galleryGapClass}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openGallery(0)}
                  onKeyDown={(e) => e.key === 'Enter' && openGallery(0)}
                  className={`col-span-2 h-full min-h-0 relative ${roundedClass} ${cellClass}`}
                >
                  <ImageWithFallback src={images[0] ?? ''} alt="Space 1" className={imgClass} />
                </div>
                <div className={`col-span-1 grid h-full min-h-0 grid-rows-2 ${galleryGapClass}`}>
                  {images.slice(1, 3).map((img, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => openGallery(idx + 1)}
                      onKeyDown={(e) => e.key === 'Enter' && openGallery(idx + 1)}
                      className={`h-full min-h-0 relative ${roundedClass} ${cellClass}`}
                    >
                      <ImageWithFallback src={img} alt={`Space ${idx + 2}`} className={imgClass} />
                    </div>
                  ))}
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openGallery(3)}
                  onKeyDown={(e) => e.key === 'Enter' && openGallery(3)}
                  className={`col-span-1 h-full min-h-0 relative ${roundedClass} ${cellClass}`}
                >
                  <ImageWithFallback src={images[3] ?? ''} alt="Space 4" className={imgClass} />
                  {imageCount > 4 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-100 group-hover:bg-black/60 transition-colors">
                      <span className="px-5 py-2.5 md:px-6 md:py-3 bg-white text-brand-700 font-black text-sm md:text-base rounded-xl md:rounded-2xl shadow-2xl hover:scale-105 transition-transform cursor-pointer">
                        View all {imageCount} photos
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className={`md:hidden h-full min-h-0 flex flex-col ${galleryGapClass}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openGallery(0)}
                  onKeyDown={(e) => e.key === 'Enter' && openGallery(0)}
                  className={`flex-1 min-h-0 relative ${roundedClass} ${cellClass}`}
                >
                  <ImageWithFallback src={images[0] ?? ''} alt="Space 1" className={imgClass} />
                </div>
                <button
                  type="button"
                  onClick={() => openGallery(0)}
                  className="shrink-0 w-full py-3 border-2 border-brand-200 rounded-2xl text-brand-700 font-black flex items-center justify-center gap-2"
                >
                  View all {imageCount} photos
                </button>
              </div>
            </div>
          );
        })()}

        {spaceDetails && (
          <ListingGalleryLightbox
            open={galleryOpen}
            images={
              spaceDetails.images?.length
                ? spaceDetails.images
                : spaceDetails.image
                  ? [spaceDetails.image]
                  : []
            }
            activeIndex={galleryIndex}
            onClose={() => setGalleryOpen(false)}
            onActiveIndexChange={setGalleryIndex}
          />
        )}

        {/* main content layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-8 lg:gap-12">
          <div className="space-y-10 md:space-y-12">
            {/* host section */}
            <section className="flex items-center justify-between py-6 md:py-8 border-b border-brand-100">
              <div className="space-y-1.5">
                <h2 className="text-2xl md:text-3xl font-black text-brand-700">Space hosted by {spaceDetails.host?.name ?? 'Host'}</h2>
                <p className="text-brand-500 font-medium text-base md:text-lg">
                  Up to {spaceDetails.capacity} guests · {spaceDetails.category} · {spaceDetails.squareMeters != null ? `${spaceDetails.squareMeters} m²` : '— m²'}
                </p>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => spaceDetails.host && setShowHostProfile(true)}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border-2 border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 cursor-pointer hover:border-brand-400 transition-colors"
                  aria-label={`View ${spaceDetails.host?.name ?? 'host'}'s profile`}
                >
                  <ImageWithFallback src={spaceDetails.host?.avatar ?? ''} alt="Host" className="w-full h-full object-cover" />
                </button>
                {spaceDetails.host?.isSuperhost && (
                  <div className="absolute -bottom-2 -right-2 bg-brand-200 p-2 rounded-xl border-4 border-white">
                    <ShieldCheck className="w-5 h-5 text-brand-700" />
                  </div>
                )}
              </div>
            </section>

            {/* host profile modal (same as "View Full Profile" on booking page) */}
            <AnimatePresence>
              {showHostProfile && spaceDetails.host && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowHostProfile(false)}
                    className="absolute inset-0 bg-brand-900/40 backdrop-blur-md"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-2xl bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                  >
                    <button
                      onClick={() => setShowHostProfile(false)}
                      className="absolute top-6 right-6 p-3 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-2xl transition-all z-10 cursor-pointer"
                      aria-label="Close profile"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>

                    <div className="overflow-y-auto custom-scrollbar">
                      <div className="p-6 md:p-8 bg-gradient-to-b from-brand-50/50 to-white">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                          <div className="w-24 h-24 md:w-28 md:h-28 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl shrink-0">
                            <ImageWithFallback
                              src={spaceDetails.host.avatar ?? ''}
                              alt={spaceDetails.host.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-center md:text-left space-y-3">
                            <h2 className="text-2xl md:text-3xl font-black text-brand-700 tracking-tight">
                              {spaceDetails.host.name}
                            </h2>
                            {spaceDetails.host.isSuperhost && (
                              <div className="flex items-center justify-center md:justify-start gap-2">
                                <ShieldCheck className="w-5 h-5 text-brand-500" />
                                <span className="text-lg font-black text-brand-700">Superhost</span>
                              </div>
                            )}
                            <p className="text-brand-600 font-medium">
                              Host on SpaceBook since {spaceDetails.host.since}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="px-6 md:px-8 pb-8 md:pb-10 space-y-6 md:space-y-8">
                        {hostProfileLoading ? (
                          <div className="py-6">
                            <div className="h-5 w-40 bg-brand-100 rounded-lg animate-pulse mb-4" />
                            <div className="h-4 w-full bg-brand-50 rounded-lg animate-pulse mb-2" />
                            <div className="h-4 w-5/6 bg-brand-50 rounded-lg animate-pulse" />
                          </div>
                        ) : (
                          hostBio && (
                            <div className="space-y-4 pt-2">
                              <h3 className="text-xl font-black text-brand-700">
                                About {spaceDetails.host.name.split(' ')[0]}
                              </h3>
                              <p className="text-brand-600 font-medium leading-relaxed">
                                {hostBio}
                              </p>
                            </div>
                          )
                        )}

                        <div className="space-y-4">
                          <h3 className="text-xl font-black text-brand-700">Host Stats</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-brand-50 rounded-2xl p-5 border border-brand-100">
                              <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Active Bookings</p>
                              <p className="text-2xl font-black text-brand-700">
                                {hostProfileLoading ? '—' : String(hostActiveBookings ?? '—')}
                              </p>
                            </div>
                            <div className="bg-brand-50 rounded-2xl p-5 border border-brand-100">
                              <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Avg. Rating</p>
                              <p className="text-2xl font-black text-brand-700">
                                {hostProfileLoading
                                  ? '—'
                                  : hostAvgRating != null
                                    ? hostAvgRating.toFixed(2)
                                    : '—'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4">
                          <button
                            onClick={() => {
                              setShowHostProfile(false);
                              navigate(`/dashboard?tab=Messages&with=${encodeURIComponent(spaceDetails.host.id)}`);
                            }}
                            className="w-full py-4 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-xl md:rounded-2xl shadow-xl shadow-brand-700/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-3"
                          >
                            <MessageSquare className="w-5 h-5" />
                            Contact {spaceDetails.host.name.split(' ')[0]}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* description */}
            <section className="space-y-6 md:space-y-8">
              {spaceDetails.isInstantBookable && (
                <div className="flex gap-4 md:gap-5 items-start">
                  <div className="w-12 h-12 bg-brand-50 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-brand-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-brand-700 mb-1.5">Instant Booking</h3>
                    <p className="text-brand-500 font-medium">
                      Book this space immediately without waiting for host approval.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-4 md:gap-5 items-start">
                <div className="w-12 h-12 bg-brand-50 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-brand-700" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-brand-700 mb-1.5">Cancellation Policy</h3>
                  <p className="text-brand-500 font-medium">
                    {CANCELLATION_POLICY_DESCRIPTIONS[(spaceDetails.cancellationPolicy ?? 'flexible').toLowerCase()] ?? CANCELLATION_POLICY_DESCRIPTIONS.flexible}
                  </p>
                </div>
              </div>
              <div className="pt-6 md:pt-8 border-t border-brand-100">
                <div
                  ref={descriptionRef}
                  className={`text-brand-700 font-medium text-base md:text-lg leading-relaxed transition-all duration-300 ${!isDescriptionOpen ? 'line-clamp-3' : ''}`}
                >
                  <MarkdownContent>{spaceDetails.description}</MarkdownContent>
                </div>

                {(hasMoreContent || isDescriptionOpen) && (
                  <button
                    onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                    className="mt-6 text-brand-700 font-black underline underline-offset-8 decoration-brand-200 decoration-4 hover:decoration-brand-700 hover:text-brand-900 transition-all cursor-pointer inline-flex items-center gap-2 group/more"
                  >
                    {isDescriptionOpen ? 'Show less' : 'Show more'}
                    <ChevronRight className={`w-5 h-5 group-hover/more:translate-x-1 transition-transform ${isDescriptionOpen ? '-rotate-90' : ''}`} />
                  </button>
                )}
              </div>
            </section>

            {/* amenities */}
            <section className="space-y-6 md:space-y-8 py-8 md:py-10 border-y border-brand-100">
              <h2 className="text-2xl md:text-3xl font-black text-brand-700 mb-6 md:mb-8">What this space offers</h2>
              <div className="relative">
                <div className="grid grid-cols-2 gap-y-6 gap-x-8 md:gap-x-10">
                  {(spaceDetails.amenities ?? []).map((amenityId, idx) => {
                    const amenity = AmenitiesList.find((a) => a.id === amenityId);
                    const amenityLabel = amenity?.label ?? amenityId;
                    const IconComponent = amenity?.icon ?? Zap;
                    return (
                      <div key={idx} className="flex items-center gap-4 md:gap-5 group">
                        <div className="w-10 h-10 md:w-11 md:h-11 bg-brand-50 rounded-xl md:rounded-2xl flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                          <IconComponent className="w-5 h-5 text-brand-500" />
                        </div>
                        <span className="text-base font-bold text-brand-700">{amenityLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* reviews */}
            <section id="reviews-section" className="space-y-8 md:space-y-10">
              <div className="flex items-center gap-3 md:gap-4">
                <Star className="w-6 h-6 md:w-7 md:h-7 text-brand-700 fill-brand-700 shrink-0" />
                <h2 className="text-xl md:text-2xl font-black text-brand-700">{formatRatingScore(spaceDetails.rating)} · {spaceDetails.reviews} reviews</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                {reviews.slice(0, 2).map((review) => (
                  <div key={review.id} className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-brand-100 rounded-2xl overflow-hidden shrink-0">
                          {review.avatar ? (
                            <ImageWithFallback src={review.avatar} alt={review.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand-500 font-black text-lg">
                              {review.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-black text-brand-700">{review.name}</h4>
                          <p className="text-brand-400 text-sm font-bold">{review.date}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`px-2.5 py-1 rounded-xl font-black text-xs border-2 ${getRatingColor(review.rating)}`}>
                          ⭐ {review.rating.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {renderStars(review.rating)}
                        </div>
                      </div>
                    </div>
                    <p className="text-brand-500 font-medium leading-relaxed">{review.text}</p>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setIsReviewsOpen(true)}
                className="px-6 md:px-8 py-3 md:py-3.5 border-2 border-brand-700 text-brand-700 font-black text-sm md:text-base rounded-xl md:rounded-2xl hover:bg-brand-700 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg shadow-brand-700/0 hover:shadow-brand-700/10"
              >
                Show all reviews
              </button>
            </section>

            {/* reviews modal */}
            <AnimatePresence>
              {isReviewsOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 py-8 md:p-12">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsReviewsOpen(false)}
                    className="absolute inset-0 bg-brand-700/60 backdrop-blur-md"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 100, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.95 }}
                    className="relative w-full max-w-5xl h-full bg-white rounded-[2rem] md:rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl"
                  >
                    {/* modal header */}
                    <div className="flex items-center justify-between p-5 md:p-6 border-b border-brand-100 shrink-0">
                      <div className="flex items-center gap-3">
                        <Star className="w-5 h-5 md:w-6 md:h-6 text-brand-700 fill-brand-700 shrink-0" />
                        <h2 className="text-lg md:text-2xl font-black text-brand-700">{formatRatingScore(spaceDetails.rating)} · {spaceDetails.reviews} reviews</h2>
                      </div>
                      <button 
                        onClick={() => setIsReviewsOpen(false)}
                        className="w-10 h-10 md:w-12 md:h-12 bg-brand-50 rounded-full flex items-center justify-center hover:bg-brand-100 transition-colors cursor-pointer group shrink-0"
                      >
                        <Plus className="w-5 h-5 md:w-6 md:h-6 text-brand-700 rotate-45 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>

                    {/* modal body */}
                    <div 
                      ref={scrollRef}
                      className="flex-1 overflow-y-auto p-5 md:p-8"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 lg:gap-12">
                        {/* rating breakdown */}
                        <div className="space-y-6 md:space-y-8 lg:sticky lg:top-0 h-fit">
                          {/* rating distribution chart */}
                          <div className="bg-brand-50 rounded-3xl p-6 space-y-4 border-2 border-brand-100">
                            <h3 className="text-sm font-black text-brand-700 uppercase tracking-widest">Rating Distribution</h3>
                            <div className="space-y-3">
                              {([5, 4, 3, 2, 1] as const).map((rating) => {
                                const count = ratingDistribution[rating];
                                const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                                return (
                                  <div key={rating} className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 w-12 shrink-0">
                                      <span className="text-xs font-black text-brand-700">{rating}</span>
                                      <Star className="w-3 h-3 text-brand-700 fill-brand-700" />
                                    </div>
                                    <div className="flex-1 h-2 bg-white rounded-full overflow-hidden border border-brand-200">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.8, delay: (5 - rating) * 0.1 }}
                                        className="h-full bg-brand-700 rounded-full"
                                      />
                                    </div>
                                    <span className="text-xs font-black text-brand-400 w-6 text-right">
                                      {count}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* category ratings */}
                          {[
                            { label: 'Cleanliness', score: reviewAggregates.cleanliness ?? 0 },
                            { label: 'Communication', score: reviewAggregates.communication ?? 0 },
                            { label: 'Location', score: reviewAggregates.location ?? 0 },
                            { label: 'Value', score: reviewAggregates.value ?? 0 },
                          ].map((stat) => (
                            <div key={stat.label} className="space-y-2">
                              <div className="flex justify-between items-center text-sm font-bold text-brand-700">
                                <span>{stat.label}</span>
                                <span>{formatRatingScore(stat.score)}</span>
                              </div>
                              <div className="h-1 w-full bg-brand-50 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${((stat.score || 0) / 5) * 100}%` }}
                                  transition={{ delay: 0.2, duration: 1 }}
                                  className="h-full bg-brand-700 rounded-full"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* review list */}
                        <div className="space-y-8">
                          {/* sort controls (header) */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-brand-100">
                            <h3 className="text-xl font-black text-brand-700">Most relevant reviews</h3>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-brand-400">Sort by:</span>
                              <Popover.Root>
                                <Popover.Trigger asChild>
                                  <button className="flex items-center gap-2 px-4 py-2.5 bg-brand-50 border-2 border-brand-100 rounded-xl text-sm font-bold text-brand-700 hover:border-brand-300 hover:bg-brand-100 transition-all cursor-pointer outline-none active:scale-95">
                                    {sortBy === 'recent' && <History className="w-4 h-4 text-brand-400" />}
                                    {sortBy === 'oldest' && <History className="w-4 h-4 text-brand-400" />}
                                    {sortBy === 'highest' && <ArrowUpNarrowWide className="w-4 h-4 text-brand-400" />}
                                    {sortBy === 'lowest' && <ArrowDownWideNarrow className="w-4 h-4 text-brand-400" />}
                                    <span>
                                      {sortBy === 'recent' ? 'Most Recent' : 
                                       sortBy === 'oldest' ? 'Oldest' : 
                                       sortBy === 'highest' ? 'Highest Rating' : 
                                       'Lowest Rating'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-brand-400 ml-1" />
                                  </button>
                                </Popover.Trigger>
                                <Popover.Portal>
                                  <Popover.Content 
                                    align="end" 
                                    sideOffset={8}
                                    className="z-[1100] outline-none"
                                  >
                                    <motion.div
                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                      className="bg-white rounded-2xl shadow-2xl border border-brand-100 p-2 min-w-[200px]"
                                    >
                                      {[
                                        { id: 'recent', label: 'Most Recent', icon: History },
                                        { id: 'oldest', label: 'Oldest', icon: History },
                                        { id: 'highest', label: 'Highest Rating', icon: ArrowUpNarrowWide },
                                        { id: 'lowest', label: 'Lowest Rating', icon: ArrowDownWideNarrow }
                                      ].map((option) => (
                                        <Popover.Close asChild key={option.id}>
                                          <button
                                            onClick={() => {
                                              setSortBy(option.id as any);
                                              setReviewPage(1);
                                              scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all group cursor-pointer ${
                                              sortBy === option.id 
                                              ? 'bg-brand-700 text-white' 
                                              : 'text-brand-700 hover:bg-brand-50'
                                            }`}
                                          >
                                            <div className="flex items-center gap-3">
                                              <option.icon className={`w-4 h-4 ${sortBy === option.id ? 'text-brand-200' : 'text-brand-400 group-hover:text-brand-700'}`} />
                                              {option.label}
                                            </div>
                                            {sortBy === option.id && <Check className="w-4 h-4 text-brand-200" />}
                                          </button>
                                        </Popover.Close>
                                      ))}
                                    </motion.div>
                                  </Popover.Content>
                                </Popover.Portal>
                              </Popover.Root>
                            </div>
                          </div>

                          <div className="space-y-12 min-h-[600px]">
                            {currentReviews.map((review, idx) => (
                              <motion.div 
                                key={review.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="space-y-4"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-4 flex-1">
                                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-brand-50 border border-brand-100 shrink-0">
                                      <ImageWithFallback src={review.avatar} alt={review.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                      <h4 className="font-black text-brand-700">{review.name}</h4>
                                      <p className="text-brand-400 text-sm font-bold">{review.date}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <motion.div 
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ delay: idx * 0.1 + 0.2, type: 'spring', stiffness: 200 }}
                                      className={`px-3 py-1.5 rounded-xl font-black text-sm border-2 ${getRatingColor(review.rating)}`}
                                    >
                                      ⭐ {review.rating.toFixed(2)}
                                    </motion.div>
                                    <div className="flex items-center gap-0.5">
                                      {renderStars(review.rating)}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-brand-500 font-medium leading-relaxed text-base md:text-lg">{review.text}</p>
                              </motion.div>
                            ))}
                          </div>

                          {/* pagination */}
                          <div className="pt-12 border-t border-brand-100 flex items-center justify-between">
                            <div className="text-sm font-bold text-brand-400">
                              Page {reviewPage} of {totalReviewPages}
                            </div>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => {
                                  if (reviewPage > 1) {
                                    setReviewPage(reviewPage - 1);
                                    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }}
                                disabled={reviewPage === 1}
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
                                  reviewPage === 1 
                                  ? 'border-brand-50 text-brand-100 cursor-not-allowed' 
                                  : 'border-brand-100 text-brand-700 hover:bg-brand-50 hover:border-brand-200 cursor-pointer active:scale-95'
                                }`}
                              >
                                <ChevronLeft className="w-6 h-6" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (reviewPage < totalReviewPages) {
                                    setReviewPage(reviewPage + 1);
                                    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }}
                                disabled={reviewPage === totalReviewPages}
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
                                  reviewPage === totalReviewPages 
                                  ? 'border-brand-50 text-brand-100 cursor-not-allowed' 
                                  : 'border-brand-100 text-brand-700 hover:bg-brand-50 hover:border-brand-200 cursor-pointer active:scale-95'
                                }`}
                              >
                                <ChevronRight className="w-6 h-6" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* location */}
            <section id="location-map" className="space-y-6 md:space-y-8 pt-8 md:pt-10 border-t border-brand-100">
              <h2 className="text-2xl md:text-3xl font-black text-brand-700">Where you'll be</h2>
              {spaceDetails.latitude != null && spaceDetails.longitude != null ? (
                <>
                  <SpaceLocationMap
                    latitude={spaceDetails.latitude}
                    longitude={spaceDetails.longitude}
                    className="h-[35.2rem] w-full"
                  />
                  <a
                    href={`https://www.google.com/maps?q=${spaceDetails.latitude},${spaceDetails.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 px-6 py-3 bg-brand-700 text-white font-black text-sm md:text-base rounded-full hover:bg-brand-600 transition-all duration-300 shadow-lg shadow-brand-700/20 hover:shadow-xl hover:shadow-brand-700/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <MapPin className="w-5 h-5" />
                    <span>Open in Google Maps</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </>
              ) : (
                <div className="h-[35.2rem] bg-brand-50 rounded-[1.5rem] md:rounded-[2rem] relative overflow-hidden border border-brand-100 flex items-center justify-center">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--brand-300)_1px,_transparent_1px)] [background-size:40px_40px]" />
                  <div className="relative z-10 text-center">
                    <div className="w-14 h-14 bg-brand-700 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xl shadow-brand-700/20">
                      <MapPin className="w-7 h-7 text-white" />
                    </div>
                    <p className="text-brand-700 font-black text-base md:text-lg">{spaceDetails.location}</p>
                  </div>
                </div>
              )}
              {spaceDetails.latitude == null && spaceDetails.longitude == null && spaceDetails.location && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spaceDetails.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3 bg-brand-700 text-white font-black text-sm md:text-base rounded-full hover:bg-brand-600 transition-all duration-300 shadow-lg shadow-brand-700/20 hover:shadow-xl hover:shadow-brand-700/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <MapPin className="w-5 h-5" />
                  <span>Open in Google Maps</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </section>
          </div>

          {/* booking widget */}
          <div className="relative z-10" id="booking">
            <div className="sticky top-24 md:top-32 bg-white border-2 border-brand-100 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-2xl shadow-brand-700/5 overflow-hidden flex flex-col max-h-[calc(100vh-5.5rem)] md:max-h-[calc(100vh-7.5rem)]">
              {(spaceDetails?.status ?? 'active') !== 'active' && (
                <div className="mb-4 p-3 md:p-4 bg-amber-50 border border-amber-200 rounded-xl md:rounded-2xl shrink-0">
                  <p className="text-amber-800 font-bold text-sm">
                    {(spaceDetails?.status ?? '') === 'maintenance'
                      ? 'This space is under maintenance.'
                      : 'This space is not currently available for booking.'}
                  </p>
                  <p className="text-amber-600 text-xs mt-1">
                    {(spaceDetails?.status ?? '') === 'maintenance'
                      ? 'The host is making improvements and it will be available again soon.'
                      : 'The host has temporarily deactivated this listing.'}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div>
                  <span className="text-2xl md:text-3xl font-black text-brand-700">${spaceDetails.price}</span>
                  <span className="text-brand-400 font-bold tracking-tight text-sm"> / hour</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Star className="w-4 h-4 text-brand-500 fill-brand-500" />
                  <span className="font-black text-brand-700">{formatRatingScore(spaceDetails.rating)}</span>
                  <span className="text-brand-300">·</span>
                  <span className="text-brand-400 font-bold">{spaceDetails.reviews} reviews</span>
                </div>
              </div>

              <div className={`flex flex-col flex-1 min-h-0 ${(spaceDetails?.status ?? 'active') !== 'active' ? 'pointer-events-none opacity-60' : ''}`}>
                {/* date picker */}
                <div className="group relative shrink-0 mb-4" ref={calendarRef}>
                  <label className="block text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] mb-2 ml-1">Selected Date</label>
                  <div className="relative">
                    <button 
                      data-testid="booking-date-trigger"
                      onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                      className={`w-full px-4 py-2.5 bg-brand-50 border-2 rounded-xl text-brand-700 font-bold text-sm flex items-center justify-between transition-all cursor-pointer ${
                        isCalendarOpen ? 'border-brand-700 shadow-lg' : 'border-brand-100 hover:border-brand-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="w-5 h-5 text-brand-400" />
                        <span>{selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Choose a date'}</span>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-brand-400 transition-transform duration-300 ${isCalendarOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {isCalendarOpen && (
                      <motion.div
                        data-testid="calendar-panel"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute left-0 right-0 mt-3 bg-white border border-brand-100 rounded-[1.5rem] md:rounded-[2rem] shadow-2xl z-[100] p-5"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="font-black text-brand-700">{format(currentMonth, 'MMMM yyyy')}</h4>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => changeMonth(-1)} 
                              className="w-10 h-10 flex items-center justify-center bg-brand-50 hover:bg-brand-700 hover:text-white rounded-xl transition-all duration-300 hover:scale-110 active:scale-90 hover:shadow-lg hover:shadow-brand-700/20 group/nav cursor-pointer"
                            >
                              <ChevronLeft className="w-5 h-5 text-brand-400 group-hover/nav:text-white transition-colors" />
                            </button>
                            <button 
                              onClick={() => changeMonth(1)} 
                              className="w-10 h-10 flex items-center justify-center bg-brand-50 hover:bg-brand-700 hover:text-white rounded-xl transition-all duration-300 hover:scale-110 active:scale-90 hover:shadow-lg hover:shadow-brand-700/20 group/nav cursor-pointer"
                            >
                              <ChevronRight className="w-5 h-5 text-brand-400 group-hover/nav:text-white transition-colors" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-center text-[10px] font-black text-brand-300 uppercase py-2">{day}</div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.map((day, idx) => {
                            if (day === null) return <div key={`empty-${idx}`} />;
                            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                            const isSelected = selectedDate && 
                              date.getDate() === selectedDate.getDate() && 
                              date.getMonth() === selectedDate.getMonth() && 
                              date.getFullYear() === selectedDate.getFullYear();
                            const todayStart = new Date();
                            todayStart.setHours(0, 0, 0, 0);
                            const isPast = date < todayStart;
                            const isToday = date.getDate() === todayStart.getDate() &&
                              date.getMonth() === todayStart.getMonth() &&
                              date.getFullYear() === todayStart.getFullYear();
                            const maxAdvance = spaceDetails?.maxAdvanceBookingDays ?? null;
                            const daysFromToday = (date.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000);
                            const isBeyondAdvance = maxAdvance != null && daysFromToday > maxAdvance;
                            const dayName = DAY_NAMES[date.getDay()];
                            const isBannedDay = (spaceDetails?.bannedDays?.length ?? 0) > 0 && spaceDetails?.bannedDays?.includes(dayName);
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const isBlockedDate = isDateInBlockedRanges(dateStr, spaceDetails?.blockedDates ?? null);
                            const isFullyBooked = fullyBookedByDate[dateStr] === true;
                            const isDisabled = isPast ||
                              (isToday && spaceDetails?.sameDayBookingAllowed === false) ||
                              isBeyondAdvance ||
                              isBannedDay ||
                              isBlockedDate ||
                              isFullyBooked;

                            return (
                              <button
                                key={idx}
                                disabled={isDisabled}
                                onClick={() => {
                                  setSelectedDate(date);
                                  setIsCalendarOpen(false);
                                }}
                                className={`
                                  aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all cursor-pointer relative group/date
                                  ${isDisabled
                                    ? 'text-brand-100 cursor-not-allowed' 
                                    : isSelected
                                      ? 'bg-brand-700 text-white shadow-xl shadow-brand-700/30 scale-105 z-10'
                                      : 'text-brand-700 hover:bg-brand-50 hover:scale-110 hover:shadow-lg active:scale-95'
                                  }
                                `}
                              >
                                <span className="relative z-10">{day}</span>
                                {!isDisabled && !isSelected && (
                                  <div className="absolute inset-0 border-2 border-brand-50 rounded-xl group-hover/date:border-brand-200 transition-colors" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* time slot grid */}
                <div className="flex flex-col flex-1 min-h-[12rem] md:min-h-[14rem] space-y-2.5">
                  <AnimatePresence>
                    {bookingConflict && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl overflow-hidden shrink-0"
                      >
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-xs font-bold text-red-600 leading-snug">
                          This time range overlaps with an existing booking. Please select a different time.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between gap-2 shrink-0">
                    <label className="block text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Daily Availability</label>
                    <div className="flex gap-2.5 flex-wrap justify-end">
                      {unavailableForGrid.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-brand-200" />
                          <span className="text-[10px] font-bold text-brand-400">Outside window</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-brand-200/60" />
                        <span className="text-[10px] font-bold text-brand-400">Booked</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-brand-50 border border-brand-200" />
                        <span className="text-[10px] font-bold text-brand-400">Open</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-brand-700" />
                        <span className="text-[10px] font-bold text-brand-400">Selected</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                  <div className="grid grid-cols-4 gap-1.5">
                    {allTimeSlots.map((time) => {
                      const isInBooked = isTimeInBookedRange(time, bookedRanges);
                      const isUnavailable = unavailableForGrid.includes(time);
                      const slotDt = selectedDate ? slotToDateTime(selectedDate, time) : null;
                      const isPast = slotDt ? slotDt.getTime() <= nowMs : false;
                      const isStart = startTime === time;
                      const isEnd = endTime === time;
                      const inRange = isTimeInRange(time);
                      const isSelected = isStart || isEnd || inRange;
                      const displayTime = time.replace('+1', '').replace(':00', '');
                      const isNextDay = time.includes('+1');

                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={isUnavailable || isPast}
                          onClick={() => handleTimeClick(time)}
                          className={`
                            relative py-2 rounded-lg text-[10px] md:text-[11px] font-black transition-all cursor-pointer
                            ${isUnavailable || isPast
                              ? 'bg-brand-100 text-brand-300 cursor-not-allowed opacity-60'
                              : isInBooked && !isSelected
                              ? 'bg-brand-200/30 text-brand-300 cursor-pointer'
                              : isSelected
                                ? 'bg-brand-700 text-white shadow-lg z-10'
                                : 'bg-brand-50 text-brand-500 hover:bg-brand-100 border border-transparent hover:border-brand-200'
                            }
                            ${isStart && endTime ? 'rounded-r-none' : ''}
                            ${isEnd ? 'rounded-l-none' : ''}
                            ${inRange ? 'rounded-none' : ''}
                          `}
                        >
                          <span className="relative z-10">{displayTime}</span>
                          {isNextDay && !isSelected && (
                            <span className="absolute top-0.5 right-1 text-[7px] font-black text-brand-300">+1</span>
                          )}
                          {isStart && !endTime && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-400 rounded-full border-2 border-white animate-pulse" />
                          )}
                          {isInBooked && !isSelected && (
                            <Lock className="absolute top-1 right-1 w-3 h-3 text-brand-300 opacity-50" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {startTime && !endTime && (
                    <motion.p 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-[11px] font-bold text-brand-400 mt-1.5 italic"
                    >
                      Now select an end time...
                    </motion.p>
                  )}
                  </div>
                </div>

                {/* duration summary + actions (pinned to bottom of card) */}
                <div className="shrink-0 pt-3 mt-2.5 border-t border-brand-100 space-y-3">
                <AnimatePresence>
                  {startTime && endTime && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2.5 overflow-hidden"
                    >
                      <div className="flex justify-between items-center bg-brand-50 px-3.5 py-2.5 rounded-xl">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Clock className="w-4 h-4 text-brand-700 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Selected</p>
                            <p className="text-xs md:text-sm font-bold text-brand-700 truncate">{startTime} — {endTime}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-black text-brand-700">{duration}h</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 px-1">
                        <div className="flex justify-between items-center text-brand-500 font-medium text-xs md:text-sm">
                          <span>${spaceDetails.price} × {duration}h</span>
                          <span className="font-bold text-brand-700">${subtotal}</span>
                        </div>
                        {cleaningFee > 0 && (
                          <div className="flex justify-between items-center text-brand-500 font-medium text-xs md:text-sm">
                            <span>Cleaning fee</span>
                            <span className="font-bold text-brand-700">${cleaningFee}</span>
                          </div>
                        )}
                        {equipmentFee > 0 && (
                          <div className="flex justify-between items-center text-brand-500 font-medium text-xs md:text-sm">
                            <span>Equipment fee</span>
                            <span className="font-bold text-brand-700">${equipmentFee}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-brand-500 font-medium text-xs md:text-sm">
                          <span>Service fee ({PLATFORM_SERVICE_FEE_PERCENT}%)</span>
                          <span className="font-bold text-brand-700">${serviceFee}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1.5 border-t border-brand-100">
                          <span className="text-sm font-black text-brand-700">Total</span>
                          <span className="text-base md:text-lg font-black text-brand-700">${total}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {durationError && (
                  <p className="text-center text-red-600 text-xs md:text-sm font-bold">
                    {durationError}
                  </p>
                )}

                <button 
                  onClick={handleBook}
                  disabled={!startTime || !endTime || !durationValid || (spaceDetails?.status ?? 'active') !== 'active' || isHostOfSpace}
                  className="w-full py-3 bg-brand-700 text-white font-black text-sm md:text-base rounded-xl shadow-xl shadow-brand-700/30 hover:bg-brand-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isHostOfSpace ? 'Your Space' : (spaceDetails.isInstantBookable ? 'Instant Book' : 'Request to Book')}
                </button>

                {isHostOfSpace && (
                  <p className="text-center text-brand-400 text-xs font-bold">
                    You can manage this booking from your host portal, but you cannot book your own space.
                  </p>
                )}

                <p className="text-center text-brand-400 text-xs font-bold leading-snug">
                  Max {spaceDetails.capacity} guests
                  {(minH != null || maxH != null) && (
                    <>
                      {' · '}
                      {minH != null && maxH != null
                        ? `${minH}–${maxH}h booking`
                        : minH != null
                          ? `min ${minH}h`
                          : `max ${maxH}h`}
                    </>
                  )}
                </p>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
