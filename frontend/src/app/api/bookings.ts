import { apiGet, apiPost, apiPatch } from './client';

export type Booking = {
  id: string;
  space: string;
  spaceId?: string;
  date: string;
  time: string;
  startTime?: string;
  endTime?: string;
  status: string;
  image: string | null;
  price: number;
  cancellationPolicy?: string | null;
};

export function fetchBookings(): Promise<Booking[]> {
  return apiGet<Booking[]>('/api/bookings');
}

export function createBooking(spaceId: string, date: string, startTime: string, endTime: string): Promise<{ id: string; status: string; totalPrice: number }> {
  return apiPost<{ id: string; status: string; totalPrice: number }>('/api/bookings', {
    space_id: spaceId,
    date,
    start_time: startTime,
    end_time: endTime,
  });
}

export function cancelBooking(id: string): Promise<{ id: string; status: string }> {
  return apiPatch<{ id: string; status: string }>(`/api/bookings/${id}`, { status: 'cancelled' });
}

export function updateBookingStatus(
  id: string,
  status: 'confirmed' | 'cancelled'
): Promise<{ id: string; status: string }> {
  return apiPatch<{ id: string; status: string }>(`/api/bookings/${id}`, { status });
}
