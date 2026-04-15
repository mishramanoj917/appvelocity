// ---------------------------------------------------------------------------
// Minimal in-memory job store (replace with Redis in production)
// ---------------------------------------------------------------------------
// Kept in a separate lib module so it can be imported by multiple Next.js
// route handlers without triggering the "only HTTP methods may be exported
// from route files" TypeScript constraint.
// ---------------------------------------------------------------------------

export type JobStatus = 'running' | 'complete' | 'failed';

export interface Job {
  jobId: string;
  agentId: string;
  status: JobStatus;
  result?: unknown;
  error?: string;
  /** Ordered list of pipeline step names emitted by the agent in real time */
  steps: string[];
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
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  pushStep(jobId: string, step: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.steps.push(step);
      job.updatedAt = Date.now();
    }
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

// Singleton attached to globalThis so it survives Next.js hot-module reloads
// in dev, which would otherwise recreate the module and lose all in-flight jobs.
const _global = globalThis as typeof globalThis & { __jobStore?: InMemoryJobStore };
export const jobStore = _global.__jobStore ?? (_global.__jobStore = new InMemoryJobStore());
