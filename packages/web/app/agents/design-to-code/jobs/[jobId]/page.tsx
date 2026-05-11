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
import { FileTreeView } from '@/components/code-viewer/file-tree';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectBundleData {
  projectName?: string;
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
  projectBundle?: ProjectBundleData;
  logs?: string[];
  iterations?: number;
  // Optional fields populated by future pipeline enhancements
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
  steps?: string[];
  createdAt: number;
  updatedAt: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobResultPage({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const [job, setJob]           = useState<Job | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Lifted file selection state — shared between ProjectStructureCard and CodeViewer
  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);

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

  const projectBundle  = job.result?.data?.projectBundle;
  const pipelineLogs   = job.result?.data?.logs ?? [];
  const gateStats      = job.result?.data?.gateStats;
  const visualQaReports = job.result?.data?.visualQaReports ?? [];
  const snapshotReused = job.result?.data?.snapshotReused;
  const statusBarFiltered = job.result?.data?.statusBarNodesFiltered;
  const escalatedFiles = job.result?.data?.escalatedFiles ?? [];
  const durationSec    = ((job.updatedAt - job.createdAt) / 1000).toFixed(1);

  if (!projectBundle?.files.length) {
    return (
      <PageLayout jobId={jobId}>
        <div className="av-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              No files generated
            </h2>
          </div>
          <p className="mb-3 text-sm text-gray-400">
            The agent completed but produced an empty bundle. Check the pipeline log below.
          </p>
          {pipelineLogs.length > 0 && <PipelineLogCard logs={pipelineLogs} />}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout jobId={jobId}>
      {/* ── Summary row ──────────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="av-badge border border-green-200 bg-green-50 px-3 py-1 text-sm text-green-700">
          ✓ {projectBundle.files.length} file{projectBundle.files.length !== 1 ? 's' : ''} generated
        </span>
        <span className="av-badge border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600">
          {projectBundle.framework}
        </span>
        <span className="av-badge border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600">
          {durationSec}s
        </span>
        {snapshotReused === true && (
          <span className="av-badge border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
            📦 Snapshot reused
          </span>
        )}
        {typeof statusBarFiltered === 'number' && statusBarFiltered > 0 && (
          <span className="av-badge border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-500">
            {statusBarFiltered} status bar nodes filtered
          </span>
        )}
      </div>

      {/* ── Project structure ────────────────────────────────────────────────── */}
      <ProjectStructureCard
        files={projectBundle.files}
        selectedFile={selectedFile}
        onFileSelect={setSelectedFile}
      />

      {/* ── Code viewer ──────────────────────────────────────────────────────── */}
      <CodeViewer
        files={projectBundle.files}
        framework={projectBundle.framework}
        jobId={jobId}
        selectedFile={selectedFile}
        onFileSelect={setSelectedFile}
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
            <span className="ml-2 rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-700">
              {escalatedFiles.length}
            </span>
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            These files failed Gate 1 after 3 attempts and require human review.
          </p>
          <div className="space-y-1">
            {escalatedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-2 rounded border border-yellow-200 bg-yellow-50 px-3 py-2">
                <span className="text-yellow-600">⚠</span>
                <code className="font-mono text-xs text-yellow-800">{file}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Dependencies ─────────────────────────────────────────────────────── */}
      {Object.keys(projectBundle.dependencies ?? {}).length > 0 && (
        <div className="av-card mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Suggested Dependencies
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(projectBundle.dependencies).map(([pkg, ver]) => (
              <code
                key={pkg}
                className="rounded bg-gray-100 border border-gray-200 px-2 py-0.5 font-mono text-xs text-gray-700"
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

// ─── Project structure card ───────────────────────────────────────────────────

function ProjectStructureCard({
  files,
  selectedFile,
  onFileSelect,
}: {
  files: CodeFile[];
  selectedFile: string | undefined;
  onFileSelect: (path: string) => void;
}) {
  const totalFiles   = files.length;
  const dirs = new Set(
    files
      .map((f) => f.path.split('/').slice(0, -1).join('/'))
      .filter(Boolean)
  );
  const totalFolders = dirs.size;

  return (
    <div className="av-card mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Project Structure
        </h3>
        <span className="text-[10px] text-gray-400">
          {totalFiles} files · {totalFolders} folder{totalFolders !== 1 ? 's' : ''}
        </span>
      </div>
      <FileTreeView
        files={files}
        activeFile={selectedFile ?? files[0]?.path ?? ''}
        onSelectFile={onFileSelect}
        theme="light"
        className="max-h-64 overflow-y-auto rounded-lg bg-gray-50 border border-[#e4e7ec] py-1"
      />
    </div>
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
        allGood ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
      }`}
    >
      <p className="mb-1.5 text-[10px] font-medium text-gray-500">{label}</p>
      {labelOverride ? (
        <p className={`text-sm font-semibold ${allGood ? 'text-green-700' : 'text-yellow-700'}`}>
          {labelOverride}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-green-700">{passed} passed</span>
          {failed > 0 && (
            <span className="text-sm font-semibold text-yellow-700">{failed} failed</span>
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
        report.overallPass ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm text-[#0f1724]">{report.screen}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {report.failedLayers.length === 0 ? (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">
                All layers passed
              </span>
            ) : (
              report.failedLayers.map((layer) => (
                <span key={layer} className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">
                  {layer} failed
                </span>
              ))
            )}
          </div>
        </div>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            report.overallPass
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-600'
          }`}
        >
          {report.overallPass ? '✓ Pass' : '✗ Fail'}
        </span>
      </div>

      {/* Layer details */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-[10px]">
        {report.tokenDiff && (
          <div className="rounded bg-white border border-[#e4e7ec] px-2 py-1.5">
            <p className="text-gray-400">Token diff</p>
            <p className={report.tokenDiff.critical > 0 ? 'text-red-600' : 'text-green-700'}>
              {report.tokenDiff.critical} critical · {report.tokenDiff.warnings} warn
            </p>
          </div>
        )}
        {report.pixelDiff && (
          <div className="rounded bg-white border border-[#e4e7ec] px-2 py-1.5">
            <p className="text-gray-400">Pixel diff</p>
            <p className={report.pixelDiff.diffPercent > 15 ? 'text-red-600' : 'text-green-700'}>
              {report.pixelDiff.diffPercent.toFixed(1)}%
            </p>
          </div>
        )}
        {report.visualJudge && (
          <div className="rounded bg-white border border-[#e4e7ec] px-2 py-1.5">
            <p className="text-gray-400">LLM judge</p>
            <p className={report.visualJudge.score >= 85 ? 'text-green-700' : 'text-yellow-700'}>
              {report.visualJudge.score}/100
            </p>
          </div>
        )}
        {report.structural && (
          <div className="rounded bg-white border border-[#e4e7ec] px-2 py-1.5">
            <p className="text-gray-400">Structural</p>
            <p className={report.structural.missing.length > 0 ? 'text-yellow-700' : 'text-green-700'}>
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

function PipelineLogCard({ logs }: { logs: string[] }) {
  return (
    <div className="av-card">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Pipeline Log
      </h3>
      <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 border border-[#e4e7ec] p-3">
        {logs.map((entry, i) => (
          <div
            key={i}
            className={`av-log font-mono text-xs ${
              /error|fail/i.test(entry)
                ? 'text-red-600'
                : /success|done|zip|pass/i.test(entry)
                ? 'text-green-700'
                : /warn/i.test(entry)
                ? 'text-yellow-700'
                : 'text-gray-500'
            }`}
          >
            {entry}
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
      <header className="border-b border-[#e4e7ec] bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link
            href="/agents/design-to-code"
            className="text-sm text-gray-500 transition-colors hover:text-[#0f1724]"
          >
            ← New job
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-[#0f1724]">DesignToCodeAgent</span>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-xs text-gray-400">{jobId}</span>
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
    <span className="av-badge border border-red-200 bg-red-50 text-red-600">✗ Failed</span>
  );
}
