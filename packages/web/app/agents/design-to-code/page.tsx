'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// ─── 6-Agent pipeline definition ──────────────────────────────────────────────

interface PipelineAgent {
  id: string;
  icon: string;
  label: string;
  detail: string;
  tools: string[];
}

const PIPELINE: PipelineAgent[] = [
  {
    id: 'orchestrator',
    icon: '🎯',
    label: 'Orchestrator',
    detail: 'Session lifecycle · retry policy',
    tools: [],
  },
  {
    id: 'figma-ingestion',
    icon: '📥',
    label: 'Figma Ingestion',
    detail: 'Snapshot-first · 1 API call',
    tools: ['fetch_figma'],
  },
  {
    id: 'ground-truth',
    icon: '🗺️',
    label: 'Ground Truth',
    detail: 'IR build · status bar filter',
    tools: ['analyze_design', 'build_ir'],
  },
  {
    id: 'coding',
    icon: '⚡',
    label: 'Coding',
    detail: 'ReAct loop · code generation',
    tools: [
      'plan_generation',
      'generate_all_components',
      'generate_component',
      'assemble_project',
      'create_zip',
    ],
  },
  {
    id: 'validation',
    icon: '🛡️',
    label: 'Validation',
    detail: 'Gate 1/2/3 · pre-write checks',
    tools: ['validate_file', 'repair_file', 'run_workspace_check', 'run_compilation_check'],
  },
  {
    id: 'visual-qa',
    icon: '👁️',
    label: 'Visual QA',
    detail: 'Structural · token · pixel · LLM judge',
    tools: [],
  },
];

const TOOL_TO_AGENT: Record<string, string> = {
  fetch_figma:             'figma-ingestion',
  analyze_design:          'ground-truth',
  build_ir:                'ground-truth',
  plan_generation:         'coding',
  generate_all_components: 'coding',
  generate_component:      'coding',
  assemble_project:        'coding',
  create_zip:              'coding',
  validate_file:           'validation',
  repair_file:             'validation',
  run_workspace_check:     'validation',
  run_compilation_check:   'validation',
};

const TOOL_LABEL: Record<string, string> = {
  fetch_figma:             'Fetch Figma',
  analyze_design:          'Vision Analysis',
  build_ir:                'Build IR',
  plan_generation:         'Plan',
  generate_all_components: 'Generate All',
  generate_component:      'Generate One',
  validate_file:           'Gate 1 Check',
  repair_file:             'Gate 5 Repair',
  run_workspace_check:     'Gate 3 Compile',
  assemble_project:        'Assemble',
  run_compilation_check:   'Compile Check',
  create_zip:              'Create ZIP',
};

const TOOL_LOGS: Record<string, string> = {
  fetch_figma:             'Checking snapshot cache · fetching Figma design data…',
  analyze_design:          'Running vision analysis on exported screens…',
  build_ir:                'Building Design IR · filtering status bar nodes…',
  plan_generation:         'Planning screens and navigation flow…',
  generate_all_components: 'Generating all screens and components in parallel…',
  generate_component:      'Generating single screen or component…',
  validate_file:           'Gate 1 — pre-write static check (Babel / dart analyze)…',
  repair_file:             'Gate 5 — LLM repair loop…',
  run_workspace_check:     'Gate 3 — incremental workspace compile check…',
  assemble_project:        'Assembling project scaffold…',
  run_compilation_check:   'Full compilation check + auto-fix pass…',
  create_zip:              'Packaging project into ZIP archive…',
};

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
    { value: 'jotai',   label: 'Jotai' },
    { value: 'none',    label: 'None' },
  ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type AgentStatus = 'idle' | 'active' | 'done';

