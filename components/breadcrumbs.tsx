'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`flex items-center text-xs font-medium text-neutral-500 select-none overflow-x-auto whitespace-nowrap scrollbar-none py-1.5 ${className}`}
    >
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 transition-colors px-2 py-1 rounded-lg hover:bg-neutral-100 font-display font-bold text-[11px]"
        >
          <Home className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden sm:inline">Home</span>
        </Link>
        
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <div key={index} className="flex items-center gap-1 sm:gap-1.5">
              <ChevronRight className="w-3 h-3 text-neutral-300 shrink-0" />
              {isLast || !item.href ? (
                <span className="text-neutral-800 font-extrabold font-display truncate max-w-[120px] xs:max-w-[180px] sm:max-w-[280px] md:max-w-md bg-neutral-100/90 text-neutral-900 border border-neutral-200/40 px-2 py-0.5 rounded-md text-[11px] tracking-wide">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-neutral-900 transition-colors px-2 py-1 rounded-lg hover:bg-neutral-100 text-neutral-600 font-display font-bold text-[11px]"
                >
                  {item.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
