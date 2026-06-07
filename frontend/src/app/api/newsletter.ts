import { apiPost } from './client';

export async function subscribeNewsletter(email: string): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>('/api/newsletter/subscribe', { email });
}
