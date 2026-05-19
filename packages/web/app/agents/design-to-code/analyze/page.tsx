'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { DesignQualityReport, DesignIssue, QualitySuggestion } from '@appvelocity/agent-design-to-code-workflow';

// ─── Local storage (reuses same key as main D2C page) ────────────────────────

const STORAGE_KEY = 'av_api_keys';

function loadFigmaToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? ((JSON.parse(raw) as { figmaToken?: string }).figmaToken ?? '') : '';
  } catch { return ''; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeColour(grade: string | undefined) {
  switch (grade) {
    case 'A': return 'text-green-700 bg-green-50 border-green-200';
    case 'B': return 'text-brand-600 bg-brand-50 border-brand-200';
    case 'C': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'D': return 'text-orange-700 bg-orange-50 border-orange-200';
    default:  return 'text-red-700 bg-red-50 border-red-200';
  }
}

function gradeLabel(grade: string | undefined) {
  switch (grade) {
    case 'A': return 'Excellent';
    case 'B': return 'Good';
    case 'C': return 'Needs Work';
    case 'D': return 'Poor';
    default:  return 'Critical';
  }
}

function severityIcon(severity: DesignIssue['severity']) {
  switch (severity) {
    case 'critical': return '🔴';
    case 'warning':  return '🟡';
    case 'info':     return '🔵';
  }
}

function severityColour(severity: DesignIssue['severity']) {
  switch (severity) {
    case 'critical': return 'border-red-200 bg-red-50 text-red-800';
    case 'warning':  return 'border-yellow-200 bg-yellow-50 text-yellow-800';
    case 'info':     return 'border-blue-200 bg-blue-50 text-blue-800';
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  // SVG circular gauge
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = circ * (score / 100);

  const strokeColour =
    grade === 'A' ? '#16a34a' :
    grade === 'B' ? '#f15b40' :
    grade === 'C' ? '#ca8a04' :
    grade === 'D' ? '#ea580c' :
                    '#dc2626';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke={strokeColour}
          strokeWidth="10"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="65" y="60" textAnchor="middle" dominantBaseline="middle"
          fontSize="28" fontWeight="700" fill="#0f1724">
          {score}
        </text>
        <text x="65" y="82" textAnchor="middle" dominantBaseline="middle"
          fontSize="13" fontWeight="600" fill={strokeColour}>
          {grade}
        </text>
      </svg>
      <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${gradeColour(grade)}`}>
        {gradeLabel(grade)}
      </span>
    </div>
  );
}

function DimensionBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const barColour =
    score >= 75 ? 'bg-green-500' :
    score >= 50 ? 'bg-brand-500' :
    score >= 30 ? 'bg-yellow-500' :
                  'bg-red-500';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-[#0f1724]">{score}<span className="ml-0.5 text-gray-400">/ 100</span></span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColour}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="w-8 text-right text-[10px] text-gray-400">{weight}%</span>
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: DesignIssue }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl border p-4 ${severityColour(issue.severity)}`}>
      <button
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mt-0.5 shrink-0 text-base">{severityIcon(issue.severity)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{issue.title}</span>
            {issue.affectedCount > 0 && (
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-medium">
                {issue.affectedCount} affected
              </span>
            )}
          </div>
          {!open && (
            <p className="mt-0.5 truncate text-xs opacity-80">{issue.description}</p>
          )}
        </div>
        <span className="shrink-0 text-xs opacity-60">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-current/10 pt-3 text-xs">
          <p>{issue.description}</p>
          <div className="rounded-lg bg-white/40 p-3">
            <p className="font-semibold">Impact on code generation</p>
            <p className="mt-0.5 opacity-80">{issue.impact}</p>
          </div>
          <div className="rounded-lg bg-white/40 p-3">
            <p className="font-semibold">How to fix in Figma</p>
            <p className="mt-0.5 opacity-80">{issue.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ s, index }: { s: QualitySuggestion; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="rounded-xl border border-[#e4e7ec] bg-white p-4">
      <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
          {s.priority}
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#0f1724]">{s.title}</span>
            <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
              +{s.scoreDelta} pts
            </span>
          </div>
        </div>
        <span className="shrink-0 text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ol className="mt-3 space-y-1.5 border-t border-[#e4e7ec] pt-3">
          {s.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-[#e4e7ec] bg-white px-4 py-3 text-center">
      <span className="text-xl">{icon}</span>
      <span className="text-lg font-bold text-[#0f1724]">{value}</span>
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}

// ─── Loading steps ────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  'Connecting to Figma API…',
  'Fetching file structure and design variables…',
  'Building Intermediate Representation…',
  'Scoring quality dimensions…',
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const [figmaUrl, setFigmaUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [loadingStep, setLoadingStep] = useState(0);
  const [report, setReport] = useState<DesignQualityReport | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const loadingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fill token from shared localStorage
  useEffect(() => {
    const saved = loadFigmaToken();
    if (saved) setToken(saved);
  }, []);

  async function runAudit() {
    setPhase('loading');
    setLoadingStep(0);
    setReport(null);
    setErrorMsg('');

    // Fake progress through steps while real fetch runs
    loadingTimer.current = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 2200);

    try {
      const res = await fetch('/api/agents/design-to-code/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaUrl, figmaAccessToken: token }),
      });
      clearInterval(loadingTimer.current!);

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as DesignQualityReport;
      setReport(data);
      setPhase('done');
    } catch (err) {
      clearInterval(loadingTimer.current!);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  const canSubmit = figmaUrl.trim().length > 0 && token.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {/* Header */}
      <header className="border-b border-[#e4e7ec] bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link href="/agents/design-to-code" className="text-sm text-gray-500 transition-colors hover:text-[#0f1724]">
            ← DesignToCodeAgent
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-[#0f1724]">Design Quality Audit</span>
          <Link
            href="/agents/design-to-code/history"
            className="ml-auto text-sm text-gray-500 transition-colors hover:text-[#0f1724]"
          >
            History
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
        {/* Page title */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl"
            style={{ background: '#6366f118', border: '1px solid #6366f130' }}>
            🔍
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0f1724]">Design Quality Audit</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Analyse your Figma file for design quality issues before generating code. Fast, LLM-free, 3–8 seconds.
            </p>
          </div>
        </div>

        {/* Input form */}
        <div className="av-card space-y-4">
          <h2 className="text-sm font-semibold text-[#0f1724]">Figma File</h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Figma URL</label>
            <input
              type="url"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/file/… or https://www.figma.com/design/…"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f1724] placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={phase === 'loading'}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Figma Access Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="figd_…"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-14 font-mono text-sm text-[#0f1724] placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                disabled={phase === 'loading'}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-[11px] text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Figma → Account Settings → Personal access tokens</p>
          </div>

          <button
            onClick={runAudit}
            disabled={!canSubmit || phase === 'loading'}
            className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === 'loading' ? 'Analysing…' : 'Run Quality Audit'}
          </button>
        </div>

        {/* Loading state */}
        {phase === 'loading' && (
          <div className="av-card flex flex-col items-center gap-6 py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-100 border-t-brand-500" />
            <div className="space-y-2 text-center">
              {LOADING_STEPS.map((step, i) => (
                <p key={i} className={`text-sm transition-all ${
                  i === loadingStep ? 'font-semibold text-[#0f1724]' :
                  i < loadingStep ? 'text-gray-400 line-through' :
                  'text-gray-300'
                }`}>
                  {i < loadingStep ? '✓ ' : i === loadingStep ? '› ' : ''}{step}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-700">Audit failed</p>
            <p className="mt-1 text-xs text-red-600">{errorMsg}</p>
            <button
              onClick={() => setPhase('idle')}
              className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:border-red-400"
            >
              Try again
            </button>
          </div>
        )}

        {/* Report */}
        {phase === 'done' && report && (
          <>
            {/* Score + dimensions */}
            <div className="av-card">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#0f1724]">{report.figmaFileName}</h2>
                  <p className="text-xs text-gray-400">IR Score — lower scores indicate design quality issues that reduce code generation fidelity</p>
                </div>
              </div>
              <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
                <ScoreGauge score={report.irScore} grade={report.grade} />
                <div className="flex-1 space-y-3">
                  {Object.values(report.dimensions).map((dim) => (
                    <DimensionBar key={dim.label} label={dim.label} score={dim.score} weight={dim.weight} />
                  ))}
                </div>
              </div>
            </div>

            {/* Design system stats */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-[#0f1724]">Design System Overview</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                <StatPill icon="📱" label="Screens" value={report.stats.screenCount} />
                <StatPill icon="♻" label="Components" value={report.stats.componentCount} />
                <StatPill icon="🎨" label="Tokens" value={report.stats.tokenCount} />
                <StatPill icon="🖌" label="Unique Colors" value={report.stats.uniqueColors} />
                <StatPill icon="🔤" label="Font Combos" value={report.stats.uniqueFontCombos} />
                <StatPill icon="📐" label="Grid" value={report.stats.spacingUnit ? `${report.stats.spacingUnit}pt` : '—'} />
              </div>
            </div>

            {/* Issues */}
            {report.issues.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#0f1724]">
                  Issues Found
                  <span className="ml-2 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                    {report.issues.length}
                  </span>
                  <span className="ml-2 text-[11px] font-normal text-gray-400">Click to expand</span>
                </h2>
                <div className="space-y-2">
                  {report.issues.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} />
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {report.suggestions.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#0f1724]">
                  Top Quick Wins
                  <span className="ml-2 text-[11px] font-normal text-gray-400">
                    Implement these to improve your IR score
                  </span>
                </h2>
                <div className="space-y-2">
                  {report.suggestions.map((s, i) => (
                    <SuggestionCard key={s.priority} s={s} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-700">Ready to generate code?</p>
                  <p className="mt-0.5 text-xs text-brand-600">
                    {report.irScore >= 60
                      ? 'Your design is ready for code generation. Applying the suggestions above will further improve output quality.'
                      : 'Consider addressing the critical issues above before generating code for best results.'}
                  </p>
                </div>
                <Link
                  href={`/agents/design-to-code?figmaUrl=${encodeURIComponent(figmaUrl)}`}
                  className="shrink-0 rounded-xl bg-brand-500 px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-600"
                >
                  Generate Code →
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
