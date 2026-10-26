import React from 'react';
import { Metadata } from 'next';
import ForgotPasswordForm from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password | ZimKickOff Admin',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full min-h-[70vh] flex items-center justify-center px-4 py-12">
      <ForgotPasswordForm />
    </div>
  );
}
