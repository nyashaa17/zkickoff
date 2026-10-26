'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Play,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Wifi,
  Tv,
  Edit,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { StandaloneEvent, EventSource, getEmbedUrl } from '@/lib/supabase/events-query';

interface PreviewPlayerProps {
  event: StandaloneEvent;
}

export default function PreviewPlayer({ event }: PreviewPlayerProps) {
  const sources = event.sources || [];
  const primarySource = sources.find((s) => s.is_primary) || sources[0];
  const [activeSourceId, setActiveSourceId] = useState<string>(primarySource?.id || '');

  const activeSource = sources.find((s) => s.id === activeSourceId) || primarySource;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded uppercase">
                {event.publication_status}
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                v{event.version}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl text-neutral-900 mt-1">
              Player Preview: {event.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 hover:bg-neutral-800 transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit Event
          </Link>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Admin Stream Verification Terminal</p>
          <p className="leading-relaxed">
            Verify video and audio playback for each stream source before publishing. URLs are validated syntactically and streamed directly browser-side without server fetching.
          </p>
        </div>
      </div>

      {/* Player Frame */}
      <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-lg border border-neutral-800">
        {activeSource ? (
          <iframe
            id="adminPreviewIframe"
            title={`Preview ${activeSource.name}`}
            className="absolute inset-0 w-full h-full border-none m-0 p-0 z-10 bg-black"
            allowFullScreen
            allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
            src={getEmbedUrl(activeSource)}
            referrerPolicy="no-referrer"
          ></iframe>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
            <AlertTriangle className="w-10 h-10 text-zim-yellow mb-2" />
            <p className="font-bold">No Stream Feeds Configured</p>
            <p className="text-xs text-neutral-400 mt-1">
              Add at least one YouTube or HLS stream feed in the event editor.
            </p>
          </div>
        )}
      </div>

      {/* Source Selector */}
      {sources.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-3xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-zim-green" />
              Configured Feeds ({sources.length})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {sources.map((src) => {
              const isSelected = src.id === (activeSource?.id || '');
              return (
                <button
                  key={src.id}
                  onClick={() => setActiveSourceId(src.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">{src.name}</span>
                    {src.is_primary && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        isSelected ? 'bg-zim-green text-white' : 'bg-green-100 text-zim-green'
                      }`}>
                        Primary
                      </span>
                    )}
                  </div>
                  <div className={`text-[11px] font-mono truncate ${
                    isSelected ? 'text-neutral-300' : 'text-neutral-500'
                  }`}>
                    {src.stream_type.toUpperCase()} • Order: {src.display_order}
                  </div>
                  <div className={`text-[10px] font-mono truncate mt-1 ${
                    isSelected ? 'text-neutral-400' : 'text-neutral-400'
                  }`}>
                    {src.stream_url}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
