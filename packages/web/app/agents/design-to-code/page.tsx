'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// ─── Agent tool registry (12 tools the orchestrator LLM can call) ─────────────

interface AgentTool {
  key: string;
  label: string;
  detail: string;
}

const AGENT_TOOLS: AgentTool[] = [
  { key: 'fetch_figma',             label: 'Fetch Figma',      detail: 'Pages · components · vars'    },
  { key: 'analyze_design',          label: 'Vision Analysis',  detail: 'PNG → LLM → layout hints'     },
  { key: 'build_ir',                label: 'Build IR',         detail: 'Design IR extraction'          },
  { key: 'plan_generation',         label: 'Plan',             detail: 'Screens · nav flow'            },
  { key: 'generate_all_components', label: 'Generate All',     detail: 'Parallel code generation'      },
  { key: 'generate_component',      label: 'Generate One',     detail: 'Single screen or component'    },
  { key: 'validate_file',           label: 'Validate File',    detail: 'Gate 1 — Babel AST check'     },
  { key: 'repair_file',             label: 'Repair File',      detail: 'Gate 5 — LLM targeted fix'    },
  { key: 'run_workspace_check',     label: 'Workspace Check',  detail: 'Gate 3 — tsc / dart analyze'  },
  { key: 'assemble_project',        label: 'Assemble',         detail: 'Router · state · build cfg'    },
  { key: 'run_compilation_check',   label: 'Compile Check',    detail: 'Full compile + auto-fix'       },
  { key: 'create_zip',              label: 'Create ZIP',       detail: 'Package project archive'       },
];

