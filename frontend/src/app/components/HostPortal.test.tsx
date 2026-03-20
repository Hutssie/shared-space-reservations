import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPortal } from './HostPortal';
import { AuthProvider } from '../context/AuthContext';
import * as hostApi from '../api/host';

vi.mock('../api/host', () => ({
  fetchHostSpaces: vi.fn(),
  fetchHostBookings: vi.fn(),
}));

const mockListings = [
  { id: '1', title: 'My Studio', image: null, bookings: 10, revenue: 1200, rating: 4.9, category: '', location: '', capacity: 8, price: 100, reviews: 20, description: '', amenities: [], images: [], isInstantBookable: true, host: null },
];

const mockBookings = [
  { id: 'b1', spaceId: '1', space: 'My Studio', image: null, guest: 'Alice', guestId: 'u1', date: '2026-02-20', time: '10:00 - 14:00', status: 'confirmed', totalPrice: 400 },
];

describe('HostPortal', () => {
  beforeEach(() => {
    (hostApi.fetchHostSpaces as ReturnType<typeof vi.fn>).mockResolvedValue(mockListings);
    (hostApi.fetchHostBookings as ReturnType<typeof vi.fn>).mockResolvedValue(mockBookings);
  });

  it('C23: HostPortal: fetches host spaces and renders listing cards', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <HostPortal />
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(hostApi.fetchHostSpaces).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('My Studio')).toBeInTheDocument());
  });

  it('C24: HostPortal: shows Weekly/Monthly chart toggle and Weekly is active by default', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <HostPortal />
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(hostApi.fetchHostBookings).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /weekly/i });
    const monthlyBtn = screen.getByRole('button', { name: /monthly/i });
    expect(weeklyBtn).toHaveClass('bg-brand-700');
    expect(monthlyBtn).toHaveClass('bg-brand-50');
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
  });
});
