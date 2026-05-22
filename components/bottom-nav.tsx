'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, Tv, Clock } from 'lucide-react';

function BottomNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get('tab');

  return (
    <>
      {/* Bottom bar for mobile only */}
      <div id="mobile-bottom-bar" className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-white/95 backdrop-blur-md border border-neutral-200/80 rounded-2xl shadow-xl flex items-center justify-around h-14 px-2">
        <Link 
          href="/" 
          className={`flex flex-col items-center justify-center w-16 h-10 rounded-xl transition-all ${
            pathname === '/' && activeTab !== 'FINISHED' ? 'text-zim-green font-bold' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Home</span>
        </Link>

        <Link 
          href="/live" 
          className={`flex flex-col items-center justify-center w-16 h-10 rounded-xl transition-all relative ${
            pathname === '/live' ? 'text-zim-green font-bold' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <span className="absolute top-0 right-3 flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zim-red opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zim-red"></span>
          </span>
          <Tv className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Live</span>
        </Link>

        <Link 
          href="/?tab=FINISHED"
          className={`flex flex-col items-center justify-center w-16 h-10 rounded-xl transition-all cursor-pointer ${
            activeTab === 'FINISHED' ? 'text-zim-green font-bold' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Finished</span>
        </Link>
      </div>
    </>
  );
}

export default function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavContent />
    </Suspense>
  );
}
