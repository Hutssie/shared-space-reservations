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
