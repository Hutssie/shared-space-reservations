import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  Check, 
  X, 
  Camera, 
  Plus, 
  Wifi, 
  Coffee, 
  AirVent, 
  Tv, 
  Music, 
  Briefcase, 
  Maximize2, 
  Users,
  Save,
  Trash2,
  Info,
  ChevronRight,
  Sparkles,
  Zap,
  Clock,
  AlertTriangle,
  Calendar,
  Timer,
  Shield,
  Ban,
  CalendarX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { AmenitiesList } from './FilterDropdowns';
import { DescriptionEditor } from './DescriptionEditor';

import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/dist/style.css';
import { fetchSpace, updateSpace, deleteSpace } from '../api/spaces';
import { fetchHostSpaceBookedDates } from '../api/host';
import type { Space } from '../api/spaces';

type BlockedDate = { id: string; startDate: string; endDate: string; createdAt: string };

const sections = [
  { id: 'details', label: 'Basic Details', icon: Info },
  { id: 'photos', label: 'Photo Gallery', icon: Camera },
  { id: 'capacity', label: 'Capacity & Size', icon: Maximize2 },
  { id: 'amenities', label: 'Amenities', icon: Sparkles },
  { id: 'booking', label: 'Booking Settings', icon: Calendar },
  { id: 'status', label: 'Publishing', icon: Zap },
];

const TIME_SLOTS = [
  '12:00 AM', '01:00 AM', '02:00 AM', '03:00 AM', '04:00 AM', '05:00 AM', '06:00 AM', '07:00 AM',
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
  '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
];

const categoryOptions = [
  'Art Studio',
  'Sports Space',
  'Classroom',
  'Conference Room',
  'IT Classroom',
  'Laboratory',
  'Photo Studio',
  'Recording Studio',
  'Kitchen Studio',
  'Dancing Studio'
];

const cancellationPolicies = [
  { value: 'flexible', label: 'Flexible', desc: '24hr notice' },
  { value: 'moderate', label: 'Moderate', desc: '48hr notice' },
  { value: 'strict', label: 'Strict', desc: '7 days notice' }
];

const STATUS_UI_TO_API: Record<string, string> = { Active: 'active', Maintenance: 'maintenance', Inactive: 'inactive' };
const STATUS_API_TO_UI: Record<string, string> = { active: 'Active', maintenance: 'Maintenance', inactive: 'Inactive' };

const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const parseDurationHoursInput = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n)) return null;
  return clampInt(n, 1, 24);
};

