import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '../api/auth';
import { getStoredToken, getStoredUser, clearAuth } from '../api/auth';
import { apiGet } from '../api/client';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(getStoredUser);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isLoading, setIsLoading] = useState(!!getStoredToken());

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (!u) setToken(null);
  }, []);

  const setAuth = useCallback((t: string, u: User) => {
    setToken(t);
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUserState(null);
    setToken(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiGet<User>('/api/users/me')
      .then((u) => {
        setUserState(u);
        setToken(token);
      })
      .catch(() => {
        clearAuth();
        setUserState(null);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    const onLogout = () => logout();
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [logout]);

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    setUser,
    setAuth,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
