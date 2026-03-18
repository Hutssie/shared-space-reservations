import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Package, 
  Heart, 
  MessageSquare, 
  Bell as BellIcon,
  Star,
  CreditCard, 
  Settings, 
  LogOut, 
  ChevronRight,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useUnreadBookings } from '../contexts/UnreadBookingsContext';
import { UnreadBadge } from './ui/UnreadBadge';

export const UserMenuDropdown = () => {
  const { user, logout } = useAuth();
  const { hasUnreadBookings } = useUnreadBookings();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { label: 'My Bookings', icon: Package, tab: 'My Bookings' },
    { label: 'Favorites', icon: Heart, tab: 'Favorites' },
    { label: 'Messages', icon: MessageSquare, tab: 'Messages' },
    { label: 'Notifications', icon: BellIcon, tab: 'Notifications' },
    { label: 'Reviews', icon: Star, tab: 'Reviews' },
    { label: 'Billing', icon: CreditCard, tab: 'Billing' },
    { label: 'Settings', icon: Settings, tab: 'Settings' },
  ];

  const handleNavigate = (tab: string) => {
    navigate(`/dashboard?tab=${encodeURIComponent(tab)}`);
    setIsOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsOpen(false);
    window.location.reload(); // Force refresh to update navbar state
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 border-2 border-brand-100 rounded-full py-2 px-4 hover:shadow-xl hover:border-brand-300 transition-all cursor-pointer bg-white relative"
      >
        <UnreadBadge show={hasUnreadBookings} position="top-right" size="md" />
        <Menu className="w-5 h-5 text-brand-700" />
        <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center text-white">
          <User className="w-5 h-5" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="absolute right-0 mt-4 w-72 bg-white rounded-[2.5rem] shadow-2xl border border-brand-100 overflow-hidden z-[100] p-3"
          >
            <div className="px-6 py-6 border-b border-brand-50 mb-2">
              <p className="text-xs font-black text-brand-400 uppercase tracking-[0.2em] mb-1">Signed in as</p>
              <p className="font-black text-brand-700">{user?.name ?? 'User'}</p>
            </div>

            <div className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavigate(item.tab)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl font-bold text-brand-500 hover:bg-brand-50 hover:text-brand-700 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3 relative">
                    <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {item.label}
                    {item.label === 'My Bookings' && (
                      <UnreadBadge show={hasUnreadBookings} position="inline" size="sm" />
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </button>
              ))}
            </div>

            <div className="mt-2 pt-2 border-t border-brand-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
