import { NextRequest, NextResponse } from 'next/server';
import { jobStore } from '@/lib/job-store';

/**
 * GET /api/agents/design-to-code/download?jobId={id}
 *
 * Reads the in-memory zipBuffer produced by the projectZipper node and
 * streams it back as a downloadable ZIP archive.
 */
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId query param is required' }, { status: 400 });
  }

  const job = jobStore.get(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status === 'running') {
    return NextResponse.json({ error: 'Job is still running' }, { status: 202 });
  }

  if (job.status === 'failed') {
    return NextResponse.json({ error: job.error ?? 'Job failed' }, { status: 500 });
  }

  // data is WorkflowState — cast to access zipBuffer / projectName
  const data = (job.result as { data?: Record<string, unknown> } | undefined)?.data;

  if (!data) {
    return NextResponse.json({ error: 'No output data for this job' }, { status: 404 });
  }

  const zipBuffer = data['zipBuffer'] as Buffer | undefined;

  if (!zipBuffer || !Buffer.isBuffer(zipBuffer)) {
    return NextResponse.json({ error: 'ZIP archive not found — job may have run in screens-only mode without bundling' }, { status: 404 });
  }

  const projectName =
    (data['projectBundle'] as { projectName?: string } | undefined)?.projectName ??
    (data['executionPlan'] as { projectName?: string } | undefined)?.projectName ??
    'project';

  const filename = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;

  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
