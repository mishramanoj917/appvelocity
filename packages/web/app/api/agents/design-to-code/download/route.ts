import { promises as fs } from 'node:fs';
import { NextRequest, NextResponse } from 'next/server';
import { jobStore } from '@/lib/job-store';
import { getProjectZipPath } from '@/lib/project-store';

/**
 * GET /api/agents/design-to-code/download?jobId={id}
 *
 * Tries in-memory buffer first; falls back to disk for jobs restored from
 * project history (e.g. after a server restart).
 */
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId query param is required' }, { status: 400 });
  }

  // ── Try in-memory first ───────────────────────────────────────────────────
  const job = jobStore.get(jobId);

  if (job) {
    if (job.status === 'running') {
      return NextResponse.json({ error: 'Job is still running' }, { status: 202 });
    }
    if (job.status === 'failed') {
      return NextResponse.json({ error: job.error ?? 'Job failed' }, { status: 500 });
    }

    const data = (job.result as { data?: Record<string, unknown> } | undefined)?.data;
    const zipBuffer = data?.['zipBuffer'] as Buffer | undefined;

    if (zipBuffer && Buffer.isBuffer(zipBuffer)) {
      const projectName =
        (data?.['projectBundle'] as { projectName?: string } | undefined)?.projectName ?? 'project';
      return zipResponse(zipBuffer, zipBuffer.byteLength, projectName);
    }
  }

  // ── Fall back to disk ─────────────────────────────────────────────────────
  const zipPath = await getProjectZipPath(jobId);
  if (zipPath) {
    const buf = await fs.readFile(zipPath);
    const projectName = zipPath.replace(/.*[\\/]/, '').replace(/\.zip$/, '');
    return zipResponse(buf, buf.byteLength, projectName);
  }

  return NextResponse.json({ error: 'ZIP archive not found' }, { status: 404 });
}

function zipResponse(data: Buffer, length: number, projectName: string) {
  const filename = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
  return new Response(data as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(length),
      'Cache-Control': 'no-store',
    },
  });
}
