'use client';

/**
 * /agents/design-to-code
 *
 * Launch page for DesignToCodeAgent.
 * - Accepts a Figma URL + framework selector
 * - Shows a visual pipeline of all 8 nodes with live active-node highlighting
 * - Streams human-readable log entries below the pipeline
 * - Navigates to /agents/design-to-code/jobs/[jobId] on completion
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Pipeline definition ──────────────────────────────────────────────────────

interface PipelineNode {
  key: string;          // matches WorkflowState.currentStep values
  label: string;        // short display name
  detail: string;       // sub-label
  llm?: 'always' | 'flutter'; // 'always' = LLM for all frameworks; 'flutter' = Flutter only
}

const PIPELINE: PipelineNode[] = [
  { key: 'InputValidator',         label: 'Validate Input',    detail: 'Figma URL · token check'        },
  { key: 'FigmaFetcherAgent',      label: 'Fetch Figma',       detail: 'Pages · components · variables' },
  { key: 'GenerationPlannerAgent', label: 'Plan Generation',   detail: 'Screen & component order',       llm: 'always'  },
  { key: 'IRBuilderAgent',         label: 'Build IR',          detail: 'DesignIR extraction'             },
  { key: 'IRValidatorAgent',       label: 'Validate IR',       detail: 'Structure · naming · a11y',      llm: 'always'  },
  { key: 'CodeGeneratorAgent',     label: 'Generate Code',     detail: 'Templates + Gemini refine',      llm: 'flutter' },
  { key: 'CodeValidatorAgent',     label: 'Validate Code',     detail: 'Gemini review · dart analyze',   llm: 'flutter' },
  { key: 'CodeFixerAgent',         label: 'Fix Code',          detail: 'Gemini fix · dart format',       llm: 'flutter' },
];

function nodeLLMLabel(node: PipelineNode, framework: 'react-native' | 'flutter'): string | null {
  if (!node.llm) return null;
  if (node.llm === 'always') return framework === 'flutter' ? 'Gemini' : 'GPT-4o';
  if (node.llm === 'flutter') return framework === 'flutter' ? 'Gemini' : null;
  return null;
}

// Human-readable log messages for each step transition
const STEP_LOGS: Record<string, string> = {
  InputValidator:         'Validating Figma URL and access token…',
  FigmaFetcherAgent:      'Fetching design data from Figma…',
  GenerationPlannerAgent: 'Analysing design structure, planning generation…',
  IRBuilderAgent:         'Building Intermediate Representation from Figma nodes…',
  IRValidatorAgent:       'Validating IR quality — structure, naming, accessibility…',
  CodeGeneratorAgent:     'Generating code artifacts from templates…',
  CodeValidatorAgent:     'Running syntax and lint checks on generated files…',
  CodeFixerAgent:         'Applying auto-fixes (prettier / dart format)…',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type NodeStatus = 'idle' | 'active' | 'done' | 'error';

function PipelineNodeCard({
  node,
  status,
  index,
  total,
  llmLabel,
}: {
  node: PipelineNode;
  status: NodeStatus;
  index: number;
  total: number;
  llmLabel: string | null;
}) {
  const isLast = index === total - 1;

  const ring =
    status === 'active' ? 'border-brand-500 bg-brand-950 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]'
    : status === 'done'  ? 'border-green-800 bg-green-950/40'
    : status === 'error' ? 'border-red-800 bg-red-950/40'
    : 'border-gray-800 bg-gray-900';

  const iconColor =
    status === 'active' ? 'text-brand-400'
    : status === 'done'  ? 'text-green-400'
    : status === 'error' ? 'text-red-400'
    : 'text-gray-600';

  const labelColor =
    status === 'active' ? 'text-white'
    : status === 'done'  ? 'text-green-300'
    : status === 'error' ? 'text-red-400'
    : 'text-gray-500';

  const icon =
    status === 'done'  ? '✓'
    : status === 'error' ? '✗'
    : status === 'active' ? '▶'
    : String(index + 1);

  return (
    <div className="flex flex-col items-center">
      <div className={`relative flex w-32 flex-col items-center rounded-xl border p-3 transition-all duration-300 ${ring}`}>
        {/* Icon circle */}
        <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${iconColor} ${status === 'active' ? 'animate-pulse' : ''}`}>
          {icon}
        </div>
        {/* Label */}
        <p className={`text-center text-xs font-semibold leading-tight ${labelColor}`}>{node.label}</p>
        {/* Detail */}
        <p className="mt-0.5 text-center font-mono text-[9px] leading-tight text-gray-600">{node.detail}</p>
        {/* LLM badge — shows model name when applicable */}
        {llmLabel && (
          <span className="mt-1.5 rounded-full bg-indigo-950 px-1.5 py-0.5 font-mono text-[9px] text-indigo-400">
            {llmLabel}
          </span>
        )}
      </div>
      {/* Connector arrow */}
      {!isLast && (
        <div className={`mt-1 text-sm ${status === 'done' ? 'text-green-600' : 'text-gray-700'}`}>→</div>
      )}
    </div>
  );
}

function LogLine({ message, fresh }: { message: string; fresh: boolean }) {
  return (
    <div className={`av-log py-0.5 text-xs leading-relaxed ${fresh ? 'av-cursor text-gray-200' : 'text-gray-500'}`}>
      <span className="mr-2 text-gray-700">›</span>{message}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignToCodePage() {
  const router = useRouter();
  const [figmaUrl, setFigmaUrl]     = useState('');
  const [framework, setFramework]   = useState<'react-native' | 'flutter'>('react-native');
  const [phase, setPhase]           = useState<'idle' | 'running' | 'error'>('idle');
  const [logs, setLogs]             = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [doneSteps, setDoneSteps]   = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg]     = useState('');
  const [countdown, setCountdown]   = useState<number | null>(null);
  const logRef      = useRef<HTMLDivElement>(null);
  const esRef       = useRef<EventSource | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef    = useRef<string>('');

  // Auto-scroll log panel
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Cleanup on unmount
  useEffect(() => () => {
    esRef.current?.close();
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  function pushLog(msg: string) {
    setLogs((l) => [...l, msg]);
  }

  function advanceStep(step: string) {
    setActiveStep((prev) => {
      if (prev) setDoneSteps((d) => new Set(d).add(prev));
      return step;
    });
    const msg = STEP_LOGS[step];
    if (msg) pushLog(msg);
  }

  async function handleLaunch() {
    const url = figmaUrl.trim();
    if (!url) return;

    setPhase('running');
    setLogs(['Starting DesignToCodeAgent…']);
    setActiveStep(null);
    setDoneSteps(new Set());
    setErrorMsg('');

    try {
      const res = await fetch('/api/agents/design-to-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          params: { figmaUrl: url, targetFramework: framework },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPhase('error');
        setErrorMsg((data as { error?: string }).error ?? 'Launch failed');
        return;
      }

      const { jobId, streamUrl } = data as { jobId: string; streamUrl: string };
      jobIdRef.current = jobId;
      pushLog(`Job created (${jobId.slice(0, 8)}…)`);

      const es = new EventSource(streamUrl);
      esRef.current = es;

      // Real-time step events — emitted by the SSE route from job.steps
      es.addEventListener('step', (e) => {
        const { step } = JSON.parse(e.data) as { step: string };
        advanceStep(step);
      });

      es.addEventListener('complete', () => {
        es.close();
        setActiveStep((prev) => {
          if (prev) setDoneSteps((d) => new Set(d).add(prev));
          return null;
        });
        pushLog('Pipeline complete. Loading results in 30 seconds…');

        const DELAY = 30;
        setCountdown(DELAY);

        let remaining = DELAY;
        countdownRef.current = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(countdownRef.current!);
            countdownRef.current = null;
            router.push(`/agents/design-to-code/jobs/${jobId}`);
          }
        }, 1000);
      });

      es.addEventListener('error', (e) => {
        const msg =
          e instanceof MessageEvent
            ? (JSON.parse(e.data) as { message: string }).message
            : 'Stream error';
        setPhase('error');
        setErrorMsg(msg);
        es.close();
      });
    } catch (err) {
      setPhase('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  function handleCancel() {
    esRef.current?.close();
    setPhase('idle');
    setLogs([]);
    setActiveStep(null);
    setDoneSteps(new Set());
  }

  // Derive per-node status
  function nodeStatus(node: PipelineNode): NodeStatus {
    if (doneSteps.has(node.key)) return 'done';
    if (activeStep === node.key) return 'active';
    return 'idle';
  }

  return (
    <div className="min-h-full">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-950/80 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link href="/" className="text-sm text-gray-500 transition-colors hover:text-gray-300">
            ← Dashboard
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-300">DesignToCodeAgent</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        {/* ── Agent header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl"
            style={{ background: '#6366f118', border: '1px solid #6366f130' }}
          >
            🎨
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">DesignToCodeAgent</h1>
            <p className="mt-0.5 text-sm font-medium" style={{ color: '#6366f1' }}>
              Figma → Production Mobile Code
            </p>
          </div>
        </div>

        {/* ── Launch form ──────────────────────────────────────────────────── */}
        <div className="av-card space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Generate Code
          </h2>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Figma File URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50"
              placeholder="https://www.figma.com/file/… or https://www.figma.com/design/…"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              disabled={phase === 'running'}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-400">
              Target Framework
            </label>
            <div className="flex gap-3">
              {(['react-native', 'flutter'] as const).map((fw) => (
                <button
                  key={fw}
                  onClick={() => setFramework(fw)}
                  disabled={phase === 'running'}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    framework === fw
                      ? 'border-brand-600 bg-brand-950 text-brand-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  {fw === 'react-native' ? 'React Native' : 'Flutter'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleLaunch}
              disabled={phase === 'running' || !figmaUrl.trim()}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === 'running' ? 'Generating…' : 'Generate Code'}
            </button>
            {phase === 'running' && (
              <button
                onClick={handleCancel}
                className="rounded-lg border border-gray-700 px-5 py-2 text-sm text-gray-400 transition-colors hover:border-red-700 hover:text-red-400"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* ── Pipeline visualization ────────────────────────────────────────── */}
        {phase === 'running' && (
          <div className="av-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Pipeline
              </h3>
              <span className="av-badge border border-brand-900 bg-brand-950 text-brand-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                Running
              </span>
            </div>

            {/* Node row — horizontally scrollable on small screens */}
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max items-start gap-1">
                {PIPELINE.map((node, i) => (
                  <PipelineNodeCard
                    key={node.key}
                    node={node}
                    llmLabel={nodeLLMLabel(node, framework)}
                    status={nodeStatus(node)}
                    index={i}
                    total={PIPELINE.length}
                  />
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 border-t border-gray-800 pt-3">
              <span className="text-[10px] text-gray-600">Legend:</span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-500" /> Active
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> Done
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-600" /> LLM node
              </span>
            </div>
          </div>
        )}

        {/* ── Live execution log ────────────────────────────────────────────── */}
        {phase === 'running' && logs.length > 0 && (
          <div className="av-card">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Execution Log
            </h3>
            <div ref={logRef} className="max-h-48 overflow-y-auto rounded-lg bg-gray-950 p-4">
              {logs.map((line, i) => (
                <LogLine key={i} message={line} fresh={i === logs.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── Countdown banner ─────────────────────────────────────────────── */}
        {countdown !== null && (
          <div className="av-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-950 text-lg text-green-400">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-300">Pipeline complete</p>
                <p className="text-xs text-gray-500">Navigating to results in {countdown}s…</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (countdownRef.current) clearInterval(countdownRef.current);
                setCountdown(null);
                router.push(`/agents/design-to-code/jobs/${jobIdRef.current}`);
              }}
              className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 transition-colors hover:border-green-700 hover:text-green-400"
            >
              Go now
            </button>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="av-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Error</h3>
              <span className="av-badge border border-red-900 bg-red-950 text-red-400">
                ✗ Failed
              </span>
            </div>
            <div className="rounded-lg bg-red-950/40 p-4 text-sm text-red-400">{errorMsg}</div>
            <button
              onClick={() => { setPhase('idle'); setLogs([]); }}
              className="mt-3 text-xs text-gray-500 transition-colors hover:text-gray-300"
            >
              ← Try again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
