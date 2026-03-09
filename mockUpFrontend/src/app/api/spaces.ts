import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export type Space = {
  id: string;
  image: string | null;
  category: string;
  title: string;
  location: string;
  capacity: number;
  price: number;
  rating: number | null;
  reviews: number;
  isInstantBookable: boolean;
  description: string;
  amenities: string[];
  images: string[];
  host: { name: string; avatar: string | null; since: string; isSuperhost: boolean } | null;
  latitude?: number | null;
  longitude?: number | null;
  squareMeters?: number | null;
  availabilityStartTime?: string | null;
  availabilityEndTime?: string | null;
  sameDayBookingAllowed?: boolean;
  minDurationHours?: number | null;
  maxDurationHours?: number | null;
  maxAdvanceBookingDays?: number | null;
  cancellationPolicy?: string | null;
  cleaningFeeCents?: number | null;
  equipmentFeeCents?: number | null;
  bannedDays?: string[] | null;
  blockedDates?: { id: string; startDate: string; endDate: string; createdAt: string }[] | null;
  status?: string;
};

export type SpaceListItem = Space;

export function fetchSpaces(params: {
  q?: string;
  location?: string;
  category?: string;
  date?: string;
  minPrice?: number;
  maxPrice?: number;
  minCapacity?: number;
  amenities?: string[];
  limit?: number;
  offset?: number;
  featured?: boolean;
}): Promise<{ spaces: Space[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.location) sp.set('location', params.location);
  if (params.category) sp.set('category', params.category);
  if (params.date) sp.set('date', params.date);
  if (params.minPrice != null) sp.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) sp.set('maxPrice', String(params.maxPrice));
  if (params.minCapacity != null) sp.set('minCapacity', String(params.minCapacity));
  if (params.amenities != null && params.amenities.length > 0) sp.set('amenities', params.amenities.join(','));
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  if (params.featured != null) sp.set('featured', String(params.featured));
  const query = sp.toString();
  return apiGet<{ spaces: Space[]; total: number }>(`/api/spaces${query ? `?${query}` : ''}`);
}

export function fetchLocationSuggestions(query: string): Promise<{ locations: string[] }> {
  const sp = new URLSearchParams();
  if (query.trim()) sp.set('q', query.trim());
  return apiGet<{ locations: string[] }>(`/api/spaces/locations${sp.toString() ? `?${sp.toString()}` : ''}`);
}

export function fetchSpace(id: string): Promise<Space> {
  return apiGet<Space>(`/api/spaces/${id}`);
}

export function fetchCategoryCounts(): Promise<Record<string, number>> {
  return apiGet<Record<string, number>>('/api/spaces/category-counts');
}

export function fetchPopularCategoriesThisWeek(): Promise<{ categories: string[] }> {
  return apiGet<{ categories: string[] }>('/api/spaces/popular-categories-week');
}

export function fetchFeaturedSpacesThisWeek(): Promise<{ spaces: Space[]; total: number }> {
  return apiGet<{ spaces: Space[]; total: number }>('/api/spaces/featured-this-week');
}

export function fetchAvailability(spaceId: string, date: string): Promise<{ slots: string[]; booked: string[]; unavailable?: string[] }> {
  return apiGet<{ slots: string[]; booked: string[]; unavailable?: string[] }>(`/api/spaces/${spaceId}/availability?date=${encodeURIComponent(date)}`);
}

export function createSpace(data: {
  category: string;
  title: string;
  location: string;
  capacity: number;
  pricePerHour: number;
  description: string;
  imageUrl?: string;
  imagesJson?: string[] | string;
  amenitiesJson?: string[] | string;
  isInstantBookable?: boolean;
  latitude?: number;
  longitude?: number;
  squareMeters?: number | null;
  availabilityStartTime?: string | null;
  availabilityEndTime?: string | null;
  sameDayBookingAllowed?: boolean;
  minDurationHours?: number | null;
  maxDurationHours?: number | null;
  maxAdvanceBookingDays?: number | null;
  cancellationPolicy?: string | null;
  cleaningFeeCents?: number | null;
  equipmentFeeCents?: number | null;
}): Promise<Space> {
  return apiPost<Space>('/api/spaces', data);
}

export function updateSpace(
  id: string,
  data: Partial<{
    category: string;
    title: string;
    location: string;
    capacity: number;
    pricePerHour: number;
    squareMeters: number | null;
    description: string;
    imageUrl: string;
    imagesJson: string[] | string;
    amenitiesJson: string[] | string;
    isInstantBookable: boolean;
    availabilityStartTime?: string | null;
    availabilityEndTime?: string | null;
    sameDayBookingAllowed?: boolean;
    minDurationHours?: number | null;
    maxDurationHours?: number | null;
    maxAdvanceBookingDays?: number | null;
    cancellationPolicy?: string | null;
    cleaningFeeCents?: number | null;
    equipmentFeeCents?: number | null;
    bannedDaysJson?: string | null;
    blockedDatesJson?: { id: string; startDate: string; endDate: string; createdAt: string }[] | null;
    status?: string;
  }>
): Promise<Space> {
  return apiPatch<Space>(`/api/spaces/${id}`, data);
}

export type DeleteSpaceResult =
  | { success: true }
  | { success: false; activeBookingsCount: number };

export async function deleteSpace(id: string): Promise<DeleteSpaceResult> {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const token = localStorage.getItem('token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/api/spaces/${id}`, { method: 'DELETE', headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (res.status === 204 || (res.ok && res.status >= 200 && res.status < 300)) {
    return { success: true };
  }
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    const count = typeof (body as { activeBookingsCount?: number }).activeBookingsCount === 'number'
      ? (body as { activeBookingsCount: number }).activeBookingsCount
      : 0;
    return { success: false, activeBookingsCount: count };
  }
  const body = await res.json().catch(() => ({}));
  throw new Error((body as { error?: string }).error || res.statusText || 'Request failed');
}

export function fetchSpaceReviews(spaceId: string): Promise<{
  reviews: Array<{ id: string; name: string; avatar: string | null; rating: number; text: string; createdAt: string }>;
  aggregates: { cleanliness: number | null; communication: number | null; location: number | null; value: number | null };
}> {
  return apiGet(`/api/spaces/${spaceId}/reviews`);
}

export function createSpaceReview(
  spaceId: string,
  rating: number,
  text: string,
  categoryScores?: { cleanliness?: number; communication?: number; location?: number; value?: number }
): Promise<unknown> {
  return apiPost(`/api/spaces/${spaceId}/reviews`, { rating, text, ...categoryScores });
}

export function updateReview(
  spaceId: string,
  reviewId: string,
  data: { rating: number; text: string; cleanliness: number; communication: number; location: number; value: number }
): Promise<unknown> {
  return apiPatch(`/api/spaces/${spaceId}/reviews/${reviewId}`, data);
}

export function deleteReview(spaceId: string, reviewId: string): Promise<void> {
  return apiDelete(`/api/spaces/${spaceId}/reviews/${reviewId}`);
}
