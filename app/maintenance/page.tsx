import React from 'react';
import { Settings } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Under Maintenance - Total Sports Live',
  description: 'We are currently undergoing scheduled server maintenance to improve your experience.',
  robots: {
    index: false,
    follow: false,
  }
};

export default function MaintenancePage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-neutral-200 max-w-lg w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-amber-100 p-4 rounded-full">
            <Settings className="w-12 h-12 text-amber-600 animate-spin" />
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4">
          We'll be back shortly!
        </h1>
        <p className="text-neutral-600 mb-6 leading-relaxed">
          We're currently performing a scheduled server migration to improve your experience. 
          Our service will be back online securely as soon as possible.
        </p>
        <div className="text-sm font-medium text-neutral-500 bg-neutral-50 py-3 rounded-lg border border-neutral-100">
          Expected downtime: less than an hour
        </div>
      </div>
    </div>
  );
}
