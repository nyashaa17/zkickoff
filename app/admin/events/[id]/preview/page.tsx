import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { StandaloneEvent } from '@/lib/supabase/events-query';
import PreviewPlayer from './preview-player';

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Preview Player | ZimKickOff Admin',
  robots: { index: false, follow: false },
};

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;

  let event: StandaloneEvent | null = null;
  try {
    const adminSupabase = createAdminClient();
    const { data: eventData, error: eventErr } = await adminSupabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventErr || !eventData) {
      notFound();
    }

    const { data: sources } = await adminSupabase
      .from('event_sources')
      .select('*')
      .eq('event_id', id)
      .order('display_order', { ascending: true });

    event = {
      ...(eventData as StandaloneEvent),
      sources: (sources || []) as any,
    };
  } catch (err) {
    notFound();
  }

  if (!event) {
    notFound();
  }

  return <PreviewPlayer event={event} />;
}
