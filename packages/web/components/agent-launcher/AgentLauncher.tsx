'use client';

import { useState, useRef, useEffect } from 'react';
import type { AgentConfig, ActionParam } from '@/lib/agents.config';

interface Props {
  agent: AgentConfig;
}

type JobState =
  | { phase: 'idle' }
  | { phase: 'running'; jobId: string; logs: string[] }
  | { phase: 'complete'; jobId: string; result: unknown }
  | { phase: 'error'; message: string };

export function AgentLauncher({ agent }: Props) {
  const isAvailable = agent.status === 'active' || agent.status === 'beta';
  const firstAction = agent.actions?.[0];

  // Hooks must be called unconditionally — guard values are safe even when unavailable
  const [selectedAction, setSelectedAction] = useState(firstAction!);
  const [params, setParams] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (firstAction?.params ?? []).map((p) => [p.key, String(p.defaultValue ?? '')])
    )
  );
  const [job, setJob] = useState<JobState>({ phase: 'idle' });
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [job]);

  if (!isAvailable || !agent.actions?.length) {
    return (
      <div className="av-card border-dashed text-center">
        <p className="text-sm text-gray-500">
          {agent.name} is not yet available.{' '}
          <span className="text-gray-400">Check back in a future release.</span>
        </p>
      </div>
    );
  }

  function handleActionChange(actionId: string) {
    const action = agent.actions!.find((a) => a.id === actionId)!;
    setSelectedAction(action);
    setParams(
      Object.fromEntries(
        action.params.map((p) => [p.key, String(p.defaultValue ?? '')])
      )
    );
  }

  async function handleLaunch() {
    setJob({ phase: 'running', jobId: '', logs: ['Starting agent…'] });

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: selectedAction.id, params }),
      });

      const data = await res.json();

      if (!res.ok) {
        setJob({ phase: 'error', message: data.error ?? 'Launch failed' });
        return;
      }

      const { jobId, streamUrl } = data as { jobId: string; streamUrl: string };
      setJob({ phase: 'running', jobId, logs: ['Job created. Streaming output…'] });

      // Open SSE stream
      const es = new EventSource(streamUrl);
      esRef.current = es;

      es.addEventListener('log', (e) => {
        const { message } = JSON.parse(e.data) as { message: string };
        setJob((prev) =>
          prev.phase === 'running'
            ? { ...prev, logs: [...prev.logs, message] }
            : prev
        );
      });

      es.addEventListener('progress', (e) => {
        const { label } = JSON.parse(e.data) as { label: string };
        setJob((prev) =>
          prev.phase === 'running'
            ? { ...prev, logs: [...prev.logs, `→ ${label}`] }
            : prev
        );
      });

      es.addEventListener('complete', (e) => {
        const { result } = JSON.parse(e.data) as { result: unknown };
        setJob({ phase: 'complete', jobId, result });
        es.close();
      });

      es.addEventListener('error', (e) => {
        const msg =
          e instanceof MessageEvent
            ? (JSON.parse(e.data) as { message: string }).message
            : 'Stream error';
        setJob({ phase: 'error', message: msg });
        es.close();
      });
    } catch (err) {
      setJob({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  function handleCancel() {
    esRef.current?.close();
    setJob({ phase: 'idle' });
  }

  return (
    <div className="space-y-4">
      {/* Action selector */}
      {agent.actions.length > 1 && (
        <div className="av-card">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Action
          </label>
          <div className="flex flex-wrap gap-2">
            {agent.actions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionChange(action.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  selectedAction.id === action.id
                    ? 'border-brand-600 bg-brand-950 text-brand-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">{selectedAction.description}</p>
        </div>
      )}

      {/* Parameter form */}
      <div className="av-card space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Parameters
        </h3>

        {selectedAction.params.map((param) => (
          <ParamField
            key={param.key}
            param={param}
            value={params[param.key] ?? ''}
            onChange={(val) => setParams((p) => ({ ...p, [param.key]: val }))}
          />
        ))}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleLaunch}
            disabled={job.phase === 'running'}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {job.phase === 'running' ? '⏳ Running…' : `Run ${selectedAction.label}`}
          </button>
          {job.phase === 'running' && (
            <button
              onClick={handleCancel}
              className="rounded-lg border border-gray-700 px-5 py-2 text-sm text-gray-400 hover:border-red-700 hover:text-red-400"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Output / logs */}
      {job.phase !== 'idle' && (
        <div className="av-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Output
            </h3>
            {job.phase === 'running' && (
              <span className="av-badge bg-brand-950 text-brand-400 border border-brand-900">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                Streaming
              </span>
            )}
            {job.phase === 'complete' && (
              <span className="av-badge bg-green-950 text-green-400 border border-green-900">
                ✓ Complete
              </span>
            )}
            {job.phase === 'error' && (
              <span className="av-badge bg-red-950 text-red-400 border border-red-900">
                ✗ Failed
              </span>
            )}
          </div>

          {/* Log stream */}
          {(job.phase === 'running') && (
            <div
              ref={logRef}
              className="h-64 overflow-y-auto rounded-lg bg-gray-950 p-4"
            >
              {job.logs.map((line, i) => (
                <div
                  key={i}
                  className={`av-log ${i === job.logs.length - 1 ? 'av-cursor' : ''}`}
                >
                  {line}
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {job.phase === 'complete' && (
            <pre className="max-h-96 overflow-y-auto rounded-lg bg-gray-950 p-4 text-xs text-green-300">
              {JSON.stringify(job.result, null, 2)}
            </pre>
          )}

          {/* Error */}
          {job.phase === 'error' && (
            <div className="rounded-lg bg-red-950/40 p-4 text-sm text-red-400">
              {job.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Individual parameter field ───────────────────────────────────────────────

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ActionParam;
  value: string;
  onChange: (v: string) => void;
}) {
  const base =
    'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-400">
        {param.label}
        {param.required && <span className="ml-1 text-red-400">*</span>}
      </label>

      {param.type === 'select' ? (
        <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
          {param.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : param.type === 'boolean' ? (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(String(e.target.checked))}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-brand-600"
          />
          <span className="text-xs text-gray-400">{param.label}</span>
        </label>
      ) : (
        <input
          type={param.type === 'number' ? 'number' : 'text'}
          className={base}
          value={value}
          placeholder={param.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
