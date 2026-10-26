'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // Derived strictly from window.location.origin targeting the trusted internal callback
      const redirectUrl = `${window.location.origin}/auth/callback?next=/admin/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Handle rate limiting explicitly without revealing account existence
        if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
          setErrorMsg('Too many recovery requests. Please wait a few minutes before trying again.');
          setLoading(false);
          return;
        }

        console.error('[Password Recovery Error]:', error.message);
      }

      // Security standard: Always display identical success notice to prevent user enumeration
      setSubmitted(true);
      setLoading(false);
    } catch (err: any) {
      console.error('[Password Recovery Unexpected Error]:', err?.message || err);
      // Even on unexpected error, do not expose internal errors or account status
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white border border-neutral-200 rounded-3xl shadow-3xs space-y-6">
      <div className="space-y-1 text-center">
        <div className="w-12 h-12 bg-green-50 text-zim-green rounded-2xl flex items-center justify-center mx-auto mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="font-display font-extrabold text-2xl text-neutral-900">
          Reset Password
        </h1>
        <p className="text-xs text-neutral-500">
          Enter your administrator email to receive password reset instructions.
        </p>
      </div>

      {submitted ? (
        <div className="space-y-5">
          <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-3 text-xs text-green-900">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Instructions Sent</p>
              <p className="text-neutral-600 leading-relaxed">
                If an administrator account exists for <strong>{email}</strong>, a password reset link has been dispatched. Please check your inbox and spam folder.
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-xs text-zim-green font-bold hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleResetRequest} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-zim-green hover:bg-opacity-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
          >
            {loading ? 'Sending Instructions...' : 'Send Reset Link'}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center pt-3 border-t border-neutral-100">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
