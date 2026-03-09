import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  Plus, 
  Image as ImageIcon, 
  MapPin, 
  DollarSign, 
  Clock, 
  Users, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Heart,
  Brush,
  Dumbbell,
  GraduationCap,
  Monitor,
  FlaskConical,
  Camera,
  Mic,
  Maximize2,
  Wifi,
  Coffee,
  AirVent,
  Tv,
  Music,
  Briefcase,
  X,
  Navigation,
  Globe,
  Building,
  Hash,
  Map as MapIcon,
  Sun,
  Car,
  Shield,
  VolumeX,
  Layers,
  Box,
  Speaker,
  Video,
  ChevronRight,
  ChevronLeft,
  Utensils,
  ChefHat,
  ShowerHead,
  Microscope,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { AmenitiesList } from './FilterDropdowns';
import { createSpace } from '../api/spaces';
import { apiUploadFile } from '../api/client';
import { fetchPlaceSuggestions, type PlaceSuggestion } from '../api/places';
import { geocodeAddress } from '../utils/geocode';
import { toast } from 'sonner';
import { ListingMap } from './MapView';
import { DescriptionEditor } from './DescriptionEditor';

const categories = [
  { id: 'art', label: 'Art Studio', icon: Brush, desc: 'Creative spaces for painting, sculpting, and fine arts.' },
  { id: 'sports', label: 'Sports Space', icon: Dumbbell, desc: 'Gyms, yoga studios, and athletic training facilities.' },
  { id: 'classroom', label: 'Classroom', icon: GraduationCap, desc: 'Educational settings for workshops and teaching.' },
  { id: 'conference', label: 'Conference Room', icon: Users, desc: 'Professional meeting rooms for teams and clients.' },
  { id: 'it', label: 'IT Classroom', icon: Monitor, desc: 'Computer labs equipped for technical training.' },
  { id: 'lab', label: 'Laboratory', icon: FlaskConical, desc: 'Scientific or research spaces for experimentation.' },
  { id: 'photo', label: 'Photo Studio', icon: Camera, desc: 'Photography studios with lighting and backdrops.' },
  { id: 'recording', label: 'Recording Studio', icon: Mic, desc: 'Acoustically treated spaces for audio production.' },
  { id: 'kitchen', label: 'Kitchen Studio', icon: Coffee, desc: 'Fully equipped kitchens for food photography and filming.' },
  { id: 'dance', label: 'Dancing Studio', icon: Music, desc: 'Spacious studios with mirrors and specialized flooring.' },
];

