import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Dashboard } from './Dashboard';
import * as bookingsApi from '../api/bookings';
import * as favoritesApi from '../api/favorites';

vi.mock('../api/bookings', () => ({ fetchBookings: vi.fn() }));
vi.mock('../api/favorites', () => ({ fetchFavorites: vi.fn() }));

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
