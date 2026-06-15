import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Live Football Broadcasts & Active Streams | ZimKickOff',
  description: 'View all ongoing live football streams. Never miss a goal with ZimKickOff live feeds.',
  alternates: {
    canonical: '/live',
  },
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
