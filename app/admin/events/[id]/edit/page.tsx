import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { StandaloneEvent } from '@/lib/supabase/events-query';
import EventForm from '../../event-form';

interface EditEventPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Edit Event | ZimKickOff Admin',
  robots: { index: false, follow: false },
};

export default async function EditEventPage({ params }: EditEventPageProps) {
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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">
      <EventForm mode="edit" initialData={event} />
    </div>
  );
}