export const ListSpace = () => {
  const [step, setStep] = useState(1);
  const [isStarted, setIsStarted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    country: '',
    region: '',
    city: '',
    address: '',
    apt: '',
    floor: '',
    building: '',
    zip: '',
    sqm: '',
    capacity: 10,
    price: 75,
    description: '',
    pinPlaced: false,
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DEFAULT_MAP_CENTER = { lat: 40.7128, lng: -74.006 };
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(12);

  const [locationSearch, setLocationSearch] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placeSuggestionsLoading, setPlaceSuggestionsLoading] = useState(false);
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false);
  const placeSuggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationInputRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    if (step !== 3) return;
    const country = formData.country.trim();
    const city = formData.city.trim();
    const query = city ? (country ? `${city}, ${country}` : city) : country;
    if (!query) {
      setMapCenter(null);
      return;
    }
    const t = setTimeout(() => {
      geocodeAddress(query).then((result) => {
        if (result) {
          setMapCenter({ lat: result.lat, lng: result.lng });
          setMapZoom(result.zoom);
        }
      });
    }, 450);
    return () => clearTimeout(t);
  }, [step, formData.country, formData.city]);

  useEffect(() => {
    if (step !== 3 || locationSearch.trim().length < 2) {
      setPlaceSuggestions([]);
      return;
    }
    if (placeSuggestionsDebounceRef.current) clearTimeout(placeSuggestionsDebounceRef.current);
    placeSuggestionsDebounceRef.current = setTimeout(() => {
      setPlaceSuggestionsLoading(true);
      fetchPlaceSuggestions(locationSearch.trim())
        .then((res) => setPlaceSuggestions(res.suggestions || []))
        .catch(() => setPlaceSuggestions([]))
        .finally(() => setPlaceSuggestionsLoading(false));
    }, 350);
    return () => {
      if (placeSuggestionsDebounceRef.current) clearTimeout(placeSuggestionsDebounceRef.current);
    };
  }, [step, locationSearch]);

  const handleSelectPlace = useCallback((suggestion: PlaceSuggestion) => {
    const country = suggestion.country ?? '';
    const region = suggestion.state ?? '';
    const city = suggestion.city ?? (suggestion.primary && suggestion.primary !== suggestion.country ? suggestion.primary : '');
    setFormData((prev) => ({ ...prev, country, region, city }));
    setLocationSearch('');
    setPlaceSuggestions([]);
    setShowPlaceSuggestions(false);
    if (suggestion.latitude != null && suggestion.longitude != null) {
      setMapCenter({ lat: suggestion.latitude, lng: suggestion.longitude });
      setMapZoom(12);
    }
  }, []);

  const handleChangePlace = useCallback(() => {
    setFormData((prev) => ({ ...prev, country: '', region: '', city: '' }));
    setLocationSearch('');
    setShowPlaceSuggestions(true);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newEntries = Array.from(e.target.files).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setImages((prev) => [...prev, ...newEntries]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index].preview);
      return next;
    });
  };

  const toggleAmenity = (id: string) => {
    setSelectedAmenities(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  if (!isStarted) {
    return (
      <div className="bg-white min-h-screen">
        {/* Landing Hero */}
        <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-32 pb-24">
          <div className="absolute inset-0 z-0">
            <ImageWithFallback 
              src="https://images.unsplash.com/photo-1707197724059-d175c1091bb2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBzdW5saWdodCUyMHdvcmtzcGFjZSUyMGNvZmZlZXxlbnwxfHx8fDE3NzEzMzY1NzV8MA&ixlib=rb-4.1.0&q=80&w=1920" 
              alt="Bright workspace" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-brand-700/40 backdrop-blur-[2px]" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl bg-white/10 backdrop-blur-xl p-8 md:p-12 rounded-[3rem] border border-white/20 shadow-2xl"
            >
              <span className="inline-block px-4 py-1 bg-brand-200 text-brand-700 rounded-full text-xs font-black uppercase tracking-widest mb-6">Host on SpaceBook</span>
              <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                Your space, <br />
                <span className="text-brand-200">their next masterpiece.</span>
              </h1>
              <p className="text-brand-100 text-lg md:text-xl font-medium mb-10 leading-relaxed">
                Turn your creative studio, meeting room, or vacant office into a thriving business. Join 10,000+ hosts worldwide.
              </p>
              <button 
                onClick={() => setIsStarted(true)}
                className="group px-10 py-5 bg-white text-brand-700 font-black text-xl rounded-2xl hover:bg-brand-200 transition-all flex items-center gap-3 shadow-xl shadow-black/20 cursor-pointer"
              >
                Start Listing 
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>
        </section>

        {/* Value Props */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black text-brand-700 mb-4">Why list with us?</h2>
              <p className="text-brand-400 font-medium text-lg">We provide the tools you need to succeed as a host.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { icon: ShieldCheck, title: 'Secure & Protected', desc: 'Every booking is protected by our $1M liability insurance. We verify all guests so you can host with peace of mind.' },
                { icon: Clock, title: 'Flexible Scheduling', desc: 'Manage your availability with ease. Set your own hours, block dates, and sync with your existing calendars.' },
                { icon: Heart, title: 'Community Focused', desc: 'Connect with a global community of creatives looking for exactly what you have to offer.' }
              ].map((prop, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-8 bg-brand-100 rounded-[2.5rem] hover:shadow-xl transition-all duration-500"
                >
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <prop.icon className="w-8 h-8 text-brand-500" />
                  </div>
                  <h3 className="text-2xl font-black text-brand-700 mb-4">{prop.title}</h3>
                  <p className="text-brand-500 font-medium leading-relaxed">{prop.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="pb-24 px-4">
          <div className="max-w-7xl mx-auto bg-brand-700 rounded-[4rem] p-12 lg:p-24 text-center overflow-hidden relative">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--brand-200)_1px,_transparent_1px)] [background-size:30px_30px]" />
            <h2 className="text-4xl md:text-6xl font-black text-white mb-8 relative z-10">Ready to earn?</h2>
            <p className="text-brand-100 text-lg md:text-xl font-medium mb-12 max-w-2xl mx-auto relative z-10">
              It takes less than 10 minutes to set up your listing. Join our community today.
            </p>
            <button 
              onClick={() => setIsStarted(true)}
              className="relative z-10 px-12 py-5 bg-brand-200 hover:bg-white text-brand-700 font-black text-xl rounded-2xl transition-all shadow-2xl active:scale-95 cursor-pointer"
            >
              Get Started Now
            </button>
          </div>
        </section>
      </div>
    );
  }

  const isNextDisabled = () => {
    if (step === 1) return !formData.title.trim();
    if (step === 2) return !selectedCategory;
    if (step === 3) return !formData.country || !formData.address || !formData.zip || !formData.pinPlaced;
    if (step === 4) return images.length === 0;
    if (step === 5) return !formData.sqm || !formData.description;
    return false;
  };

  return (
    <div className="pt-32 pb-12 min-h-screen bg-brand-100/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl border border-brand-100 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-2 bg-brand-100 w-full flex">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div 
              key={s}
              className={`h-full transition-all duration-700 ease-out border-r border-white/20 last:border-none ${s <= step ? 'bg-brand-500' : 'bg-brand-100'}`} 
              style={{ width: '16.666%' }}
            />
          ))}
        </div>

        <div className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-black text-brand-700 mb-2">What's the name of your space?</h2>
                  <p className="text-brand-400 font-medium">Give your listing a memorable title that stands out.</p>
                </div>
                <div>
                  <label className="block text-xs font-black text-brand-400 mb-2 uppercase tracking-widest">Space name</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Bright Industrial Loft"
                    className="w-full px-6 py-5 bg-brand-50 border-2 border-transparent rounded-2xl focus:border-brand-700 focus:bg-white transition-all outline-none font-bold text-brand-700 text-lg"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2cat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-black text-brand-700 mb-2">What kind of space is it?</h2>
                  <p className="text-brand-400 font-medium">Choose the category that best fits your creative hub.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categories.map((cat) => (
                    <button 
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`p-6 border-2 rounded-3xl text-left transition-all group flex items-start gap-5 cursor-pointer ${
                        selectedCategory === cat.id 
                          ? 'border-brand-700 bg-brand-50 shadow-lg scale-[1.02]' 
                          : 'border-brand-100 hover:border-brand-300 hover:bg-brand-50/50'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        selectedCategory === cat.id ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-500 group-hover:bg-brand-200'
                      }`}>
                        <cat.icon className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="font-black text-brand-700 text-lg block mb-1">{cat.label}</span>
                        <p className="text-sm text-brand-400 font-medium leading-relaxed">{cat.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-black text-brand-700 mb-2">Where's it located?</h2>
                  <p className="text-brand-400 font-medium">Be precise so guests can find your space easily.</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-5">
                    <div ref={locationInputRef} className="relative">
                      <label className="block text-xs font-black text-brand-400 mb-2 uppercase tracking-widest">City or area</label>
                      {formData.country || formData.city ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2 px-4 py-3 bg-brand-50 rounded-2xl border-2 border-transparent font-bold text-brand-700">
                            <MapPin className="w-4 h-4 text-brand-400 shrink-0" />
                            <span>{[formData.city, formData.region, formData.country].filter(Boolean).join(', ')}</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleChangePlace}
                            className="px-4 py-2 text-brand-600 font-bold hover:bg-brand-100 rounded-xl transition-colors cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-300" />
                            <input
                              type="text"
                              value={locationSearch}
                              onChange={(e) => { setLocationSearch(e.target.value); setShowPlaceSuggestions(true); }}
                              onFocus={() => setShowPlaceSuggestions(true)}
                              placeholder="Search for a city or area..."
                              autoComplete="off"
                              className="w-full pl-11 pr-4 py-4 bg-brand-50 border-2 border-transparent rounded-2xl focus:border-brand-700 focus:bg-white transition-all outline-none font-bold text-brand-700"
                            />
                          </div>
                          {showPlaceSuggestions && (placeSuggestions.length > 0 || placeSuggestionsLoading || (locationSearch.trim() !== '' && !placeSuggestionsLoading)) && (
                            <div className="absolute top-full left-0 right-0 mt-1 py-2 bg-white rounded-xl rounded-t-none border border-t-0 border-brand-200 shadow-xl shadow-brand-700/10 overflow-hidden z-50 max-h-60 overflow-y-auto">
                              {placeSuggestionsLoading ? (
                                <div className="px-4 py-3 text-brand-400 font-medium text-sm">Searching places...</div>
                              ) : placeSuggestions.length > 0 ? (
                                placeSuggestions.map((s) => (
                                  <button
                                    key={s.label}
                                    type="button"
                                    onClick={() => handleSelectPlace(s)}
                                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-brand-50 transition-colors cursor-pointer border-b border-brand-50 last:border-b-0"
                                  >
                                    <MapPin className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-bold text-brand-700 text-sm">{s.primary}</div>
                                      {s.secondary ? <div className="text-brand-400 text-xs mt-0.5">{s.secondary}</div> : null}
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-brand-400 font-medium text-sm">No places found. Try a different search.</div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-brand-400 mb-2 uppercase tracking-widest">Postal Code</label>
                        <input
                          type="text"
                          value={formData.zip}
                          onChange={(e) => setFormData({...formData, zip: e.target.value})}
                          placeholder="11201"
                          className="w-full px-5 py-4 bg-brand-50 border-2 border-transparent rounded-2xl focus:border-brand-700 focus:bg-white transition-all outline-none font-bold text-brand-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-brand-400 mb-2 uppercase tracking-widest">Street Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
                        <input 
                          type="text" 
                          value={formData.address}
                          onChange={(e) => setFormData({...formData, address: e.target.value})}
                          placeholder="123 Creative Lane" 
                          className="w-full pl-12 pr-4 py-4 bg-brand-50 border-2 border-transparent rounded-2xl focus:border-brand-700 focus:bg-white transition-all outline-none font-bold text-brand-700" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-brand-400 mb-1.5 uppercase tracking-widest">Apt/Unit</label>
                        <input 
                          type="text" 
                          value={formData.apt}
                          onChange={(e) => setFormData({...formData, apt: e.target.value})}
                          placeholder="4B" 
                          className="w-full px-4 py-3.5 bg-brand-50 border-2 border-transparent rounded-xl focus:border-brand-700 focus:bg-white transition-all outline-none font-bold text-brand-700" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-brand-400 mb-1.5 uppercase tracking-widest">Floor</label>
                        <input 
                          type="text" 
                          value={formData.floor}
                          onChange={(e) => setFormData({...formData, floor: e.target.value})}
                          placeholder="2nd" 
                          className="w-full px-4 py-3.5 bg-brand-50 border-2 border-transparent rounded-xl focus:border-brand-700 focus:bg-white transition-all outline-none font-bold text-brand-700" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-brand-400 mb-1.5 uppercase tracking-widest">Building</label>
                        <input 
                          type="text" 
                          value={formData.building}
                          onChange={(e) => setFormData({...formData, building: e.target.value})}
                          placeholder="The Warehouse" 
                          className="w-full px-4 py-3.5 bg-brand-50 border-2 border-transparent rounded-xl focus:border-brand-700 focus:bg-white transition-all outline-none font-bold text-brand-700" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="relative h-full min-h-[400px] flex flex-col">
                    <ListingMap
                      center={mapCenter ?? DEFAULT_MAP_CENTER}
                      zoom={mapZoom}
                      pin={formData.pinPlaced && formData.latitude != null && formData.longitude != null ? { lat: formData.latitude, lng: formData.longitude } : null}
                      onPositionChange={(lat, lng) => setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng, pinPlaced: true }))}
                      className="flex-1 min-h-[400px]"
                    />
                    <p className="text-[10px] text-brand-400 font-bold mt-2 text-center">Click on the map to place your pin.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-black text-brand-700 mb-2">Showcase your space</h2>
                  <p className="text-brand-400 font-medium">Add at least one high-quality photo to attract guests.</p>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video md:aspect-[21/9] border-4 border-dashed border-brand-200 rounded-[3rem] bg-brand-50 hover:bg-brand-100 hover:border-brand-400 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer group"
                >
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-10 h-10 text-brand-700" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-brand-700">Drop photos here or click to upload</p>
                    <p className="text-sm text-brand-400 font-medium">Supports JPG, PNG (Max 5MB)</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    multiple 
                    hidden 
                    accept="image/*"
                    onChange={handleImageUpload} 
                  />
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
                    {images.map((item, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative aspect-square rounded-2xl overflow-hidden group shadow-md"
                      >
                        <img src={item.preview} alt="Uploaded" className="w-full h-full object-cover" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-2xl border-2 border-dashed border-brand-200 flex items-center justify-center hover:bg-brand-50 transition-all text-brand-400 hover:text-brand-700 cursor-pointer"
                    >
                      <Plus className="w-8 h-8" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {step === 5 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                <div>
                  <h2 className="text-3xl font-black text-brand-700 mb-2">The finer details</h2>
                  <p className="text-brand-400 font-medium">Tell guests about the size, amenities, and pricing.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-brand-50 rounded-[2rem] border border-brand-100 flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-4 text-brand-700">
                      <Maximize2 className="w-5 h-5" />
                      <span className="font-black uppercase tracking-widest text-[10px]">Square Meters</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={formData.sqm}
                        onChange={(e) => setFormData({...formData, sqm: e.target.value})}
                        placeholder="0" 
                        className="w-full bg-transparent border-none focus:ring-0 text-3xl font-black text-brand-700 p-0 outline-none" 
                      />
                      <span className="text-brand-300 font-black text-xl">m²</span>
                    </div>
                  </div>

                  <div className="p-6 bg-brand-50 rounded-[2rem] border border-brand-100 flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-4 text-brand-700">
                      <Users className="w-5 h-5" />
                      <span className="font-black uppercase tracking-widest text-[10px]">Capacity</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => setFormData({...formData, capacity: Math.max(1, formData.capacity - 1)})}
                        className="w-10 h-10 rounded-xl bg-white border border-brand-200 flex items-center justify-center font-black text-xl text-brand-700 hover:bg-brand-700 hover:text-white transition-colors cursor-pointer"
                      >-</button>
                      <span className="font-black text-3xl text-brand-700">{formData.capacity}</span>
                      <button 
                        onClick={() => setFormData({...formData, capacity: formData.capacity + 1})}
                        className="w-10 h-10 rounded-xl bg-white border border-brand-200 flex items-center justify-center font-black text-xl text-brand-700 hover:bg-brand-700 hover:text-white transition-colors cursor-pointer"
                      >+</button>
                    </div>
                  </div>

                  <div className="p-6 bg-brand-50 rounded-[2rem] border border-brand-100 flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-4 text-brand-700">
                      <DollarSign className="w-5 h-5" />
                      <span className="font-black uppercase tracking-widest text-[10px]">Hourly Price</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-brand-300 font-black text-xl">$</span>
                      <input 
                        type="number" 
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                        className="w-full bg-transparent border-none focus:ring-0 text-3xl font-black text-brand-700 p-0 outline-none" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-black text-brand-400 uppercase tracking-widest">Amenities</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {AmenitiesList.map((amenity) => (
                      <button 
                        key={amenity.id}
                        onClick={() => toggleAmenity(amenity.id)}
                        type="button"
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                          selectedAmenities.includes(amenity.id)
                            ? 'bg-brand-700 border-brand-700 text-white shadow-lg shadow-brand-700/20'
                            : 'bg-white border-brand-50 text-brand-700 hover:border-brand-200'
                        }`}
                      >
                        <amenity.icon className={`w-5 h-5 shrink-0 ${selectedAmenities.includes(amenity.id) ? 'text-brand-200' : 'text-brand-500'}`} />
                        <span className="font-bold text-sm leading-tight">{amenity.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <label className="block text-xs font-black text-brand-400 uppercase tracking-widest">Description</label>
                  <DescriptionEditor
                    value={formData.description}
                    onChange={(description) => setFormData((prev) => ({ ...prev, description }))}
                    placeholder="Describe your studio's vibe, equipment, and unique features..."
                    minHeight="140px"
                  />
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div 
                key="step5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="relative w-32 h-32 mx-auto mb-10">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                    className="w-full h-full bg-brand-200 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-brand-200/20"
                  >
                    <CheckCircle2 className="w-16 h-16 text-brand-700" />
                  </motion.div>
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                    className="absolute -inset-4 border-2 border-dashed border-brand-300 rounded-[3rem] opacity-40"
                  />
                </div>
                <h2 className="text-4xl font-black text-brand-700 mb-4 tracking-tight">Your space is ready!</h2>
                <p className="text-brand-500 font-medium text-lg mb-12 max-w-sm mx-auto leading-relaxed">
                  Excellent work! Your listing is now being reviewed. We'll have you hosting in no time.
                </p>
                <button 
                  onClick={() => {
                    setIsStarted(false);
                    setStep(1);
                    // Standard navigation handle
                    window.location.href = '/dashboard';
                  }}
                  className="px-12 py-5 bg-brand-700 text-white font-black text-xl rounded-2xl hover:bg-brand-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-brand-700/20 cursor-pointer"
                >
                  Go to Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {step < 6 && (
            <div className="mt-12 pt-8 border-t border-brand-100 flex items-center justify-between">
              <button 
                onClick={() => step > 1 ? setStep(step - 1) : setIsStarted(false)}
                className="px-8 py-4 text-brand-400 font-black uppercase tracking-widest text-xs hover:text-brand-700 transition-colors cursor-pointer"
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              <button 
                disabled={isNextDisabled() || submitting}
                onClick={async () => {
                  if (step === 5) {
                    const categoryLabel = categories.find((c) => c.id === selectedCategory)?.label ?? selectedCategory;
                    if (!categoryLabel) return;
                    setSubmitting(true);
                    try {
                      const uploadedUrls: string[] = [];
                      for (const item of images) {
                        const { url } = await apiUploadFile(item.file);
                        uploadedUrls.push(url);
                      }
                      await createSpace({
                        category: categoryLabel,
                        title: formData.title.trim() || (formData.address ? `${formData.address}, ${formData.city}` : `${categoryLabel} - ${formData.city}`),
                        location: [formData.city, formData.region, formData.country].filter(Boolean).join(', '),
                        capacity: formData.capacity,
                        pricePerHour: formData.price,
                        description: formData.description,
                        imageUrl: uploadedUrls[0] || undefined,
                        imagesJson: uploadedUrls,
                        amenitiesJson: selectedAmenities,
                        latitude: formData.latitude ?? undefined,
                        longitude: formData.longitude ?? undefined,
                        squareMeters: formData.sqm !== '' && formData.sqm != null ? Number(formData.sqm) : undefined,
                      });
                      setStep(6);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to create listing');
                    } finally {
                      setSubmitting(false);
                    }
                  } else {
                    setStep(step + 1);
                  }
                }}
                className={`px-12 py-4 font-black rounded-2xl transition-all flex items-center gap-3 shadow-xl active:scale-95 cursor-pointer ${
                  isNextDisabled() || submitting
                    ? 'bg-brand-100 text-brand-300 cursor-not-allowed shadow-none' 
                    : 'bg-brand-700 text-white hover:bg-brand-600 shadow-brand-700/20'
                }`}
              >
                {submitting ? 'Creating...' : step === 5 ? 'Complete Listing' : 'Next Step'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
