import { NextRequest } from 'next/server';
import { jobStore } from '@/lib/job-store';

/**
 * GET /api/agents/stream/[jobId]
 * Server-Sent Events (SSE) stream for real-time agent output.
 *
 * Events emitted:
 *   event: log       – incremental log/reasoning output from the agent
 *   event: progress  – progress update { step, total, label }
 *   event: complete  – final result when agent finishes
 *   event: error     – error detail when agent fails
 *
 * Usage (client):
 *   const es = new EventSource(`/api/agents/stream/${jobId}`);
 *   es.addEventListener('log', (e) => console.log(JSON.parse(e.data)));
 *   es.addEventListener('complete', (e) => { ... es.close(); });
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = jobStore.get(params.jobId);
  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Keep-alive ping every 15 s to prevent proxy timeouts
      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, 15_000);

      // Poll job store until terminal state
      // In production: subscribe to a Redis pub/sub channel instead
      let attempts = 0;
      const maxAttempts = 360; // 3 minutes at 500ms
      let lastStepIndex = 0; // tracks which steps we've already emitted

      const poll = setInterval(() => {
        attempts++;
        const current = jobStore.get(params.jobId);

        if (!current || attempts >= maxAttempts) {
          send('error', { message: 'Job timed out or not found' });
          clearInterval(poll);
          clearInterval(ping);
          controller.close();
          return;
        }

        // Emit any new pipeline steps since the last poll
        const newSteps = current.steps.slice(lastStepIndex);
        for (const step of newSteps) {
          send('step', { step });
        }
        lastStepIndex += newSteps.length;

        if (current.status === 'complete') {
          // Strip zipBuffer (can be hundreds of KB) — client fetches it via /download endpoint
          const output = current.result as
            | { success?: boolean; data?: Record<string, unknown>; errors?: unknown[] }
            | undefined;
          const data = output?.data ?? {};
          const projectName =
            (data['projectBundle'] as { projectName?: string } | undefined)?.projectName ??
            (data['executionPlan'] as { projectName?: string } | undefined)?.projectName ??
            'project';
          send('complete', {
            success: output?.success ?? false,
            projectName,
            errors: output?.errors ?? (data['errors'] as unknown[] | undefined) ?? [],
          });
          clearInterval(poll);
          clearInterval(ping);
          controller.close();
          return;
        }

        if (current.status === 'failed') {
          send('error', { message: current.error ?? 'Unknown error' });
          clearInterval(poll);
          clearInterval(ping);
          controller.close();
          return;
        }
      }, 500);

      // Clean up if the client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(poll);
        clearInterval(ping);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
