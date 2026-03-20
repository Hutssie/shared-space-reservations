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
};

export function fetchPlaceSuggestions(query: string): Promise<{ suggestions: PlaceSuggestion[] }> {
  const q = query.trim();
  if (!q) return Promise.resolve({ suggestions: [] });
  const sp = new URLSearchParams({ q });
  return apiGet<{ suggestions: PlaceSuggestion[] }>(`/api/places/suggest?${sp.toString()}`);
}
