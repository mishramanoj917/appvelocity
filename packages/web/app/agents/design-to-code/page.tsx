'use client';

/**
 * /agents/design-to-code
 *
 * Dedicated launch page for DesignToCodeAgent.
 * Accepts a Figma URL + framework, streams live pipeline logs, then
 * navigates to /agents/design-to-code/jobs/[jobId] on completion.
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DesignToCodePage() {
  const router = useRouter();
  const [figmaUrl, setFigmaUrl] = useState('');
  const [framework, setFramework] = useState<'react-native' | 'flutter'>('react-native');
  const [phase, setPhase] = useState<'idle' | 'running' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Auto-scroll log panel
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Cleanup on unmount
  useEffect(() => () => { esRef.current?.close(); }, []);

  async function handleLaunch() {
    const url = figmaUrl.trim();
    if (!url) return;

    setPhase('running');
    setLogs(['Starting DesignToCodeAgent…']);
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
      setLogs((l) => [...l, `Job created (${jobId.slice(0, 8)}…). Streaming pipeline output…`]);

      const es = new EventSource(streamUrl);
      esRef.current = es;

      es.addEventListener('log', (e) => {
        const { message } = JSON.parse(e.data) as { message: string };
        setLogs((l) => [...l, message]);
      });

      es.addEventListener('progress', (e) => {
        const { label } = JSON.parse(e.data) as { label: string };
        setLogs((l) => [...l, `→ ${label}`]);
      });

      es.addEventListener('complete', () => {
        es.close();
        // Navigate to the job result page
        router.push(`/agents/design-to-code/jobs/${jobId}`);
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
  }

  return (
    <div className="min-h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-950/80 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link
            href="/"
            className="text-sm text-gray-500 transition-colors hover:text-gray-300"
          >
            ← Dashboard
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-300">DesignToCodeAgent</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* ── Agent header ──────────────────────────────────────────────────── */}
        <div className="mb-8 flex items-center gap-4">
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

        {/* ── Launch form ───────────────────────────────────────────────────── */}
        <div className="av-card space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Generate Code
          </h2>

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

          {/* Framework selector */}
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

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleLaunch}
              disabled={phase === 'running' || !figmaUrl.trim()}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === 'running' ? '⏳ Generating…' : 'Generate Code'}
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

        {/* ── Live pipeline logs ────────────────────────────────────────────── */}
        {phase === 'running' && (
          <div className="av-card mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Pipeline
              </h3>
              <span className="av-badge border border-brand-900 bg-brand-950 text-brand-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                Running
              </span>
            </div>
            <div ref={logRef} className="h-64 overflow-y-auto rounded-lg bg-gray-950 p-4">
              {logs.map((line, i) => (
                <div key={i} className={`av-log ${i === logs.length - 1 ? 'av-cursor' : ''}`}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="av-card mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Error
              </h3>
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
