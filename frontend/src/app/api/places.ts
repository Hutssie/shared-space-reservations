import { apiGet } from './client';

export type PlaceSuggestion = {
  label: string;
  primary: string;
  secondary: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
};

/** Build a location filter string from a place suggestion (city, region, country). */
export function locationFromPlaceSuggestion(suggestion: PlaceSuggestion): string {
  const country = suggestion.country ?? '';
  const city = suggestion.city ?? '';
  let region = suggestion.state ?? '';

  if (!city && !region && suggestion.primary && suggestion.primary !== country) {
    region = suggestion.primary;
  }

  const location = [city, region, country].filter(Boolean).join(', ');
  return location || suggestion.label;
}

export function fetchPlaceSuggestions(query: string): Promise<{ suggestions: PlaceSuggestion[] }> {
  const q = query.trim();
  if (!q) return Promise.resolve({ suggestions: [] });
  const sp = new URLSearchParams({ q });
  return apiGet<{ suggestions: PlaceSuggestion[] }>(`/api/places/suggest?${sp.toString()}`);
}
