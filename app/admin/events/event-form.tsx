'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  AlertCircle,
  Check,
  ArrowLeft,
  Tv,
  Save,
  Radio,
  Clock,
  ExternalLink,
  Info
} from 'lucide-react';
import Link from 'next/link';
import { StandaloneEvent, EventSource } from '@/lib/supabase/events-query';
import { createEventAction, updateEventAction } from '@/app/actions/events';

interface EventFormProps {
  initialData?: StandaloneEvent;
  mode: 'create' | 'edit';
}

interface SourceState {
  id?: string;
  name: string;
  stream_type: 'youtube' | 'hls';
  stream_url: string;
  is_primary: boolean;
  display_order: number;
}

export default function EventForm({ initialData, mode }: EventFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [category, setCategory] = useState(initialData?.category || 'Special Broadcast');
  const [description, setDescription] = useState(initialData?.description || '');
  const [bannerUrl, setBannerUrl] = useState(initialData?.banner_url || '');

  // Format dates for datetime-local input
  const formatForInput = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const [startTime, setStartTime] = useState(
    formatForInput(initialData?.start_time) || formatForInput(new Date().toISOString())
  );
  const [endTime, setEndTime] = useState(formatForInput(initialData?.end_time));
  const [publicationStatus, setPublicationStatus] = useState<'draft' | 'published' | 'archived'>(
    initialData?.publication_status || 'draft'
  );
  const [broadcastStatus, setBroadcastStatus] = useState<'upcoming' | 'live' | 'concluded'>(
    initialData?.broadcast_status || 'upcoming'
  );

  const [sources, setSources] = useState<SourceState[]>(
    initialData?.sources && initialData.sources.length > 0
      ? initialData.sources.map((s, idx) => ({
          name: s.name,
          stream_type: s.stream_type,
          stream_url: s.stream_url,
          is_primary: s.is_primary,
          display_order: s.display_order ?? idx,
        }))
      : []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-slug generator from title if creating
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (mode === 'create' && !slug) {
      const autoSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(autoSlug);
    }
  };

  const addSource = () => {
    const isFirst = sources.length === 0;
    setSources([
      ...sources,
      {
        name: `Feed ${sources.length + 1}`,
        stream_type: 'youtube',
        stream_url: '',
        is_primary: isFirst,
        display_order: sources.length,
      },
    ]);
  };

  const removeSource = (idx: number) => {
    const updated = sources.filter((_, i) => i !== idx);
    // If we removed the primary source and sources remain, make first one primary
    if (updated.length > 0 && !updated.some((s) => s.is_primary)) {
      updated[0].is_primary = true;
    }
    // Re-index display orders
    updated.forEach((s, i) => {
      s.display_order = i;
    });
    setSources(updated);
  };

  const setPrimary = (idx: number) => {
    setSources(
      sources.map((s, i) => ({
        ...s,
        is_primary: i === idx,
      }))
    );
  };

  const updateSourceField = (idx: number, field: keyof SourceState, value: any) => {
    const updated = [...sources];
    updated[idx] = { ...updated[idx], [field]: value };
    setSources(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Client-side quick checks
    if (!title.trim() || title.trim().length < 3) {
      setErrorMessage('Title must be at least 3 characters.');
      return;
    }
    if (!slug.trim()) {
      setErrorMessage('Slug is required.');
      return;
    }
    if (publicationStatus === 'published' && sources.length === 0) {
      setErrorMessage('Published events must have at least one stream source. Add a stream feed below or switch status to Draft.');
      return;
    }
    if (sources.length > 0 && !sources.some((s) => s.is_primary)) {
      setErrorMessage('Exactly one stream source must be designated as the Primary feed.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim() || null,
        category: category.trim() || 'Special Event',
        banner_url: bannerUrl.trim() || null,
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : null,
        publication_status: publicationStatus,
        broadcast_status: broadcastStatus,
        sources: sources.map((s, i) => ({
          name: s.name.trim(),
          stream_type: s.stream_type,
          stream_url: s.stream_url.trim(),
          is_primary: Boolean(s.is_primary),
          display_order: Number(s.display_order ?? i),
        })),
      };

      let res;
      if (mode === 'create') {
        res = await createEventAction(payload);
      } else {
        payload.id = initialData?.id;
        payload.expected_version = initialData?.version;
        res = await updateEventAction(payload);
      }

      if (!res.success) {
        setErrorMessage(res.message || res.error || 'Failed to save event.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(mode === 'create' ? 'Event created successfully!' : 'Event updated successfully!');
      setTimeout(() => {
        router.push('/admin/events');
        router.refresh();
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/events"
            className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-600" />
          </Link>
          <div>
            <h1 className="font-display font-extrabold text-2xl text-neutral-900">
              {mode === 'create' ? 'Create Standalone Live Event' : `Edit Event: ${initialData?.title}`}
            </h1>
            <p className="text-xs text-neutral-500">
              Configure event details, streaming sources, and publication status.
            </p>
          </div>
        </div>

        {initialData && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
              v{initialData.version}
            </span>
            <Link
              href={`/admin/events/${initialData.id}/preview`}
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Preview Player
            </Link>
          </div>
        )}
      </div>

      {/* Error & Success Banners */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Error Saving Event</p>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-zim-green text-xs font-semibold">
          <Check className="w-5 h-5 text-zim-green shrink-0" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* Section 1: Basic Information */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-3xs space-y-5">
        <h2 className="font-display font-bold text-base text-neutral-900 pb-2 border-b border-neutral-100 flex items-center gap-2">
          <Tv className="w-4 h-4 text-zim-green" />
          Event Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Title */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="font-bold text-neutral-800">Event Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Zimbabwe National Boxing Championship 2026"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-800">URL Slug *</label>
            <div className="flex items-center">
              <span className="px-3 py-2.5 bg-neutral-100 border border-r-0 border-neutral-200 rounded-l-xl text-neutral-500 font-mono text-[11px]">
                /event/
              </span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="zim-boxing-championship-2026"
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-r-xl focus:outline-none focus:border-zim-green text-xs font-mono"
              />
            </div>
            <p className="text-[11px] text-neutral-400">Lowercase letters, numbers, and hyphens only.</p>
          </div>

          {/* Flexible Category */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-800">Event Category *</label>
            <input
              type="text"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Boxing, Athletics, Rugby, Concert, Special"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs"
            />
            <p className="text-[11px] text-neutral-400">Enter any flexible sport or broadcast category.</p>
          </div>

          {/* Description */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="font-bold text-neutral-800">Description (Optional)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide event overview, lineup, or commentary notes..."
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs leading-relaxed"
            />
          </div>

          {/* Banner URL */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="font-bold text-neutral-800">Banner Image URL (Optional HTTPS)</label>
            <input
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Scheduling & Status */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-3xs space-y-5">
        <h2 className="font-display font-bold text-base text-neutral-900 pb-2 border-b border-neutral-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-zim-green" />
          Scheduling & Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Start Time */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-800">Start Time *</label>
            <input
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs font-sans"
            />
          </div>

          {/* End Time */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-800">End Time (Optional)</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs font-sans"
            />
          </div>

          {/* Publication Status */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-800">Publication Status *</label>
            <select
              value={publicationStatus}
              onChange={(e) => setPublicationStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs font-sans"
            >
              <option value="draft">Draft (Hidden from public)</option>
              <option value="published">Published (Visible on Live & Event page)</option>
              <option value="archived">Archived (Ended / Archived)</option>
            </select>
          </div>

          {/* Broadcast Status */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-800">Broadcast Status *</label>
            <select
              value={broadcastStatus}
              onChange={(e) => setBroadcastStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs font-sans"
            >
              <option value="upcoming">Upcoming (Scheduled)</option>
              <option value="live">Live Now (Stream transmitting)</option>
              <option value="concluded">Concluded (Stream finished)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 3: Stream Sources Management */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-3xs space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div>
            <h2 className="font-display font-bold text-base text-neutral-900 flex items-center gap-2">
              <Radio className="w-4 h-4 text-zim-green" />
              Stream Broadcast Sources
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Configure feeds. When sources exist, exactly one must be designated as Primary.
            </p>
          </div>

          <button
            type="button"
            onClick={addSource}
            className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Feed
          </button>
        </div>

        {sources.length === 0 ? (
          <div className="p-8 border border-dashed border-neutral-200 rounded-2xl text-center space-y-2">
            <Info className="w-8 h-8 text-neutral-400 mx-auto" />
            <p className="text-xs font-semibold text-neutral-700">No stream sources configured yet.</p>
            <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
              Draft events may have zero sources. Published events must have at least one valid source with exactly one primary feed.
            </p>
            <button
              type="button"
              onClick={addSource}
              className="mt-2 px-3 py-1.5 bg-green-50 text-zim-green border border-green-200 text-xs font-bold rounded-xl inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Primary Source
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sources.map((src, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all ${
                  src.is_primary
                    ? 'border-zim-green/60 bg-green-50/20'
                    : 'border-neutral-200 bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-200/60">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-neutral-800">
                      <input
                        type="radio"
                        name="primary_source_selector"
                        checked={src.is_primary}
                        onChange={() => setPrimary(idx)}
                        className="text-zim-green focus:ring-zim-green"
                      />
                      <span>Primary Feed</span>
                    </label>
                    {src.is_primary && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-zim-green text-white rounded-md uppercase">
                        Active Default
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-400 font-mono">
                      Order: {src.display_order}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSource(idx)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                      title="Remove Feed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Source Name */}
                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-700">Feed Label *</label>
                    <input
                      type="text"
                      required
                      value={src.name}
                      onChange={(e) => updateSourceField(idx, 'name', e.target.value)}
                      placeholder="e.g. Server 1 HD"
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs"
                    />
                  </div>

                  {/* Stream Type */}
                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-700">Stream Type *</label>
                    <select
                      value={src.stream_type}
                      onChange={(e) => updateSourceField(idx, 'stream_type', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs"
                    >
                      <option value="youtube">YouTube (ID or Watch Link)</option>
                      <option value="hls">HLS Master (.m3u8 HTTPS)</option>
                    </select>
                  </div>

                  {/* Display Order */}
                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-700">Display Order</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={src.display_order}
                      onChange={(e) => updateSourceField(idx, 'display_order', parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs font-mono"
                    />
                  </div>

                  {/* Stream URL */}
                  <div className="md:col-span-3 space-y-1">
                    <label className="font-semibold text-neutral-700">
                      Upstream Video URL / ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={src.stream_url}
                      onChange={(e) => updateSourceField(idx, 'stream_url', e.target.value)}
                      placeholder={
                        src.stream_type === 'youtube'
                          ? 'e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or video ID'
                          : 'e.g. https://cdn.broadcaster.com/live/master.m3u8'
                      }
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-zim-green text-xs font-mono"
                    />
                    <p className="text-[11px] text-neutral-400">
                      {src.stream_type === 'youtube'
                        ? 'Normalized automatically to canonical YouTube watch URL.'
                        : 'Must begin with secure https://. Private/local IP addresses are prohibited.'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
        <Link
          href="/admin/events"
          className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-xl transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-zim-green hover:bg-opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? 'Saving Event...' : mode === 'create' ? 'Create Event' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
