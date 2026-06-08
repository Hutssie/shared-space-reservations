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
  favoritedAt?: string;
};

export function sortFavoritesByRecent(favorites: Favorite[]): Favorite[] {
  return [...favorites].sort((a, b) => {
    const aTime = a.favoritedAt ? Date.parse(a.favoritedAt) : 0;
    const bTime = b.favoritedAt ? Date.parse(b.favoritedAt) : 0;
    return bTime - aTime;
  });
}

export function fetchFavorites(): Promise<Favorite[]> {
  return apiGet<Favorite[]>('/api/favorites');
}

export function addFavorite(spaceId: string): Promise<{ spaceId: string }> {
  return apiPost<{ spaceId: string }>('/api/favorites', { space_id: spaceId });
}

export function removeFavorite(spaceId: string): Promise<void> {
  return apiDelete(`/api/favorites/${spaceId}`);
}
