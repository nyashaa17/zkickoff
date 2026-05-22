'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Play, Tv, Calendar, X, Menu, Clock, SlidersHorizontal, ChevronRight, Trophy, Sparkles, Home, Shield, FileText } from 'lucide-react';
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
    router.push(`/watch/${slug}`);
    setSearchQuery('');
    setIsDrawerOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-neutral-100 shadow-xs backdrop-blur-md bg-opacity-95">
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

      {/* Slide-out Global Hamburger Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Dark blur backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-55"
            />

            {/* Side-Drawer Container (slides from right) */}
            <motion.div
              ref={drawerRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-55 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drawer Top Header */}
              <div className="px-5 py-4 flex items-center justify-between bg-white relative z-10 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center -rotate-12 transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#009739" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12h4l3-9 5 18 3-9h3" />
                    </svg>
                  </div>
                  <span className="font-display font-extrabold flex items-center text-[22px] tracking-tight">
                    <span className="text-zinc-900">Zim</span>
                    <span className="text-[#009739]">Kick</span>
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 hover:bg-neutral-100 rounded-full cursor-pointer transition-colors"
                >
                  <X className="w-6 h-6 text-slate-600" />
                </button>
              </div>

              {/* Dynamic Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 bg-[#f8f9fa]">
                <Link
                  href="/"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 bg-[#e8f3ec] text-[#1E8F4E] rounded-xl font-medium text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                >
                  <Home className="w-[1.1rem] h-[1.1rem] stroke-[2.5]" />
                  <span>Matches</span>
                </Link>

                <Link
                  href="/"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-100/80 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <Trophy className="w-5 h-5 stroke-[2]" />
                  <span>Stats</span>
                </Link>

                <Link
                  href="/"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-100/80 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <Shield className="w-5 h-5 stroke-[2]" />
                  <span>Privacy Policy</span>
                </Link>

                <Link
                  href="/"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-neutral-100/80 rounded-xl font-medium text-[15px] transition-colors"
                >
                  <FileText className="w-5 h-5 stroke-[2]" />
                  <span>Terms &amp; Conditions</span>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
