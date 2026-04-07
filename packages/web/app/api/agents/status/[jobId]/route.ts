import { NextRequest, NextResponse } from 'next/server';
import { jobStore } from '../../[agentId]/route';

/**
 * GET /api/agents/status/[jobId]
 * Polls the status of a running agent job.
 *
 * Response shape:
 * {
 *   jobId: string
 *   agentId: string
 *   status: 'running' | 'complete' | 'failed'
 *   result?: unknown        // present when status === 'complete'
 *   error?: string          // present when status === 'failed'
 *   createdAt: number
 *   updatedAt: number
 * }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = jobStore.get(params.jobId);

  if (!job) {
    return NextResponse.json(
      { error: `Job '${params.jobId}' not found` },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}
