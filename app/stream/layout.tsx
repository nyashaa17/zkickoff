import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Football Streams Directory | ZimKickOff',
  description: 'ZimKickOff high-quality football stream directory. Find live matches now.',
  alternates: {
    canonical: '/stream',
  },
};

export default function StreamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
