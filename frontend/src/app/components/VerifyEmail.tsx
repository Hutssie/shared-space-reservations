import React, { useState, useEffect } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ImageWithFallback } from './ImageWithFallback';
import { verifyEmail } from '../api/auth';

const VERIFIED_CACHE_PREFIX = 'spacebook-email-verified:';

export const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification link is invalid.');
      return;
    }

    const cacheKey = `${VERIFIED_CACHE_PREFIX}${token}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setStatus('success');
      setMessage(cached);
      return;
    }

    let cancelled = false;

    verifyEmail(token)
      .then((res) => {
        if (cancelled) return;
        sessionStorage.setItem(cacheKey, res.message);
        setStatus('success');
        setMessage(res.message);
        toast.success('Email verified!');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed.');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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
          <div className="lg:hidden mb-12">
            <Link to="/" className="text-2xl font-black text-brand-700">SPACE<span className="text-brand-400">BOOK</span></Link>
          </div>

          {status === 'loading' && (
            <div className="py-12">
              <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-700 rounded-full animate-spin mx-auto mb-6" />
              <p className="text-brand-500 font-medium">Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-brand-700 mb-3">Email verified</h1>
              <p className="text-brand-400 font-medium mb-8">{message}</p>
              <button
                type="button"
                onClick={() => navigate('/auth/login', { replace: true })}
                className="inline-flex items-center gap-2 px-8 py-4 bg-brand-700 hover:bg-brand-600 text-white font-black rounded-2xl transition-all cursor-pointer"
              >
                Sign in
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-200">
              <h2 className="text-xl font-black text-amber-800 mb-2">Verification failed</h2>
              <p className="text-amber-700 font-medium mb-6">{message}</p>
              <Link
                to="/auth/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-700 text-white font-black rounded-xl hover:bg-brand-600 transition-all"
              >
                Back to sign up
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
