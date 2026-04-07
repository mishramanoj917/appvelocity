'use client';

/**
 * /agents/design-to-code/jobs/[jobId]
 *
 * Job result page for a DesignToCode run.
 * - Polls /api/agents/status/[jobId] until the job is terminal
 * - Renders CodeViewer with the generated files on success
 * - Shows error details on failure
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CodeViewer, type CodeFile } from '@/components/code-viewer/CodeViewer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowLogEntry {
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

interface GeneratedCode {
  framework: string;
  files: CodeFile[];
  dependencies: Record<string, string>;
}

interface AgentOutputData {
  generatedCode?: GeneratedCode;
  logs?: WorkflowLogEntry[];
  validationResult?: { valid: boolean; score: number };
}

interface AgentOutput {
  success: boolean;
  data?: AgentOutputData;
  errors?: Array<{ code: string; message: string }>;
  metadata?: { executionTime: number };
}

interface Job {
  jobId: string;
  agentId: string;
  status: 'running' | 'complete' | 'failed';
  result?: AgentOutput;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobResultPage({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const [job, setJob] = useState<Job | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      const res = await fetch(`/api/agents/status/${jobId}`);
      if (res.status === 404) {
        setNotFound(true);
        if (timer) clearInterval(timer);
        return;
      }
      const data = (await res.json()) as Job;
      setJob(data);
      if (data.status !== 'running') {
        if (timer) clearInterval(timer);
      }
    }

    poll();
    timer = setInterval(poll, 2000);
    return () => { if (timer) clearInterval(timer); };
  }, [jobId]);

  // ── Not found ───────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <CenteredLayout>
        <p className="text-gray-400">Job not found. It may have expired.</p>
        <Link
          href="/agents/design-to-code"
          className="mt-4 block text-sm text-brand-400 transition-colors hover:text-brand-300"
        >
          ← Start a new job
        </Link>
      </CenteredLayout>
    );
  }

  // ── Still running ───────────────────────────────────────────────────────────
  if (!job || job.status === 'running') {
    return (
      <CenteredLayout>
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="text-gray-400">Generating code…</p>
        <p className="mt-1 font-mono text-xs text-gray-600">{jobId}</p>
      </CenteredLayout>
    );
  }

  // ── Failed ──────────────────────────────────────────────────────────────────
  if (job.status === 'failed' || !job.result?.success) {
    const errMsg =
      job.error ??
      job.result?.errors?.[0]?.message ??
      'The agent encountered an unexpected error.';
    return (
      <PageLayout jobId={jobId}>
        <div className="av-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Error</h2>
            <FailedBadge />
          </div>
          <div className="rounded-lg bg-red-950/40 p-4 text-sm text-red-400">{errMsg}</div>
          <Link
            href="/agents/design-to-code"
            className="mt-3 block text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            ← Try again
          </Link>
        </div>
      </PageLayout>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  const generatedCode = job.result?.data?.generatedCode;
  const pipelineLogs = job.result?.data?.logs ?? [];
  const validation = job.result?.data?.validationResult;
  const durationSec = ((job.updatedAt - job.createdAt) / 1000).toFixed(1);

  if (!generatedCode?.files.length) {
    return (
      <PageLayout jobId={jobId}>
        <div className="av-card text-sm text-gray-400">
          No files were generated. The agent completed but produced an empty bundle.
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout jobId={jobId}>
      {/* ── Summary row ──────────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="av-badge border border-green-900 bg-green-950 px-3 py-1 text-sm text-green-400">
          ✓ {generatedCode.files.length} file{generatedCode.files.length !== 1 ? 's' : ''} generated
        </span>
        <span className="av-badge border border-gray-800 bg-gray-900 px-3 py-1 text-sm text-gray-400">
          {generatedCode.framework}
        </span>
        <span className="av-badge border border-gray-800 bg-gray-900 px-3 py-1 text-sm text-gray-400">
          {durationSec}s
        </span>
        {validation && (
          <span
            className={`av-badge border px-3 py-1 text-sm ${
              validation.valid
                ? 'border-green-900 bg-green-950 text-green-400'
                : 'border-yellow-900 bg-yellow-950 text-yellow-400'
            }`}
          >
            IR score {validation.score}/100
          </span>
        )}
      </div>

      {/* ── Code viewer ──────────────────────────────────────────────────────── */}
      <CodeViewer
        files={generatedCode.files}
        framework={generatedCode.framework}
        jobId={jobId}
      />

      {/* ── Dependencies ─────────────────────────────────────────────────────── */}
      {Object.keys(generatedCode.dependencies ?? {}).length > 0 && (
        <div className="av-card mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Suggested Dependencies
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(generatedCode.dependencies).map(([pkg, ver]) => (
              <code
                key={pkg}
                className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-300"
              >
                {pkg}@{ver}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* ── Pipeline log ─────────────────────────────────────────────────────── */}
      {pipelineLogs.length > 0 && (
        <div className="av-card mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Pipeline Log
          </h3>
          <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-950 p-3">
            {pipelineLogs.map((entry, i) => (
              <div
                key={i}
                className={`av-log text-xs ${
                  entry.level === 'error'
                    ? 'text-red-400'
                    : entry.level === 'success'
                    ? 'text-green-400'
                    : entry.level === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-500'
                }`}
              >
                [{entry.level}] {entry.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function PageLayout({ jobId, children }: { jobId: string; children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <header className="border-b border-gray-800 bg-gray-950/80 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link
            href="/agents/design-to-code"
            className="text-sm text-gray-500 transition-colors hover:text-gray-300"
          >
            ← New job
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-300">DesignToCodeAgent</span>
          <span className="text-gray-700">/</span>
          <span className="font-mono text-xs text-gray-500">{jobId}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

function CenteredLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2">
      {children}
    </div>
  );
}

function FailedBadge() {
  return (
    <span className="av-badge border border-red-900 bg-red-950 text-red-400">✗ Failed</span>
  );
}
