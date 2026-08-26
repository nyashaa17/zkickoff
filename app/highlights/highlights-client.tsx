'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import { Highlight } from '@/lib/highlights-service';
import { motion } from 'motion/react';

interface HighlightsClientProps {
  initialHighlights: Highlight[];
  initialHasMore: boolean;
}

export default function HighlightsClient({ initialHighlights, initialHasMore }: HighlightsClientProps) {
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(20);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/highlights?offset=${offset}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setHighlights(prev => [...prev, ...data.highlights]);
        setHasMore(data.hasMore);
        setOffset(prev => prev + 20);
      }
    } catch (err) {
      console.error('Error loading more highlights:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8 bg-[#F8FAFC] min-h-screen">
      <h1 className="sr-only">Football Video Highlights | ZimKickOff</h1>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-neutral-200/40 pb-4">
        <div className="space-y-1">
          <h2 className="font-display font-extrabold text-xl text-neutral-900 flex items-center gap-2">
            <Play className="w-5 h-5 text-[#009739]" />
            Video Highlights
          </h2>
          <p className="text-xs text-neutral-500">Latest goals, saves, and key moments from top leagues</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#009739] hover:opacity-85 font-display transition-all py-1.5 px-3 bg-white hover:bg-neutral-50 rounded-xl border border-neutral-200/50 shrink-0 self-start sm:self-auto shadow-4xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Live Feed
        </Link>
      </div>

      {/* Highlights Grid */}
      {highlights.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {highlights.map((hl, idx) => (
              <motion.a
                key={hl.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                href={hl.url || hl.embed_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="group block bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-xs hover:shadow-md hover:border-neutral-300 transition-all"
              >
                {hl.thumbnail && (
                  <div className="relative aspect-video bg-neutral-200">
                    <Image
                      src={hl.thumbnail}
                      alt={hl.title || 'Match Highlight'}
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                        <Play className="w-6 h-6 text-[#009739] ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <p className="text-sm font-bold text-neutral-800 line-clamp-2 group-hover:text-[#009739] transition-colors">
                    {hl.title || 'Match Highlight Video'}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                    {hl.league_name && <span className="uppercase tracking-wider">{hl.league_name}</span>}
                    {hl.source && <span>{hl.source}</span>}
                  </div>
                  {hl.created_at && (
                    <p className="text-[10px] text-neutral-400">
                      {new Date(hl.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </motion.a>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={loadMore}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                ) : (
                  'Load More Highlights'
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center shadow-xs">
          <Play className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <h3 className="font-display font-extrabold text-neutral-700">No Highlights Available</h3>
          <p className="text-xs text-neutral-400 mt-1">Check back later for the latest video highlights.</p>
        </div>
      )}
    </div>
  );
}
