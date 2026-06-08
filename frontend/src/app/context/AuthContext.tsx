import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '../api/auth';
import { getStoredToken, getStoredUser, clearAuth } from '../api/auth';
import { apiGet } from '../api/client';
import { appNavigate } from '../navigation';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  pendingLogout: boolean;
  setUser: (user: User | null) => void;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  finalizeLogout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(getStoredUser);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isLoading, setIsLoading] = useState(!!getStoredToken());
  const [pendingLogout, setPendingLogout] = useState(false);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (!u) setToken(null);
  }, []);

  const setAuth = useCallback((t: string, u: User) => {
    setToken(t);
    setUserState(u);
  }, []);

  const clearSession = useCallback(() => {
    clearAuth();
    setUserState(null);
    setToken(null);
  }, []);

  const finalizeLogout = useCallback(() => {
    setPendingLogout(false);
    clearSession();
  }, [clearSession]);

  const logout = useCallback(() => {
    setPendingLogout(true);
    appNavigate('/', { replace: true });
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
        clearSession();
      })
      .finally(() => setIsLoading(false));
  }, [token, clearSession]);

  useEffect(() => {
    const onForcedLogout = () => clearSession();
    window.addEventListener('auth:logout', onForcedLogout);
    return () => window.removeEventListener('auth:logout', onForcedLogout);
  }, [clearSession]);

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    pendingLogout,
    setUser,
    setAuth,
    logout,
    finalizeLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
