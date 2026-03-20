import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ListSpace } from './ListSpace';
import * as spacesApi from '../api/spaces';
import * as placesApi from '../api/places';

vi.mock('../api/spaces', () => ({ createSpace: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../api/client', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../api/client')>();
  return {
    ...orig,
    apiUploadFile: vi.fn().mockResolvedValue({ url: 'https://example.com/uploaded.jpg' }),
  };
});

const createSpaceMock = spacesApi.createSpace as ReturnType<typeof vi.fn>;

const mockSuggestion = {
  label: 'Brooklyn, New York, United States',
  primary: 'Brooklyn',
  secondary: 'New York, United States',
  city: 'Brooklyn',
  state: 'New York',
  country: 'United States',
};

vi.mock('../api/places', () => ({
  fetchPlaceSuggestions: vi.fn(),
}));

vi.mock('./MapView', () => ({
  ListingMap: ({ onPositionChange }: { onPositionChange: (lat: number, lng: number) => void }) => (
    <div data-testid="listing-map">
      <button type="button" onClick={() => onPositionChange(40.65, -73.95)}>Place pin on map</button>
    </div>
  ),
}));

describe('ListSpace', () => {
  beforeEach(() => {
    createSpaceMock.mockResolvedValue({ id: 'new-1', title: 'New Space', category: 'photo', location: 'NY', capacity: 10, price: 75, rating: null, reviews: 0, image: null, images: [], description: '', amenities: [], isInstantBookable: false, host: null });
    (globalThis.URL as any).createObjectURL = () => 'blob:test/1';
    (placesApi.fetchPlaceSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({ suggestions: [mockSuggestion] });
  });

  it('C24: ListSpace: "Complete Listing" on step 4 calls createSpace with form data (mock)', async () => {
    render(
      <MemoryRouter>
        <ListSpace />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /start listing/i }));

    fireEvent.change(screen.getByPlaceholderText(/bright industrial loft/i), { target: { value: 'My Studio' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next step/i })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    await waitFor(() => expect(screen.getByText(/what kind of space/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Photo Studio'));
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    await waitFor(() => expect(screen.getByPlaceholderText(/search for a city or area/i)).toBeInTheDocument());
    const cityInput = screen.getByPlaceholderText(/search for a city or area/i);
    fireEvent.change(cityInput, { target: { value: 'Brooklyn' } });
    await waitFor(() => expect(screen.getByText('Brooklyn')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Brooklyn'));

    await waitFor(() => expect(screen.getByText(/brooklyn, new york, united states/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/123 creative lane/i), { target: { value: '123 Main St' } });
    fireEvent.change(screen.getByPlaceholderText(/11201/i), { target: { value: '11201' } });
    fireEvent.click(screen.getByText(/place pin on map/i));
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    await waitFor(() => expect(screen.getByText(/drop photos here/i)).toBeInTheDocument());
    const dropZone = screen.getByText(/drop photos here/i).closest('div[class*="border-dashed"]');
    const fileInput = dropZone?.querySelector('input[type="file"]');
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } });
    }
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /next step/i });
      expect(btn).not.toBeDisabled();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    await waitFor(() => expect(screen.getByPlaceholderText(/describe your studio/i)).toBeInTheDocument());
    const sqmInput = screen.getByPlaceholderText(/^0$/);
    fireEvent.change(sqmInput, { target: { value: '50' } });
    fireEvent.change(screen.getByPlaceholderText(/describe your studio/i), { target: { value: 'A great space.' } });
    fireEvent.click(screen.getByRole('button', { name: /complete listing/i }));

    await waitFor(() => expect(createSpaceMock).toHaveBeenCalled());
    expect(createSpaceMock).toHaveBeenCalledWith(expect.objectContaining({
      category: 'Photo Studio',
      capacity: 10,
      pricePerHour: 75,
      description: 'A great space.',
      location: 'Brooklyn, New York, United States',
    }));
  });
});
