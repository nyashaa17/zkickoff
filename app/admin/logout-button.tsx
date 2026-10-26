'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Logout Error]:', error.message);
        setErrorMsg('Failed to sign out. Please try again.');
        setLoading(false);
        return;
      }

      // Route to login and refresh to clear any cached Server Component auth state
      router.push('/admin/login?notice=signed_out');
      router.refresh();
    } catch (err: any) {
      console.error('[Logout Unexpected Error]:', err?.message || err);
      setErrorMsg('Unexpected error during sign out.');
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        title="Sign Out of Admin Console"
        aria-label="Sign Out of Admin Console"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>{loading ? 'Signing out...' : 'Sign Out'}</span>
      </button>

      {errorMsg && (
        <span className="absolute -bottom-6 right-0 text-[10px] text-red-600 whitespace-nowrap">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
