import { apiGet, apiPatch, apiDelete, apiPost } from './client';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  bannedAt: string | null;
  createdAt: string;
};

export type AdminUserDetail = AdminUser & {
  professionalTitle?: string | null;
  bio?: string | null;
  spacesCount: number;
  bookingsCount: number;
  reviewsCount: number;
};

export type AdminSpace = {
  id: string;
  title: string;
  category: string;
  location: string;
  status: string;
  host?: { id: string; name: string; avatar: string | null } | null;
  [key: string]: unknown;
};

export type AdminBooking = {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
  spaceId: string;
  space: { id: string; title: string; location: string; hostId: string };
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
  createdAt: string;
};

export type AdminReview = {
  id: string;
  spaceId: string;
  space: { id: string; title: string };
  userId: string;
  user: { id: string; name: string; email: string };
  rating: number;
  text: string;
  cleanliness?: number | null;
  communication?: number | null;
  location?: number | null;
  value?: number | null;
  createdAt: string;
};

export type AdminStats = {
  users: number;
  spaces: number;
  spacesActive: number;
  bookings: number;
  bookingsConfirmed: number;
  bookingsPending: number;
  reviews: number;
  cities: number;
};

export function fetchAdminUsers(params?: { q?: string; limit?: number; offset?: number }): Promise<{ users: AdminUser[]; total: number; limit: number; offset: number }> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const query = sp.toString();
  return apiGet<{ users: AdminUser[]; total: number; limit: number; offset: number }>(`/api/admin/users${query ? `?${query}` : ''}`);
}

export function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  return apiGet<AdminUserDetail>(`/api/admin/users/${id}`);
}

export function banAdminUser(id: string): Promise<AdminUser> {
  return apiPost<AdminUser>(`/api/admin/users/${id}/ban`);
}

export function unbanAdminUser(id: string): Promise<AdminUser> {
  return apiPost<AdminUser>(`/api/admin/users/${id}/unban`);
}

export function fetchAdminSpaces(params?: { status?: string; hostId?: string; category?: string; q?: string; limit?: number; offset?: number }): Promise<{ spaces: AdminSpace[]; total: number; limit: number; offset: number }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.hostId) sp.set('hostId', params.hostId);
  if (params?.category) sp.set('category', params.category);
  if (params?.q) sp.set('q', params.q);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const query = sp.toString();
  return apiGet<{ spaces: AdminSpace[]; total: number; limit: number; offset: number }>(`/api/admin/spaces${query ? `?${query}` : ''}`);
}

export function updateSpaceStatus(id: string, status: string): Promise<AdminSpace> {
  return apiPatch<AdminSpace>(`/api/admin/spaces/${id}`, { status });
}

export function fetchAdminBookings(params?: { status?: string; spaceId?: string; userId?: string; limit?: number; offset?: number }): Promise<{ bookings: AdminBooking[]; total: number; limit: number; offset: number }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.spaceId) sp.set('spaceId', params.spaceId);
  if (params?.userId) sp.set('userId', params.userId);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const query = sp.toString();
  return apiGet<{ bookings: AdminBooking[]; total: number; limit: number; offset: number }>(`/api/admin/bookings${query ? `?${query}` : ''}`);
}

export function fetchAdminReviews(params?: { spaceId?: string; userId?: string; limit?: number; offset?: number }): Promise<{ reviews: AdminReview[]; total: number; limit: number; offset: number }> {
  const sp = new URLSearchParams();
  if (params?.spaceId) sp.set('spaceId', params.spaceId);
  if (params?.userId) sp.set('userId', params.userId);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const query = sp.toString();
  return apiGet<{ reviews: AdminReview[]; total: number; limit: number; offset: number }>(`/api/admin/reviews${query ? `?${query}` : ''}`);
}

export function deleteAdminReview(id: string): Promise<void> {
  return apiDelete(`/api/admin/reviews/${id}`);
}

export function fetchAdminStats(): Promise<AdminStats> {
  return apiGet<AdminStats>('/api/admin/stats');
}
