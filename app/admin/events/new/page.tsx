import React from 'react';
import { Metadata } from 'next';
import EventForm from '../event-form';

export const metadata: Metadata = {
  title: 'Create Event | ZimKickOff Admin',
  robots: { index: false, follow: false },
};

export default function NewEventPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">
      <EventForm mode="create" />
    </div>
  );
}
