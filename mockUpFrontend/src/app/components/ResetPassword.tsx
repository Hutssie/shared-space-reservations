import React, { useState } from 'react';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { resetPassword } from '../api/auth';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../utils/passwordValidation';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const pwValidation = validatePassword(newPassword);
    if (!pwValidation.valid) {
      toast.error(pwValidation.error);
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      toast.success('Your password has changed successfully.');
      navigate('/auth/login', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-white flex flex-col lg:flex-row">
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
            <Link to="/" className="text-2xl font-black text-white cursor-pointer hover:opacity-80 transition-opacity">
              SPACE<span className="text-brand-200">BOOK</span>
            </Link>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-24 py-12 bg-white">
          <div className="max-w-md w-full mx-auto text-center">
            <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-200 mb-8">
              <h2 className="text-xl font-black text-amber-800 mb-2">Invalid or expired link</h2>
              <p className="text-amber-700 font-medium mb-6">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-700 text-white font-black rounded-xl hover:bg-brand-600 transition-all"
              >
                Back to Sign In
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
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
          <Link to="/" className="text-2xl font-black text-white cursor-pointer hover:opacity-80 transition-opacity">
            SPACE<span className="text-brand-200">BOOK</span>
          </Link>
        </div>
        <div className="relative z-10">
          <h2 className="text-5xl font-black text-white mb-6 leading-tight">Set a new password.</h2>
          <p className="text-brand-100 text-xl font-medium max-w-md">
            Choose a strong password to secure your account.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-24 py-12 bg-white">
        <div className="max-w-md w-full mx-auto">
          <div className="lg:hidden mb-12">
            <Link to="/" className="text-2xl font-black text-brand-700">SPACE<span className="text-brand-400">BOOK</span></Link>
          </div>

          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-black text-brand-700 mb-2">Reset Password</h1>
            <p className="text-brand-400 font-medium">
              Enter your new password below.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-black text-brand-700 uppercase tracking-widest mb-2">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-brand-100 border-none rounded-2xl focus:ring-2 focus:ring-brand-400 text-brand-700 placeholder:text-brand-300 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-300 hover:text-brand-500 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-brand-400 font-medium">At least 8 characters, including one uppercase letter.</p>
            </div>

            <div>
              <label className="block text-xs font-black text-brand-700 uppercase tracking-widest mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-brand-100 border-none rounded-2xl focus:ring-2 focus:ring-brand-400 text-brand-700 placeholder:text-brand-300 transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-5 bg-brand-700 hover:bg-brand-600 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-brand-700/10 active:scale-95 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-70"
            >
              {submitting ? 'Please wait...' : 'Reset Password'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <p className="mt-10 text-center">
            <Link to="/auth/login" className="text-brand-500 font-bold hover:text-brand-700 transition-colors">
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
