'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Parse informational and error notices from query parameters
  const noticeParam = searchParams.get('notice');
  const errorParam = searchParams.get('error');

  const getNoticeMessage = () => {
    if (noticeParam === 'password_updated') {
      return 'Password updated successfully. Please sign in with your new credentials.';
    }
    if (noticeParam === 'signed_out') {
      return 'You have been successfully signed out.';
    }
    return null;
  };

  const getErrorMessage = () => {
    if (errorMsg) return errorMsg;
    if (errorParam === 'invalid_recovery_link') {
      return 'The password reset link was invalid, expired, or has already been used. Please request a new link.';
    }
    if (errorParam === 'forbidden') {
      return 'Access denied: Your account does not possess administrator privileges.';
    }
    return null;
  };

  const displayNotice = getNoticeMessage();
  const displayError = getErrorMessage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      router.push('/admin/events');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white border border-neutral-200 rounded-3xl shadow-3xs space-y-6">
      <div className="space-y-1 text-center">
        <div className="w-12 h-12 bg-green-50 text-zim-green rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="font-display font-extrabold text-2xl text-neutral-900">
          ZimKickOff Admin
        </h1>
        <p className="text-xs text-neutral-500">
          Sign in to manage live broadcasts and standalone events.
        </p>
      </div>

      {displayNotice && !displayError && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-xs text-green-800">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p>{displayNotice}</p>
        </div>
      )}

      {displayError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p>{displayError}</p>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4 text-xs">
        <div className="space-y-1.5">
          <label className="font-bold text-neutral-700">Administrator Email</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nyashamadeko@gmail.com"
              className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-bold text-neutral-700">Password</label>
            <Link
              href="/admin/forgot-password"
              className="text-[11px] text-zim-green hover:underline font-semibold"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-zim-green hover:bg-opacity-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
        >
          {loading ? 'Authenticating...' : 'Sign In'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
