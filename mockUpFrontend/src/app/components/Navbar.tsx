import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Menu, User, Bell as BellIcon, X, ChevronRight, LogIn, UserPlus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { NotificationsDropdown } from './NotificationsDropdown';
import { motion, AnimatePresence } from 'motion/react';
import { UserMenuDropdown } from './UserMenuDropdown';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ onOpenAI }: { onOpenAI: () => void }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authDropdownOpen, setAuthDropdownOpen] = useState(false);
  const authDropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const isAuthenticated = !!token;
  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (authDropdownRef.current && !authDropdownRef.current.contains(e.target as Node)) {
        setAuthDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { name: 'Find a Space', path: '/find' },
    { name: 'List your Space', path: '/list-your-space' },
    ...(isAuthenticated ? [{ name: 'Host Portal', path: '/host' }] : []),
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
        <div className="max-w-[1600px] mx-auto px-4 md:px-12">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center shrink-0">
              <Link 
                to="/"
                className="text-2xl font-black tracking-tight text-brand-700 hover:opacity-80 transition-opacity relative z-10 p-1 -m-1"
              >
                SPACE<span className="text-brand-400">BOOK</span>
              </Link>
            </div>
            
            <div className="hidden md:flex items-center space-x-10">
              {navLinks.map((link) => (
                <Link 
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-black uppercase tracking-wider transition-colors ${isActive(link.path) ? 'text-brand-400' : 'text-brand-700 hover:text-brand-400'}`}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="flex items-center space-x-3 md:space-x-6">
              <button 
                onClick={onOpenAI}
                className="flex items-center gap-2 px-4 md:px-6 py-2.5 bg-brand-700 hover:bg-brand-600 text-white rounded-full transition-all shadow-lg shadow-brand-700/10 active:scale-95 cursor-pointer group"
              >
                <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">AI Search</span>
              </button>
              
              <div className="hidden sm:flex items-center space-x-4">
                {isAuthenticated && (
                  <NotificationsDropdown 
                    trigger={
                      <button className="p-2 text-brand-700 hover:bg-brand-100 rounded-full transition-colors cursor-pointer relative group">
                        <BellIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-500 rounded-full border-2 border-white animate-pulse" />
                      </button>
                    }
                  />
                )}
                {isAuthenticated ? (
                  <UserMenuDropdown />
                ) : (
                  <div className="relative" ref={authDropdownRef}>
                    <button 
                      onClick={() => setAuthDropdownOpen(!authDropdownOpen)}
                      className="flex items-center space-x-3 border-2 border-brand-100 rounded-full py-2 px-4 hover:shadow-xl hover:border-brand-300 transition-all cursor-pointer bg-white"
                    >
                      <Menu className="w-5 h-5 text-brand-700" />
                      <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center text-white">
                        <User className="w-5 h-5" />
                      </div>
                    </button>
                    <AnimatePresence>
                      {authDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 15, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 15, scale: 0.95 }}
                          className="absolute right-0 mt-4 w-56 bg-white rounded-[2.5rem] shadow-2xl border border-brand-100 overflow-hidden z-[100] p-3"
                        >
                          <button
                            onClick={() => { setAuthDropdownOpen(false); navigate('/auth/login'); }}
                            className="w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-brand-700 hover:bg-brand-50 transition-all cursor-pointer"
                          >
                            <LogIn className="w-5 h-5 text-brand-500" />
                            Sign in
                            <ChevronRight className="w-4 h-4 ml-auto text-brand-300" />
                          </button>
                          <button
                            onClick={() => { setAuthDropdownOpen(false); navigate('/auth/register'); }}
                            className="w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-brand-700 hover:bg-brand-50 transition-all cursor-pointer"
                          >
                            <UserPlus className="w-5 h-5 text-brand-500" />
                            Sign up
                            <ChevronRight className="w-4 h-4 ml-auto text-brand-300" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-brand-700 hover:bg-brand-100 rounded-xl transition-colors cursor-pointer md:hidden"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[300px] bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-brand-100 flex items-center justify-between">
                <Link 
                  to="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-xl font-black text-brand-700 tracking-tight"
                >
                  SPACE<span className="text-brand-400">BOOK</span>
                </Link>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6 text-brand-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                {navLinks.map((link) => (
                  <Link 
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block p-4 rounded-2xl font-black uppercase tracking-wider transition-all ${isActive(link.path) ? 'bg-brand-700 text-white shadow-lg' : 'text-brand-700 hover:bg-brand-50'}`}
                  >
                    {link.name}
                  </Link>
                ))}

                <div className="pt-6 mt-6 border-t border-brand-100">
                  {isAuthenticated ? (
                    <div className="space-y-2">
                      <Link 
                        to="/dashboard"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-4 p-4 rounded-2xl font-black text-brand-700 hover:bg-brand-50"
                      >
                        <User className="w-5 h-5" />
                        Dashboard
                      </Link>
                      <Link 
                        to="/dashboard?tab=Notifications"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center justify-between p-4 rounded-2xl font-black text-brand-700 hover:bg-brand-50"
                      >
                        <div className="flex items-center gap-4">
                          <BellIcon className="w-5 h-5" />
                          Notifications
                        </div>
                        <span className="w-2.5 h-2.5 bg-brand-500 rounded-full border-2 border-white animate-pulse" />
                      </Link>
                      <button 
                        onClick={() => {
                          logout();
                          setIsMobileMenuOpen(false);
                          navigate('/');
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl font-black text-red-500 hover:bg-red-50 text-left cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Link 
                        to="/auth/login"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-4 p-4 rounded-2xl font-black text-brand-700 hover:bg-brand-50"
                      >
                        <LogIn className="w-5 h-5" />
                        Sign in
                      </Link>
                      <Link 
                        to="/auth/register"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-4 p-4 rounded-2xl font-black text-brand-700 hover:bg-brand-50"
                      >
                        <UserPlus className="w-5 h-5" />
                        Sign up
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-brand-50">
                <p className="text-xs font-bold text-brand-300 uppercase tracking-widest text-center">
                  © 2026 SpaceBook Inc.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
