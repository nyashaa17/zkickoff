'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Play, Tv, Calendar, X, Menu, Clock, SlidersHorizontal, ChevronRight, Trophy, Sparkles, Home, Shield, FileText, Info, Mail, Newspaper } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Match } from '@/lib/matches-data';

export default function Navbar() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const drawerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load matches immediately to guarantee instantaneous click-through searching inside the drawer
  useEffect(() => {
    if (isDrawerOpen && allMatches.length === 0) {
      fetch('/api/livescore')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.matches) {
            setAllMatches(data.matches);
          }
        })
        .catch((err) => console.error('Navbar search pre-fetch error:', err));
    }
  }, [isDrawerOpen, allMatches.length]);

  // Handle closing drawer on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute search results dynamically inside the drawer
  const searchResults = searchQuery.trim()
    ? allMatches.filter(
        (m) =>
          m.teams.home.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.teams.away.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.teams.home.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.teams.away.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.competition.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleResultClick = (slug: string) => {
    router.push(`/preview/${slug}`);
    setSearchQuery('');
    setIsDrawerOpen(false);
  };

  return (
    <div className="relative">
      <header className="w-full bg-white md:bg-white/95 border-b border-neutral-100 shadow-xs md:backdrop-blur-md [transform:translate3d(0,0,0)] [will-change:transform]">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 shrink-0 select-none">
            <span className="font-display font-extrabold text-base md:text-lg tracking-tight flex items-center">
              <span className="text-zim-green">Zim</span>
              <span className="text-zim-black">Kick</span>
              <span className="text-zim-red">Off</span>
            </span>
          </Link>

          {/* Desktop navigation and Hamburger Trigger */}
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm font-display font-bold text-neutral-600">
              <Link href="/" className="hover:text-zim-green transition-colors py-1">
                Home
              </Link>
              <Link href="/live" className="hover:text-zim-green transition-colors py-1 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zim-red opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zim-red"></span>
                </span>
                Live Streaming
              </Link>
            </nav>

            {/* Unified Hamburger Menu Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/60 hover:border-neutral-300 rounded-xl transition-all font-display font-bold text-xs text-neutral-700 cursor-pointer"
            >
              <Menu className="w-5 h-5 text-neutral-600" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Dropdown Navigation Menu */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Background overlay to close on click outside */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-transparent"
            />

            {/* Dropdown Container */}
            <motion.div
              ref={drawerRef}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute top-[64px] right-4 md:right-6 w-[calc(100%-32px)] md:w-[320px] bg-white z-50 shadow-xl rounded-xl flex flex-col overflow-hidden border border-neutral-100"
            >
              {/* Dynamic Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 bg-white max-h-[calc(100vh-100px)]">
                <Link
                  href="/"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 bg-neutral-900 text-white rounded-xl font-medium text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                >
                  <Home className="w-[1.1rem] h-[1.1rem] stroke-[2.5]" />
                  <span>Matches</span>
                </Link>

                <Link
                  href="/"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-50 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <Trophy className="w-5 h-5 stroke-[2]" />
                  <span>Stats</span>
                </Link>

                <Link
                  href="/"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-50 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <Newspaper className="w-5 h-5 stroke-[2]" />
                  <span>Articles</span>
                </Link>

                <Link
                  href="/contact"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-50 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <Mail className="w-5 h-5 stroke-[2]" />
                  <span>Contact us</span>
                </Link>

                <Link
                  href="/stream"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-50 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <Tv className="w-5 h-5 stroke-[2]" />
                  <span>PL Streams</span>
                </Link>

                <Link
                  href="/worldcup"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-50 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <Trophy className="w-5 h-5 stroke-[2]" />
                  <span>World Cup 2026</span>
                </Link>

                <div className="py-2 px-1">
                  <div className="h-px bg-neutral-100 w-full" />
                </div>

                <Link
                  href="/privacy"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-50 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <Shield className="w-5 h-5 stroke-[2]" />
                  <span>Privacy Policy</span>
                </Link>

                <Link
                  href="/terms"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-50 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <FileText className="w-5 h-5 stroke-[2]" />
                  <span>Terms & Conditions</span>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
