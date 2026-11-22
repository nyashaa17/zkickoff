import { type NextRequest } from 'next/server';
import { handleAuthCallback } from '@/lib/auth/auth-callback-handler';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
