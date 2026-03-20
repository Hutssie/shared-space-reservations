import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UnreadBookingsContextType {
  hasUnreadBookings: boolean;
  markBookingsAsRead: () => void;
  addNewBooking: (bookingId: string) => void;
  newestBookingId: string | null;
  clearNewestBooking: () => void;
}

const UnreadBookingsContext = createContext<UnreadBookingsContextType | undefined>(undefined);

export const UnreadBookingsProvider = ({ children }: { children: ReactNode }) => {
  const [hasUnreadBookings, setHasUnreadBookings] = useState<boolean>(() => {
    const stored = localStorage.getItem('hasUnreadBookings');
    return stored === 'true';
  });
  const [newestBookingId, setNewestBookingId] = useState<string | null>(() => {
    const stored = localStorage.getItem('newestBookingId');
    return (stored && stored.trim()) || null;
  });

  useEffect(() => {
    localStorage.setItem('hasUnreadBookings', String(hasUnreadBookings));
  }, [hasUnreadBookings]);

  useEffect(() => {
    if (newestBookingId) localStorage.setItem('newestBookingId', newestBookingId);
    else localStorage.removeItem('newestBookingId');
  }, [newestBookingId]);

  const markBookingsAsRead = () => {
    setHasUnreadBookings(false);
  };

  const addNewBooking = (bookingId: string) => {
    const id = bookingId ? String(bookingId).trim() : null;
    if (!id) return;
    setHasUnreadBookings(true);
    setNewestBookingId(id);
    localStorage.setItem('hasUnreadBookings', 'true');
    localStorage.setItem('newestBookingId', id);
  };

  const clearNewestBooking = () => {
    setNewestBookingId(null);
  };

  return (
    <UnreadBookingsContext.Provider value={{ hasUnreadBookings, markBookingsAsRead, addNewBooking, newestBookingId, clearNewestBooking }}>
      {children}
    </UnreadBookingsContext.Provider>
  );
};

export const useUnreadBookings = () => {
  const context = useContext(UnreadBookingsContext);
  if (context === undefined) {
    throw new Error('useUnreadBookings must be used within an UnreadBookingsProvider');
  }
  return context;
};
