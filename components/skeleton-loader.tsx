'use client';

import React from 'react';

export function MatchCardSkeleton() {
  return (
    <div className="bg-white border border-neutral-200/60 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
      {/* Left info (Competition & Status) */}
      <div className="w-full md:w-1/4 flex flex-col gap-2">
        <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
        <div className="h-5 bg-neutral-200 rounded w-1/3"></div>
      </div>
      
      {/* Teams and Score line */}
      <div className="w-full md:w-2/4 flex items-center justify-between gap-4 py-2 border-y md:border-y-0 border-neutral-100 my-1 md:my-0">
        <div className="flex items-center gap-3 w-[45%] justify-end">
          <div className="h-4 bg-neutral-200 rounded w-2/3 text-right"></div>
          <div className="w-8 h-8 rounded-full bg-neutral-200 shrink-0"></div>
        </div>

        <div className="h-6 bg-neutral-200 rounded w-10 shrink-0"></div>

        <div className="flex items-center gap-3 w-[45%] justify-start">
          <div className="w-8 h-8 rounded-full bg-neutral-200 shrink-0"></div>
          <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
        </div>
      </div>

      {/* Action Button */}
      <div className="w-full md:w-1/4 flex md:justify-end shrink-0">
        <div className="h-10 bg-neutral-200 rounded-xl w-full md:w-28"></div>
      </div>
    </div>
  );
}

export function MatchGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DetailedPageSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 animate-pulse">
      <div className="h-6 bg-neutral-200 rounded w-1/4 mb-6"></div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Large video player mockup */}
          <div className="aspect-video bg-neutral-200 rounded-2xl w-full"></div>
          
          {/* Match details skeleton */}
          <div className="bg-white border border-neutral-200/60 p-5 rounded-2xl space-y-3">
            <div className="h-4 bg-neutral-200 rounded w-1/3"></div>
            <div className="h-7 bg-neutral-200 rounded w-2/3"></div>
            <div className="h-5 bg-neutral-200 rounded w-1/2"></div>
          </div>
        </div>
        
        {/* Sidebar skeleton */}
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200/60 p-5 rounded-2xl space-y-4">
            <div className="h-5 bg-neutral-200 rounded w-1/2"></div>
            <div className="space-y-2">
              <div className="h-10 bg-neutral-200 rounded-lg"></div>
              <div className="h-10 bg-neutral-200 rounded-lg"></div>
              <div className="h-10 bg-neutral-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
