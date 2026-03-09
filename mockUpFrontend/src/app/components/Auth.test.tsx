import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Auth } from './Auth';
import { AuthProvider } from '../context/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>();
  return {
    getStoredUser: actual.getStoredUser,
    getStoredToken: actual.getStoredToken,
    clearAuth: actual.clearAuth,
    login: vi.fn(),
    register: vi.fn(),
    saveAuth: vi.fn(),
  };
});

import { login, register as registerApi } from '../api/auth';

const loginMock = login as ReturnType<typeof vi.fn>;
const registerMock = registerApi as ReturnType<typeof vi.fn>;

const renderAuth = (initialMode: 'login' | 'register' = 'login') =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Auth initialMode={initialMode} />
      </AuthProvider>
    </MemoryRouter>
  );

describe('Auth form', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    loginMock.mockReset();
    registerMock.mockReset();
  });

  it('C11: Login form: submit with empty email/password shows validation or error', () => {
    renderAuth('login');
    const submit = screen.getByRole('button', { name: /sign in/i });
    expect(submit).toBeInTheDocument();
    fireEvent.click(submit);
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('C12: Login form: submit with valid data calls login API and navigate (mock API)', async () => {
    loginMock.mockResolvedValueOnce({ token: 't', user: { id: '1', email: 'a@b.com', name: 'A', avatarUrl: null } });
    renderAuth('login');
    fireEvent.change(screen.getByPlaceholderText(/hello@example\.com/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await vi.waitFor(() => expect(loginMock).toHaveBeenCalledWith('a@b.com', 'password123'));
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('C13: Register form: name field visible in register mode', () => {
    renderAuth('register');
    expect(screen.getByPlaceholderText(/john doe/i)).toBeInTheDocument();
  });

  it('C14: Toggle between login and register updates form fields', () => {
    renderAuth('login');
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(screen.getByPlaceholderText(/john doe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });
});