const TOOL_LOGS: Record<string, string> = {
  fetch_figma:             'Fetching design data from Figma API…',
  analyze_design:          'Exporting screens as PNG, running vision analysis…',
  build_ir:                'Building Design IR from Figma nodes…',
  plan_generation:         'Planning screens and navigation flow…',
  generate_all_components: 'Generating all screens and components in parallel…',
  generate_component:      'Generating single screen or component…',
  validate_file:           'Running Gate 1 syntax check on file…',
  repair_file:             'Running Gate 5 repair loop — LLM targeted fix…',
  run_workspace_check:     'Running Gate 3 workspace check (tsc / dart analyze)…',
  assemble_project:        'Assembling project — router, state management, build config…',
  run_compilation_check:   'Running full compilation check + auto-fix pass…',
  create_zip:              'Packaging project into ZIP archive…',
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

type ToolStatus = 'idle' | 'active' | 'done';

function ToolCard({ tool, status, callCount }: {
  tool: AgentTool; status: ToolStatus; callCount: number;
}) {
  const ring =
    status === 'active' ? 'border-brand-500 bg-brand-950 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]'
    : status === 'done'  ? 'border-green-800 bg-green-950/40'
    : 'border-gray-800 bg-gray-900';

  const dot =
    status === 'active' ? 'bg-brand-400 animate-pulse'
    : status === 'done'  ? 'bg-green-500'
    : 'bg-gray-700';

  const labelColor =
    status === 'active' ? 'text-white'
    : status === 'done'  ? 'text-green-300'
    : 'text-gray-500';

  return (
    <div className={`relative flex flex-col rounded-xl border p-2.5 transition-all duration-300 ${ring}`}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
        <p className={`truncate text-[11px] font-semibold leading-tight ${labelColor}`}>{tool.label}</p>
        {callCount > 0 && (
          <span className="ml-auto flex-shrink-0 rounded-full bg-gray-800 px-1 text-[9px] text-gray-500">
            ×{callCount}
          </span>
        )}
      </div>
      <p className="font-mono text-[8px] leading-tight text-gray-600">{tool.detail}</p>
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

interface CallEvent {
  tool: string;
  iter: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignToCodePage() {
  const [figmaUrl, setFigmaUrl]             = useState('');
  const [framework, setFramework]           = useState<'react-native' | 'flutter'>('react-native');
  const [genMode, setGenMode]               = useState<'project' | 'screens'>('project');
  const [stateMgmt, setStateMgmt]           = useState('zustand');
  const [phase, setPhase]                   = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [logs, setLogs]                     = useState<string[]>([]);
  const [activeTool, setActiveTool]         = useState<string | null>(null);
  const [toolCallCounts, setToolCallCounts] = useState<Map<string, number>>(new Map());
  const [callTimeline, setCallTimeline]     = useState<CallEvent[]>([]);
  const [currentIter, setCurrentIter]       = useState(0);
  const [errorMsg, setErrorMsg]             = useState('');
  const [jobId, setJobId]                   = useState('');
  const [projectName, setProjectName]       = useState('project');
  const logRef = useRef<HTMLDivElement>(null);
  const esRef  = useRef<EventSource | null>(null);

  useEffect(() => {
    setStateMgmt(SM_OPTIONS[framework][0]!.value);
  }, [framework]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  function pushLog(msg: string) { setLogs((l) => [...l, msg]); }

  function advanceStep(stepStr: string) {
    // Parse "fetch_figma [iter 1]" emitted by agent.ts onStep callback
    const match = stepStr.match(/^(\S+)\s+\[iter\s+(\d+)\]/);
    const toolName = match ? match[1]! : stepStr;
    const iter     = match ? parseInt(match[2]!, 10) : 0;

    setCurrentIter(iter);
    setCallTimeline((t) => [...t, { tool: toolName, iter }]);
    setToolCallCounts((prev) => {
      const next = new Map(prev);
      next.set(toolName, (next.get(toolName) ?? 0) + 1);
      return next;
    });
    setActiveTool(toolName);

    const msg = TOOL_LOGS[toolName];
    if (msg) pushLog(`[iter ${iter}] ${msg}`);
  }

  async function handleLaunch() {
    const url = figmaUrl.trim();
    if (!url) return;

    setPhase('running');
    setLogs(['Starting DesignToCodeAgent (ReAct mode)…']);
    setActiveTool(null);
    setToolCallCounts(new Map());
    setCallTimeline([]);
    setCurrentIter(0);
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
        setActiveTool(null);
        try {
          const payload = JSON.parse((e as MessageEvent).data ?? '{}') as {
            success?: boolean;
            projectName?: string;
            errors?: Array<{ message?: string; code?: string }>;
          };
          if (payload.projectName) setProjectName(payload.projectName);
          if (payload.success === false) {
            const firstError = payload.errors?.[0];
            const msg = firstError?.message ?? firstError?.code ?? 'Agent failed — check FIGMA_ACCESS_TOKEN and URL.';
            setErrorMsg(msg);
            setPhase('error');
          } else {
            pushLog('Agent complete — your project ZIP is ready to download.');
            setPhase('done');
          }
        } catch {
          pushLog('Agent complete — your project ZIP is ready to download.');
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
    setActiveTool(null);
    setToolCallCounts(new Map());
    setCallTimeline([]);
    setCurrentIter(0);
  }

  function toolStatus(tool: AgentTool): ToolStatus {
    if (activeTool === tool.key) return 'active';
    if (toolCallCounts.has(tool.key)) return 'done';
    return 'idle';
  }

  const showAgent = phase === 'running' || phase === 'done';

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
          <span className="ml-auto rounded-full border border-indigo-900 bg-indigo-950 px-2 py-0.5 text-[10px] text-indigo-400">
            ReAct Agent
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        {/* ── Agent header ──────────────────────────────────────────────────── */}
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
              Figma → Runnable Flutter / React Native Project
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              LLM-orchestrated ReAct loop · up to 30 iterations · 12 tools
            </p>
          </div>
        </div>

        {/* ── Launch form ───────────────────────────────────────────────────── */}
        <div className="av-card space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Configure</h2>

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
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">Framework</label>
              <div className="flex gap-2">
                {(['react-native', 'flutter'] as const).map((fw) => (
                  <button
                    key={fw}
                    onClick={() => setFramework(fw)}
                    disabled={phase === 'running'}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      framework === fw
                        ? 'border-brand-600 bg-brand-950 text-brand-300'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {fw === 'react-native' ? 'React Native' : 'Flutter'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">Generate</label>
              <div className="flex gap-2">
                {(['project', 'screens'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setGenMode(mode)}
                    disabled={phase === 'running'}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      genMode === mode
                        ? 'border-brand-600 bg-brand-950 text-brand-300'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {mode === 'project' ? 'Full Project' : 'Screens Only'}
                  </button>
                ))}
              </div>
            </div>

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
              {phase === 'running' ? 'Running Agent…' : 'Generate Code'}
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

        {/* ── Agent tool panel ──────────────────────────────────────────────── */}
        {showAgent && (
          <div className="av-card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Agent Tools
                </h3>
                {currentIter > 0 && (
                  <p className="mt-0.5 text-[10px] text-gray-600">
                    Iteration {currentIter} / 30
                  </p>
                )}
              </div>
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

            {/* 12-tool grid — lights up as the LLM picks tools */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {AGENT_TOOLS.map((tool) => (
                <ToolCard
                  key={tool.key}
                  tool={tool}
                  status={toolStatus(tool)}
                  callCount={toolCallCounts.get(tool.key) ?? 0}
                />
              ))}
            </div>

            {/* Dynamic call sequence chosen by the LLM orchestrator */}
            {callTimeline.length > 0 && (
              <div className="mt-4 border-t border-gray-800 pt-3">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  Agent call sequence
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {callTimeline.map((event, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${
                          i === callTimeline.length - 1 && phase === 'running'
                            ? 'border-brand-800 bg-brand-950 text-brand-300'
                            : 'border-gray-800 bg-gray-900 text-gray-500'
                        }`}
                      >
                        {event.iter}:{event.tool.replace(/_/g, ' ')}
                      </span>
                      {i < callTimeline.length - 1 && (
                        <span className="text-[10px] text-gray-700">→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 border-t border-gray-800 pt-3">
              <span className="text-[10px] text-gray-600">Legend:</span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="h-2 w-2 rounded-full bg-brand-400" /> Active
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Done
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="font-mono text-[9px] text-gray-600">×N</span> Call count
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
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-950 text-xl text-green-400">
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold text-green-300">Project ready</p>
                <p className="text-xs text-gray-500">
                  {genMode === 'project'
                    ? `Complete ${framework === 'flutter' ? 'Flutter' : 'React Native'} project — unzip and run immediately`
                    : 'Screen files generated'}
                </p>
                {callTimeline.length > 0 && (
                  <p className="text-[10px] text-gray-600">
                    {callTimeline.length} tool calls · {currentIter} iterations
                  </p>
                )}
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
