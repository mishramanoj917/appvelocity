'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// ─── Pipeline definition (13 nodes) ──────────────────────────────────────────

interface PipelineNode {
  key: string;
  label: string;
  detail: string;
  llm?: 'always' | 'flutter';
}

const PIPELINE: PipelineNode[] = [
  { key: 'InputValidator',          label: 'Validate',        detail: 'URL · token · mode'              },
  { key: 'FigmaFetcherAgent',       label: 'Fetch Figma',     detail: 'Pages · components · vars'       },
  { key: 'DesignAnalyzerAgent',     label: 'Vision Parser',   detail: 'PNG → LLM → assets',  llm: 'always' },
  { key: 'GenerationPlannerAgent',  label: 'Plan',            detail: 'Screens · nav flow',  llm: 'always' },
  { key: 'IRBuilderAgent',          label: 'Build IR',        detail: 'DesignIR extraction'              },
  { key: 'IRValidatorAgent',        label: 'Validate IR',     detail: 'Structure · naming',  llm: 'always' },
  { key: 'CodeGeneratorAgent',      label: 'Generate Code',   detail: 'Templates + Skills',  llm: 'flutter' },
  { key: 'ProjectAssemblerAgent',   label: 'Assemble',        detail: 'Router · state · cfg'             },
  { key: 'CodeValidatorAgent',      label: 'Lint',            detail: 'Syntax · lint check'              },
  { key: 'CodeFixerAgent',          label: 'Fix',             detail: 'Auto-format & fix',   llm: 'flutter' },
  { key: 'CompilationValidatorAgent', label: 'Compile Check', detail: 'flutter analyze / tsc'            },
  { key: 'CompilationFixerAgent',   label: 'Compile Fix',     detail: 'LLM compiler fix',    llm: 'always' },
  { key: 'ProjectZipperAgent',      label: 'Package',         detail: 'Create ZIP archive'               },
];

function nodeLLMLabel(node: PipelineNode, framework: 'react-native' | 'flutter'): string | null {
  if (!node.llm) return null;
  if (node.llm === 'always') return framework === 'flutter' ? 'Gemini' : 'Claude';
  if (node.llm === 'flutter') return framework === 'flutter' ? 'Gemini' : null;
  return null;
}

const STEP_LOGS: Record<string, string> = {
  InputValidator:            'Validating Figma URL, token, and generation options…',
  FigmaFetcherAgent:         'Fetching design data from Figma API…',
  DesignAnalyzerAgent:       'Exporting screens as PNG, running vision analysis…',
  GenerationPlannerAgent:    'Analysing design structure, planning navigation flow…',
  IRBuilderAgent:            'Building Intermediate Representation from Figma nodes…',
  IRValidatorAgent:          'Validating IR quality — structure, naming, semantics…',
  CodeGeneratorAgent:        'Generating screen and component code…',
  ProjectAssemblerAgent:     'Assembling project — entry point, router, state management…',
  CodeValidatorAgent:        'Running syntax and lint checks…',
  CodeFixerAgent:            'Applying auto-fixes (prettier / dart format)…',
  CompilationValidatorAgent: 'Running flutter analyze / tsc --noEmit on generated project…',
  CompilationFixerAgent:     'Fixing compiler errors with LLM assistance…',
  ProjectZipperAgent:        'Packaging project into ZIP archive…',
};

