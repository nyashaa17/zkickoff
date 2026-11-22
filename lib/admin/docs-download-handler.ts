import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAdminSession } from '@/lib/supabase/auth-guard';

type SupportedFormat = 'pdf' | 'md' | 'txt';

interface FormatConfig {
  filename: string;
  mimeType: string;
}

const FORMAT_MAP: Record<SupportedFormat, FormatConfig> = {
  pdf: {
    filename: 'ZimKickOff_Developer_API_Documentation.pdf',
    mimeType: 'application/pdf',
  },
  md: {
    filename: 'ZimKickOff_Developer_API_Documentation.md',
    mimeType: 'text/markdown; charset=utf-8',
  },
  txt: {
    filename: 'ZimKickOff_Developer_API_Documentation.txt',
    mimeType: 'text/plain; charset=utf-8',
  },
};

/**
 * Resolves the absolute path to a documentation file across local dev,
 * production, and standalone Next.js deployment runtimes.
 */
function resolveDocFilePath(filename: string): string | null {
  const candidatePaths = [
    path.join(process.cwd(), 'docs', 'developer-api', filename),
    path.join(process.cwd(), '.next', 'standalone', 'docs', 'developer-api', filename),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function handleDocsDownload(
  req: NextRequest,
  authGuard: () => Promise<any> = requireAdminSession
) {
  // 1. Enforce strict administrator authorization
  try {
    const session = await authGuard();
    if (!session || !['admin', 'superadmin'].includes(session.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied: Administrator privileges required to download API documentation.',
          },
        },
        { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }
  } catch (err: any) {
    // If not authenticated or session verification fails
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Sign in as an administrator to download API documentation.',
        },
      },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  // 2. Validate format parameter (strictly whitelist pdf, md, txt)
  const { searchParams } = new URL(req.url);
  const rawFormat = (searchParams.get('format') || '').toLowerCase().trim();

  if (!rawFormat || !(rawFormat in FORMAT_MAP)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: 'Unsupported format requested. Supported formats are: "pdf", "md", and "txt".',
        },
      },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  const formatConfig = FORMAT_MAP[rawFormat as SupportedFormat];

  // 3. Resolve file securely on server filesystem (zero user-path concatenation)
  const resolvedPath = resolveDocFilePath(formatConfig.filename);

  if (!resolvedPath) {
    console.error(`[Admin Docs Download] File not found on server: ${formatConfig.filename}`);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DOC_NOT_FOUND',
          message: `The requested documentation package (${formatConfig.filename}) was not found on this server.`,
        },
      },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  try {
    const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ resolvedPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': formatConfig.mimeType,
        'Content-Disposition': `attachment; filename="${formatConfig.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (fileErr: any) {
    console.error('[Admin Docs Download] Error reading file:', fileErr);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FILE_READ_ERROR',
          message: 'An error occurred while reading the documentation file.',
        },
      },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
