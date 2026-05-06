'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AgentHierarchyView } from '@/components/agent-hierarchy/AgentHierarchyView';
import {
  type PipelineAgent,
  PIPELINE,
  TOOL_TO_AGENT,
  TOOL_LABEL,
  TOOL_LOGS,
} from '@/lib/pipeline-config';

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
    ? 'border-brand-400 bg-brand-50 shadow-[0_0_0_2px_rgba(241,91,64,0.15)]'
    : isDone
    ? 'border-green-300 bg-green-50'
    : 'border-[#e4e7ec] bg-gray-50';

  const dot = isActive ? 'bg-brand-500 animate-pulse' : isDone ? 'bg-green-500' : 'bg-gray-300';

  const labelColor = isActive ? 'text-[#0f1724]' : isDone ? 'text-green-700' : 'text-gray-500';

  const activeToolLabel = isActive && activeTool ? (TOOL_LABEL[activeTool] ?? activeTool) : null;

  return (
    <div className={`flex flex-col rounded-xl border p-3.5 transition-all duration-300 ${border}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">{agent.icon}</span>
            <span className={`truncate text-xs font-semibold leading-tight ${labelColor}`}>
              {agent.label}
            </span>
            {callCount > 0 && (
              <span className="ml-auto flex-shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                ×{callCount}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] leading-tight text-gray-400">{agent.detail}</p>
          {activeToolLabel && (
            <p className="mt-1 truncate rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] text-brand-600">
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
    <div className={`av-log py-0.5 text-xs leading-relaxed ${fresh ? 'av-cursor text-gray-800' : 'text-gray-500'}`}>
      <span className="mr-2 text-gray-400">›</span>{message}
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
  const [figmaToken, setFigmaToken]         = useState('');
  const [showToken, setShowToken]           = useState(false);
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
    if (!figmaToken.trim()) return;

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
        formData.append('figmaAccessToken', figmaToken.trim());
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
              figmaAccessToken: figmaToken.trim(),
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
      <header className="border-b border-[#e4e7ec] bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/" className="text-sm text-gray-500 transition-colors hover:text-[#0f1724]">
            ← Dashboard
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-[#0f1724]">DesignToCodeAgent</span>
          <Link
            href="/agents/design-to-code/history"
            className="ml-auto text-sm text-gray-500 transition-colors hover:text-[#0f1724]"
          >
            History
          </Link>
          <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
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
            <h1 className="text-2xl font-bold text-[#0f1724]">DesignToCodeAgent</h1>
            <p className="mt-0.5 text-sm font-medium text-brand-600">
              Figma → Runnable Flutter / React Native Project
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              6-agent pipeline · snapshot-first · Gate 1/2/3 validation · Visual QA
            </p>
          </div>
        </div>

        {/* ── Launch form ───────────────────────────────────────────────────── */}
        <div className="av-card space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Configure</h2>

          {/* Input mode toggle */}
          <div className="flex gap-2">
            {(['url', 'plugin'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                disabled={phase === 'running'}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  inputMode === mode
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-300 text-gray-500 hover:border-gray-400'
                }`}
              >
                {mode === 'url' ? 'Figma URL' : '📦 Plugin Export'}
              </button>
            ))}
          </div>

          {/* Figma URL — required in url mode, optional in plugin mode */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Figma File URL{' '}
              {inputMode === 'url'
                ? <span className="text-red-400">*</span>
                : <span className="text-gray-600">(optional — auto-detected from ZIP)</span>}
            </label>
            <input
              type="url"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f1724] placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
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

          {/* Figma Access Token */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Figma Access Token <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-16 text-sm text-[#0f1724] placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 font-mono"
                placeholder="figd_…"
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                disabled={phase === 'running'}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:text-gray-600"
                tabIndex={-1}
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Personal access token from Figma → Account settings → Personal access tokens
            </p>
          </div>

          {/* Plugin ZIP upload — only shown in plugin mode */}
          {inputMode === 'plugin' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                AppVelocity Plugin Export ZIP <span className="text-red-400">*</span>
              </label>
              <div
                onClick={() => fileInput.current?.click()}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors ${
                  pluginFile
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-300 text-gray-500 hover:border-gray-400'
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
              <p className="mt-1 text-xs text-gray-400">
                Run the AppVelocity Figma plugin → Export → upload the ZIP here for pixel-perfect output
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">Framework</label>
              <div className="flex gap-2">
                {(['react-native', 'flutter'] as const).map((fw) => (
                  <button
                    key={fw}
                    onClick={() => setFramework(fw)}
                    disabled={phase === 'running'}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      framework === fw
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {fw === 'react-native' ? 'React Native' : 'Flutter'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">Generate</label>
              <div className="flex gap-2">
                {(['project', 'screens'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setGenMode(mode)}
                    disabled={phase === 'running'}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      genMode === mode
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {mode === 'project' ? 'Full Project' : 'Screens Only'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">State Management</label>
              <select
                value={stateMgmt}
                onChange={(e) => setStateMgmt(e.target.value)}
                disabled={phase === 'running'}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-[#0f1724] focus:border-brand-500 focus:outline-none disabled:opacity-50"
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
              disabled={phase === 'running' || !figmaToken.trim() || (inputMode === 'url' && !figmaUrl.trim()) || (inputMode === 'plugin' && !pluginFile)}
              className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === 'running' ? 'Running Pipeline…' : 'Generate Code'}
            </button>
            {phase === 'running' && (
              <button
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-500 transition-colors hover:border-red-400 hover:text-red-500"
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Agent Pipeline
                </h3>
                {currentIter > 0 && (
                  <p className="mt-0.5 text-[10px] text-gray-500">
                    Iteration {currentIter} / 30
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {snapshotCached === true && (
                  <span className="av-badge border border-emerald-200 bg-emerald-50 text-emerald-700">
                    📦 Snapshot cached
                  </span>
                )}
                {snapshotCached === false && (
                  <span className="av-badge border border-blue-200 bg-blue-50 text-blue-700">
                    🔄 Fresh fetch
                  </span>
                )}
                {phase === 'running' && (
                  <span className="av-badge border border-brand-200 bg-brand-50 text-brand-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                    Running
                  </span>
                )}
                {phase === 'done' && (
                  <span className="av-badge border border-green-200 bg-green-50 text-green-700">
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
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#e4e7ec] pt-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  Validation gates
                </span>
                <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] text-green-700">
                  Gate 1 passed: {gate1Stats.passed}
                </span>
                {gate1Stats.failed > 0 && (
                  <span className="rounded border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] text-yellow-700">
                    Gate 1 failed: {gate1Stats.failed}
                  </span>
                )}
                <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500">
                  {callTimeline.length} total tool calls
                </span>
              </div>
            )}

            {/* Agent execution hierarchy */}
            {callTimeline.length > 0 && (
              <div className="mt-4 border-t border-[#e4e7ec] pt-3">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  Agent call sequence
                </p>
                <AgentHierarchyView
                  steps={callTimeline.map((c) => `${c.tool} [iter ${c.iter}]`)}
                  isLive={phase === 'running'}
                  standalone={false}
                />
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 border-t border-[#e4e7ec] pt-3">
              <span className="text-[10px] text-gray-400">Legend:</span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> Active
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Done
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="font-mono text-[9px] text-gray-400">×N</span> Tool calls
              </span>
            </div>
          </div>
        )}

        {/* ── Live execution log ─────────────────────────────────────────────── */}
        {(phase === 'running' || phase === 'done') && logs.length > 0 && (
          <div className="av-card">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Execution Log
            </h3>
            <div ref={logRef} className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-4 border border-[#e4e7ec]">
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
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-xl text-green-600">
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold text-green-700">Project ready</p>
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
            <div className="flex items-center gap-2">
              <Link
                href={`/agents/design-to-code/jobs/${jobId}`}
                className="flex items-center gap-2 rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-600 transition-colors hover:border-brand-500 hover:text-brand-700"
              >
                View Code →
              </Link>
              <a
                href={`/api/agents/design-to-code/download?jobId=${jobId}`}
                download={`${projectName}.zip`}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                ⬇ Download ZIP
              </a>
            </div>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="av-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Error</h3>
              <span className="av-badge border border-red-200 bg-red-50 text-red-600">✗ Failed</span>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">{errorMsg}</div>
            <button
              onClick={() => { setPhase('idle'); setLogs([]); }}
              className="mt-3 text-xs text-gray-400 transition-colors hover:text-gray-600"
            >
              ← Try again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
