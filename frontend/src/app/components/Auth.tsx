import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, Chrome, Eye, EyeOff, CheckCircle2, X } from 'lucide-react';
import AppleIcon from '@mui/icons-material/Apple';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ImageWithFallback } from './ImageWithFallback';
import { useNavigate, useLocation, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { login, register as registerApi, saveAuth, requestPasswordReset, fetchPublicStats } from '../api/auth';
import { validatePassword } from '../utils/passwordValidation';

export const Auth = ({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuth();
  const [stats, setStats] = useState<{ spaces: number; users: number; cities: number } | null>(null);

  useEffect(() => {
    fetchPublicStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      const pwValidation = validatePassword(password);
      if (!pwValidation.valid) {
        toast.error(pwValidation.error);
        return;
      }
    }
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { token, user } = await login(email, password);
        saveAuth(token, user);
        setAuth(token, user);
        const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } else {
        const { token, user } = await registerApi(email, password, name);
        saveAuth(token, user);
        setAuth(token, user);
        navigate('/auth/onboarding', { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* Partea stanga: branding si imagine */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-700 overflow-hidden p-16 flex-col justify-between">
        <div className="absolute inset-0 z-0 opacity-50">
          <ImageWithFallback 
            src="https://images.unsplash.com/photo-1760822508874-d71b1f9a4d8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYXJjaGl0ZWN0dXJlJTIwc3Vuc2V0JTIwd2FybXxlbnwxfHx8fDE3NzE0MDQyMjR8MA&ixlib=rb-4.1.0&q=80&w=1200" 
            alt="Warm architectural space" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-700 via-brand-700/20 to-transparent" />
        </div>

        <div className="relative z-10">
          <Link 
            to="/"
            className="text-2xl font-black text-white cursor-pointer hover:opacity-80 transition-opacity"
          >
            SPACE<span className="text-brand-200">BOOK</span>
          </Link>
        </div>

        <div className="relative z-10">
          <h2 className="text-5xl font-black text-white mb-6 leading-tight">
            {mode === 'login' ? 'Welcome back to your creative home.' : 'Start your journey with us.'}
          </h2>
          <p className="text-brand-100 text-xl font-medium max-w-md">
            Join a community of thousands of creators finding and listing unique spaces worldwide.
          </p>
        </div>

        <div className="relative z-10 flex gap-12 text-white/60 text-sm font-bold tracking-widest uppercase">
          <div className="flex flex-col gap-2">
            <span className="text-brand-200 text-2xl font-black">
              {stats ? formatCount(stats.spaces) : '—'}
            </span>
            <span>Spaces</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-brand-200 text-2xl font-black">
              {stats ? formatCount(stats.users) : '—'}
            </span>
            <span>Creators</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-brand-200 text-2xl font-black">
              {stats ? formatCount(stats.cities) : '—'}
            </span>
            <span>Cities</span>
          </div>
        </div>
      </div>

      {/* Partea dreapta: formularul */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-24 py-12 bg-white">
        <div className="max-w-md w-full mx-auto">
          <div className="lg:hidden mb-12">
            <Link to="/" className="text-2xl font-black text-brand-700">SPACE<span className="text-brand-400">BOOK</span></Link>
          </div>

          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-black text-brand-700 mb-2">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </h1>
            <p className="text-brand-400 font-medium">
              {mode === 'login' 
                ? "Don't have an account? " 
                : "Already have an account? "}
              <button 
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-brand-500 font-bold hover:underline"
              >
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div>
                    <label className="block text-xs font-black text-brand-700 uppercase tracking-widest mb-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
                      <input 
                        type="text" 
                        placeholder="John Doe" 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-brand-100 border-none rounded-2xl focus:ring-2 focus:ring-brand-400 text-brand-700 placeholder:text-brand-300 transition-all font-medium"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-black text-brand-700 uppercase tracking-widest mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
                <input 
                  type="email" 
                  placeholder="hello@example.com" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-brand-100 border-none rounded-2xl focus:ring-2 focus:ring-brand-400 text-brand-700 placeholder:text-brand-300 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-xs font-black text-brand-700 uppercase tracking-widest">Password</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => setShowForgotModal(true)} className="text-xs font-bold text-brand-400 hover:text-brand-500 transition-colors cursor-pointer">Forgot password?</button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-brand-100 border-none rounded-2xl focus:ring-2 focus:ring-brand-400 text-brand-700 placeholder:text-brand-300 transition-all font-medium"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-300 hover:text-brand-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="mt-1.5 text-xs text-brand-400 font-medium">At least 8 characters, including one uppercase letter.</p>
              )}
            </div>

            <button 
              type="submit"
              disabled={submitting}
              className="w-full py-5 bg-brand-700 hover:bg-brand-600 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-brand-700/10 active:scale-95 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-70"
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase font-black tracking-widest">
              <span className="bg-white px-4 text-brand-300">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-3 py-4 border-2 border-brand-100 rounded-2xl hover:bg-brand-50 hover:border-brand-200 transition-all font-bold text-brand-700 group cursor-pointer">
              <Chrome className="w-5 h-5 text-brand-700" />
              Google
            </button>
            <button className="flex items-center justify-center gap-3 py-4 border-2 border-brand-100 rounded-2xl hover:bg-brand-50 hover:border-brand-200 transition-all font-bold text-brand-700 group cursor-pointer">
              <AppleIcon className="w-5 h-5 text-brand-700" />
              Apple
            </button>
          </div>

          <p className="mt-10 text-center text-xs text-brand-300 font-medium px-8 leading-relaxed">
            By continuing, you agree to SpaceBook's <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* Modalul pentru parola uitata */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!forgotSubmitting) {
                  setShowForgotModal(false);
                  setForgotSuccess(false);
                  setForgotEmail('');
                }
              }}
              className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border-2 border-brand-200 p-8 sm:p-10"
            >
              {forgotSuccess ? (
                <div className="space-y-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotSuccess(false);
                      setForgotEmail('');
                    }}
                    className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center text-brand-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex flex-col items-center text-center pt-4">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-brand-700 mb-2">Check Your Email</h3>
                    <p className="text-brand-400 font-medium mb-2">We&apos;ve sent a password reset link to:</p>
                    <p className="font-black text-brand-700 text-lg mb-6">{forgotEmail}</p>
                    <div className="w-full p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-6 text-left">
                      <p className="text-sm text-brand-700 font-medium">
                        Didn&apos;t receive the email? Check your spam folder or try again with a different email address.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotModal(false);
                        setForgotSuccess(false);
                        setForgotEmail('');
                      }}
                      className="w-full px-6 py-4 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-xl sm:rounded-2xl transition-all cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-brand-50 rounded-2xl shrink-0">
                      <Lock className="w-6 h-6 text-brand-700" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-xl sm:text-2xl font-black text-brand-700">Reset Password</h3>
                      <p className="text-sm sm:text-base text-brand-400 font-medium leading-relaxed">
                        Enter your email and we&apos;ll send you a link to reset your password.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-brand-700 uppercase tracking-widest mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
                      <input
                        type="email"
                        placeholder="hello@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-brand-100 border-none rounded-2xl focus:ring-2 focus:ring-brand-400 text-brand-700 placeholder:text-brand-300 transition-all font-medium"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotModal(false);
                        setForgotSuccess(false);
                        setForgotEmail('');
                      }}
                      disabled={forgotSubmitting}
                      className="flex-1 px-6 py-4 bg-brand-50 text-brand-700 font-black rounded-xl sm:rounded-2xl hover:bg-brand-100 transition-all cursor-pointer disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!forgotEmail.trim()) {
                          toast.error('Please enter your email');
                          return;
                        }
                        setForgotSubmitting(true);
                        try {
                          await requestPasswordReset(forgotEmail.trim());
                          setForgotSuccess(true);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Something went wrong');
                        } finally {
                          setForgotSubmitting(false);
                        }
                      }}
                      disabled={forgotSubmitting}
                      className="flex-1 px-6 py-4 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-xl sm:rounded-2xl shadow-lg shadow-brand-700/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                    >
                      {forgotSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
