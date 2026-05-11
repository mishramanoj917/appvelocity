import { promises as fs } from 'node:fs';
import { NextRequest, NextResponse } from 'next/server';
import { getProjectZipPath } from '@/lib/project-store';

/** GET /api/agents/design-to-code/history/[jobId]/download — streams ZIP from disk. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const zipPath = await getProjectZipPath(params.jobId);

  if (!zipPath) {
    return NextResponse.json({ error: 'ZIP not found for this project' }, { status: 404 });
  }

  const buf = await fs.readFile(zipPath);
  const filename = zipPath.replace(/.*[\\/]/, ''); // basename

  return new Response(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(buf.byteLength),
      'Cache-Control':       'no-store',
    },
  });
}
