'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    // Determine current theme based on <html> class set by inline pre-hydration script
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    setIsDark(isCurrentlyDark);

    // Also listen for system changes if user has not stored a manual preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem('theme');
      if (!stored) {
        if (e.matches) {
          document.documentElement.classList.add('dark');
          setIsDark(true);
        } else {
          document.documentElement.classList.remove('dark');
          setIsDark(false);
        }
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);

    if (nextIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Render placeholder with matching dimensions prior to client hydration
  if (!mounted) {
    return (
      <button
        aria-label="Toggle dark mode"
        className={`p-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-400 opacity-60 pointer-events-none flex items-center gap-2 ${className}`}
      >
        <div className="w-4 h-4" />
        {showLabel && <span className="text-xs font-display font-bold">Theme</span>}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`p-2 rounded-xl border border-neutral-800 hover:border-brand-green/40 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-brand-green transition-all cursor-pointer flex items-center gap-2 ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-brand-green transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-neutral-300 transition-transform hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs font-display font-bold text-neutral-200">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}
