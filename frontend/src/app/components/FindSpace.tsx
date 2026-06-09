import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SpaceCard } from './SpaceCard';
import { SlidersHorizontal, Map as MapIcon, Grid, ChevronDown, Calendar, Users, DollarSign, MapPin, X } from 'lucide-react';
import { DateDropdown, GuestsDropdown, PriceDropdown, MoreFiltersDropdown, SpaceTypeDropdown, FiltersContent } from './FilterDropdowns';
import { useSearchParams, useNavigate } from 'react-router';
import { format } from 'date-fns';
import { fetchSpaces, type MapBounds } from '../api/spaces';
import { geocodeAddress } from '../utils/geocode';
import { fetchPlaceSuggestions, locationFromPlaceSuggestion, type PlaceSuggestion } from '../api/places';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedSpacesRef = React.useRef(false);
  const gridAbortRef = React.useRef<AbortController | null>(null);
  const gridRequestIdRef = React.useRef(0);
  const [mapSpaces, setMapSpaces] = useState<Space[]>([]);
  const [mapTotal, setMapTotal] = useState(0);
  const [mapInitialCenter, setMapInitialCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapInitialZoom, setMapInitialZoom] = useState<number | undefined>(undefined);
  const lastMapBoundsRef = React.useRef<MapBounds | null>(null);
  const mapFetchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapAbortRef = React.useRef<AbortController | null>(null);
  const mapRequestIdRef = React.useRef(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const { token } = useAuth();
  const dateParam = searchParams.get('date') || '';
  const appliedDate = useMemo(() => {
    if (!dateParam) return null;
    const parsed = new Date(dateParam);
    return isNaN(parsed.getTime()) ? null : parsed;
  }, [dateParam]);

  const locationParam = searchParams.get('location') || '';
  const centerLatParam = searchParams.get('centerLat');
  const centerLngParam = searchParams.get('centerLng');
  const centerLat = centerLatParam != null ? parseFloat(centerLatParam) : undefined;
  const centerLng = centerLngParam != null ? parseFloat(centerLngParam) : undefined;
  const placeNorthParam = searchParams.get('placeNorth');
  const placeSouthParam = searchParams.get('placeSouth');
  const placeEastParam = searchParams.get('placeEast');
  const placeWestParam = searchParams.get('placeWest');
  const placeNorth = placeNorthParam != null ? parseFloat(placeNorthParam) : undefined;
  const placeSouth = placeSouthParam != null ? parseFloat(placeSouthParam) : undefined;
  const placeEast = placeEastParam != null ? parseFloat(placeEastParam) : undefined;
  const placeWest = placeWestParam != null ? parseFloat(placeWestParam) : undefined;
  const categoryParam = searchParams.get('category') || '';
  const selectedCategories = categoryParam ? categoryParam.split(',') : [];
  const pageParam = searchParams.get('page');
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const perPage = 50;

  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const minCapacityParam = searchParams.get('minCapacity');
  const appliedPriceRange = useMemo((): [number, number] | null => {
    if (minPriceParam == null || maxPriceParam == null) return null;
    const min = parseInt(minPriceParam, 10);
    const max = parseInt(maxPriceParam, 10);
    if (Number.isNaN(min) || Number.isNaN(max)) return null;
    return [min, max];
  }, [minPriceParam, maxPriceParam]);
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
    const location = locationFromPlaceSuggestion(suggestion);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('location', location);
    newParams.delete('page');
    if (suggestion.latitude != null && suggestion.longitude != null) {
      newParams.set('centerLat', String(suggestion.latitude));
      newParams.set('centerLng', String(suggestion.longitude));
      setMapInitialCenter({ lat: suggestion.latitude, lng: suggestion.longitude });
      setMapInitialZoom(12);
    } else {
      newParams.delete('centerLat');
      newParams.delete('centerLng');
    }
    if (
      suggestion.north != null &&
      suggestion.south != null &&
      suggestion.east != null &&
      suggestion.west != null
    ) {
      newParams.set('placeNorth', String(suggestion.north));
      newParams.set('placeSouth', String(suggestion.south));
      newParams.set('placeEast', String(suggestion.east));
      newParams.set('placeWest', String(suggestion.west));
    } else {
      newParams.delete('placeNorth');
      newParams.delete('placeSouth');
      newParams.delete('placeEast');
      newParams.delete('placeWest');
    }
    setSearchParams(newParams);
    setLocationInput('');
    setShowSuggestions(false);
    setSuggestions([]);
  }, [searchParams, setSearchParams]);

  const handleClearLocation = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('location');
    newParams.delete('centerLat');
    newParams.delete('centerLng');
    newParams.delete('placeNorth');
    newParams.delete('placeSouth');
    newParams.delete('placeEast');
    newParams.delete('placeWest');
    newParams.delete('page');
    setSearchParams(newParams);
    setLocationInput('');
    setShowSuggestions(false);
  }, [searchParams, setSearchParams]);

  const baseFilterParams = useMemo(
    () => ({
      location: locationParam || undefined,
      centerLat: centerLat != null && !Number.isNaN(centerLat) ? centerLat : undefined,
      centerLng: centerLng != null && !Number.isNaN(centerLng) ? centerLng : undefined,
      placeNorth: placeNorth != null && !Number.isNaN(placeNorth) ? placeNorth : undefined,
      placeSouth: placeSouth != null && !Number.isNaN(placeSouth) ? placeSouth : undefined,
      placeEast: placeEast != null && !Number.isNaN(placeEast) ? placeEast : undefined,
      placeWest: placeWest != null && !Number.isNaN(placeWest) ? placeWest : undefined,
      category: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
      date: appliedDate ? format(appliedDate, 'yyyy-MM-dd') : undefined,
      minPrice: appliedPriceRange?.[0],
      maxPrice: appliedPriceRange?.[1],
      minCapacity: appliedMinCapacity ?? undefined,
      amenities: appliedAmenityIds.length > 0 ? appliedAmenityIds : undefined,
    }),
    [
      locationParam,
      centerLat,
      centerLng,
      placeNorth,
      placeSouth,
      placeEast,
      placeWest,
      selectedCategories.join(','),
      appliedDate,
      minPriceParam,
      maxPriceParam,
      appliedMinCapacity,
      appliedAmenityIds,
    ]
  );

  const gridFilterParams = useMemo(
    () => ({ ...baseFilterParams, sort: 'recommended' as const }),
    [baseFilterParams]
  );

  const mapFilterParams = baseFilterParams;

  const fetchMapSpacesForBounds = useCallback(
    (bounds: MapBounds) => {
      lastMapBoundsRef.current = bounds;
      mapAbortRef.current?.abort();
      const controller = new AbortController();
      mapAbortRef.current = controller;
      const requestId = ++mapRequestIdRef.current;
      fetchSpaces(
        {
          ...mapFilterParams,
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
          limit: 150,
        },
        { signal: controller.signal }
      )
        .then((res) => {
          if (requestId !== mapRequestIdRef.current) return;
          setMapSpaces(res.spaces);
          setMapTotal(res.total);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (err instanceof Error && err.name === 'AbortError') return;
          if (requestId !== mapRequestIdRef.current) return;
          setMapSpaces([]);
          setMapTotal(0);
        })
    },
    [mapFilterParams]
  );

  const handleMapBoundsChange = useCallback(
    (bounds: MapBounds) => {
      if (view !== 'map') return;
      if (mapFetchDebounceRef.current) clearTimeout(mapFetchDebounceRef.current);
      mapFetchDebounceRef.current = setTimeout(() => {
        mapFetchDebounceRef.current = null;
        fetchMapSpacesForBounds(bounds);
      }, 300);
    },
    [view, fetchMapSpacesForBounds]
  );

  useEffect(() => {
    if (view !== 'grid') return;

    gridAbortRef.current?.abort();
    const controller = new AbortController();
    gridAbortRef.current = controller;
    const requestId = ++gridRequestIdRef.current;

    if (hasLoadedSpacesRef.current) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    const offset = (currentPage - 1) * perPage;
    fetchSpaces(
      {
        ...gridFilterParams,
        limit: perPage,
        offset,
      },
      { signal: controller.signal }
    )
      .then((res) => {
        if (requestId !== gridRequestIdRef.current) return;
        setSpaces(res.spaces);
        setTotalSpaces(res.total);
        hasLoadedSpacesRef.current = true;
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof Error && err.name === 'AbortError') return;
        if (requestId !== gridRequestIdRef.current) return;
        setSpaces([]);
        setTotalSpaces(0);
      })
      .finally(() => {
        if (requestId !== gridRequestIdRef.current) return;
        setLoading(false);
        setIsRefreshing(false);
      });
  }, [view, gridFilterParams, currentPage]);

  useEffect(() => {
    if (view !== 'map') return;
    const bounds = lastMapBoundsRef.current;
    if (bounds) fetchMapSpacesForBounds(bounds);
  }, [view, mapFilterParams, fetchMapSpacesForBounds]);

  useEffect(() => {
    if (view !== 'grid') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage, view]);

  useEffect(() => {
    if (!locationParam) return;
    let cancelled = false;
    geocodeAddress(locationParam).then((result) => {
      if (cancelled || !result) return;
      setMapInitialCenter({ lat: result.lat, lng: result.lng });
      setMapInitialZoom(result.zoom);
    });
    return () => {
      cancelled = true;
    };
  }, [locationParam]);

  useEffect(() => {
    return () => {
      if (mapFetchDebounceRef.current) clearTimeout(mapFetchDebounceRef.current);
      mapAbortRef.current?.abort();
      gridAbortRef.current?.abort();
    };
  }, []);

  const handleSwitchToMap = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('page');
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams);
    }
    setView('map');
  }, [searchParams, setSearchParams]);

  const handleSwitchToGrid = useCallback(() => {
    setView('grid');
  }, []);

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

  const handleDateApply = (date: Date | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (date) {
      newParams.set('date', format(date, 'yyyy-MM-dd'));
    } else {
      newParams.delete('date');
    }
    newParams.delete('page');
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
  const displayTotal = view === 'map' ? mapTotal : totalSpaces;
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
    <div className="pt-20 pb-16 min-h-screen bg-white">
      {/* search + filters header */}
      <div className="sticky top-20 z-40 bg-white border-b border-brand-100 px-3 lg:px-8 py-2.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-2.5 lg:gap-3 items-center justify-between">
          <div className="w-full lg:max-w-md relative" ref={locationInputRef}>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400 pointer-events-none" />
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
              className="w-full pl-9 pr-9 py-2 bg-brand-100 border-none rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none text-brand-700 font-medium text-sm"
              autoComplete="off"
            />
            {(locationParam || locationInput) && (
              <button
                type="button"
                onClick={() => { setLocationInput(''); handleClearLocation(); setShowSuggestions(false); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-brand-400 hover:text-brand-700 hover:bg-brand-200/50 transition-colors cursor-pointer"
                aria-label="Clear location"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {showSuggestions && (suggestionsLoading || suggestions.length > 0 || (locationInput.trim() !== '' && !suggestionsLoading)) && (
              <div className="absolute top-full left-0 right-0 mt-1 py-1.5 bg-white rounded-lg border border-brand-200 shadow-lg shadow-brand-700/10 overflow-hidden z-50 max-h-60 overflow-y-auto">
                {suggestionsLoading ? (
                  <div className="px-3 py-2 text-brand-400 font-medium text-sm">Searching places...</div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => handleSelectLocation(s)}
                      className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-brand-50 transition-colors cursor-pointer border-b border-brand-50 last:border-b-0"
                    >
                      <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-brand-700 text-sm">{s.primary}</div>
                        {s.secondary && (
                          <div className="text-brand-400 text-xs font-medium mt-0.5">{s.secondary}</div>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-brand-400 font-medium text-sm">No places found. Try a different search.</div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            <SpaceTypeDropdown
              selected={selectedCategories}
              onApply={handleCategoryApply}
              trigger={
                <button className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedCategories.length > 0 ? 'bg-brand-700 border-brand-700 text-white' : 'border-brand-200 text-brand-600 hover:bg-brand-100'}`}>
                  {selectedCategories.length === 0 
                    ? 'Space Type' 
                    : selectedCategories.length === 1 
                      ? selectedCategories[0] 
                      : `${selectedCategories.length} Types`} 
                  <ChevronDown className={`w-3.5 h-3.5 ${selectedCategories.length > 0 ? 'text-brand-200' : 'text-brand-400'}`} />
                </button>
              }
            />
            <DateDropdown 
              value={appliedDate}
              onApply={handleDateApply}
              trigger={
                <button className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${appliedDate ? 'bg-brand-700 border-brand-700 text-white' : 'border-brand-200 text-brand-600 hover:bg-brand-100'}`}>
                  <Calendar className={`w-3.5 h-3.5 ${appliedDate ? 'text-brand-200' : 'text-brand-400'}`} /> 
                  {appliedDate ? format(appliedDate, 'MMM d') : 'Date'} 
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              } 
            />
            <GuestsDropdown
              value={appliedMinCapacity ?? 1}
              onApply={handleGuestsApply}
              trigger={
                <button className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${appliedMinCapacity != null && appliedMinCapacity > 1 ? 'bg-brand-700 border-brand-700 text-white' : 'border-brand-200 text-brand-600 hover:bg-brand-100'}`}>
                  <Users className={`w-3.5 h-3.5 ${appliedMinCapacity != null && appliedMinCapacity > 1 ? 'text-brand-200' : ''}`} />
                  {appliedMinCapacity != null && appliedMinCapacity > 1 ? `${appliedMinCapacity}+ people` : 'People'}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              }
            />
            <PriceDropdown
              value={appliedPriceRange ?? [0, 1000]}
              onApply={handlePriceApply}
              trigger={
                <button className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${appliedPriceRange ? 'bg-brand-700 border-brand-700 text-white' : 'border-brand-200 text-brand-600 hover:bg-brand-100'}`}>
                  <DollarSign className={`w-3.5 h-3.5 ${appliedPriceRange ? 'text-brand-200' : ''}`} />
                  {appliedPriceRange ? `$${appliedPriceRange[0]}–$${appliedPriceRange[1]}` : 'Price'}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              }
            />
            <div className="h-5 w-px bg-brand-200 mx-1 hidden sm:block" />
            <div className="lg:hidden">
              <MoreFiltersDropdown
                trigger={
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-700 text-white rounded-lg text-xs font-bold hover:bg-brand-600 transition-all cursor-pointer">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                  </button>
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-5 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 lg:gap-10">
          {/* sidebar filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-[8.75rem] flex flex-col max-h-[calc(100vh-12rem)]">
              <h3 className="text-base font-black text-brand-700 mb-4 flex items-center gap-2 shrink-0">
                <SlidersHorizontal className="w-4 h-4 text-brand-500" />
                Filters
              </h3>
              <div className="flex-1 min-h-0 overflow-y-auto pr-3 custom-scrollbar">
                <FiltersContent
                  isSidebar
                  selectedAmenityIds={pendingAmenityIds}
                  onAmenityChange={setPendingAmenityIds}
                />
              </div>
              <div className="shrink-0 mt-6 pt-5 pb-2 border-t border-brand-100 space-y-2.5">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="w-full py-2.5 bg-brand-700 text-white text-sm font-black rounded-xl shadow-lg shadow-brand-700/20 hover:bg-brand-600 transition-all active:scale-95 cursor-pointer"
                >
                  Apply Filters
                </button>
                <button 
                  onClick={() => setSearchParams({})}
                  className="w-full py-2 text-brand-400 font-bold hover:text-brand-700 transition-colors text-xs cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </aside>

          {/* main content */}
          <div>
            {/* result count + view toggle */}
            <div className="flex items-center justify-between mb-5 gap-4">
              <div className="min-w-0">
                <h1 className="text-lg lg:text-xl font-black text-brand-700 truncate">
                  {displayTotal} {displayTotal === 1 ? 'space' : 'spaces'} found{' '}
                  {view === 'map'
                    ? 'in this area'
                    : locationParam
                      ? `in ${locationParam}`
                      : 'nearby'}
                  {isRefreshing && (
                    <span className="ml-2 inline-block w-3.5 h-3.5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin align-middle" aria-hidden />
                  )}
                </h1>
                <p className="text-brand-400 font-medium text-xs sm:text-sm">Prices may vary depending on date and time</p>
              </div>

              <div className="flex bg-brand-100 p-0.5 rounded-lg shrink-0">
                <button 
                  onClick={handleSwitchToGrid}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'grid' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-500 hover:text-brand-700'}`}
                >
                  <Grid className="w-3.5 h-3.5" /> Grid
                </button>
                <button 
                  onClick={handleSwitchToMap}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'map' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-500 hover:text-brand-700'}`}
                >
                  <MapIcon className="w-3.5 h-3.5" /> Map
                </button>
              </div>
            </div>

            {view === 'grid' ? (
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 transition-opacity duration-200 ${
                  isRefreshing ? 'opacity-70 pointer-events-none' : ''
                }`}
                aria-busy={isRefreshing}
              >
                {loading && filteredSpaces.length === 0 ? (
                  <div className="col-span-full py-16 text-center">
                    <div className="text-brand-500 font-medium text-sm">Loading spaces...</div>
                  </div>
                ) : filteredSpaces.length > 0 ? (
                  filteredSpaces.map((space) => (
                    <div key={space.id} data-space-id={space.id}>
                    <SpaceCard
                      compact
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
                  <div className="col-span-full py-16 text-center">
                    <h3 className="text-xl font-black text-brand-700 mb-2">No spaces found</h3>
                    <p className="text-brand-400 font-medium text-sm">Try adjusting your filters or search terms.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative h-[min(68vh,calc(100vh-17rem))] min-h-[360px] w-full rounded-2xl border border-brand-200 shadow-inner">
                <SpacesMap
                  spaces={mapSpaces}
                  initialCenter={mapInitialCenter}
                  initialZoom={mapInitialZoom}
                  onBoundsChange={handleMapBoundsChange}
                  dateParam={appliedDate ? format(appliedDate, 'yyyy-MM-dd') : undefined}
                  className="absolute inset-0 w-full h-full"
                  favoriteIds={favoriteIds}
                  onFavoriteClick={handleFavoriteClick}
                />
              </div>
            )}

            {/* pagination */}
            {view === 'grid' && totalSpaces > 0 && (
              <div className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-brand-100 text-brand-700 text-sm font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  aria-label="Previous page"
                >
                  ←
                </button>
                {paginationPages.map((p, idx) =>
                  p === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-brand-400 text-sm font-bold" aria-hidden>…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors cursor-pointer ${
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
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-brand-100 text-brand-700 text-sm font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
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
