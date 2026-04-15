import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { agentRegistry } from '@/lib/agent-registry';
import { jobStore } from '@/lib/job-store';

const LaunchSchema = z.object({
  action: z.string(),
  params: z.record(z.string(), z.any()),
  options: z
    .object({
      dryRun: z.boolean().optional(),
      verbose: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST /api/agents/[agentId]
 * Launches an agent job and returns a jobId for polling / streaming.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { agentId } = params;

  // Check the agent exists and is available
  const agentEntry = agentRegistry.get(agentId);
  if (!agentEntry) {
    return NextResponse.json(
      { error: `Agent '${agentId}' not found.` },
      { status: 404 }
    );
  }

  if (agentEntry.status !== 'active') {
    return NextResponse.json(
      {
        error: `Agent '${agentId}' is not yet available (status: ${agentEntry.status}).`,
        plannedCapabilities: agentEntry.plannedCapabilities,
      },
      { status: 503 }
    );
  }

  // Validate the request body
  const body = await request.json().catch(() => null);
  const parsed = LaunchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Create a job and start execution asynchronously
  const jobId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  jobStore.create(jobId, agentId);

  // Fire-and-forget: execution tracked via job store
  agentEntry.instance!
    .execute({
      ...parsed.data,
      context: {
        sessionId,
        projectId: request.headers.get('x-project-id') ?? undefined,
        // Called by the agent after each pipeline node — pushes step name into the job store
        // so the SSE stream can relay it to the dashboard in real time.
        onStep: (step: string) => jobStore.pushStep(jobId, step),
      },
    })
    .then((result) => jobStore.complete(jobId, result))
    .catch((err: Error) => jobStore.fail(jobId, err.message));

  return NextResponse.json(
    {
      jobId,
      agentId,
      status: 'running',
      streamUrl: `/api/agents/stream/${jobId}`,
      statusUrl: `/api/agents/status/${jobId}`,
    },
    { status: 202 }
  );
}

/**
 * GET /api/agents/[agentId]
 * Returns agent metadata and capabilities.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const agentEntry = agentRegistry.get(params.agentId);
  if (!agentEntry) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: params.agentId,
    name: agentEntry.name,
    version: agentEntry.version,
    status: agentEntry.status,
    description: agentEntry.description,
    capabilities: agentEntry.capabilities,
  });
}
