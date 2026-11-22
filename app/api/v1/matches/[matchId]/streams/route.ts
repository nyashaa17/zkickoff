import { NextRequest } from 'next/server';
import { handleStreamsRequest } from '@/lib/api/streams/streams-request-handler';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  return handleStreamsRequest(req, params);
}
