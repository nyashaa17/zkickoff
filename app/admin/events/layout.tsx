import React from 'react';
import { requireAdminSession } from '@/lib/supabase/auth-guard';

export default async function AdminEventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforces cryptographic session authentication and admin allowlist validation
  // on all admin event routes, forms, and draft preview player terminals.
  await requireAdminSession();

  return <>{children}</>;
}
