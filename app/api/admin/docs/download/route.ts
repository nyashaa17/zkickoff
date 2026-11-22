import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/supabase/auth-guard';
import { handleDocsDownload } from '@/lib/admin/docs-download-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return handleDocsDownload(req, requireAdminSession);
}
