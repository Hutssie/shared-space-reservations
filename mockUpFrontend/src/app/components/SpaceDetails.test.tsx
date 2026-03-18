import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { SpaceDetails } from './SpaceDetails';
import * as spacesApi from '../api/spaces';
import * as bookingsApi from '../api/bookings';

const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router')>();
  return { ...orig, useNavigate: () => mockNavigate };
});

vi.mock('../api/spaces', () => ({
  fetchSpace: vi.fn(),
  fetchAvailability: vi.fn(),
  fetchSpaceReviews: vi.fn(),
}));
vi.mock('../api/bookings', () => ({
  createBooking: vi.fn(),
}));
const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
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

const fetchSpaceMock = spacesApi.fetchSpace as ReturnType<typeof vi.fn>;
const fetchAvailabilityMock = spacesApi.fetchAvailability as ReturnType<typeof vi.fn>;
const createBookingMock = bookingsApi.createBooking as ReturnType<typeof vi.fn>;

const mockSpace = {
  id: 'space-1',
  title: 'Bright Loft',
  category: 'Photo Studio',
  location: 'Brooklyn',
  capacity: 8,
  price: 120,
  rating: 4.8,
  reviews: 42,
  image: null,
  images: [],
  description: 'A bright space.',
  amenities: [],
  isInstantBookable: true,
  host: { id: 'host-1', name: 'Sarah', avatar: null, since: '2020', isSuperhost: false },
};

describe('SpaceDetails', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T01:00:00').getTime());
    mockUseAuth.mockReturnValue({ token: 'logged-in-token' });
    fetchSpaceMock.mockResolvedValue(mockSpace);
    fetchAvailabilityMock.mockResolvedValue({
      granularityMinutes: 60,
      slotMinutes: [540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200, 1260, 1320, 1380, 1440],
      bookedIntervals: [],
      unavailableIntervals: [],
    });
    (spacesApi.fetchSpaceReviews as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('C18: With valid space id: fetches space and shows title, price', async () => {
    render(
      <MemoryRouter initialEntries={['/space/space-1']}>
        <Routes>
          <Route path="/space/:id" element={<SpaceDetails />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Bright Loft')).toBeInTheDocument());
    expect(screen.getByText(/\$120/)).toBeInTheDocument();
  });

  it('C19: With invalid id: shows "Space not found" and link to /find', async () => {
    fetchSpaceMock.mockRejectedValueOnce(new Error('Not found'));
    render(
      <MemoryRouter initialEntries={['/space/invalid-id']}>
        <Routes>
          <Route path="/space/:id" element={<SpaceDetails />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/space not found/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /browse spaces/i })).toHaveAttribute('href', '/find');
  });

  it('C20: Booking panel: selecting time slots updates start/end and total', async () => {
    render(
      <MemoryRouter initialEntries={['/space/space-1']}>
        <Routes>
          <Route path="/space/:id" element={<SpaceDetails />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Bright Loft')).toBeInTheDocument());
    const startSlots = screen.getAllByText(/09 AM/);
    const endSlots = screen.getAllByText(/10 AM/);
    if (startSlots.length > 0) fireEvent.click(startSlots[0]);
    await waitFor(() => {});
    if (endSlots.length > 0) fireEvent.click(endSlots[0]);
    await waitFor(() => expect(screen.getByText(/total/i)).toBeInTheDocument());
  });

  it('C21: Submit booking when not logged in triggers redirect to login', async () => {
    mockNavigate.mockClear();
    mockUseAuth.mockReturnValue({ token: null });
    render(
      <MemoryRouter initialEntries={['/space/space-1']}>
        <Routes>
          <Route path="/space/:id" element={<SpaceDetails />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Bright Loft')).toBeInTheDocument());
    const startSlot = screen.getAllByText(/09 AM/)[0];
    const endSlot = screen.getAllByText(/10 AM/)[0];
    if (startSlot) fireEvent.click(startSlot);
    await waitFor(() => {});
    if (endSlot) fireEvent.click(endSlot);
    await waitFor(() => expect(screen.getByRole('button', { name: /instant book|request to book/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /instant book|request to book/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ state: expect.any(Object) }));
  });
});