function AgentStageCard({
  agent,
  status,
  callCount,
  activeTool,
}: {
  agent: PipelineAgent;
  status: AgentStatus;
  callCount: number;
  activeTool: string | null;
}) {
  const isActive = status === 'active';
  const isDone   = status === 'done';

  const border = isActive
    ? 'border-brand-500 bg-brand-950 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]'
    : isDone
    ? 'border-green-800 bg-green-950/40'
    : 'border-gray-800 bg-gray-900/60';

  const dot = isActive ? 'bg-brand-400 animate-pulse' : isDone ? 'bg-green-500' : 'bg-gray-700';

  const labelColor = isActive ? 'text-white' : isDone ? 'text-green-300' : 'text-gray-500';

  const activeToolLabel = isActive && activeTool ? (TOOL_LABEL[activeTool] ?? activeTool) : null;

  return (
    <div className={`flex flex-col rounded-xl border p-3 transition-all duration-300 ${border}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">{agent.icon}</span>
            <span className={`truncate text-[11px] font-semibold leading-tight ${labelColor}`}>
              {agent.label}
            </span>
            {callCount > 0 && (
              <span className="ml-auto flex-shrink-0 rounded-full bg-gray-800 px-1.5 py-0.5 text-[9px] text-gray-500">
                ×{callCount}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[8px] leading-tight text-gray-600">{agent.detail}</p>
          {activeToolLabel && (
            <p className="mt-1 truncate rounded bg-brand-900/50 px-1.5 py-0.5 font-mono text-[9px] text-brand-300">
              {activeToolLabel}
            </p>
          )}
        </div>
      </div>
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
  const [inputMode, setInputMode]           = useState<'url' | 'plugin'>('url');
  const [pluginFile, setPluginFile]         = useState<File | null>(null);
  const [framework, setFramework]           = useState<'react-native' | 'flutter'>('react-native');
  const [genMode, setGenMode]               = useState<'project' | 'screens'>('project');
  const [stateMgmt, setStateMgmt]           = useState('zustand');
  const [phase, setPhase]                   = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [logs, setLogs]                     = useState<string[]>([]);
  const [activeTool, setActiveTool]           = useState<string | null>(null);
  const [activeAgent, setActiveAgent]         = useState<string | null>(null);
  const [agentCallCounts, setAgentCallCounts] = useState<Map<string, number>>(new Map());
  const [callTimeline, setCallTimeline]     = useState<CallEvent[]>([]);
  const [currentIter, setCurrentIter]       = useState(0);
  const [snapshotCached, setSnapshotCached] = useState<boolean | null>(null);
  const [gate1Stats, setGate1Stats]         = useState({ passed: 0, failed: 0 });
  const [errorMsg, setErrorMsg]             = useState('');
  const [jobId, setJobId]                   = useState('');
  const [projectName, setProjectName]       = useState('project');
  const logRef    = useRef<HTMLDivElement>(null);
  const esRef     = useRef<EventSource | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStateMgmt(SM_OPTIONS[framework][0]!.value);
  }, [framework]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  function pushLog(msg: string) { setLogs((l) => [...l, msg]); }

  function advanceStep(stepStr: string) {
    const match    = stepStr.match(/^(\S+)\s+\[iter\s+(\d+)\]/);
    const toolName = match ? match[1]! : stepStr;
    const iter     = match ? parseInt(match[2]!, 10) : 0;

    setCurrentIter(iter);
    setCallTimeline((t) => [...t, { tool: toolName, iter }]);
    setActiveTool(toolName);

    const agentId = TOOL_TO_AGENT[toolName];
    if (agentId) {
      setActiveAgent(agentId);
      setAgentCallCounts((prev) => {
        const next = new Map(prev);
        next.set(agentId, (next.get(agentId) ?? 0) + 1);
        return next;
      });
    }

    if (toolName === 'validate_file') {
      setGate1Stats((g) => ({ ...g, passed: g.passed + 1 }));
    }

    const msg = TOOL_LOGS[toolName];
    if (msg) pushLog(`[iter ${iter}] ${msg}`);
  }

  function handleStreamEvent(data: Record<string, unknown>) {
    if (typeof data.step === 'string') advanceStep(data.step);

    // Phase 5 agent-level events (ready for when backend wires them)
    if (data.type === 'agent_start' && typeof data.agent === 'string') {
      setActiveAgent(data.agent as string);
    }
    if (data.type === 'snapshot_cached') {
      setSnapshotCached(true);
      pushLog('Snapshot cache hit — skipping Figma API call');
    }
    if (data.type === 'snapshot_fresh') {
      setSnapshotCached(false);
    }
    if (data.type === 'gate1_result') {
      const passed = data.passed as boolean;
      setGate1Stats((g) => ({
        passed: g.passed + (passed ? 1 : 0),
        failed: g.failed + (passed ? 0 : 1),
      }));
    }
  }

  async function handleLaunch() {
    const url = figmaUrl.trim();
    if (inputMode === 'url' && !url) return;
    if (inputMode === 'plugin' && !pluginFile) return;

    setPhase('running');
    setLogs(['Starting DesignToCode pipeline (6-agent mode)…']);
    setActiveTool(null);
    setActiveAgent('orchestrator');
    setAgentCallCounts(new Map());
    setCallTimeline([]);
    setCurrentIter(0);
    setSnapshotCached(null);
    setGate1Stats({ passed: 0, failed: 0 });
    setErrorMsg('');
    setJobId('');

    try {
      let res: Response;

      if (inputMode === 'plugin' && pluginFile) {
        // Plugin mode: send as multipart/form-data with the ZIP file
        const formData = new FormData();
        formData.append('action', 'generate');
        formData.append('figmaUrl', url);
        formData.append('targetFramework', framework);
        formData.append('generationMode', genMode);
        formData.append('stateManagement', stateMgmt);
        formData.append('pluginZip', pluginFile);
        res = await fetch('/api/agents/design-to-code', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/agents/design-to-code', {
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
      }

      const data = await res.json();
      if (!res.ok) {
        setPhase('error');
        setErrorMsg((data as { error?: string }).error ?? 'Launch failed');
        return;
      }

      const { jobId: jid, streamUrl } = data as { jobId: string; streamUrl: string };
      setJobId(jid);
      pushLog(`Session started (${jid.slice(0, 8)}…)`);

      const es = new EventSource(streamUrl);
      esRef.current = es;

      es.addEventListener('step', (e) => {
        handleStreamEvent(JSON.parse(e.data) as Record<string, unknown>);
      });

      es.addEventListener('complete', (e) => {
        es.close();
        setActiveTool(null);
        setActiveAgent(null);
        try {
          const payload = JSON.parse((e as MessageEvent).data ?? '{}') as {
            success?: boolean;
            projectName?: string;
            errors?: Array<{ message?: string; code?: string }>;
          };
          if (payload.projectName) setProjectName(payload.projectName);
          if (payload.success === false) {
            const err = payload.errors?.[0];
            const errMsg = err?.message
              ? `[${err.code ?? 'ERROR'}] ${err.message}`
              : (err?.code ?? 'Pipeline failed — check FIGMA_ACCESS_TOKEN and server logs for details.');
            setErrorMsg(errMsg);
            setPhase('error');
          } else {
            pushLog('Pipeline complete — project ZIP is ready.');
            setPhase('done');
          }
        } catch {
          pushLog('Pipeline complete — project ZIP is ready.');
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
    setActiveAgent(null);
    setAgentCallCounts(new Map());
    setCallTimeline([]);
    setCurrentIter(0);
  }

  function agentStatus(agent: PipelineAgent): AgentStatus {
    if (activeAgent === agent.id) return 'active';
    if ((agentCallCounts.get(agent.id) ?? 0) > 0) return 'done';
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
          <span className="ml-auto rounded-full border border-indigo-900 bg-indigo-950 px-2 py-0.5 text-[10px] text-indigo-400">
            6-Agent Pipeline
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
              6-agent pipeline · snapshot-first · Gate 1/2/3 validation · Visual QA
            </p>
          </div>
        </div>

        {/* ── Launch form ───────────────────────────────────────────────────── */}
        <div className="av-card space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Configure</h2>

          {/* Input mode toggle */}
          <div className="flex gap-2">
            {(['url', 'plugin'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                disabled={phase === 'running'}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  inputMode === mode
                    ? 'border-brand-600 bg-brand-950 text-brand-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {mode === 'url' ? 'Figma URL' : '📦 Plugin Export'}
              </button>
            ))}
          </div>

          {/* Figma URL — required in url mode, optional in plugin mode */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Figma File URL{' '}
              {inputMode === 'url'
                ? <span className="text-red-400">*</span>
                : <span className="text-gray-600">(optional — auto-detected from ZIP)</span>}
            </label>
            <input
              type="url"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50"
              placeholder="https://www.figma.com/file/… or https://www.figma.com/design/…"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              disabled={phase === 'running'}
            />
            {inputMode === 'plugin' && !figmaUrl.trim() && (
              <p className="mt-1 text-xs text-gray-600">
                Leave blank to use the file key embedded in the ZIP, or paste URL to load fresh design tokens
              </p>
            )}
          </div>

          {/* Plugin ZIP upload — only shown in plugin mode */}
          {inputMode === 'plugin' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                AppVelocity Plugin Export ZIP <span className="text-red-400">*</span>
              </label>
              <div
                onClick={() => fileInput.current?.click()}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors ${
                  pluginFile
                    ? 'border-brand-600 bg-brand-950/30 text-brand-300'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                } ${phase === 'running' ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <span className="text-lg">📦</span>
                <span>
                  {pluginFile ? pluginFile.name : 'Click to upload appvelocity-export.zip'}
                </span>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".zip"
                className="hidden"
                disabled={phase === 'running'}
                onChange={(e) => setPluginFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-gray-600">
                Run the AppVelocity Figma plugin → Export → upload the ZIP here for pixel-perfect output
              </p>
            </div>
          )}

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
              disabled={phase === 'running' || (inputMode === 'url' && !figmaUrl.trim()) || (inputMode === 'plugin' && !pluginFile)}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === 'running' ? 'Running Pipeline…' : 'Generate Code'}
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

        {/* ── 6-agent pipeline panel ────────────────────────────────────────── */}
        {showPipeline && (
          <div className="av-card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Agent Pipeline
                </h3>
                {currentIter > 0 && (
                  <p className="mt-0.5 text-[10px] text-gray-600">
                    Iteration {currentIter} / 30
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {snapshotCached === true && (
                  <span className="av-badge border border-emerald-900 bg-emerald-950 text-emerald-400">
                    📦 Snapshot cached
                  </span>
                )}
                {snapshotCached === false && (
                  <span className="av-badge border border-blue-900 bg-blue-950 text-blue-400">
                    🔄 Fresh fetch
                  </span>
                )}
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
            </div>

            {/* 6-agent cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {PIPELINE.map((agent) => (
                <AgentStageCard
                  key={agent.id}
                  agent={agent}
                  status={agentStatus(agent)}
                  callCount={agentCallCounts.get(agent.id) ?? 0}
                  activeTool={activeAgent === agent.id ? activeTool : null}
                />
              ))}
            </div>

            {/* Gate stats row */}
            {(gate1Stats.passed + gate1Stats.failed) > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-800 pt-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  Validation gates
                </span>
                <span className="rounded border border-green-900 bg-green-950/40 px-2 py-0.5 text-[10px] text-green-400">
                  Gate 1 passed: {gate1Stats.passed}
                </span>
                {gate1Stats.failed > 0 && (
                  <span className="rounded border border-yellow-900 bg-yellow-950/40 px-2 py-0.5 text-[10px] text-yellow-400">
                    Gate 1 failed: {gate1Stats.failed}
                  </span>
                )}
                <span className="rounded border border-gray-800 bg-gray-900 px-2 py-0.5 text-[10px] text-gray-500">
                  {callTimeline.length} total tool calls
                </span>
              </div>
            )}

            {/* Dynamic call sequence */}
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
                <span className="font-mono text-[9px] text-gray-600">×N</span> Tool calls
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
                <p className="text-[10px] text-gray-600">
                  {callTimeline.length} tool calls · {currentIter} iterations
                  {gate1Stats.passed > 0 && ` · ${gate1Stats.passed} files validated`}
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
