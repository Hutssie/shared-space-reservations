const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const BOOKING_SLOT_CONFLICT_MESSAGE = 'Time slot is already booked';

function friendlyApiError(status: number, body: { error?: string }, fallback: string): string {
  const raw = (body.error || fallback).trim();
  if (status === 409 && /exclusion constraint|23P01|bookings_no_confirmed_overlap/i.test(raw)) {
    return BOOKING_SLOT_CONFLICT_MESSAGE;
  }
  if (/prisma\.|ConnectorError|Invalid `prisma\./i.test(raw)) {
    return status >= 500 ? 'Something went wrong. Please try again.' : fallback;
  }
  return raw || fallback;
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(friendlyApiError(res.status, body, res.statusText || 'Request failed'));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string, init?: RequestInit) => api<T>(path, { method: 'GET', ...init });
export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined });
export const apiPatch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined });
export const apiDelete = (path: string) => api<void>(path, { method: 'DELETE' });

export async function apiUploadFile(file: File): Promise<{ url: string }> {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(friendlyApiError(res.status, body, res.statusText || 'Upload failed'));
  }
  return res.json() as Promise<{ url: string }>;
}