// State management options per framework
const SM_OPTIONS: Record<'react-native' | 'flutter', { value: string; label: string }[]> = {
  flutter: [
    { value: 'riverpod', label: 'Riverpod (recommended)' },
    { value: 'bloc',     label: 'BLoC' },
    { value: 'provider', label: 'Provider' },
    { value: 'none',     label: 'None' },
  ],
  'react-native': [
    { value: 'zustand', label: 'Zustand (recommended)' },
    { value: 'redux',   label: 'Redux Toolkit' },
    { value: 'jotai',  label: 'Jotai' },
    { value: 'none',   label: 'None' },
  ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type NodeStatus = 'idle' | 'active' | 'done' | 'error';

function PipelineNodeCard({ node, status, index, total, llmLabel }: {
  node: PipelineNode; status: NodeStatus; index: number; total: number; llmLabel: string | null;
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
  const icon = status === 'done' ? '✓' : status === 'error' ? '✗' : status === 'active' ? '▶' : String(index + 1);

  return (
    <div className="flex flex-col items-center">
      <div className={`relative flex w-28 flex-col items-center rounded-xl border p-2.5 transition-all duration-300 ${ring}`}>
        <div className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${iconColor} ${status === 'active' ? 'animate-pulse' : ''}`}>
          {icon}
        </div>
        <p className={`text-center text-[11px] font-semibold leading-tight ${labelColor}`}>{node.label}</p>
        <p className="mt-0.5 text-center font-mono text-[8px] leading-tight text-gray-600">{node.detail}</p>
        {llmLabel && (
          <span className="mt-1 rounded-full bg-indigo-950 px-1.5 py-0.5 font-mono text-[8px] text-indigo-400">
            {llmLabel}
          </span>
        )}
      </div>
      {!isLast && (
        <div className={`mt-1 text-xs ${status === 'done' ? 'text-green-600' : 'text-gray-700'}`}>→</div>
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
  const [figmaUrl, setFigmaUrl]         = useState('');
  const [framework, setFramework]       = useState<'react-native' | 'flutter'>('react-native');
  const [genMode, setGenMode]           = useState<'project' | 'screens'>('project');
  const [stateMgmt, setStateMgmt]       = useState('zustand');
  const [phase, setPhase]               = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [logs, setLogs]                 = useState<string[]>([]);
  const [activeStep, setActiveStep]     = useState<string | null>(null);
  const [doneSteps, setDoneSteps]       = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg]         = useState('');
  const [jobId, setJobId]               = useState('');
  const [projectName, setProjectName]   = useState('project');
  const logRef = useRef<HTMLDivElement>(null);
  const esRef  = useRef<EventSource | null>(null);

  // Reset state management default when framework changes
  useEffect(() => {
    setStateMgmt(SM_OPTIONS[framework][0]!.value);
  }, [framework]);

  // Auto-scroll log panel
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  function pushLog(msg: string) { setLogs((l) => [...l, msg]); }

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
    setJobId('');

    try {
      const res = await fetch('/api/agents/design-to-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          params: {
            figmaUrl: url,
            targetFramework: framework,
            generationMode: genMode,
            stateManagement: stateMgmt,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPhase('error');
        setErrorMsg((data as { error?: string }).error ?? 'Launch failed');
        return;
      }

      const { jobId: jid, streamUrl } = data as { jobId: string; streamUrl: string };
      setJobId(jid);
      pushLog(`Job created (${jid.slice(0, 8)}…)`);

      const es = new EventSource(streamUrl);
      esRef.current = es;

      es.addEventListener('step', (e) => {
        const { step } = JSON.parse(e.data) as { step: string };
        advanceStep(step);
      });

      es.addEventListener('complete', (e) => {
        es.close();
        setActiveStep((prev) => {
          if (prev) setDoneSteps((d) => new Set(d).add(prev));
          return null;
        });
        try {
          const payload = JSON.parse((e as MessageEvent).data ?? '{}') as {
            success?: boolean;
            projectName?: string;
            errors?: Array<{ message?: string; code?: string }>;
          };
          if (payload.projectName) setProjectName(payload.projectName);
          if (payload.success === false) {
            const firstError = payload.errors?.[0];
            const msg = firstError?.message ?? firstError?.code ?? 'Pipeline failed — check that FIGMA_ACCESS_TOKEN is set and the URL is valid.';
            setErrorMsg(msg);
            setPhase('error');
          } else {
            pushLog('Pipeline complete — your project ZIP is ready to download.');
            setPhase('done');
          }
        } catch {
          pushLog('Pipeline complete — your project ZIP is ready to download.');
          setPhase('done');
        }
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

  function nodeStatus(node: PipelineNode): NodeStatus {
    if (doneSteps.has(node.key)) return 'done';
    if (activeStep === node.key) return 'active';
    return 'idle';
  }

  const showPipeline = phase === 'running' || phase === 'done';

  return (
    <div className="min-h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-950/80 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/" className="text-sm text-gray-500 transition-colors hover:text-gray-300">
            ← Dashboard
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-300">DesignToCodeAgent</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        {/* ── Agent header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl"
            style={{ background: '#6366f118', border: '1px solid #6366f130' }}>
            🎨
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">DesignToCodeAgent</h1>
            <p className="mt-0.5 text-sm font-medium" style={{ color: '#6366f1' }}>
              Figma → Runnable Flutter / React Native Project
            </p>
          </div>
        </div>

        {/* ── Launch form ───────────────────────────────────────────────────── */}
        <div className="av-card space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Configure</h2>

          {/* Figma URL */}
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

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {/* Framework */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">Framework</label>
              <div className="flex gap-2">
                {(['react-native', 'flutter'] as const).map((fw) => (
                  <button key={fw} onClick={() => setFramework(fw)}
                    disabled={phase === 'running'}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      framework === fw
                        ? 'border-brand-600 bg-brand-950 text-brand-300'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}>
                    {fw === 'react-native' ? 'React Native' : 'Flutter'}
                  </button>
                ))}
              </div>
            </div>

            {/* Generation mode */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">Generate</label>
              <div className="flex gap-2">
                {(['project', 'screens'] as const).map((mode) => (
                  <button key={mode} onClick={() => setGenMode(mode)}
                    disabled={phase === 'running'}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      genMode === mode
                        ? 'border-brand-600 bg-brand-950 text-brand-300'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}>
                    {mode === 'project' ? 'Full Project' : 'Screens Only'}
                  </button>
                ))}
              </div>
            </div>

            {/* State management */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">State Management</label>
              <select
                value={stateMgmt}
                onChange={(e) => setStateMgmt(e.target.value)}
                disabled={phase === 'running'}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 focus:border-brand-600 focus:outline-none disabled:opacity-50"
              >
                {SM_OPTIONS[framework].map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
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
              <button onClick={handleCancel}
                className="rounded-lg border border-gray-700 px-5 py-2 text-sm text-gray-400 transition-colors hover:border-red-700 hover:text-red-400">
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* ── Pipeline visualization ─────────────────────────────────────────── */}
        {showPipeline && (
          <div className="av-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pipeline</h3>
              {phase === 'running' && (
                <span className="av-badge border border-brand-900 bg-brand-950 text-brand-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                  Running
                </span>
              )}
              {phase === 'done' && (
                <span className="av-badge border border-green-900 bg-green-950 text-green-400">
                  ✓ Complete
                </span>
              )}
            </div>

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

            <div className="mt-4 flex items-center gap-4 border-t border-gray-800 pt-3">
              <span className="text-[10px] text-gray-600">Legend:</span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-500" /> Active
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> Done
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-600" /> LLM
              </span>
            </div>
          </div>
        )}

        {/* ── Live execution log ─────────────────────────────────────────────── */}
        {(phase === 'running' || phase === 'done') && logs.length > 0 && (
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

        {/* ── Download banner ────────────────────────────────────────────────── */}
        {phase === 'done' && jobId && (
          <div className="av-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-950 text-xl text-green-400">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-300">Project ready</p>
                <p className="text-xs text-gray-500">
                  {genMode === 'project'
                    ? `Complete ${framework === 'flutter' ? 'Flutter' : 'React Native'} project — unzip and run immediately`
                    : 'Screen files generated'}
                </p>
              </div>
            </div>
            <a
              href={`/api/agents/design-to-code/download?jobId=${jobId}`}
              download={`${projectName}.zip`}
              className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600"
            >
              ⬇ Download ZIP
            </a>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="av-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Error</h3>
              <span className="av-badge border border-red-900 bg-red-950 text-red-400">✗ Failed</span>
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
