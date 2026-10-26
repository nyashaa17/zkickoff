'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordForm() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    // Check for an active session or listen for PASSWORD_RECOVERY auth event
    async function checkSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          // If no active session yet, wait briefly for auth hash/callback token processing
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (!mounted) return;
            if (
              event === 'PASSWORD_RECOVERY' ||
              (event === 'SIGNED_IN' && newSession) ||
              (event === 'INITIAL_SESSION' && newSession)
            ) {
              setHasValidSession(true);
              setSessionChecking(false);
            }
          });

          // Timeout check: if no recovery session recognized after 2.5s, mark invalid
          setTimeout(() => {
            if (mounted) {
              setSessionChecking((currentChecking) => {
                if (currentChecking) {
                  setHasValidSession(false);
                }
                return false;
              });
            }
          }, 2500);

          return () => {
            subscription.unsubscribe();
          };
        }

        if (mounted) {
          setHasValidSession(true);
          setSessionChecking(false);
        }
      } catch (err) {
        if (mounted) {
          setHasValidSession(false);
          setSessionChecking(false);
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErrorMsg(null);

    // Validation 1: Minimum password length
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters in length.');
      return;
    }

    // Validation 2: Passwords match
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to update password. Your recovery link may have expired.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Sign out the recovery session and redirect to login with confirmation
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push('/admin/login?notice=password_updated');
      }, 1500);
    } catch (err: any) {
      console.error('[Password Update Error]:', err?.message || err);
      setErrorMsg('An unexpected error occurred while updating your password. Please try again.');
      setLoading(false);
    }
  };

  // State 1: Checking session token
  if (sessionChecking) {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-white border border-neutral-200 rounded-3xl shadow-3xs space-y-4 text-center">
        <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
          <Lock className="w-6 h-6 text-neutral-400" />
        </div>
        <p className="text-xs text-neutral-500 font-medium">Verifying recovery authorization...</p>
      </div>
    );
  }

  // State 2: Invalid or expired session
  if (!hasValidSession && !success) {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-white border border-neutral-200 rounded-3xl shadow-3xs space-y-6 text-center">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-display font-extrabold text-xl text-neutral-900">
            Recovery Link Expired or Invalid
          </h1>
          <p className="text-xs text-neutral-500 leading-relaxed max-w-xs mx-auto">
            This password reset link is invalid, expired, or has already been used. For your security, password reset links are single-use and time-limited.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            href="/admin/forgot-password"
            className="w-full py-2.5 bg-zim-green hover:bg-opacity-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            Request New Reset Link
          </Link>
          <Link
            href="/admin/login"
            className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition-all"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // State 3: Password updated successfully
  if (success) {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-white border border-neutral-200 rounded-3xl shadow-3xs space-y-6 text-center">
        <div className="w-12 h-12 bg-green-50 text-zim-green rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-xl text-neutral-900">
            Password Updated
          </h1>
          <p className="text-xs text-neutral-500">
            Your administrator password has been updated successfully. Redirecting to sign in...
          </p>
        </div>
      </div>
    );
  }

  // State 4: Valid recovery session, present password form
  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white border border-neutral-200 rounded-3xl shadow-3xs space-y-6">
      <div className="space-y-1 text-center">
        <div className="w-12 h-12 bg-green-50 text-zim-green rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="font-display font-extrabold text-2xl text-neutral-900">
          Set New Password
        </h1>
        <p className="text-xs text-neutral-500">
          Enter your new administrator password below.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handlePasswordUpdate} className="space-y-4 text-xs">
        <div className="space-y-1.5">
          <label className="font-bold text-neutral-700">New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs"
            />
          </div>
          <p className="text-[11px] text-neutral-400">Must be at least 8 characters.</p>
        </div>

        <div className="space-y-1.5">
          <label className="font-bold text-neutral-700">Confirm New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? 'Updating Password...' : 'Update Password'}
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="text-center pt-2">
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cancel and Return to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}
