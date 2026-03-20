import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = useAuth as ReturnType<typeof vi.fn>;

const Dashboard = () => <div>Dashboard content</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('C8: Renders children when token present', () => {
    useAuthMock.mockReturnValue({ token: 'abc', isLoading: false });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('C9: Redirects to /auth/login when no token', () => {
    useAuthMock.mockReturnValue({ token: null, isLoading: false });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/auth/login" element={<div>Login page</div>} />
          <Route path="*" element={<div>Fallback</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('C10: Shows loading state while isLoading true', () => {
    useAuthMock.mockReturnValue({ token: 'x', isLoading: true });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
