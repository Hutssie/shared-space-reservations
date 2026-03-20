import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const Consumer = () => {
  const { user, token, isLoading, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.name : 'null'}</span>
      <span data-testid="token">{token ?? 'null'}</span>
      <span data-testid="loading">{isLoading ? 'true' : 'false'}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('C5: AuthProvider with no token: user and token null, isLoading false after mount', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('C6: AuthProvider with token in localStorage: calls GET /api/users/me, then sets user', async () => {
    localStorage.setItem('token', 'abc');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'x@y.com', name: 'Old', avatarUrl: null }));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ id: '1', email: 'x@y.com', name: 'Current', avatarUrl: null }),
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Current');
    });
    expect(screen.getByTestId('token').textContent).toBe('abc');
  });

  it('C7: logout() clears user and token', async () => {
    localStorage.setItem('token', 'x');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'User', avatarUrl: null }));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ id: '1', email: 'a@b.com', name: 'User', avatarUrl: null }),
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('User'));

    fireEvent.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
      expect(screen.getByTestId('token').textContent).toBe('null');
    });
  });
});
