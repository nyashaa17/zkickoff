'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Play, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TICKER_MESSAGES = [
  {
    id: 'worldcup',
    text: 'World Cup 2026: View Squads, Fixtures, and Tables',
    href: '/worldcup',
    icon: Trophy,
    iconColor: 'text-amber-300',
    ariaLabel: 'Go to World Cup 2026'
  },
  {
    id: 'streams',
    text: 'Free HD Streams: Watch Premier League, Champions League & La Liga',
    href: '/',
    icon: Play,
    iconColor: 'text-emerald-300',
    ariaLabel: 'Watch Live Football Streams'
  },
  {
    id: 'whatsapp',
    text: 'Join ZimKickOff WhatsApp Channel for Instant Match stream alerts!',
    href: 'https://whatsapp.com/channel/0029VbCawa77YSd8W5QIHA41',
    isExternal: true,
    icon: Send,
    iconColor: 'text-teal-300',
    ariaLabel: 'Join WhatsApp Channel'
  }
];

export default function WorldCupTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % TICKER_MESSAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const current = TICKER_MESSAGES[index];
  const IconComponent = current.icon;

  const content = (
    <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold">
      <IconComponent className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${current.iconColor} shrink-0`} />
      <span className="truncate">{current.text}</span>
    </div>
  );

  return (
    <div className="relative w-full bg-[#009739] text-white py-2 px-4 shadow-xs text-center border-b border-[#007a2d] overflow-hidden select-none">
      <div className="max-w-7xl mx-auto h-5 flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -15, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {current.isExternal ? (
              <a
                href={current.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-center justify-center"
                aria-label={current.ariaLabel}
                id={`ticker-item-${current.id}`}
              >
                {content}
              </a>
            ) : (
              <Link
                href={current.href}
                className="hover:underline flex items-center justify-center"
                aria-label={current.ariaLabel}
                id={`ticker-item-${current.id}`}
              >
                {content}
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
