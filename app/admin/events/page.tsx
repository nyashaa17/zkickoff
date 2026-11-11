import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Tv, Shield, Key } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { StandaloneEvent } from '@/lib/supabase/events-query';
import AdminEventsTable from './admin-events-table';
import LogoutButton from '../logout-button';

export const metadata: Metadata = {
  title: 'Event Management | ZimKickOff Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  let events: StandaloneEvent[] = [];

  try {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from('events')
      .select('*, sources:event_sources(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      events = data as StandaloneEvent[];
    }
  } catch (err) {
    // Graceful fallback when database credentials are not yet configured in local test
    console.warn('[AdminEventsPage] Could not load events directly:', err);
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-zim-green border border-green-200 rounded-full text-xs font-bold font-mono">
            <Shield className="w-3.5 h-3.5" />
            ADMIN CONSOLE
          </div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl text-neutral-900 tracking-tight">
            Standalone Live Events
          </h1>
          <p className="text-xs text-neutral-500">
            Create, manage, and publish live broadcasts separate from standard league football matches.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/events/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zim-green hover:bg-opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Create New Event
          </Link>
          <LogoutButton />
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-px">
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-zim-green border-b-2 border-zim-green transition-colors"
        >
          <Tv className="w-4 h-4" />
          Standalone Events
        </Link>
        <Link
          href="/admin/api"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 border-b-2 border-transparent transition-colors"
        >
          <Key className="w-4 h-4" />
          Developer API
        </Link>
      </div>

      {/* Events Table Component */}
      <AdminEventsTable initialEvents={events} />
    </div>
  );
}
