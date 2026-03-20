import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MapPin, Calendar, ChevronDown, X } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { DateDropdown } from './FilterDropdowns';
import { format } from 'date-fns';
import { fetchPlaceSuggestions, type PlaceSuggestion } from '../api/places';
import { fetchPopularCategoriesThisWeek } from '../api/spaces';

export const Hero = () => {
  const navigate = useNavigate();
  const [locationInput, setLocationInput] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const locationInputRef = useRef<HTMLDivElement>(null);
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextShowRef = useRef(false);
  const [popularCategories, setPopularCategories] = useState<string[]>([]);

  const DEFAULT_POPULAR_CATEGORIES = ['Photo Studio', 'Recording Studio', 'Kitchen Studio'];

  useEffect(() => {
    if (!showSuggestions) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (locationInputRef.current && !locationInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  useEffect(() => {
    fetchPopularCategoriesThisWeek()
      .then((res) => {
        if (res.categories.length > 0) setPopularCategories(res.categories);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!locationInput.trim() || locationInput.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setShowSuggestions(false);
      skipNextShowRef.current = false;
      return;
    }
    if (skipNextShowRef.current) {
      skipNextShowRef.current = false;
      return;
    }
    setSuggestionsLoading(true);
    setShowSuggestions(true);
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    suggestionDebounceRef.current = setTimeout(() => {
      fetchPlaceSuggestions(locationInput)
        .then((res) => {
          setSuggestions(res.suggestions || []);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestionsLoading(false));
      suggestionDebounceRef.current = null;
    }, 300);
    return () => {
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    };
  }, [locationInput]);

  const handleSelectLocation = useCallback((suggestion: PlaceSuggestion) => {
    const city = suggestion.city ?? '';
    const region = suggestion.state ?? '';
    const country = suggestion.country ?? '';
    const location = [city, region, country].filter(Boolean).join(', ') || suggestion.label;
    skipNextShowRef.current = true;
    setLocationInput(location);
    setShowSuggestions(false);
    setSuggestions([]);
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (locationInput.trim()) {
      params.set('location', locationInput.trim());
    }
    if (selectedDate) {
      params.set('date', format(selectedDate, 'yyyy-MM-dd'));
    }
    const queryString = params.toString();
    navigate(queryString ? `/find?${queryString}` : '/find');
  };

  return (
    <section className="relative min-h-[85vh] md:min-h-[90vh] flex flex-col items-center justify-center overflow-hidden pt-24 md:pt-32 pb-16 md:pb-20 px-4">
      <div className="absolute inset-0 z-0">
        <ImageWithFallback 
          src="https://images.unsplash.com/photo-1652498196118-4577d5f6abd5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjcmVhdGl2ZSUyMHN0dWRpbyUyMGxvZnR8ZW58MXx8fHwxNzcxMzMzMjU5fDA&ixlib=rb-4.1.0&q=80&w=1920" 
          alt="Modern creative studio" 
          className="w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-700/80 via-brand-700/40 to-brand-700/80" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-2 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-3xl sm:text-4xl md:text-7xl font-black text-white mb-4 md:mb-6 leading-[1.1] tracking-tight px-2">
            Discover unique spaces for your <br className="hidden md:block" />
            <span className="text-brand-200 underline decoration-brand-200 underline-offset-4 md:underline-offset-8">next creative project</span>
          </h1>
          <p className="text-base md:text-xl text-brand-100 mb-8 md:mb-12 max-w-2xl mx-auto font-medium leading-relaxed px-4">
            Book professional studios, inspiring lofts, and creative venues by the hour. No long-term commitments.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-white/10 backdrop-blur-2xl p-1.5 md:p-2 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl max-w-4xl mx-auto border border-white/20"
        >
          <div className="bg-white p-3 md:p-6 rounded-[1.75rem] md:rounded-[2rem] flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
            <div className="flex-[1.2] relative group" ref={locationInputRef}>
              <div className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2">
                <MapPin className="w-4 h-4 md:w-5 md:h-5 text-brand-400 group-focus-within:text-brand-700 transition-colors pointer-events-none" />
              </div>
              <input 
                type="text" 
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onFocus={() => locationInput && setShowSuggestions(suggestions.length > 0)}
                placeholder="Where are you going?" 
                className="w-full pl-11 md:pl-14 pr-10 md:pr-12 py-3 md:py-4 bg-brand-50 border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-brand-200 transition-all text-brand-700 font-bold placeholder:text-brand-300 text-sm md:text-base"
                autoComplete="off"
              />
              {locationInput && (
                <button
                  type="button"
                  onClick={() => { setLocationInput(''); setShowSuggestions(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-brand-400 hover:text-brand-700 hover:bg-brand-200/50 transition-colors cursor-pointer"
                  aria-label="Clear location"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              )}
              {showSuggestions && (suggestionsLoading || suggestions.length > 0 || (locationInput.trim() !== '' && !suggestionsLoading)) && (
                <div className="absolute top-full left-0 right-0 mt-1 py-2 bg-white rounded-xl md:rounded-2xl border border-brand-200 shadow-xl shadow-brand-700/10 overflow-hidden z-50 max-h-72 overflow-y-auto">
                  {suggestionsLoading ? (
                    <div className="px-4 py-3 text-brand-400 font-medium text-sm">Searching places...</div>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => handleSelectLocation(s)}
                        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-brand-50 transition-colors cursor-pointer border-b border-brand-50 last:border-b-0"
                      >
                        <MapPin className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-brand-700 text-sm md:text-base">{s.primary}</div>
                          {s.secondary && (
                            <div className="text-brand-400 text-xs md:text-sm font-medium mt-0.5">{s.secondary}</div>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-brand-400 font-medium text-sm">No places found. Try a different search.</div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <DateDropdown 
                value={selectedDate}
                onChange={setSelectedDate}
                trigger={
                  <button className="w-full relative group cursor-pointer">
                    <div className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 z-10">
                      <Calendar className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${selectedDate ? 'text-brand-700' : 'text-brand-400'}`} />
                    </div>
                    <div className="w-full pl-11 md:pl-14 pr-4 md:pr-10 py-3 md:py-4 bg-brand-50 rounded-xl md:rounded-2xl text-left transition-all border-2 border-transparent hover:border-brand-100 group-focus-within:ring-2 group-focus-within:ring-brand-200">
                      <span className={`text-sm md:text-base font-bold truncate block ${selectedDate ? 'text-brand-700' : 'text-brand-300'}`}>
                        {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'What date?'}
                      </span>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <ChevronDown className="w-4 h-4 text-brand-300 group-hover:text-brand-500 transition-colors" />
                    </div>
                  </button>
                }
              />
            </div>

            <button 
              onClick={handleSearch}
              className="px-6 md:px-10 py-3.5 md:py-4.5 bg-brand-700 hover:bg-brand-600 text-white font-black text-base md:text-lg rounded-xl md:rounded-2xl transition-all shadow-xl shadow-brand-700/20 active:scale-95 flex items-center justify-center gap-2 md:gap-3 group cursor-pointer"
            >
              <Search className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-12 transition-transform" />
              Search
            </button>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-8 md:mt-12 flex flex-wrap justify-center items-center gap-3 md:gap-4 text-white/90 text-[10px] md:text-sm font-black uppercase tracking-widest"
        >
          <span className="opacity-60 hidden sm:inline">Popular right now:</span>
          {(popularCategories.length > 0 ? popularCategories : DEFAULT_POPULAR_CATEGORIES).map((cat) => (
            <button
              key={cat}
              onClick={() => navigate(`/find?category=${encodeURIComponent(cat)}`)}
              className="px-4 md:px-6 py-2 md:py-2.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full hover:bg-brand-200 hover:text-brand-700 transition-all cursor-pointer"
            >
              {cat}
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
