'use client';

/**
 * /agents/design-to-code/jobs/[jobId]
 *
 * Job result page for a DesignToCode run.
 * - Polls /api/agents/status/[jobId] until the job is terminal
 * - Renders CodeViewer with the generated files on success
 * - Shows gate stats, visual QA reports, snapshot info, and escalated files
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

interface GateStats {
  gate1: { passed: number; failed: number; escalated: number };
  gate2?: { newErrors: number };
  gate3?: { passed: boolean; errorCount: number };
}

interface VisualQAReport {
  screen: string;
  overallPass: boolean;
  failedLayers: ('structural' | 'token' | 'pixel' | 'visual')[];
  structural?: { missing: string[]; extra: string[] };
  tokenDiff?: { critical: number; warnings: number };
  pixelDiff?: { diffPercent: number };
  visualJudge?: { score: number; issues: string[]; pass: boolean };
}

interface AgentOutputData {
  generatedCode?: GeneratedCode;
  logs?: WorkflowLogEntry[];
  validationResult?: {
    valid: boolean;
    score: number;
    issues?: Array<{ severity: string; message: string; fixSuggestion?: string }>;
  };
  // New 6-agent pipeline fields
  gateStats?: GateStats;
  snapshotReused?: boolean;
  statusBarNodesFiltered?: number;
  escalatedFiles?: string[];
  visualQaReports?: VisualQAReport[];
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

  if (!job || job.status === 'running') {
    return (
      <CenteredLayout>
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="text-gray-400">Pipeline running…</p>
        <p className="mt-1 font-mono text-xs text-gray-600">{jobId}</p>
      </CenteredLayout>
    );
  }

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

  const generatedCode  = job.result?.data?.generatedCode;
  const pipelineLogs   = job.result?.data?.logs ?? [];
  const validation     = job.result?.data?.validationResult;
  const gateStats      = job.result?.data?.gateStats;
  const visualQaReports = job.result?.data?.visualQaReports ?? [];
  const snapshotReused = job.result?.data?.snapshotReused;
  const statusBarFiltered = job.result?.data?.statusBarNodesFiltered;
  const escalatedFiles = job.result?.data?.escalatedFiles ?? [];
  const durationSec    = ((job.updatedAt - job.createdAt) / 1000).toFixed(1);

  if (!generatedCode?.files.length) {
    const irIssues = validation?.issues?.filter((i) => i.severity === 'error') ?? [];
    return (
      <PageLayout jobId={jobId}>
        <div className="av-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              No files generated
            </h2>
            {validation && (
              <span className="rounded-full bg-yellow-950 px-2 py-0.5 text-xs text-yellow-400">
                IR score: {validation.score}/100
              </span>
            )}
          </div>
          <p className="mb-3 text-sm text-gray-400">
            {irIssues.length > 0
              ? 'The IR validator found structural issues that prevented code generation.'
              : 'The agent completed but produced an empty bundle. Check the pipeline log below.'}
          </p>
          {irIssues.length > 0 && (
            <ul className="mb-4 space-y-1">
              {irIssues.map((issue, i) => (
                <li key={i} className="rounded bg-red-950/40 px-3 py-2 text-xs text-red-400">
                  {issue.message}
                  {issue.fixSuggestion && (
                    <span className="ml-2 text-gray-500">→ {issue.fixSuggestion}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {pipelineLogs.length > 0 && <PipelineLogCard logs={pipelineLogs} />}
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
        {snapshotReused === true && (
          <span className="av-badge border border-emerald-900 bg-emerald-950 px-3 py-1 text-sm text-emerald-400">
            📦 Snapshot reused
          </span>
        )}
        {typeof statusBarFiltered === 'number' && statusBarFiltered > 0 && (
          <span className="av-badge border border-gray-800 bg-gray-900 px-3 py-1 text-sm text-gray-500">
            {statusBarFiltered} status bar nodes filtered
          </span>
        )}
      </div>

      {/* ── Code viewer ──────────────────────────────────────────────────────── */}
      <CodeViewer
        files={generatedCode.files}
        framework={generatedCode.framework}
        jobId={jobId}
      />

      {/* ── Gate stats ───────────────────────────────────────────────────────── */}
      {gateStats && (
        <div className="av-card mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Validation Gates
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <GateCard
              label="Gate 1 — Pre-write static check"
              passed={gateStats.gate1.passed}
              failed={gateStats.gate1.failed}
              extra={gateStats.gate1.escalated > 0 ? `${gateStats.gate1.escalated} escalated` : undefined}
              extraColor="text-yellow-400"
            />
            {gateStats.gate2 !== undefined && (
              <GateCard
                label="Gate 2 — Post-write lint diff"
                passed={0}
                failed={gateStats.gate2.newErrors}
                labelOverride={`${gateStats.gate2.newErrors} new error${gateStats.gate2.newErrors !== 1 ? 's' : ''}`}
              />
            )}
            {gateStats.gate3 !== undefined && (
              <GateCard
                label="Gate 3 — Incremental compile"
                passed={gateStats.gate3.passed ? 1 : 0}
                failed={gateStats.gate3.passed ? 0 : 1}
                labelOverride={gateStats.gate3.passed ? 'Passed' : `Failed (${gateStats.gate3.errorCount} errors)`}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Visual QA reports ────────────────────────────────────────────────── */}
      {visualQaReports.length > 0 && (
        <div className="av-card mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Visual QA Reports
          </h3>
          <div className="space-y-3">
            {visualQaReports.map((report) => (
              <VisualQACard key={report.screen} report={report} />
            ))}
          </div>
        </div>
      )}

      {/* ── Escalated files ──────────────────────────────────────────────────── */}
      {escalatedFiles.length > 0 && (
        <div className="av-card mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Escalated Files
            <span className="ml-2 rounded bg-yellow-950 px-1.5 py-0.5 text-yellow-400">
              {escalatedFiles.length}
            </span>
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            These files failed Gate 1 after 3 attempts and require human review.
          </p>
          <div className="space-y-1">
            {escalatedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-yellow-950/30 px-3 py-2">
                <span className="text-yellow-500">⚠</span>
                <code className="font-mono text-xs text-yellow-300">{file}</code>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <div className="mt-6">
          <PipelineLogCard logs={pipelineLogs} />
        </div>
      )}
    </PageLayout>
  );
}

// ─── Gate card ────────────────────────────────────────────────────────────────

function GateCard({
  label,
  passed,
  failed,
  extra,
  extraColor = 'text-gray-500',
  labelOverride,
}: {
  label: string;
  passed: number;
  failed: number;
  extra?: string;
  extraColor?: string;
  labelOverride?: string;
}) {
  const allGood = failed === 0;
  return (
    <div
      className={`rounded-lg border p-3 ${
        allGood ? 'border-green-900 bg-green-950/30' : 'border-yellow-900 bg-yellow-950/20'
      }`}
    >
      <p className="mb-1.5 text-[10px] font-medium text-gray-500">{label}</p>
      {labelOverride ? (
        <p className={`text-sm font-semibold ${allGood ? 'text-green-400' : 'text-yellow-400'}`}>
          {labelOverride}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-green-400">{passed} passed</span>
          {failed > 0 && (
            <span className="text-sm font-semibold text-yellow-400">{failed} failed</span>
          )}
          {extra && <span className={`text-xs ${extraColor}`}>{extra}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Visual QA card ───────────────────────────────────────────────────────────

function VisualQACard({ report }: { report: VisualQAReport }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        report.overallPass ? 'border-green-900 bg-green-950/20' : 'border-red-900 bg-red-950/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm text-gray-200">{report.screen}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {report.failedLayers.length === 0 ? (
              <span className="rounded bg-green-950 px-1.5 py-0.5 text-[10px] text-green-400">
                All layers passed
              </span>
            ) : (
              report.failedLayers.map((layer) => (
                <span key={layer} className="rounded bg-red-950 px-1.5 py-0.5 text-[10px] text-red-400">
                  {layer} failed
                </span>
              ))
            )}
          </div>
        </div>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            report.overallPass
              ? 'bg-green-950 text-green-400'
              : 'bg-red-950 text-red-400'
          }`}
        >
          {report.overallPass ? '✓ Pass' : '✗ Fail'}
        </span>
      </div>

      {/* Layer details */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-[10px]">
        {report.tokenDiff && (
          <div className="rounded bg-gray-900 px-2 py-1.5">
            <p className="text-gray-600">Token diff</p>
            <p className={report.tokenDiff.critical > 0 ? 'text-red-400' : 'text-green-400'}>
              {report.tokenDiff.critical} critical · {report.tokenDiff.warnings} warn
            </p>
          </div>
        )}
        {report.pixelDiff && (
          <div className="rounded bg-gray-900 px-2 py-1.5">
            <p className="text-gray-600">Pixel diff</p>
            <p className={report.pixelDiff.diffPercent > 15 ? 'text-red-400' : 'text-green-400'}>
              {report.pixelDiff.diffPercent.toFixed(1)}%
            </p>
          </div>
        )}
        {report.visualJudge && (
          <div className="rounded bg-gray-900 px-2 py-1.5">
            <p className="text-gray-600">LLM judge</p>
            <p className={report.visualJudge.score >= 85 ? 'text-green-400' : 'text-yellow-400'}>
              {report.visualJudge.score}/100
            </p>
          </div>
        )}
        {report.structural && (
          <div className="rounded bg-gray-900 px-2 py-1.5">
            <p className="text-gray-600">Structural</p>
            <p className={report.structural.missing.length > 0 ? 'text-yellow-400' : 'text-green-400'}>
              {report.structural.missing.length} missing
            </p>
          </div>
        )}
      </div>

      {/* LLM judge issues */}
      {report.visualJudge?.issues && report.visualJudge.issues.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {report.visualJudge.issues.slice(0, 3).map((issue, i) => (
            <li key={i} className="text-[10px] text-gray-500">
              <span className="mr-1 text-yellow-600">›</span>{issue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Pipeline log card ────────────────────────────────────────────────────────

function PipelineLogCard({ logs }: { logs: WorkflowLogEntry[] }) {
  return (
    <div className="av-card">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Pipeline Log
      </h3>
      <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-950 p-3">
        {logs.map((entry, i) => (
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
