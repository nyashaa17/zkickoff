'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Sparkles } from 'lucide-react';
import { Highlight } from '@/lib/highlights-service';

/**
 * Compute a relative time string (e.g. "2d ago", "3h ago") from an ISO date.
 */
function timeAgo(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    if (diffMs < 0) return 'just now';

    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch {
    return '';
  }
}

interface HighlightsCarouselProps {
  highlights: Highlight[];
}

export default function HighlightsCarousel({ highlights }: HighlightsCarouselProps) {
  if (!highlights || highlights.length === 0) return null;

  return (
    <section className="w-full mt-8 mb-2">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="font-display font-bold text-xl md:text-2xl text-neutral-950 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-zim-yellow" />
          Match Highlights
        </h2>
        <Link
          href="/highlights"
          className="text-xs font-display font-bold text-zim-green hover:opacity-85 transition-opacity flex items-center gap-1"
        >
          See all <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* Horizontal scroll row */}
      <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-3 snap-x snap-mandatory scroll-smooth -mx-1 px-1">
        {highlights.map((hl, idx) => (
          <a
            key={hl.id || idx}
            href={hl.url || hl.embed_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="group snap-start shrink-0 w-[280px] sm:w-[300px] bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-xs hover:shadow-md hover:border-neutral-300 transition-all"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-neutral-200">
              {hl.thumbnail ? (
                <Image
                  src={hl.thumbnail}
                  alt={hl.title || 'Match Highlight'}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              {/* Play icon overlay on hover */}
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                  <Play className="w-6 h-6 text-zim-green ml-0.5" />
                </div>
              </div>
            </div>

            {/* Card content */}
            <div className="p-3.5 space-y-1.5">
              <p className="text-sm font-bold text-neutral-800 line-clamp-2 group-hover:text-zim-green transition-colors leading-snug">
                {hl.title || 'Match Highlight Video'}
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                <span className="truncate max-w-[60%]">
                  {hl.source || hl.league_name || ''}
                </span>
                {hl.created_at && (
                  <span className="shrink-0">{timeAgo(hl.created_at)}</span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
