'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export default function AdblockNotice() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="bg-emerald-50 text-emerald-900 py-2 px-4 text-xs text-center border-b border-emerald-100 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <span>
          Ads help cover our server costs and keep our video player <strong className="font-bold">100% ad-free</strong>. Please support us by disabling your adblocker.
        </span>
        <button 
          onClick={() => setVisible(false)} 
          className="ml-4 p-1 hover:bg-emerald-200 rounded-full transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
