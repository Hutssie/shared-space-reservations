import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { FindSpace } from './FindSpace';
import { AuthProvider } from '../context/AuthContext';
import * as spacesApi from '../api/spaces';

vi.mock('../api/spaces', () => ({
  fetchSpaces: vi.fn(),
}));
vi.mock('../api/places', () => ({
  fetchPlaceSuggestions: vi.fn().mockResolvedValue({ suggestions: [] }),
}));

const fetchSpacesMock = spacesApi.fetchSpaces as ReturnType<typeof vi.fn>;

const renderFindSpace = (initialEntries: string[] = ['/find']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <FindSpace />
      </AuthProvider>
    </MemoryRouter>
  );

describe('FindSpace', () => {
  beforeEach(() => {
    fetchSpacesMock.mockResolvedValue({
      spaces: [
        { id: '1', title: 'Studio One', category: 'Photo Studio', location: 'Brooklyn', capacity: 10, price: 100, rating: 4.5, reviews: 20, image: null, description: '', amenities: [], images: [], isInstantBookable: true, host: null },
      ],
      total: 1,
    });
  });

  it('C15: Renders search input and filter controls', async () => {
    renderFindSpace();
    await waitFor(() => expect(fetchSpacesMock).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(/search by city or location/i)).toBeInTheDocument();
    expect(screen.getByText(/space type/i)).toBeInTheDocument();
  });

  it('C16: With mocked fetchSpaces: displays loading then space cards', async () => {
    renderFindSpace();
    expect(screen.getByText(/loading spaces/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Studio One')).toBeInTheDocument());
  });

  it('C17: URL query params (location, category) trigger fetch with correct params', async () => {
    renderFindSpace(['/find?location=Craiova%2C%20Romania&category=Photo%20Studio']);
    await waitFor(() => expect(fetchSpacesMock).toHaveBeenCalled());
    expect(fetchSpacesMock).toHaveBeenCalledWith(expect.objectContaining({
      location: 'Craiova, Romania',
      category: 'Photo Studio',
    }));
  });
});
