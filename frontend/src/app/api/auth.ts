import { apiPost, apiGet } from './client';

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  professionalTitle?: string | null;
  bio?: string | null;
  role?: 'user' | 'admin';
};

export type AuthResponse = {
  token: string;
  user: User;
};

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiPost<AuthResponse>('/api/auth/login', { email, password });
}

export async function register(email: string, password: string, name: string): Promise<AuthResponse> {
  return apiPost<AuthResponse>('/api/auth/register', { email, password, name });
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>('/api/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiPost<{ success: boolean }>('/api/auth/reset-password', { token, newPassword });
}

export function fetchPublicStats(): Promise<{ spaces: number; users: number; cities: number }> {
  return apiGet<{ spaces: number; users: number; cities: number }>('/api/stats');
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiPost<{ success: boolean }>('/api/auth/change-password', { currentPassword, newPassword });
}

export function saveAuth(token: string, user: User): void {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('isLoggedIn', 'true');
}

export function clearAuth(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isLoggedIn');
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem('token');
}
