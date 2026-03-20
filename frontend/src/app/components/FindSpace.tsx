import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SpaceCard } from './SpaceCard';
import { SlidersHorizontal, Map as MapIcon, Grid, ChevronDown, Calendar, Users, DollarSign, MapPin, X } from 'lucide-react';
import { DateDropdown, GuestsDropdown, PriceDropdown, MoreFiltersDropdown, SpaceTypeDropdown, FiltersContent } from './FilterDropdowns';
import { useSearchParams, useNavigate } from 'react-router';
import { format } from 'date-fns';
import { fetchSpaces } from '../api/spaces';
import { fetchPlaceSuggestions, type PlaceSuggestion } from '../api/places';
import { fetchFavorites, addFavorite, removeFavorite } from '../api/favorites';
import { useAuth } from '../context/AuthContext';
import type { Space } from '../api/spaces';
import { SpacesMap } from './MapView';

export const FindSpace = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [view, setView] = React.useState<'grid' | 'map'>('grid');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const { token } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = new Date(dateParam);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  });

  const locationParam = searchParams.get('location') || '';
  const categoryParam = searchParams.get('category') || '';
  const selectedCategories = categoryParam ? categoryParam.split(',') : [];
  const pageParam = searchParams.get('page');
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const perPage = 50;

  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const minCapacityParam = searchParams.get('minCapacity');
  const appliedPriceRange: [number, number] | null =
    minPriceParam != null && maxPriceParam != null
      ? [parseInt(minPriceParam, 10), parseInt(maxPriceParam, 10)]
      : null;
  const appliedMinCapacity = minCapacityParam != null ? parseInt(minCapacityParam, 10) : null;

  const amenitiesParam = searchParams.get('amenities') || '';
  const appliedAmenityIds = useMemo(
    () => amenitiesParam.split(',').map((a) => a.trim()).filter(Boolean),
    [amenitiesParam]
  );
  const [pendingAmenityIds, setPendingAmenityIds] = useState<string[]>(appliedAmenityIds);

  useEffect(() => {
    setPendingAmenityIds(appliedAmenityIds);
  }, [amenitiesParam]);

  const [totalSpaces, setTotalSpaces] = useState(0);
  const [locationInput, setLocationInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const locationInputRef = React.useRef<HTMLDivElement>(null);
  const suggestionDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!locationInput.trim() || locationInput.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setShowSuggestions(false);
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
    const newParams = new URLSearchParams(searchParams);
    newParams.set('location', location);
    newParams.delete('page');
    setSearchParams(newParams);
    setLocationInput('');
    setShowSuggestions(false);
    setSuggestions([]);
  }, [searchParams, setSearchParams]);

  const handleClearLocation = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('location');
    newParams.delete('page');
    setSearchParams(newParams);
    setLocationInput('');
    setShowSuggestions(false);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setLoading(true);
    const offset = (currentPage - 1) * perPage;
    fetchSpaces({
      location: locationParam || undefined,
      category: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
      date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
      minPrice: appliedPriceRange?.[0],
      maxPrice: appliedPriceRange?.[1],
      minCapacity: appliedMinCapacity ?? undefined,
      amenities: appliedAmenityIds.length > 0 ? appliedAmenityIds : undefined,
      limit: perPage,
      offset,
    })
      .then((res) => {
        setSpaces(res.spaces);
        setTotalSpaces(res.total);
      })
      .catch(() => {
        setSpaces([]);
        setTotalSpaces(0);
      })
      .finally(() => setLoading(false));
  }, [locationParam, selectedCategories.join(','), selectedDate?.toISOString(), currentPage, minPriceParam, maxPriceParam, minCapacityParam, amenitiesParam]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const refetchSpaces = useCallback(() => {
    setLoading(true);
    const offset = (currentPage - 1) * perPage;
    fetchSpaces({
      location: locationParam || undefined,
      category: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
      date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
      minPrice: appliedPriceRange?.[0],
      maxPrice: appliedPriceRange?.[1],
      minCapacity: appliedMinCapacity ?? undefined,
      amenities: appliedAmenityIds.length > 0 ? appliedAmenityIds : undefined,
      limit: perPage,
      offset,
    })
      .then((res) => {
        setSpaces(res.spaces);
        setTotalSpaces(res.total);
      })
      .catch(() => {
        setSpaces([]);
        setTotalSpaces(0);
      })
      .finally(() => setLoading(false));
  }, [locationParam, selectedCategories.join(','), selectedDate, currentPage, minPriceParam, maxPriceParam, minCapacityParam, appliedAmenityIds]);

  const handleSwitchToMap = useCallback(() => {
    setView('map');
    refetchSpaces();
  }, [refetchSpaces]);

  useEffect(() => {
    if (!token) {
      setFavoriteIds(new Set());
      return;
    }
    fetchFavorites()
      .then((list) => setFavoriteIds(new Set(list.map((f) => f.spaceId ?? f.id))))
      .catch(() => setFavoriteIds(new Set()));
  }, [token]);

  const handleFavoriteClick = useCallback((spaceId: string) => {
    if (!token) {
      navigate('/auth/login');
      return;
    }
    const isFav = favoriteIds.has(spaceId);
    if (isFav) {
      removeFavorite(spaceId).then(() =>
        fetchFavorites().then((list) => setFavoriteIds(new Set(list.map((f) => f.spaceId ?? f.id))))
      );
    } else {
      addFavorite(spaceId).then(() =>
        fetchFavorites().then((list) => setFavoriteIds(new Set(list.map((f) => f.spaceId ?? f.id))))
      );
    }
  }, [token, favoriteIds]);

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    const newParams = new URLSearchParams(searchParams);
    if (date) {
      newParams.set('date', format(date, 'yyyy-MM-dd'));
    } else {
      newParams.delete('date');
    }
    setSearchParams(newParams);
  };

  const handleCategoryApply = (cats: string[]) => {
    const newParams = new URLSearchParams(searchParams);
    if (cats.length === 0) {
      newParams.delete('category');
    } else {
      newParams.set('category', cats.join(','));
    }
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const handlePriceApply = (range: [number, number]) => {
    const newParams = new URLSearchParams(searchParams);
    const [min, max] = range;
    if (min === 0 && max === 1000) {
      newParams.delete('minPrice');
      newParams.delete('maxPrice');
    } else {
      newParams.set('minPrice', String(min));
      newParams.set('maxPrice', String(max));
    }
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const handleGuestsApply = (count: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (count <= 1) {
      newParams.delete('minCapacity');
    } else {
      newParams.set('minCapacity', String(count));
    }
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const handleApplyFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    if (pendingAmenityIds.length === 0) {
      newParams.delete('amenities');
    } else {
      newParams.set('amenities', pendingAmenityIds.join(','));
    }
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const filteredSpaces = spaces;
  const totalPages = Math.max(1, Math.ceil(totalSpaces / perPage));

  const setPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(page, totalPages));
    const newParams = new URLSearchParams(searchParams);
    if (p === 1) {
      newParams.delete('page');
    } else {
      newParams.set('page', String(p));
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams, totalPages]);

  const paginationPages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | 'ellipsis')[] = [1];
    if (currentPage > 3) pages.push('ellipsis');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let p = start; p <= end; p++) if (p !== 1 && p !== totalPages) pages.push(p);
    if (currentPage < totalPages - 2) pages.push('ellipsis');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="pt-24 md:pt-32 pb-24 min-h-screen bg-white">
      {/* Search & Filter Header */}
      <div className="sticky top-20 z-40 bg-white border-b border-brand-100 px-2 md:px-12 py-3 md:py-4 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-3 md:gap-4 items-center justify-between">
          <div className="w-full lg:max-w-xl relative" ref={locationInputRef}>
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-brand-400 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Where are you going?" 
              value={locationParam || locationInput}
              onChange={(e) => {
                const v = e.target.value;
                setLocationInput(v);
                if (!v) {
                  handleClearLocation();
                  return;
                }
                if (locationParam && v !== locationParam) {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('location');
                  newParams.delete('page');
                  setSearchParams(newParams);
                }
              }}
              onFocus={() => locationInput && setShowSuggestions(suggestions.length > 0)}
              className="w-full pl-10 md:pl-12 pr-10 md:pr-12 py-2.5 md:py-3 bg-brand-100 border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-brand-400 focus:outline-none text-brand-700 font-medium text-sm md:text-base"
              autoComplete="off"
            />
            {(locationParam || locationInput) && (
              <button
                type="button"
                onClick={() => { setLocationInput(''); handleClearLocation(); setShowSuggestions(false); }}
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

          <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full lg:w-auto">
            <SpaceTypeDropdown
              selected={selectedCategories}
              onApply={handleCategoryApply}
              trigger={
                <button className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 border rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${selectedCategories.length > 0 ? 'bg-brand-700 border-brand-700 text-white' : 'border-brand-200 text-brand-600 hover:bg-brand-100'}`}>
                  {selectedCategories.length === 0 
                    ? 'Space Type' 
                    : selectedCategories.length === 1 
                      ? selectedCategories[0] 
                      : `${selectedCategories.length} Types`} 
                  <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 ${selectedCategories.length > 0 ? 'text-brand-200' : 'text-brand-400'}`} />
                </button>
              }
            />
            <DateDropdown 
              value={selectedDate}
              onChange={handleDateChange}
              trigger={
                <button className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 border rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${selectedDate ? 'bg-brand-700 border-brand-700 text-white' : 'border-brand-200 text-brand-600 hover:bg-brand-100'}`}>
                  <Calendar className={`w-3 h-3 md:w-4 md:h-4 ${selectedDate ? 'text-brand-200' : 'text-brand-400'}`} /> 
                  {selectedDate ? format(selectedDate, 'MMM d') : 'Date'} 
                  <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                </button>
              } 
            />
            <GuestsDropdown
              value={appliedMinCapacity ?? 1}
              onApply={handleGuestsApply}
              trigger={
                <button className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 border rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${appliedMinCapacity != null && appliedMinCapacity > 1 ? 'bg-brand-700 border-brand-700 text-white' : 'border-brand-200 text-brand-600 hover:bg-brand-100'}`}>
                  <Users className={`w-3 h-3 md:w-4 md:h-4 ${appliedMinCapacity != null && appliedMinCapacity > 1 ? 'text-brand-200' : ''}`} />
                  {appliedMinCapacity != null && appliedMinCapacity > 1 ? `${appliedMinCapacity}+ people` : 'People'}
                  <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                </button>
              }
            />
            <PriceDropdown
              value={appliedPriceRange ?? [0, 1000]}
              onApply={handlePriceApply}
              trigger={
                <button className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 border rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${appliedPriceRange ? 'bg-brand-700 border-brand-700 text-white' : 'border-brand-200 text-brand-600 hover:bg-brand-100'}`}>
                  <DollarSign className={`w-3 h-3 md:w-4 md:h-4 ${appliedPriceRange ? 'text-brand-200' : ''}`} />
                  {appliedPriceRange ? `$${appliedPriceRange[0]}–$${appliedPriceRange[1]}` : 'Price'}
                  <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                </button>
              }
            />
            <div className="h-6 md:h-8 w-px bg-brand-200 mx-1 md:mx-2 hidden sm:block" />
            <div className="lg:hidden">
              <MoreFiltersDropdown
                trigger={
                  <button className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-brand-700 text-white rounded-lg md:rounded-xl text-xs md:text-sm font-bold hover:bg-brand-600 transition-all cursor-pointer">
                    <SlidersHorizontal className="w-3 h-3 md:w-4 md:h-4" /> Filters
                  </button>
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-12 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-16">
          {/* Sidebar Filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-48 flex flex-col max-h-[calc(100vh-260px)]">
              <h3 className="text-xl font-black text-brand-700 mb-8 flex items-center gap-2 shrink-0">
                <SlidersHorizontal className="w-5 h-5 text-brand-500" />
                Filters
              </h3>
              <div className="flex-1 min-h-0 overflow-y-auto pr-6 custom-scrollbar">
                <FiltersContent
                  isSidebar
                  selectedAmenityIds={pendingAmenityIds}
                  onAmenityChange={setPendingAmenityIds}
                />
              </div>
              <div className="shrink-0 mt-12 pt-8 pb-6 border-t border-brand-100 space-y-4">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="w-full py-4 bg-brand-700 text-white font-black rounded-2xl shadow-xl shadow-brand-700/20 hover:bg-brand-600 transition-all active:scale-95 cursor-pointer"
                >
                  Apply Filters
                </button>
                <button 
                  onClick={() => setSearchParams({})}
                  className="w-full py-3 text-brand-400 font-bold hover:text-brand-700 transition-colors text-sm cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div>
            {/* Results Info & View Toggle */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-black text-brand-700">
                  {totalSpaces} {totalSpaces === 1 ? 'space' : 'spaces'} found {locationParam ? `in ${locationParam}` : ''}
                </h1>
                <p className="text-brand-400 font-medium">Prices may vary depending on date and time</p>
              </div>

              <div className="flex bg-brand-100 p-1 rounded-xl">
                <button 
                  onClick={() => setView('grid')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'grid' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-500 hover:text-brand-700'}`}
                >
                  <Grid className="w-4 h-4" /> Grid
                </button>
                <button 
                  onClick={handleSwitchToMap}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'map' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-500 hover:text-brand-700'}`}
                >
                  <MapIcon className="w-4 h-4" /> Map
                </button>
              </div>
            </div>

            {view === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                  <div className="col-span-full py-24 text-center">
                    <div className="text-brand-500 font-medium">Loading spaces...</div>
                  </div>
                ) : filteredSpaces.length > 0 ? (
                  filteredSpaces.map((space) => (
                    <div key={space.id} data-space-id={space.id}>
                    <SpaceCard
                      key={space.id}
                      id={space.id}
                      image={space.image ?? ''}
                      category={space.category}
                      title={space.title}
                      location={space.location}
                      capacity={space.capacity}
                      rating={space.rating ?? 0}
                      reviews={space.reviews}
                      price={space.price}
                      isInstantBookable={space.isInstantBookable}
                      isFavorite={favoriteIds.has(space.id)}
                      onFavoriteClick={handleFavoriteClick}
                    />
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-24 text-center">
                    <h3 className="text-2xl font-black text-brand-700 mb-2">No spaces found</h3>
                    <p className="text-brand-400 font-medium">Try adjusting your filters or search terms.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[70vh] w-full rounded-[3rem] overflow-hidden border-2 border-brand-200 shadow-inner">
                <SpacesMap
                  spaces={filteredSpaces}
                  dateParam={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined}
                  className="w-full h-full"
                />
              </div>
            )}

            {/* Pagination */}
            {totalSpaces > 0 && (
              <div className="mt-16 flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-brand-100 text-brand-700 font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  aria-label="Previous page"
                >
                  ←
                </button>
                {paginationPages.map((p, idx) =>
                  p === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-brand-400 font-bold" aria-hidden>…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold transition-colors cursor-pointer ${
                        p === currentPage ? 'bg-brand-700 text-white' : 'hover:bg-brand-100 text-brand-700'
                      }`}
                      aria-label={`Page ${p}`}
                      aria-current={p === currentPage ? 'page' : undefined}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-brand-100 text-brand-700 font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  aria-label="Next page"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
