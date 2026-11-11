import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Tv, BellRing, Key } from 'lucide-react';
import { requireAdminSession } from '@/lib/supabase/auth-guard';
import { 
  getApiSettingsAction, 
  listApiKeysAction, 
  getApiAnalyticsAction 
} from '@/app/actions/api-management';
import ApiDashboardClient from './api-dashboard-client';
import LogoutButton from '../logout-button';

export const metadata: Metadata = {
  title: 'Developer API Management | ZimKickOff Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminDeveloperApiPage() {
  await requireAdminSession();

  const [settingsRes, keysRes, analyticsRes] = await Promise.all([
    getApiSettingsAction(),
    listApiKeysAction(),
    getApiAnalyticsAction('24h'),
  ]);

  const initialSettings = settingsRes.success ? settingsRes.data || null : null;
  const initialKeys = keysRes.success ? keysRes.data || [] : [];
  const initialAnalytics = analyticsRes.success ? analyticsRes.data || null : null;

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
            Developer API Console
          </h1>
          <p className="text-xs text-neutral-500">
            Monitor API usage, enforce rate limits, issue and revoke developer keys, and manage the API kill switch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <LogoutButton />
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-px">
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 border-b-2 border-transparent transition-colors"
        >
          <Tv className="w-4 h-4" />
          Standalone Events
        </Link>
        <Link
          href="/admin/announcement"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 border-b-2 border-transparent transition-colors"
        >
          <BellRing className="w-4 h-4" />
          Service Announcement
        </Link>
        <Link
          href="/admin/api"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-zim-green border-b-2 border-zim-green transition-colors"
        >
          <Key className="w-4 h-4" />
          Developer API
        </Link>
      </div>

      {/* Developer API Management Dashboard */}
      <ApiDashboardClient
        initialSettings={initialSettings}
        initialKeys={initialKeys}
        initialAnalytics={initialAnalytics}
      />
    </div>
  );
}
