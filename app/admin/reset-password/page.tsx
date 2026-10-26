import React, { Suspense } from 'react';
import { Metadata } from 'next';
import ResetPasswordForm from './reset-password-form';

export const metadata: Metadata = {
  title: 'Set New Password | ZimKickOff Admin',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="w-full min-h-[70vh] flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="w-full max-w-md mx-auto p-8 bg-white border border-neutral-200 rounded-3xl animate-pulse h-96" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
