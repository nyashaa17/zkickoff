import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedEventBySlug } from '@/lib/supabase/events-query';
import EventClient from './event-client';

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(slug);

  if (!event) {
    return {
      title: 'Event Not Found | ZimKickOff',
      description: 'The requested live broadcast could not be located.',
    };
  }

  const canonicalUrl = `https://zimkickoff.co.zw/event/${slug}`;
  const description =
    event.description ||
    `Watch ${event.title} live on ZimKickOff. Buffer-free streaming optimized for Zimbabwe.`;

  return {
    title: `${event.title} — Live Stream & Broadcast | ZimKickOff`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${event.title} | ZimKickOff Live`,
      description: event.description || `Watch ${event.title} live online.`,
      url: canonicalUrl,
      siteName: 'ZimKickOff',
      images: event.banner_url ? [{ url: event.banner_url }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${event.title} | ZimKickOff Live`,
      description,
      images: event.banner_url ? [event.banner_url] : undefined,
    },
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(slug);

  if (!event) {
    notFound();
  }

  return <EventClient event={event} />;
}
