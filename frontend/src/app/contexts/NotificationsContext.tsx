import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { Notification } from '../api/notifications';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
} from '../api/notifications';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL_MS = 25000;

type NotificationsContextType = {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  nextCursor: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  loadMore: (cursor: string) => Promise<string | null>;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        fetchNotifications({ limit: 20 }),
        fetchUnreadNotificationCount(),
      ]);
      setNotifications(listRes.notifications);
      setNextCursor(listRes.nextCursor);
      setUnreadCount(countRes.count);
    } catch {
      // ignor erorile de auth/network
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const markRead = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        await apiMarkRead(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignor
      }
    },
    [token]
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await apiMarkAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // ignoram eroarea; facem update optimistic si atat
    }
  }, [token]);

  const loadMore = useCallback(
    async (cursor: string): Promise<string | null> => {
      if (!token) return null;
      try {
        const res = await fetchNotifications({ cursor, limit: 20 });
        setNotifications((prev) => [...prev, ...res.notifications]);
        setNextCursor(res.nextCursor);
        return res.nextCursor;
      } catch {
        return null;
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setNextCursor(null);
      return;
    }
    refresh();
  }, [token, refresh]);

  useEffect(() => {
    if (!token) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [token, refresh]);

  const value: NotificationsContextType = {
    notifications,
    unreadCount,
    isLoading,
    nextCursor,
    refresh,
    markRead,
    markAllRead,
    loadMore,
  };

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (ctx === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
}