export const EditSpace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [initialListing, setInitialListing] = useState<any>(null);
  const [listing, setListing] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('details');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [deleteBlockedByBookings, setDeleteBlockedByBookings] = useState<number | null>(null);
  const [hasCustomDuration, setHasCustomDuration] = useState(true);
  const [hasCustomOperatingHours, setHasCustomOperatingHours] = useState(true);
  const [hasWeeklySchedule, setHasWeeklySchedule] = useState(false);
  const [bannedDays, setBannedDays] = useState<string[]>([]);
  const [initialOperatingDays, setInitialOperatingDays] = useState<{ hasWeeklySchedule: boolean; bannedDays: string[] } | null>(null);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [initialBlockedDates, setInitialBlockedDates] = useState<BlockedDate[] | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ from?: Date; to?: Date } | undefined>();
  const [bookedDates, setBookedDates] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchSpace(id)
      .then((space) => {
        const hasDuration = space.minDurationHours != null || space.maxDurationHours != null;
        const hasHours = space.availabilityStartTime != null && space.availabilityEndTime != null;
        const hasSchedule = (space as { bannedDays?: string[] | null }).bannedDays != null;
        const days = (space as { bannedDays?: string[] | null }).bannedDays ?? [];
        setHasCustomDuration(hasDuration);
        setHasCustomOperatingHours(hasHours);
        setHasWeeklySchedule(hasSchedule);
        setBannedDays(Array.isArray(days) ? days : []);
        setInitialOperatingDays({ hasWeeklySchedule: hasSchedule, bannedDays: Array.isArray(days) ? days : [] });
        const blocked = (space as { blockedDates?: BlockedDate[] | null }).blockedDates ?? [];
        setBlockedDates(Array.isArray(blocked) ? blocked : []);
        setInitialBlockedDates(Array.isArray(blocked) ? blocked : []);
        const data = {
          id: space.id,
          title: space.title,
          category: space.category,
          price: space.price,
          image: space.image ?? '',
          images: space.images?.length ? space.images : [space.image].filter(Boolean),
          description: space.description,
          capacity: space.capacity,
          sqm: space.squareMeters != null ? space.squareMeters : '',
          amenities: space.amenities ?? [],
          address: space.location,
          isInstantBookable: space.isInstantBookable ?? false,
          availabilityStartTime: space.availabilityStartTime ?? null,
          availabilityEndTime: space.availabilityEndTime ?? null,
          status: STATUS_API_TO_UI[(space as { status?: string }).status ?? 'active'] ?? 'Active',
          bookingSettings: {
            sameDayBooking: space.sameDayBookingAllowed ?? true,
            minDuration: space.minDurationHours ?? null,
            maxDuration: space.maxDurationHours ?? null,
            advanceBookingDays: space.maxAdvanceBookingDays ?? 365,
            cancellationPolicy: space.cancellationPolicy ?? 'flexible',
            cleaningFee: (space.cleaningFeeCents ?? 0) / 100,
            equipmentFee: (space.equipmentFeeCents ?? 0) / 100,
          },
        };
    setInitialListing(JSON.parse(JSON.stringify(data)));
    setListing(data);
        if (id) {
          fetchHostSpaceBookedDates(id).then((r) => setBookedDates(r.dates ?? [])).catch(() => setBookedDates([]));
        }
      })
      .catch(() => toast.error('Failed to load space'))
      .finally(() => setLoading(false));
  }, [id]);

  const isDirty = useMemo(() => {
    if (!listing || !initialListing) return false;
    const listingDirty = JSON.stringify(listing) !== JSON.stringify(initialListing);
    const operatingDaysDirty = initialOperatingDays && (
      hasWeeklySchedule !== initialOperatingDays.hasWeeklySchedule ||
      JSON.stringify(bannedDays) !== JSON.stringify(initialOperatingDays.bannedDays)
    );
    const blockedDirty = initialBlockedDates && JSON.stringify(blockedDates) !== JSON.stringify(initialBlockedDates);
    return listingDirty || !!operatingDaysDirty || !!blockedDirty;
  }, [listing, initialListing, initialOperatingDays, hasWeeklySchedule, bannedDays, blockedDates, initialBlockedDates]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const handleScroll = () => {
      const lastId = sections[sections.length - 1].id;
      const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80;
      if (nearBottom) {
        setActiveSection(lastId);
        return;
      }
      const sectionElements = sections.map(s => document.getElementById(s.id));
      const threshold = Math.min(400, window.innerHeight * 0.45);
      let active: string | null = null;
      for (let i = 0; i < sectionElements.length; i++) {
        const el = sectionElements[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= threshold) active = sections[i].id;
      }
      if (active !== null) setActiveSection(active);
      else setActiveSection(sections[0].id);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!listing) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id || !listing) return;
    setIsSaving(true);
    try {
      await updateSpace(id, {
        title: listing.title,
        category: listing.category,
        pricePerHour: listing.price,
        location: listing.address,
        capacity: listing.capacity,
        squareMeters: (listing.sqm !== '' && listing.sqm != null && !Number.isNaN(Number(listing.sqm)))
          ? Number(listing.sqm)
          : null,
        description: listing.description,
        imageUrl: listing.image || undefined,
        imagesJson: listing.images,
        amenitiesJson: listing.amenities,
        isInstantBookable: listing.isInstantBookable ?? false,
        availabilityStartTime: hasCustomOperatingHours && listing.availabilityStartTime ? listing.availabilityStartTime : null,
        availabilityEndTime: hasCustomOperatingHours && listing.availabilityEndTime ? listing.availabilityEndTime : null,
        sameDayBookingAllowed: listing.bookingSettings?.sameDayBooking ?? true,
        minDurationHours: hasCustomDuration && listing.bookingSettings?.minDuration != null ? listing.bookingSettings.minDuration : null,
        maxDurationHours: hasCustomDuration && listing.bookingSettings?.maxDuration != null ? listing.bookingSettings.maxDuration : null,
        maxAdvanceBookingDays: listing.bookingSettings?.advanceBookingDays ?? null,
        cancellationPolicy: listing.bookingSettings?.cancellationPolicy ?? null,
        cleaningFeeCents: Math.round((listing.bookingSettings?.cleaningFee ?? 0) * 100),
        equipmentFeeCents: Math.round((listing.bookingSettings?.equipmentFee ?? 0) * 100),
        bannedDaysJson: hasWeeklySchedule ? JSON.stringify(bannedDays) : null,
        blockedDatesJson: blockedDates.length > 0 ? blockedDates : null,
        status: STATUS_UI_TO_API[listing.status ?? 'Active'] ?? 'active',
      });
    toast.success('All changes saved successfully!');
    setInitialListing(JSON.parse(JSON.stringify(listing)));
      setInitialOperatingDays({ hasWeeklySchedule, bannedDays: [...bannedDays] });
      setInitialBlockedDates([...blockedDates]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
    setIsSaving(false);
    }
  };

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      navigate('/host/manage-listings');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files).map(file => URL.createObjectURL(file));
      setListing({
        ...listing,
        images: [...(listing.images || []), ...newImages],
        image: listing.image || newImages[0]
      });
    }
  };

  const removeImage = (index: number) => {
    const currentImages = listing.images || [];
    const updatedImages = currentImages.filter((_: any, i: number) => i !== index);
    setListing({
      ...listing,
      images: updatedImages,
      image: updatedImages[0] || ''
    });
  };

  const toggleAmenity = (amenityId: string) => {
    const currentAmenities = listing.amenities || [];
    const updatedAmenities = currentAmenities.includes(amenityId)
      ? currentAmenities.filter((a: string) => a !== amenityId)
      : [...currentAmenities, amenityId];
    setListing({ ...listing, amenities: updatedAmenities });
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const offset = 120;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="pt-32 pb-32 min-h-screen bg-[#fcfaf9]">
      {/* header sticky */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-white/80 backdrop-blur-xl border-b border-brand-100/50 h-20 flex items-center shadow-sm">
        <div className="max-w-[1600px] mx-auto w-full px-4 md:px-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-6 min-w-0">
            <button 
              onClick={handleBackClick}
              className="shrink-0 w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:text-brand-700 hover:bg-brand-100 transition-all group cursor-pointer border-none"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="hidden sm:block h-8 w-px bg-brand-100" />
            <div className="truncate">
              <h2 className="text-base md:text-lg font-black text-brand-700 tracking-tight leading-none mb-1">Editing Listing</h2>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isDirty ? 'bg-orange-400' : 'bg-green-500'} animate-pulse`} />
                <p className="text-[9px] md:text-[10px] font-bold text-brand-400 uppercase tracking-widest truncate">
                  {listing.title}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button 
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`px-4 md:px-8 py-2.5 md:py-3 text-xs md:text-base font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 md:gap-3 ${
                isDirty 
                  ? 'bg-brand-700 text-white shadow-xl shadow-brand-700/20 hover:bg-brand-600 active:scale-[0.98]' 
                  : 'bg-brand-50 text-brand-300 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden xs:inline">Save Changes</span>
                  <span className="xs:hidden">Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* navigatie pe sectiuni pentru mobile */}
      <div className="lg:hidden fixed top-20 left-0 right-0 z-[55] bg-[#fcfaf9]/95 backdrop-blur-md border-b border-brand-100/30 overflow-x-auto custom-scrollbar shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 min-w-max">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all text-xs font-black uppercase tracking-widest whitespace-nowrap border-none cursor-pointer ${
                activeSection === section.id 
                  ? 'bg-brand-700 text-white shadow-md' 
                  : 'bg-white text-brand-400 border border-brand-100'
              }`}
            >
              <section.icon className="w-3.5 h-3.5" />
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-12 mt-20 lg:mt-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          
          {/* navigatie sectiuni - bara laterala pentru desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-40 space-y-2">
              <p className="text-[10px] font-black text-brand-300 uppercase tracking-[0.25em] mb-6 ml-4">Listing Editor</p>
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-pointer group ${
                    activeSection === section.id 
                      ? 'bg-brand-700 text-white shadow-xl shadow-brand-700/10 translate-x-2' 
                      : 'text-brand-400 hover:text-brand-700 hover:bg-white'
                  }`}
                >
                  <section.icon className={`w-5 h-5 ${activeSection === section.id ? 'text-white' : 'text-brand-200 group-hover:text-brand-500'}`} />
                  <span className="text-sm font-black tracking-tight">{section.label}</span>
                  <ChevronRight className={`w-4 h-4 ml-auto transition-opacity ${activeSection === section.id ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              ))}
              
              <div className="mt-12 pt-8 border-t border-brand-100 space-y-6 px-4">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={!id || !listing}
                  className="text-[10px] font-black text-red-400 hover:text-red-500 uppercase tracking-widest flex items-center gap-2 transition-colors border-none bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Listing
                </button>
              </div>
            </div>
          </aside>

          {/* zona principala a formularului */}
          <main className="flex-1 space-y-12">
            
            {/* 1. detalii de baza */}
            <section id="details" className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-12 border border-brand-100 shadow-xl shadow-brand-700/5 scroll-mt-48 lg:scroll-mt-40 group">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-black text-brand-700 tracking-tight">Basic Details</h3>
                  <p className="text-brand-400 text-xs md:text-sm font-medium">Help guests find your space with accurate naming and descriptions.</p>
                </div>
                <div className="hidden xs:flex w-10 h-10 md:w-12 md:h-12 bg-brand-50 rounded-xl md:rounded-2xl items-center justify-center text-brand-200 group-focus-within:text-brand-700 transition-colors shrink-0">
                  <Info className="w-5 h-5 md:w-6 md:h-6" />
                </div>
              </div>

              <div className="space-y-6 md:space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Listing Title</label>
                  <input 
                    type="text" 
                    value={listing.title}
                    onChange={(e) => setListing({...listing, title: e.target.value})}
                    placeholder="e.g. Modern Minimalist Studio"
                    className="w-full px-5 md:px-8 py-4 md:py-5 bg-brand-50 border-2 border-brand-100/50 focus:border-brand-700 focus:bg-white rounded-[1.25rem] md:rounded-[1.5rem] transition-all outline-none font-bold text-brand-700 text-lg md:text-xl placeholder:text-brand-200 shadow-sm"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Description</label>
                  <DescriptionEditor
                    value={listing.description}
                    onChange={(description) => setListing((prev) => ({ ...prev, description }))}
                    placeholder="Tell your space's story..."
                    minHeight="160px"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Space Category</label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                        className="w-full px-5 md:px-8 py-4 md:py-5 bg-white border-2 border-brand-100/50 hover:border-brand-200 focus:border-brand-700 rounded-[1.25rem] md:rounded-[1.5rem] transition-all outline-none font-bold text-brand-700 text-left flex items-center justify-between shadow-sm cursor-pointer"
                      >
                        <span className="text-base md:text-lg">{listing.category}</span>
                        <div className={`w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-brand-50 rounded-lg transition-transform ${isCategoryOpen ? 'rotate-270' : 'rotate-90'}`}>
                          <ChevronRight className="w-4 h-4 text-brand-400" />
                        </div>
                      </button>

                      <AnimatePresence>
                        {isCategoryOpen && (
                          <>
                            <div className="fixed inset-0 z-[70]" onClick={() => setIsCategoryOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute top-full left-0 right-0 mt-3 z-[80] bg-white border border-brand-100 rounded-[1.5rem] shadow-2xl overflow-hidden p-2"
                            >
                              <div className="grid grid-cols-1 gap-1 max-h-[250px] md:max-h-[300px] overflow-y-auto custom-scrollbar">
                                {categoryOptions.map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                      setListing({...listing, category: opt});
                                      setIsCategoryOpen(false);
                                    }}
                                    className={`w-full px-5 py-4 rounded-xl text-left font-bold transition-all flex items-center justify-between group cursor-pointer border-none overflow-hidden ${
                                      listing.category === opt 
                                        ? 'bg-brand-700 text-white shadow-lg' 
                                        : 'text-brand-500 hover:bg-brand-50 hover:text-brand-700'
                                    }`}
                                  >
                                    <span className="text-sm truncate mr-2 group-hover:translate-x-1 transition-transform duration-300">{opt}</span>
                                    <div className="flex-shrink-0 flex items-center">
                                      {listing.category === opt ? (
                                        <Check className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Hourly Price ($)</label>
                    <div className="relative">
                      <span className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 font-black text-brand-300 text-lg md:text-xl">$</span>
                      <input 
                        type="number" 
                        value={listing.price}
                        onChange={(e) => setListing({...listing, price: parseInt(e.target.value)})}
                        className="w-full pl-12 md:pl-14 pr-24 md:pr-32 py-4 md:py-5 bg-brand-50 border-2 border-brand-100/50 focus:border-brand-700 focus:bg-white rounded-[1.25rem] md:rounded-[1.5rem] transition-all outline-none font-bold text-brand-700 text-lg md:text-xl shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 text-[9px] md:text-[10px] font-black text-brand-200 uppercase tracking-widest pointer-events-none">Per Hour</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. galerie foto */}
            <section id="photos" className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-12 border border-brand-100 shadow-xl shadow-brand-700/5 scroll-mt-48 lg:scroll-mt-40">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 md:mb-10">
                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-black text-brand-700 tracking-tight">Photo Gallery</h3>
                  <p className="text-brand-400 text-xs md:text-sm font-medium">Add high-resolution photos to showcase your workspace's character.</p>
                </div>
                <div className="flex items-center gap-3 bg-brand-50 px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl border border-brand-100 shrink-0">
                  <Camera className="w-4 h-4 md:w-5 md:h-5 text-brand-400" />
                  <span className="text-[10px] md:text-xs font-black text-brand-700">{listing.images?.length || 0}/10</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6">
                <AnimatePresence mode="popLayout">
                  {(listing.images || []).map((img: string, idx: number) => (
                    <motion.div 
                      key={img}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className={`relative aspect-square rounded-[1.5rem] md:rounded-[2rem] overflow-hidden group border-2 ${idx === 0 ? 'border-brand-700' : 'border-brand-50'} shadow-sm`}
                    >
                      <img src={img} alt={`Space ${idx}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-brand-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                        <button 
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="p-2.5 md:p-3 bg-white text-red-500 rounded-xl md:rounded-2xl hover:bg-red-500 hover:text-white transition-all cursor-pointer shadow-xl transform translate-y-4 group-hover:translate-y-0 duration-300 border-none"
                        >
                          <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </div>
                      {idx === 0 && (
                        <div className="absolute top-3 left-3 md:top-4 md:left-4 px-3 py-1 md:px-4 md:py-1.5 bg-brand-700 text-white text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl">Cover Photo</div>
                      )}
                    </motion.div>
                  ))}
                  {listing.images?.length < 10 && (
                    <motion.button 
                      layout
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-[1.5rem] md:rounded-[2rem] border-3 border-dashed border-brand-100 flex flex-col items-center justify-center gap-2 md:gap-3 hover:bg-brand-50 hover:border-brand-700 transition-all text-brand-200 hover:text-brand-700 cursor-pointer group bg-transparent"
                    >
                      <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white border border-brand-100 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">Add Photos</span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleImageUpload} />
            </section>

            {/* 3. capacitate & dimensiuni */}
            <section id="capacity" className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-12 border border-brand-100 shadow-xl shadow-brand-700/5 scroll-mt-48 lg:scroll-mt-40">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-black text-brand-700 tracking-tight">Capacity & Size</h3>
                  <p className="text-brand-400 text-xs md:text-sm font-medium">Specify how many people your space can comfortably host.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                <div className="p-6 md:p-8 bg-brand-50 rounded-[1.5rem] md:rounded-[2rem] border-2 border-transparent focus-within:border-brand-700 focus-within:bg-white transition-all group shadow-sm">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Guest Limit</label>
                    <Users className="w-5 h-5 md:w-6 md:h-6 text-brand-200 group-focus-within:text-brand-700 transition-colors" />
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="number" 
                      value={listing.capacity}
                      onChange={(e) => setListing({...listing, capacity: parseInt(e.target.value)})}
                      className="bg-transparent border-none focus:ring-0 text-4xl md:text-5xl font-black text-brand-700 p-0 outline-none w-24 md:w-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="space-y-0 md:space-y-1">
                      <p className="font-black text-brand-700 leading-none text-base md:text-lg">Guests</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-brand-300 uppercase tracking-widest">Maximum</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 md:p-8 bg-brand-50 rounded-[1.5rem] md:rounded-[2rem] border-2 border-transparent focus-within:border-brand-700 focus-within:bg-white transition-all group shadow-sm">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Floor Area</label>
                    <Maximize2 className="w-5 h-5 md:w-6 md:h-6 text-brand-200 group-focus-within:text-brand-700 transition-colors" />
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="number" 
                      value={listing.sqm === '' || listing.sqm == null ? '' : listing.sqm}
                      onChange={(e) => {
                        const v = e.target.value;
                        setListing({ ...listing, sqm: v === '' ? '' : parseInt(v, 10) });
                      }}
                      className="bg-transparent border-none focus:ring-0 text-4xl md:text-5xl font-black text-brand-700 p-0 outline-none w-24 md:w-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="space-y-0 md:space-y-1">
                      <p className="font-black text-brand-700 leading-none text-base md:text-lg">m²</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-brand-300 uppercase tracking-widest">Total SQM</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. facilitati */}
            <section id="amenities" className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-12 border border-brand-100 shadow-xl shadow-brand-700/5 scroll-mt-48 lg:scroll-mt-40">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-black text-brand-700 tracking-tight">Amenities</h3>
                  <p className="text-brand-400 text-xs md:text-sm font-medium">Highlight the premium features available at your space.</p>
                </div>
                <Sparkles className="hidden xs:block w-7 h-7 md:w-8 md:h-8 text-brand-200" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                {AmenitiesList.map((amenity) => {
                  const isSelected = (listing.amenities || []).includes(amenity.id);
                  return (
                    <button
                      key={amenity.id}
                      type="button"
                      onClick={() => toggleAmenity(amenity.id)}
                      className={`flex flex-col items-start gap-3 md:gap-4 p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-3 transition-all cursor-pointer group text-left bg-transparent ${
                        isSelected 
                          ? 'bg-brand-50 border-brand-700 text-brand-700 ring-4 ring-brand-700/5 shadow-lg' 
                          : 'bg-white border-brand-100 text-brand-300 hover:border-brand-200 hover:bg-brand-50/50'
                      }`}
                    >
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${
                        isSelected ? 'bg-brand-700 text-white scale-110 shadow-md' : 'bg-brand-50 text-brand-200 group-hover:bg-white group-hover:text-brand-400'
                      }`}>
                        <amenity.icon className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest block">{amenity.label}</span>
                        <div className={`flex items-center gap-1.5 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                          <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-brand-700" />
                          <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-brand-700">Included</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 5. setari pentru rezervare */}
            <section id="booking" className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-12 border border-brand-100 shadow-xl shadow-brand-700/5 scroll-mt-48 lg:scroll-mt-40">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-black text-brand-700 tracking-tight">Booking Settings</h3>
                  <p className="text-brand-400 text-xs md:text-sm font-medium">Configure booking policies and availability for this space.</p>
                </div>
                <Calendar className="hidden xs:block w-7 h-7 md:w-8 md:h-8 text-brand-200" />
              </div>

              {/* comutatoare (toggle-uri) */}
              <div className="space-y-4 mb-10">
                <div className="p-5 md:p-6 bg-gradient-to-br from-brand-50 to-white rounded-[1.5rem] md:rounded-[2rem] border border-brand-100 hover:border-brand-300 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Zap className="w-5 h-5 text-brand-500" />
                        <h4 className="text-sm md:text-base font-black text-brand-700 uppercase tracking-wide">Instant Booking</h4>
                      </div>
                      <p className="text-xs md:text-sm text-brand-400 font-medium ml-8">Guests can book immediately without approval</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setListing({ ...listing, isInstantBookable: !listing.isInstantBookable })}
                      className={`relative w-14 h-8 rounded-full transition-all cursor-pointer border-none shrink-0 ${
                        listing.isInstantBookable ? 'bg-brand-700' : 'bg-brand-200'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                        listing.isInstantBookable ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>

                <div className="p-5 md:p-6 bg-gradient-to-br from-brand-50 to-white rounded-[1.5rem] md:rounded-[2rem] border border-brand-100 hover:border-brand-300 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Clock className="w-5 h-5 text-brand-500" />
                        <h4 className="text-sm md:text-base font-black text-brand-700 uppercase tracking-wide">Same-Day Booking</h4>
                      </div>
                      <p className="text-xs md:text-sm text-brand-400 font-medium ml-8">Allow bookings on the same day</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setListing({ ...listing, bookingSettings: { ...(listing.bookingSettings || {}), sameDayBooking: !(listing.bookingSettings?.sameDayBooking ?? false) } })}
                      className={`relative w-14 h-8 rounded-full transition-all cursor-pointer border-none shrink-0 ${
                        (listing.bookingSettings?.sameDayBooking ?? false) ? 'bg-brand-700' : 'bg-brand-200'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                        (listing.bookingSettings?.sameDayBooking ?? false) ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* toggle pentru durata si program */}
              <div className="mb-6">
                <h4 className="text-xs font-black text-brand-500 uppercase tracking-[0.25em] mb-6">Duration & Timing</h4>
                <div className="p-5 md:p-6 bg-gradient-to-br from-brand-50 to-white rounded-[1.5rem] md:rounded-[2rem] border border-brand-100 hover:border-brand-300 transition-all mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Timer className="w-5 h-5 text-brand-500" />
                        <h4 className="text-sm md:text-base font-black text-brand-700 uppercase tracking-wide">Custom Duration Settings</h4>
                      </div>
                      <p className="text-xs md:text-sm text-brand-400 font-medium ml-8">Set minimum and maximum booking duration limits</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHasCustomDuration(!hasCustomDuration);
                        if (hasCustomDuration) {
                          setListing({
                            ...listing,
                            bookingSettings: {
                              ...listing.bookingSettings,
                              minDuration: null,
                              maxDuration: null,
                            },
                          });
                        } else {
                          setListing({
                            ...listing,
                            bookingSettings: {
                              ...listing.bookingSettings,
                              minDuration: 2,
                              maxDuration: 8,
                            },
                          });
                        }
                      }}
                      className={`relative w-14 h-8 rounded-full transition-all cursor-pointer border-none shrink-0 ${
                        hasCustomDuration ? 'bg-brand-700' : 'bg-brand-200'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                        hasCustomDuration ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 transition-opacity ${!hasCustomDuration ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div className={`p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-2 transition-all group shadow-sm ${
                    hasCustomDuration
                      ? 'bg-brand-50 border-transparent focus-within:border-brand-700 focus-within:bg-white'
                      : 'bg-brand-100/50 border-brand-100 cursor-not-allowed'
                  }`}>
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                      <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Min Duration</label>
                      <Timer className="w-5 h-5 md:w-6 md:h-6 text-brand-200 group-focus-within:text-brand-700 transition-colors" />
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        step={1}
                        disabled={!hasCustomDuration}
                        value={hasCustomDuration ? (listing.bookingSettings?.minDuration ?? '') : ''}
                        placeholder={hasCustomDuration ? undefined : '—'}
                        onChange={(e) => {
                          const next = parseDurationHoursInput(e.target.value);
                          setListing({
                            ...listing,
                            bookingSettings: { ...(listing.bookingSettings || {}), minDuration: next },
                          });
                        }}
                        className="bg-transparent border-none focus:ring-0 text-4xl md:text-5xl font-black text-brand-700 p-0 outline-none w-16 md:w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:bg-transparent disabled:cursor-not-allowed"
                      />
                      <div className="space-y-0 md:space-y-1">
                        <p className="font-black text-brand-700 leading-none text-base md:text-lg">Hours</p>
                        <p className="text-[9px] md:text-[10px] font-bold text-brand-300 uppercase tracking-widest">Minimum</p>
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-2 transition-all group shadow-sm ${
                    hasCustomDuration
                      ? 'bg-brand-50 border-transparent focus-within:border-brand-700 focus-within:bg-white'
                      : 'bg-brand-100/50 border-brand-100 cursor-not-allowed'
                  }`}>
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                      <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Max Duration</label>
                      <Timer className="w-5 h-5 md:w-6 md:h-6 text-brand-200 group-focus-within:text-brand-700 transition-colors" />
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        step={1}
                        disabled={!hasCustomDuration}
                        value={hasCustomDuration ? (listing.bookingSettings?.maxDuration ?? '') : ''}
                        placeholder={hasCustomDuration ? undefined : '—'}
                        onChange={(e) => {
                          const next = parseDurationHoursInput(e.target.value);
                          setListing({
                            ...listing,
                            bookingSettings: { ...(listing.bookingSettings || {}), maxDuration: next },
                          });
                        }}
                        className="bg-transparent border-none focus:ring-0 text-4xl md:text-5xl font-black text-brand-700 p-0 outline-none w-16 md:w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:bg-transparent disabled:cursor-not-allowed"
                      />
                      <div className="space-y-0 md:space-y-1">
                        <p className="font-black text-brand-700 leading-none text-base md:text-lg">Hours</p>
                        <p className="text-[9px] md:text-[10px] font-bold text-brand-300 uppercase tracking-widest">Maximum</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* toggle pentru ore de functionare */}
              <div className="mb-10">
                <h4 className="text-xs font-black text-brand-500 uppercase tracking-[0.25em] mb-6">Operating Hours</h4>
                <div className="p-5 md:p-6 bg-gradient-to-br from-brand-50 to-white rounded-[1.5rem] md:rounded-[2rem] border border-brand-100 hover:border-brand-300 transition-all mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Clock className="w-5 h-5 text-brand-500" />
                        <h4 className="text-sm md:text-base font-black text-brand-700 uppercase tracking-wide">Custom Operating Hours</h4>
                      </div>
                      <p className="text-xs md:text-sm text-brand-400 font-medium ml-8">Define specific opening and closing times for your space</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHasCustomOperatingHours(!hasCustomOperatingHours);
                        if (hasCustomOperatingHours) {
                          setListing({
                            ...listing,
                            availabilityStartTime: null,
                            availabilityEndTime: null,
                          });
                        } else {
                          setListing({
                            ...listing,
                            availabilityStartTime: '09:00 AM',
                            availabilityEndTime: '06:00 PM',
                          });
                        }
                      }}
                      className={`relative w-14 h-8 rounded-full transition-all cursor-pointer border-none shrink-0 ${
                        hasCustomOperatingHours ? 'bg-brand-700' : 'bg-brand-200'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                        hasCustomOperatingHours ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 transition-opacity ${!hasCustomOperatingHours ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div className={`space-y-3 ${!hasCustomOperatingHours ? 'cursor-not-allowed' : ''}`}>
                    <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Opening Time</label>
                    <select
                      disabled={!hasCustomOperatingHours}
                      value={hasCustomOperatingHours ? (listing.availabilityStartTime ?? '09:00 AM') : ''}
                      onChange={(e) => setListing({ ...listing, availabilityStartTime: e.target.value })}
                      className={`w-full px-5 md:px-8 py-4 md:py-5 border-2 rounded-[1.25rem] md:rounded-[1.5rem] transition-all outline-none font-bold text-lg md:text-xl shadow-sm ${
                        hasCustomOperatingHours
                          ? 'bg-brand-50 border-brand-100/50 focus:border-brand-700 focus:bg-white text-brand-700 cursor-pointer'
                          : 'bg-brand-100/50 border-brand-100 text-brand-400 cursor-not-allowed'
                      }`}
                    >
                      <option value="">—</option>
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                  <div className={`space-y-3 ${!hasCustomOperatingHours ? 'cursor-not-allowed' : ''}`}>
                    <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Closing Time</label>
                    <select
                      disabled={!hasCustomOperatingHours}
                      value={hasCustomOperatingHours ? (listing.availabilityEndTime ?? '06:00 PM') : ''}
                      onChange={(e) => setListing({ ...listing, availabilityEndTime: e.target.value })}
                      className={`w-full px-5 md:px-8 py-4 md:py-5 border-2 rounded-[1.25rem] md:rounded-[1.5rem] transition-all outline-none font-bold text-lg md:text-xl shadow-sm ${
                        hasCustomOperatingHours
                          ? 'bg-brand-50 border-brand-100/50 focus:border-brand-700 focus:bg-white text-brand-700 cursor-pointer'
                          : 'bg-brand-100/50 border-brand-100 text-brand-400 cursor-not-allowed'
                      }`}
                    >
                      <option value="">—</option>
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* zile de functionare */}
              <div className="mb-10">
                <h4 className="text-xs font-black text-brand-500 uppercase tracking-[0.25em] mb-6">Operating Days</h4>
                <div className="p-5 md:p-6 bg-gradient-to-br from-brand-50 to-white rounded-[1.5rem] md:rounded-[2rem] border border-brand-100 hover:border-brand-300 transition-all mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Calendar className="w-5 h-5 text-brand-500" />
                        <h4 className="text-sm md:text-base font-black text-brand-700 uppercase tracking-wide">Weekly Schedule Restrictions</h4>
                      </div>
                      <p className="text-xs md:text-sm text-brand-400 font-medium ml-8">Block specific days of the week when your space is unavailable</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHasWeeklySchedule(!hasWeeklySchedule);
                        if (hasWeeklySchedule) {
                          setBannedDays([]);
                        }
                      }}
                      className={`relative w-14 h-8 rounded-full transition-all cursor-pointer border-none shrink-0 ${
                        hasWeeklySchedule ? 'bg-brand-700' : 'bg-brand-200'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                        hasWeeklySchedule ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
                <div className={`transition-opacity ${!hasWeeklySchedule ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const isBanned = bannedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={!hasWeeklySchedule}
                          onClick={() => {
                            if (isBanned) {
                              setBannedDays(bannedDays.filter(d => d !== day));
                            } else {
                              setBannedDays([...bannedDays, day]);
                            }
                          }}
                          className={`flex flex-col items-center gap-3 md:gap-4 p-4 md:p-5 rounded-[1.25rem] md:rounded-[1.5rem] border-2 transition-all cursor-pointer ${
                            isBanned 
                              ? 'bg-red-50 border-red-500 text-red-700 shadow-lg shadow-red-500/10' 
                              : 'bg-white border-brand-100 text-brand-400 hover:border-brand-300 hover:bg-brand-50/50'
                          }`}
                        >
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
                            isBanned ? 'bg-red-500 text-white scale-110 shadow-md' : 'bg-brand-50 text-brand-200'
                          }`}>
                            {isBanned ? <Ban className="w-5 h-5 md:w-6 md:h-6" /> : <Calendar className="w-5 h-5 md:w-6 md:h-6" />}
                          </div>
                          <div className="text-center">
                            <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest block ${
                              isBanned ? 'text-red-700' : 'text-brand-700'
                            }`}>{day.slice(0, 3)}</span>
                            <p className={`text-[8px] md:text-[9px] mt-0.5 font-bold uppercase tracking-widest ${
                              isBanned ? 'text-red-500' : 'text-brand-300'
                            }`}>
                              {isBanned ? 'Blocked' : 'Available'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* zile indisponibile */}
              <div className="mb-10">
                <h4 className="text-xs font-black text-brand-500 uppercase tracking-[0.25em] mb-2">Unavailable Dates</h4>
                <p className="text-xs md:text-sm text-brand-400 font-medium mb-6">
                  Block specific future dates for maintenance, personal time, or other reasons
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] border-2 border-brand-100 p-5 md:p-6">
                    <h5 className="text-xs font-black text-brand-500 uppercase tracking-[0.25em] mb-4">Select Dates to Block</h5>
                    <div className="mb-6 [&_.rdp]:mx-auto [&_.rdp-months]:justify-center [&_.rdp-month]:w-full [&_.rdp-caption]:flex [&_.rdp-caption]:justify-between [&_.rdp-caption]:items-center [&_.rdp-caption]:mb-4 [&_.rdp-caption]:relative [&_.rdp-caption_label]:font-black [&_.rdp-caption_label]:text-brand-700 [&_.rdp-caption_label]:uppercase [&_.rdp-caption_label]:tracking-wide [&_.rdp-nav]:flex [&_.rdp-nav]:gap-2 [&_.rdp-nav]:absolute [&_.rdp-nav]:right-0 [&_.rdp-button]:w-8 [&_.rdp-button]:h-8 [&_.rdp-button]:rounded-lg [&_.rdp-button]:bg-brand-50 [&_.rdp-button]:border-2 [&_.rdp-button]:border-brand-100 [&_.rdp-button]:transition-all [&_.rdp-button:hover]:bg-brand-100 [&_.rdp-button:hover]:border-brand-300 [&_.rdp-button]:flex [&_.rdp-button]:items-center [&_.rdp-button]:justify-center [&_.rdp-button]:text-brand-700 [&_.rdp-head_cell]:text-brand-400 [&_.rdp-head_cell]:font-black [&_.rdp-head_cell]:text-[10px] [&_.rdp-head_cell]:uppercase [&_.rdp-cell]:p-0 [&_.rdp-day]:w-10 [&_.rdp-day]:h-10 [&_.rdp-day]:rounded-xl [&_.rdp-day]:font-bold [&_.rdp-day]:text-sm [&_.rdp-day]:transition-all [&_.rdp-day_button:hover]:bg-brand-100 [&_.rdp-day_button.rdp-selected]:bg-brand-700 [&_.rdp-day_button.rdp-selected]:text-white [&_.rdp-day_button.rdp-range_middle]:bg-brand-100 [&_.rdp-day_button.rdp-range_middle]:text-brand-700 [&_.rdp-day_button.rdp-disabled]:opacity-30 [&_.rdp-day_button.rdp-disabled]:cursor-not-allowed">
                      <DayPicker
                        mode="range"
                        selected={selectedRange}
                        onSelect={setSelectedRange}
                        disabled={[
                          { before: (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; })() },
                          ...bookedDates.map((d) => new Date(d + 'T12:00:00')),
                          ...blockedDates.flatMap((b) => {
                            const dates: Date[] = [];
                            const start = new Date(b.startDate + 'T12:00:00');
                            const end = new Date(b.endDate + 'T12:00:00');
                            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                              dates.push(new Date(d));
                            }
                            return dates;
                          }),
                        ]}
                        modifiers={{ blocked: blockedDates.flatMap((b) => {
                          const dates: Date[] = [];
                          const start = new Date(b.startDate + 'T12:00:00');
                          const end = new Date(b.endDate + 'T12:00:00');
                          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                            dates.push(new Date(d));
                          }
                          return dates;
                        }) }}
                        modifiersClassNames={{ blocked: '[&_.rdp-day_button]:bg-red-50 [&_.rdp-day_button]:text-red-700 [&_.rdp-day_button]:line-through' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedRange?.from) {
                          toast.error('Please select a date or date range');
                          return;
                        }
                        const from = selectedRange.from!;
                        const to = selectedRange.to || selectedRange.from!;
                        const startStr = format(from, 'yyyy-MM-dd');
                        const endStr = format(to, 'yyyy-MM-dd');
                        const hasBooked = bookedDates.some((bd) => {
                          const d = bd;
                          return d >= startStr && d <= endStr;
                        });
                        if (hasBooked) {
                          toast.error('Cannot block dates that have existing bookings');
                          return;
                        }
                        const newBlock: BlockedDate = {
                          id: Date.now().toString(),
                          startDate: startStr,
                          endDate: endStr,
                          createdAt: new Date().toISOString(),
                        };
                        setBlockedDates((prev) => [...prev, newBlock].sort((a, b) => a.startDate.localeCompare(b.startDate)));
                        setSelectedRange(undefined);
                        toast.success('Dates blocked successfully');
                      }}
                      disabled={!selectedRange?.from}
                      className="w-full px-6 py-4 bg-brand-700 text-white font-black uppercase tracking-wider rounded-[1.25rem] md:rounded-[1.5rem] transition-all hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm md:text-base shadow-lg shadow-brand-700/20"
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Block Selected Dates
                    </button>
                  </div>
                  <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] border-2 border-brand-100 p-5 md:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-xs font-black text-brand-500 uppercase tracking-[0.25em]">Blocked Dates</h5>
                      <span className="px-3 py-1 bg-brand-700 text-white text-xs font-black rounded-full">{blockedDates.length}</span>
                    </div>
                    {blockedDates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4">
                          <CalendarX className="w-8 h-8 text-brand-200" />
                        </div>
                        <p className="text-sm font-bold text-brand-300 uppercase tracking-wider">No Blocked Dates</p>
                        <p className="text-xs text-brand-200 mt-2">Select dates on the calendar to block them</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {blockedDates
                          .sort((a, b) => a.startDate.localeCompare(b.startDate))
                          .map((block) => (
                            <div
                              key={block.id}
                              className="flex items-start justify-between p-4 bg-red-50 border-2 border-red-200 rounded-[1.25rem] md:rounded-[1.5rem] hover:border-red-300 transition-all group"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <CalendarX className="w-4 h-4 text-red-500 shrink-0" />
                                  <p className="font-black text-brand-700 text-sm md:text-base">
                                    {block.startDate === block.endDate
                                      ? format(new Date(block.startDate + 'T12:00:00'), 'MMM dd, yyyy')
                                      : `${format(new Date(block.startDate + 'T12:00:00'), 'MMM dd, yyyy')} - ${format(new Date(block.endDate + 'T12:00:00'), 'MMM dd, yyyy')}`}
                                  </p>
                                </div>
                                <p className="text-[10px] text-brand-300 font-bold uppercase tracking-wider ml-6 mt-2">
                                  Added {format(new Date(block.createdAt), 'MMM dd, yyyy')}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setBlockedDates((prev) => prev.filter((b) => b.id !== block.id));
                                  toast.success('Blocked date removed');
                                }}
                                className="p-2 hover:bg-red-100 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                title="Remove blocked date"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* rezervare in avans */}
              <div className="mb-10">
                <h4 className="text-xs font-black text-brand-500 uppercase tracking-[0.25em] mb-6">Advance Booking Window</h4>
                <div className="p-6 md:p-8 bg-brand-50 rounded-[1.5rem] md:rounded-[2rem] border-2 border-transparent focus-within:border-brand-700 focus-within:bg-white transition-all group shadow-sm max-w-sm">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Maximum Days</label>
                    <Calendar className="w-5 h-5 md:w-6 md:h-6 text-brand-200 group-focus-within:text-brand-700 transition-colors" />
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="number" 
                      value={listing.bookingSettings?.advanceBookingDays ?? 365}
                      onChange={(e) => setListing({ ...listing, bookingSettings: { ...(listing.bookingSettings || {}), advanceBookingDays: parseInt(e.target.value) || 0 } })}
                      className="bg-transparent border-none focus:ring-0 text-4xl md:text-5xl font-black text-brand-700 p-0 outline-none w-20 md:w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="space-y-0 md:space-y-1">
                      <p className="font-black text-brand-700 leading-none text-base md:text-lg">Days</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-brand-300 uppercase tracking-widest">In Advance</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* politica de anulare */}
              <div className="mb-10">
                <h4 className="text-xs font-black text-brand-500 uppercase tracking-[0.25em] mb-6">Cancellation Policy</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  {cancellationPolicies.map((policy) => (
                    <button
                      key={policy.value}
                      type="button"
                      onClick={() => setListing({ ...listing, bookingSettings: { ...(listing.bookingSettings || {}), cancellationPolicy: policy.value } })}
                      className={`p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-3 transition-all cursor-pointer flex flex-col items-center gap-3 md:gap-4 ${
                        (listing.bookingSettings?.cancellationPolicy ?? 'flexible') === policy.value 
                          ? 'bg-white border-brand-700 text-brand-700 shadow-2xl shadow-brand-700/10 md:translate-y-[-4px]' 
                          : 'bg-brand-50/50 border-transparent text-brand-400 hover:border-brand-100'
                      }`}
                    >
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
                        (listing.bookingSettings?.cancellationPolicy ?? 'flexible') === policy.value ? 'bg-brand-700 text-white shadow-lg scale-110' : 'bg-brand-50 text-brand-200'
                      }`}>
                        <Shield className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div className="text-center">
                        <p className={`font-black uppercase tracking-widest text-[10px] md:text-xs ${(listing.bookingSettings?.cancellationPolicy ?? 'flexible') === policy.value ? 'text-brand-700' : 'text-brand-400'}`}>{policy.label}</p>
                        <p className={`text-[8px] md:text-[10px] mt-1 font-bold uppercase tracking-widest ${(listing.bookingSettings?.cancellationPolicy ?? 'flexible') === policy.value ? 'text-brand-400' : 'text-brand-300'}`}>
                          {policy.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* taxe / costuri suplimentare */}
              <div>
                <h4 className="text-xs font-black text-brand-500 uppercase tracking-[0.25em] mb-6">Additional Fees</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Cleaning Fee ($)</label>
                    <div className="relative">
                      <span className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 font-black text-brand-300 text-lg md:text-xl">$</span>
                      <input 
                        type="number" 
                        value={listing.bookingSettings?.cleaningFee ?? 0}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setListing({ ...listing, bookingSettings: { ...(listing.bookingSettings || {}), cleaningFee: parseInt(val) || 0 } });
                        }}
                        className="w-full pl-12 md:pl-14 pr-6 py-4 md:py-5 bg-brand-50 border-2 border-brand-100/50 focus:border-brand-700 focus:bg-white rounded-[1.25rem] md:rounded-[1.5rem] transition-all outline-none font-bold text-brand-700 text-lg md:text-xl shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Equipment Fee ($)</label>
                    <div className="relative">
                      <span className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 font-black text-brand-300 text-lg md:text-xl">$</span>
                      <input 
                        type="number" 
                        value={listing.bookingSettings?.equipmentFee ?? 0}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setListing({ ...listing, bookingSettings: { ...(listing.bookingSettings || {}), equipmentFee: parseInt(val) || 0 } });
                        }}
                        className="w-full pl-12 md:pl-14 pr-6 py-4 md:py-5 bg-brand-50 border-2 border-brand-100/50 focus:border-brand-700 focus:bg-white rounded-[1.25rem] md:rounded-[1.5rem] transition-all outline-none font-bold text-brand-700 text-lg md:text-xl shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 6. status & publicare */}
            <section id="status" className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-12 border border-brand-100 shadow-xl shadow-brand-700/5 scroll-mt-48 lg:scroll-mt-40">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-black text-brand-700 tracking-tight">Publishing Status</h3>
                  <p className="text-brand-400 text-xs md:text-sm font-medium">Control the visibility of your space on the platform.</p>
                </div>
                <Zap className="hidden xs:block w-7 h-7 md:w-8 md:h-8 text-brand-200" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                {['Active', 'Maintenance', 'Inactive'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setListing({...listing, status})}
                    className={`p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-3 transition-all cursor-pointer flex flex-col items-center gap-3 md:gap-4 ${
                      listing.status === status 
                        ? 'bg-white border-brand-700 text-brand-700 shadow-2xl shadow-brand-700/10 md:translate-y-[-4px]' 
                        : 'bg-brand-50/50 border-transparent text-brand-400 hover:border-brand-100'
                    }`}
                  >
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
                      listing.status === status ? 'bg-brand-700 text-white shadow-lg scale-110' : 'bg-brand-50 text-brand-200'
                    }`}>
                      {status === 'Active' && <Check className="w-5 h-5 md:w-6 md:h-6" />}
                      {status === 'Maintenance' && <Clock className="w-5 h-5 md:w-6 md:h-6" />}
                      {status === 'Inactive' && <X className="w-5 h-5 md:w-6 md:h-6" />}
                    </div>
                    <div className="text-center">
                      <p className={`font-black uppercase tracking-widest text-[10px] md:text-xs ${listing.status === status ? 'text-brand-700' : 'text-brand-400'}`}>{status}</p>
                      <p className={`text-[8px] md:text-[10px] mt-1 font-bold uppercase tracking-widest ${listing.status === status ? 'text-brand-400' : 'text-brand-300'}`}>
                        {status === 'Active' ? 'Visible to everyone' : status === 'Maintenance' ? 'Updates in progress' : 'Hidden from search'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* modal de renuntare la modificari */}
      <AnimatePresence>
        {showDiscardModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDiscardModal(false)}
              className="absolute inset-0 bg-brand-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 max-w-md w-full shadow-2xl border border-brand-100 space-y-6 md:space-y-8"
            >
              <div className="w-14 h-14 md:w-16 md:h-16 bg-orange-50 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 md:w-8 md:h-8 text-orange-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl md:text-2xl font-black text-brand-700 tracking-tight">Discard changes?</h3>
                <p className="text-sm md:text-base text-brand-500 font-medium leading-relaxed">
                  You have unsaved modifications to this listing. Leaving this page will permanently lose all changes.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => navigate('/host/manage-listings')}
                  className="w-full py-4 md:py-5 bg-red-500 text-white font-black rounded-xl md:rounded-2xl hover:bg-red-600 transition-all cursor-pointer shadow-lg shadow-red-500/20 border-none"
                >
                  Discard Changes
                </button>
                <button 
                  onClick={() => setShowDiscardModal(false)}
                  className="w-full py-4 md:py-5 bg-brand-50 text-brand-700 font-black rounded-xl md:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer border-none"
                >
                  Keep Editing
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* modal de confirmare pentru stergerea anuntului */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!deleteInProgress) {
                  setShowDeleteModal(false);
                  setDeleteBlockedByBookings(null);
                }
              }}
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
                    {deleteBlockedByBookings == null ? (
                      <>
                        <h3 className="text-xl sm:text-2xl font-black text-brand-700">Delete Listing</h3>
                        <p className="text-sm sm:text-base text-brand-400 font-medium leading-relaxed">
                          Are you sure you want to delete <span className="font-black text-brand-700">{listing?.title ?? 'this listing'}</span>? This cannot be undone.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl sm:text-2xl font-black text-brand-700">Cannot delete yet</h3>
                        <p className="text-sm sm:text-base text-brand-400 font-medium leading-relaxed">
                          This listing has <span className="font-black text-brand-700">{deleteBlockedByBookings}</span> active booking{deleteBlockedByBookings !== 1 ? 's' : ''} that must be honored. Make the listing inactive until every booking is completed; then you can delete it.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {deleteBlockedByBookings == null ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteModal(false);
                          setDeleteBlockedByBookings(null);
                        }}
                        disabled={deleteInProgress}
                        className="flex-1 px-6 py-4 bg-brand-50 text-brand-700 font-black rounded-xl sm:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer disabled:opacity-60"
                      >
                        Keep Listing
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!id) return;
                          setDeleteInProgress(true);
                          try {
                            const result = await deleteSpace(id);
                            if (result.success) {
                              setShowDeleteModal(false);
                              setDeleteBlockedByBookings(null);
                              toast.success('Listing deleted.');
                              navigate('/host/manage-listings');
                            } else {
                              setDeleteBlockedByBookings(result.activeBookingsCount);
                            }
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Failed to delete listing');
                            setShowDeleteModal(false);
                            setDeleteBlockedByBookings(null);
                          } finally {
                            setDeleteInProgress(false);
                          }
                        }}
                        disabled={deleteInProgress}
                        className="flex-1 px-6 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl sm:rounded-2xl shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                      >
                        {deleteInProgress ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Deleting...
                          </span>
                        ) : (
                          'Delete Listing'
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteModal(false);
                          setDeleteBlockedByBookings(null);
                        }}
                        className="flex-1 px-6 py-4 bg-brand-50 text-brand-700 font-black rounded-xl sm:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!id) return;
                          setDeleteInProgress(true);
                          try {
                            await updateSpace(id, { status: 'inactive' });
                            setListing((prev: any) => (prev ? { ...prev, status: 'Inactive' } : prev));
                            setShowDeleteModal(false);
                            setDeleteBlockedByBookings(null);
                            toast.success('Listing is now inactive. You can delete it after all bookings are completed.');
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Failed to update listing');
                          } finally {
                            setDeleteInProgress(false);
                          }
                        }}
                        disabled={deleteInProgress}
                        className="flex-1 px-6 py-4 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-xl sm:rounded-2xl shadow-lg shadow-brand-700/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                      >
                        {deleteInProgress ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Updating...
                          </span>
                        ) : (
                          'Make inactive'
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
