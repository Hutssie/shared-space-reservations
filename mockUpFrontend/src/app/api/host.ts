import { apiGet, apiPatch } from './client';
import type { Space } from './spaces';

export type HostListing = Space & { bookings?: number; revenue?: number; status?: string; unseenBookingsCount?: number };

export type HostBooking = {
  id: string;
  spaceId: string;
  space: string;
  image: string | null;
  guest: string;
  guestId?: string;
  date: string;
  time: string;
  status: string;
  totalPrice: number;
};

export type HostSettings = {
  availabilityStartTime: string | null;
  availabilityEndTime: string | null;
};

export type HostSpaceBooking = {
  id: string;
  spaceId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  guest: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    reviewCount?: number;
    avgRatingGiven?: number | null;
  };
};

export type HostGuestProfile = {
  guest: { id: string; name: string; email: string; avatarUrl: string | null; bio: string | null };
  reviewCount: number;
  avgRatingGiven: number | null;
  withHost: { totalBookings: number; totalSpent: number; avgRating: number | null };
};

export function fetchHostSpaces(): Promise<HostListing[]> {
  return apiGet<HostListing[]>('/api/host/spaces');
}

export function fetchHostBookings(): Promise<HostBooking[]> {
  return apiGet<HostBooking[]>('/api/host/bookings');
}

export function fetchHostSpaceBookings(spaceId: string): Promise<HostSpaceBooking[]> {
  return apiGet<HostSpaceBooking[]>(`/api/host/spaces/${spaceId}/bookings`);
}

export function fetchHostSpaceBookedDates(spaceId: string): Promise<{ dates: string[] }> {
  return apiGet<{ dates: string[] }>(`/api/host/spaces/${spaceId}/bookings/dates`);
}

export function fetchHostGuestProfile(guestId: string): Promise<HostGuestProfile> {
  return apiGet<HostGuestProfile>(`/api/host/guests/${guestId}/profile`);
}

export function fetchHostSettings(): Promise<HostSettings> {
  return apiGet<HostSettings>('/api/host/settings');
}

export function updateHostSettings(data: {
  availabilityStartTime?: string | null;
  availabilityEndTime?: string | null;
}): Promise<HostSettings> {
  return apiPatch<HostSettings>('/api/host/settings', data);
}
