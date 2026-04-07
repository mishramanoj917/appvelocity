'use client';

/**
 * CodeViewer
 *
 * Displays the generated CodeBundle as a split-panel viewer:
 *   left  — file tree (click to switch)
 *   right — code content with line numbers
 *
 * Toolbar buttons:
 *   Copy    — copies the active file to clipboard
 *   Download .zip — client-side zip using fflate (dynamic import, no bundle overhead)
 */

import { useState } from 'react';

export interface CodeFile {
  path: string;
  content: string;
  language: 'typescript' | 'dart';
}

interface Props {
  files: CodeFile[];
  framework: string;
  jobId: string;
}

export function CodeViewer({ files, framework, jobId }: Props) {
  const [activeFile, setActiveFile] = useState(files[0]?.path ?? '');
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const active = files.find((f) => f.path === activeFile) ?? files[0];
  const lines = (active?.content ?? '').split('\n');

  async function copyCode() {
    if (!active) return;
    await navigator.clipboard.writeText(active.content);
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  }

  async function downloadZip() {
    setDownloading(true);
    try {
      const { zipSync, strToU8 } = await import('fflate');
      const fileMap: Record<string, Uint8Array> = {};
      for (const f of files) {
        fileMap[f.path] = strToU8(f.content);
      }
      const zipped = zipSync(fileMap, { level: 6 });
      const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${framework}-${jobId.slice(0, 8)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // Group files by directory for the sidebar
  const grouped = groupByDir(files);

  return (
    <div className="av-card overflow-hidden p-0">
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {files.length} file{files.length !== 1 ? 's' : ''} generated
        </p>
        <div className="flex gap-2">
          <button
            onClick={copyCode}
            className="rounded border border-gray-700 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
          >
            {copying ? '✓ Copied' : 'Copy'}
          </button>
          <button
            onClick={downloadZip}
            disabled={downloading}
            className="rounded border border-brand-700 px-3 py-1 text-xs text-brand-400 transition-colors hover:border-brand-500 hover:text-brand-200 disabled:opacity-50"
          >
            {downloading ? 'Zipping…' : '⬇ Download .zip'}
          </button>
        </div>
      </div>

      {/* ── Split view ────────────────────────────────────────────────────────── */}
      <div className="flex" style={{ height: '560px' }}>
        {/* File tree sidebar */}
        <div className="w-56 flex-shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-950/60 py-2">
          {Object.entries(grouped).map(([dir, dirFiles]) => (
            <div key={dir}>
              {/* Directory label */}
              {dir && (
                <div className="px-3 pb-0.5 pt-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
                  {dir}
                </div>
              )}
              {/* Files in this directory */}
              {dirFiles.map((f) => {
                const fileName = f.path.split('/').pop() ?? f.path;
                const isActive = f.path === activeFile;
                return (
                  <button
                    key={f.path}
                    onClick={() => setActiveFile(f.path)}
                    title={f.path}
                    className={`w-full px-3 py-1.5 text-left transition-colors ${
                      isActive
                        ? 'bg-brand-950/70 text-brand-300'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`}
                  >
                    <span className="block truncate text-xs">{fileName}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Code panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Active file path */}
          <div className="flex items-center border-b border-gray-800 bg-gray-900 px-4 py-1.5">
            <span className="font-mono text-xs text-gray-500">{active?.path}</span>
            <span className="ml-auto font-mono text-xs text-gray-700">
              {active?.language === 'dart' ? 'Dart' : 'TypeScript'} · {lines.length} lines
            </span>
          </div>

          {/* Code with line numbers */}
          <div className="flex-1 overflow-auto bg-gray-950">
            <table className="min-w-full border-collapse font-mono text-xs leading-5">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="hover:bg-gray-800/20">
                    <td className="w-10 select-none py-px pr-4 text-right text-gray-700 align-top">
                      {i + 1}
                    </td>
                    <td className="whitespace-pre py-px pr-4 text-gray-200 align-top">
                      {line || '\u00a0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Groups files by their parent directory path. Root files use "" as key. */
function groupByDir(files: CodeFile[]): Record<string, CodeFile[]> {
  const result: Record<string, CodeFile[]> = {};
  for (const f of files) {
    const parts = f.path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    if (!result[dir]) result[dir] = [];
    result[dir].push(f);
  }
  return result;
}
