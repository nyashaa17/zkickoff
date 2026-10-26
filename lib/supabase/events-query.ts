import { createClient } from '@supabase/supabase-js';

export interface EventSource {
  id: string;
  event_id: string;
  name: string;
  stream_type: 'youtube' | 'hls';
  stream_url: string;
  is_primary: boolean;
  display_order: number;
}

export interface StandaloneEvent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  banner_url: string | null;
  start_time: string;
  end_time: string | null;
  publication_status: 'draft' | 'published' | 'archived';
  broadcast_status: 'upcoming' | 'live' | 'concluded';
  version: number;
  created_at: string;
  updated_at: string;
  sources?: EventSource[];
}

/**
 * Returns a public anon client for reading published events.
 * Returns null if Supabase is not configured.
 */
function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}

/**
 * Fetches all published standalone events for public display.
 */
export async function getPublishedEvents(): Promise<StandaloneEvent[]> {
  const client = getPublicClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('events')
      .select('*, sources:event_sources(*)')
      .eq('publication_status', 'published')
      .order('start_time', { ascending: true });

    if (error || !data) {
      console.warn('[getPublishedEvents] Query error:', error?.message);
      return [];
    }

    return data as StandaloneEvent[];
  } catch (err) {
    console.warn('[getPublishedEvents] Fetch error:', err);
    return [];
  }
}

/**
 * Fetches a single published event by slug with its sources.
 */
export async function getPublishedEventBySlug(slug: string): Promise<StandaloneEvent | null> {
  const client = getPublicClient();
  if (!client) return null;

  try {
    const { data: event, error: eventErr } = await client
      .from('events')
      .select('*')
      .eq('slug', slug)
      .eq('publication_status', 'published')
      .single();

    if (eventErr || !event) {
      return null;
    }

    const { data: sources, error: sourcesErr } = await client
      .from('event_sources')
      .select('*')
      .eq('event_id', event.id)
      .order('display_order', { ascending: true });

    return {
      ...(event as StandaloneEvent),
      sources: (sources || []) as EventSource[],
    };
  } catch (err) {
    console.warn('[getPublishedEventBySlug] Fetch error:', err);
    return null;
  }
}

/**
 * Generates runtime Vicecap player embed URL for a given source.
 */
export function getEmbedUrl(source: { stream_type: 'youtube' | 'hls'; stream_url: string }): string {
  const encodedUrl = encodeURIComponent(source.stream_url);
  return `https://vicecap.github.io/Play/embed?url=${encodedUrl}&type=${source.stream_type}`;
}
