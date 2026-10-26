'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Tv,
  Calendar,
  Clock,
  Tag,
  Wifi,
  Share2,
  ArrowLeft,
  AlertCircle,
  Play,
  Check,
  Copy,
  ExternalLink
} from 'lucide-react';
import Breadcrumbs from '@/components/breadcrumbs';
import { StandaloneEvent, EventSource, getEmbedUrl } from '@/lib/supabase/events-query';

interface EventClientProps {
  event: StandaloneEvent;
}

export default function EventClient({ event }: EventClientProps) {
  const sources = event.sources || [];
  const primarySource = sources.find((s) => s.is_primary) || sources[0];
  const [selectedSourceId, setSelectedSourceId] = useState<string>(primarySource?.id || '');
  const [copiedLink, setCopiedLink] = useState(false);

  const activeSource = sources.find((s) => s.id === selectedSourceId) || primarySource;

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const startDate = new Date(event.start_time);
  const formattedDate = startDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      {/* Breadcrumbs */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Breadcrumbs
          items={[
            { label: 'Live Broadcasts', href: '/live' },
            { label: event.category, href: '/live' },
            { label: event.title },
          ]}
        />
        <Link
          href="/live"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Live
        </Link>
      </div>

      {/* Event Header */}
      <div className="border-b border-neutral-200/60 pb-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {event.broadcast_status === 'live' && (
            <span className="inline-flex items-center gap-1.5 bg-red-50 text-zim-red px-2.5 py-1 rounded-full text-xs font-bold border border-red-200 uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zim-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-zim-red animate-pulse"></span>
              </span>
              BROADCASTING LIVE
            </span>
          )}
          {event.broadcast_status === 'upcoming' && (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200 uppercase tracking-widest">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              UPCOMING EVENT
            </span>
          )}
          {event.broadcast_status === 'concluded' && (
            <span className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-full text-xs font-bold border border-neutral-200 uppercase tracking-widest">
              EVENT CONCLUDED
            </span>
          )}
          <span className="inline-flex items-center gap-1 bg-green-50 text-zim-green px-2.5 py-1 rounded-full text-xs font-semibold border border-green-200">
            <Tag className="w-3 h-3" />
            {event.category}
          </span>
        </div>

        <h1 className="font-display font-extrabold text-2xl md:text-4xl text-neutral-950 tracking-tight mb-2">
          {event.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-neutral-600">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Calendar className="w-4 h-4 text-neutral-400" />
            {formattedDate}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Clock className="w-4 h-4 text-neutral-400" />
            {formattedTime}
          </span>
        </div>
      </div>

      {/* Main Grid: Player on left, Info on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Player and Servers */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player Box */}
          <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-md border border-neutral-800">
            {activeSource ? (
              <iframe
                id="eventStreamPlayer"
                title={event.title}
                className="absolute inset-0 w-full h-full border-none m-0 p-0 z-10 bg-black"
                allowFullScreen
                allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
                src={getEmbedUrl(activeSource)}
                referrerPolicy="no-referrer"
              ></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
                <AlertCircle className="w-12 h-12 text-zim-yellow mb-3" />
                <h3 className="font-bold text-lg mb-1">No Active Stream Feed Available</h3>
                <p className="text-xs text-neutral-400 max-w-md">
                  This broadcast is being prepared. Please check back closer to scheduled kickoff or switch to another channel.
                </p>
              </div>
            )}
          </div>

          {/* Stream Servers & Switcher */}
          {sources.length > 0 && (
            <div className="bg-white border border-neutral-200/70 rounded-2xl p-4 shadow-3xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-zim-green" />
                  Select Broadcast Feed
                </span>
                <span className="text-xs text-neutral-400">
                  {sources.length} {sources.length === 1 ? 'feed' : 'feeds'} available
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {sources.map((source) => {
                  const isSelected = source.id === (activeSource?.id || '');
                  return (
                    <button
                      key={source.id}
                      onClick={() => setSelectedSourceId(source.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-900 text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      {source.name}
                      {source.is_primary && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-zim-green text-white rounded font-bold uppercase ml-1">
                          Primary
                        </span>
                      )}
                      <span className="text-[10px] uppercase font-mono opacity-70 ml-1">
                        {source.stream_type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Troubleshooting Tip */}
          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-neutral-900 block mb-1">Playback Tips:</span>
            If video buffering occurs, switch between available broadcast feeds above. Tap the video player volume button if stream starts muted.
          </div>
        </div>

        {/* Right Column: Event Details & Sharing */}
        <div className="space-y-6">
          {/* Details Card */}
          <div className="bg-white border border-neutral-200/70 rounded-3xl p-6 shadow-3xs space-y-4">
            <h3 className="font-display font-bold text-sm text-neutral-950 pb-2 border-b border-neutral-100">
              Event Information
            </h3>

            {event.description && (
              <div className="text-xs text-neutral-700 leading-relaxed space-y-2">
                <p>{event.description}</p>
              </div>
            )}

            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-neutral-100">
                <span className="text-neutral-400 font-medium">Category</span>
                <span className="font-semibold text-neutral-800">{event.category}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-neutral-100">
                <span className="text-neutral-400 font-medium">Broadcast Status</span>
                <span className="font-bold uppercase tracking-wider text-zim-green">
                  {event.broadcast_status}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-neutral-100">
                <span className="text-neutral-400 font-medium">Schedule</span>
                <span className="font-semibold text-neutral-800">{formattedTime}</span>
              </div>
            </div>

            {/* Share / Copy Link Button */}
            <div className="pt-2">
              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-zim-green" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Share Broadcast Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Network Optimization Banner */}
          <div className="p-5 border border-dashed border-neutral-200 bg-neutral-50 rounded-3xl space-y-2 text-neutral-500 text-xs">
            <h4 className="font-display font-bold text-neutral-900 text-[10px] uppercase tracking-widest flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5 text-zim-green" />
              Low-Bandwidth Video Delivery
            </h4>
            <p className="leading-relaxed">
              Streams automatically adapt bitrates to accommodate local Econet and NetOne data bundles, ensuring seamless playback without buffering.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
