import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { agentRegistry } from '@/lib/agent-registry';

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

  // Fire-and-forget: execution tracked via job store
  agentEntry.instance!
    .execute({
      ...parsed.data,
      context: { sessionId, projectId: request.headers.get('x-project-id') ?? undefined },
    })
    .then((result) => jobStore.complete(jobId, result))
    .catch((err: Error) => jobStore.fail(jobId, err.message));

  jobStore.create(jobId, agentId);

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

// ---------------------------------------------------------------------------
// Minimal in-memory job store (replace with Redis in production)
// ---------------------------------------------------------------------------
export type JobStatus = 'running' | 'complete' | 'failed';

export interface Job {
  jobId: string;
  agentId: string;
  status: JobStatus;
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

class InMemoryJobStore {
  private jobs = new Map<string, Job>();

  create(jobId: string, agentId: string) {
    this.jobs.set(jobId, {
      jobId,
      agentId,
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  complete(jobId: string, result: unknown) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'complete';
      job.result = result;
      job.updatedAt = Date.now();
    }
  }

  fail(jobId: string, error: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.updatedAt = Date.now();
    }
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }
}

// Singleton exported for use in status + stream routes.
// Attached to globalThis so it survives Next.js hot-module reloads in dev,
// which would otherwise recreate the module and lose all in-flight jobs.
const _global = globalThis as typeof globalThis & { __jobStore?: InMemoryJobStore };
export const jobStore = _global.__jobStore ?? (_global.__jobStore = new InMemoryJobStore());
