import { NextRequest, NextResponse } from 'next/server';
import { jobStore } from '@/lib/job-store';
import { loadBundle } from '@/lib/project-store';

/**
 * GET /api/agents/status/[jobId]
 *
 * Returns in-memory job if present. Falls back to disk (project-store) so
 * that the result page keeps working after a server restart.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = jobStore.get(params.jobId);

  if (job) {
    return NextResponse.json(job);
  }

  // Disk fallback — reconstruct a synthetic complete job from saved bundle
  const bundle = await loadBundle(params.jobId);
  if (bundle) {
    return NextResponse.json({
      jobId:     params.jobId,
      agentId:   'design-to-code',
      status:    'complete',
      steps:     [],
      result:    {
        success: true,
        data:    { projectBundle: bundle },
      },
      createdAt: 0,
      updatedAt: 0,
    });
  }

  return NextResponse.json(
    { error: `Job '${params.jobId}' not found` },
    { status: 404 }
  );
}
