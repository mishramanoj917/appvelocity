import { NextRequest, NextResponse } from 'next/server';
import { deleteProject } from '@/lib/project-store';

/** DELETE /api/agents/design-to-code/history/[jobId] — removes project from disk. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  await deleteProject(params.jobId);
  return new NextResponse(null, { status: 204 });
}
