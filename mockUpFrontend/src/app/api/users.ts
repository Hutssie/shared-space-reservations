import { apiGet, apiPatch } from './client';

export type MyReview = {
  id: string;
  spaceId: string;
  spaceName: string;
  spaceImage: string | null;
  rating: number;
  text: string;
  createdAt: string;
  cleanliness: number | null;
  communication: number | null;
  location: number | null;
  value: number | null;
};

export function fetchMyReviews(): Promise<MyReview[]> {
  return apiGet<MyReview[]>('/api/users/me/reviews');
}

export function updateMe(data: { name?: string; avatarUrl?: string; professionalTitle?: string; bio?: string }): Promise<{ id: string; email: string; name: string; avatarUrl: string | null; professionalTitle?: string | null; bio?: string | null }> {
  return apiPatch('/api/users/me', data);
}

export type UserSearchResult = { id: string; name: string; avatarUrl: string | null; email: string };

export async function searchUsers(q: string, limit = 10): Promise<UserSearchResult[]> {
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('limit', String(limit));
  const res = await apiGet<{ users: UserSearchResult[] }>(`/api/users/search?${params.toString()}`);
  return res.users;
}

export type PublicHostProfile = {
  user: { id: string; name: string; avatarUrl: string | null; bio: string | null; createdAt: string };
  hostStats: { activeBookings: number; avgListingRating: number | null };
};

export function fetchPublicHostProfile(userId: string): Promise<PublicHostProfile> {
  return apiGet<PublicHostProfile>(`/api/users/${userId}/public`);
}
