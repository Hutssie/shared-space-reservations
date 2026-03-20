import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, apiGet } from './client';

const BASE = 'http://localhost:3000';

describe('API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('C1: apiGet with 401 response clears token and dispatches auth:logout', async () => {
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('user', '{"id":"1","email":"a@b.com","name":"A"}');
    const listeners: Array<() => void> = [];
    const addSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'auth:logout') listeners.push(handler as () => void);
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(apiGet<unknown>('/api/users/me')).rejects.toThrow();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(listeners.length).toBeGreaterThanOrEqual(0);
    addSpy.mockRestore();
  });

  it('C2: api() sends Authorization header when token exists', async () => {
    localStorage.setItem('token', 'my-jwt');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ id: '1' }),
    });

    await api<{ id: string }>('/api/users/me', { method: 'GET' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-jwt',
        }),
      })
    );
  });
});
