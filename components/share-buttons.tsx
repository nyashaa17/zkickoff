'use client';

import React from 'react';
import { MessageCircle, Send, Twitter, Facebook } from 'lucide-react';

interface ShareButtonsProps {
  /** Canonical match page URL without query params */
  matchUrl: string;
  /** Short share text shown alongside the link */
  shareText?: string;
}

const platforms = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    Icon: MessageCircle,
    buildHref: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}?utm_source=whatsapp`)}`,
    color: '#25D366',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    Icon: Send,
    buildHref: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(`${url}?utm_source=telegram`)}&text=${encodeURIComponent(text)}`,
    color: '#26A5E4',
  },
  {
    key: 'twitter',
    label: 'Twitter / X',
    Icon: Twitter,
    buildHref: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${url}?utm_source=twitter`)}`,
    color: '#1DA1F2',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    Icon: Facebook,
    buildHref: (url: string, _text: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${url}?utm_source=facebook`)}`,
    color: '#1877F2',
  },
] as const;

export function ShareButtons({ matchUrl, shareText = '' }: ShareButtonsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest mr-1 hidden sm:inline">
        Share
      </span>
      {platforms.map(({ key, label, Icon, buildHref, color }) => (
        <a
          key={key}
          href={buildHref(matchUrl, shareText)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${label}`}
          className="w-8 h-8 rounded-lg border border-neutral-200/60 bg-neutral-50 hover:bg-neutral-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-4xs"
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </a>
      ))}
    </div>
  );
}
