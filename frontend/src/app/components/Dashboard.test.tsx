import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Dashboard } from './Dashboard';
import * as bookingsApi from '../api/bookings';
import * as favoritesApi from '../api/favorites';

vi.mock('../api/bookings', () => ({ fetchBookings: vi.fn() }));
vi.mock('../api/favorites', () => ({ fetchFavorites: vi.fn() }));
vi.mock('../api/messages', () => ({
  fetchConversations: vi.fn().mockResolvedValue([]),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [], nextCursor: null }),
  createOrGetConversation: vi.fn(),
  sendMessage: vi.fn(),
  markConversationRead: vi.fn(),
  subscribeToMessageStream: () => () => {},
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'u1@test.com', name: 'U1', avatarUrl: null },
    token: 't',
    isLoading: false,
    setUser: vi.fn(),
    setAuth: vi.fn(),
    logout: vi.fn(),
  }),
}));
vi.mock('../contexts/UnreadBookingsContext', () => ({
  useUnreadBookings: () => ({
    hasUnreadBookings: false,
    markBookingsAsRead: vi.fn(),
    addNewBooking: vi.fn(),
    newestBookingId: null,
    clearNewestBooking: vi.fn(),
  }),
}));

describe('Dashboard', () => {
  beforeEach(() => {
    (bookingsApi.fetchBookings as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (favoritesApi.fetchFavorites as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('C22: Dashboard: fetches bookings and favorites on mount (mock)', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(bookingsApi.fetchBookings).toHaveBeenCalled();
      expect(favoritesApi.fetchFavorites).toHaveBeenCalled();
    });
  });
});
