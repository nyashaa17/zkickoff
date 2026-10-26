'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Tv,
  Calendar,
  Clock,
  Tag,
  AlertCircle,
  Play,
  Eye
} from 'lucide-react';
import { StandaloneEvent } from '@/lib/supabase/events-query';
import { deleteEventAction } from '@/app/actions/events';

interface AdminEventsTableProps {
  initialEvents: StandaloneEvent[];
}

export default function AdminEventsTable({ initialEvents }: AdminEventsTableProps) {
  const router = useRouter();
  const [events, setEvents] = useState<StandaloneEvent[]>(initialEvents);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete event "${title}"?`)) {
      return;
    }

    setDeletingId(id);
    setActionError(null);

    const res = await deleteEventAction(id);
    setDeletingId(null);

    if (!res.success) {
      setActionError(res.message || 'Failed to delete event.');
      return;
    }

    setEvents(events.filter((e) => e.id !== id));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <p>{actionError}</p>
        </div>
      )}

      {events.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-3xl p-12 text-center space-y-4 shadow-3xs">
          <div className="w-14 h-14 rounded-full bg-green-50 text-zim-green flex items-center justify-center mx-auto">
            <Tv className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-extrabold text-neutral-900 text-lg">No Standalone Events Created</h3>
            <p className="text-neutral-500 text-xs max-w-md mx-auto">
              Get started by creating your first standalone live broadcast. You can add YouTube feeds or HLS streams and manage multiple sources.
            </p>
          </div>
          <Link
            href="/admin/events/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-zim-green text-white font-bold text-xs rounded-xl shadow-xs hover:bg-opacity-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create First Event
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200/80 rounded-3xl shadow-3xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-600 uppercase tracking-wider font-mono">
                <tr>
                  <th className="py-3.5 px-4">Event & Category</th>
                  <th className="py-3.5 px-4">Schedule</th>
                  <th className="py-3.5 px-4">Publication</th>
                  <th className="py-3.5 px-4">Broadcast</th>
                  <th className="py-3.5 px-4">Sources</th>
                  <th className="py-3.5 px-4">Version</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {events.map((evt) => {
                  const startDate = new Date(evt.start_time);
                  const formattedDate = startDate.toLocaleDateString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                  });
                  const formattedTime = startDate.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={evt.id} className="hover:bg-neutral-50/70 transition-colors">
                      {/* Title & Category */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="space-y-1">
                          <Link
                            href={`/admin/events/${evt.id}/edit`}
                            className="font-bold text-neutral-900 hover:text-zim-green line-clamp-1 transition-colors"
                          >
                            {evt.title}
                          </Link>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono">
                            <span className="px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-700">
                              {evt.category}
                            </span>
                            <span>/event/{evt.slug}</span>
                          </div>
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="py-4 px-4 whitespace-nowrap text-neutral-600">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-neutral-800">{formattedDate}</p>
                          <p className="text-[11px] text-neutral-400">{formattedTime}</p>
                        </div>
                      </td>

                      {/* Publication Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            evt.publication_status === 'published'
                              ? 'bg-green-50 text-zim-green border border-green-200'
                              : evt.publication_status === 'draft'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {evt.publication_status}
                        </span>
                      </td>

                      {/* Broadcast Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            evt.broadcast_status === 'live'
                              ? 'bg-red-50 text-zim-red border border-red-200'
                              : evt.broadcast_status === 'upcoming'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {evt.broadcast_status === 'live' && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zim-red opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zim-red"></span>
                            </span>
                          )}
                          {evt.broadcast_status}
                        </span>
                      </td>

                      {/* Sources Count */}
                      <td className="py-4 px-4 whitespace-nowrap font-mono text-neutral-600">
                        {evt.sources?.length ?? 0} {evt.sources?.length === 1 ? 'source' : 'sources'}
                      </td>

                      {/* Version */}
                      <td className="py-4 px-4 whitespace-nowrap font-mono text-[11px] text-neutral-400">
                        v{evt.version}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/admin/events/${evt.id}/preview`}
                            className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors"
                            title="Preview Player"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {evt.publication_status === 'published' && (
                            <Link
                              href={`/event/${evt.slug}`}
                              target="_blank"
                              className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors"
                              title="View Public Page"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          <Link
                            href={`/admin/events/${evt.id}/edit`}
                            className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors"
                            title="Edit Event"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Link>

                          <button
                            onClick={() => handleDelete(evt.id, evt.title)}
                            disabled={deletingId === evt.id}
                            className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Delete Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
