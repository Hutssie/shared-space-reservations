import { apiGet, apiPost, apiDelete } from './client';

export type Favorite = {
  id: string;
  spaceId?: string;
  name: string;
  location: string;
  rating: number | null;
  reviews: number;
  price: number;
  image: string | null;
};

export function fetchFavorites(): Promise<Favorite[]> {
  return apiGet<Favorite[]>('/api/favorites');
}

export function addFavorite(spaceId: string): Promise<{ spaceId: string }> {
  return apiPost<{ spaceId: string }>('/api/favorites', { space_id: spaceId });
}

export function removeFavorite(spaceId: string): Promise<void> {
  return apiDelete(`/api/favorites/${spaceId}`);
}
