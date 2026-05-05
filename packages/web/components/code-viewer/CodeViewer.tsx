'use client';

/**
 * CodeViewer
 *
 * Displays the generated CodeBundle as a split-panel viewer:
 *   left  — interactive collapsible file tree (click to expand/collapse dirs)
 *   right — code content with line numbers
 *
 * Toolbar buttons:
 *   Copy    — copies the active file to clipboard
 *   Download .zip — client-side zip using fflate (dynamic import, no bundle overhead)
 *
 * Props:
 *   selectedFile  — optional controlled active file path (lifted state from parent)
 *   onFileSelect  — optional callback when the user picks a file (lifted state)
 */

import { useState } from 'react';
import { FileTreeView } from './file-tree';

export interface CodeFile {
  path: string;
  content: string;
  language: 'typescript' | 'dart' | string;
}

interface Props {
  files: CodeFile[];
  framework: string;
  jobId: string;
  selectedFile?: string;
  onFileSelect?: (path: string) => void;
}

export function CodeViewer({ files, framework, jobId, selectedFile, onFileSelect }: Props) {
  const [internalActive, setInternalActive] = useState(files[0]?.path ?? '');
  const [copying,    setCopying]    = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Controlled if parent passes selectedFile; otherwise use internal state
  const activeFile  = selectedFile ?? internalActive;
  function selectFile(path: string) {
    setInternalActive(path);
    onFileSelect?.(path);
  }

  const active = files.find((f) => f.path === activeFile) ?? files[0];
  const lines  = (active?.content ?? '').split('\n');

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
      const blob   = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
      const url    = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href     = url;
      anchor.download = `${framework}-${jobId.slice(0, 8)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#3c3c3c] shadow-sm" style={{ background: '#1e1e1e' }}>
      {/* ── Toolbar ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: '#3c3c3c', background: '#252526' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#858585' }}>
          {files.length} file{files.length !== 1 ? 's' : ''} generated
        </p>
        <div className="flex gap-2">
          <button
            onClick={copyCode}
            className="rounded px-3 py-1 text-xs transition-colors"
            style={{ border: '1px solid #3c3c3c', color: '#cccccc', background: 'transparent' }}
            onMouseOver={e => (e.currentTarget.style.borderColor = '#6c6c6c')}
            onMouseOut={e => (e.currentTarget.style.borderColor = '#3c3c3c')}
          >
            {copying ? '✓ Copied' : 'Copy'}
          </button>
          <button
            onClick={downloadZip}
            disabled={downloading}
            className="rounded px-3 py-1 text-xs transition-colors disabled:opacity-50"
            style={{ border: '1px solid #f15b40', color: '#f15b40', background: 'transparent' }}
            onMouseOver={e => { e.currentTarget.style.background = '#f15b4015'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {downloading ? 'Zipping…' : '⬇ Download .zip'}
          </button>
        </div>
      </div>

      {/* ── Split view ──────────────────────────────────────────────────────────── */}
      <div className="flex" style={{ height: '560px' }}>
        {/* File tree sidebar — VS Code style */}
        <div className="w-64 flex-shrink-0 overflow-y-auto py-1" style={{ background: '#252526', borderRight: '1px solid #3c3c3c' }}>
          <FileTreeView
            files={files}
            activeFile={activeFile}
            onSelectFile={selectFile}
            theme="vscode"
          />
        </div>

        {/* Code panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Active file path tab */}
          <div className="flex items-center border-b px-4 py-1.5" style={{ borderColor: '#3c3c3c', background: '#1e1e1e' }}>
            <span className="font-mono text-xs" style={{ color: '#cccccc' }}>{active?.path}</span>
            <span className="ml-auto font-mono text-xs" style={{ color: '#6c6c6c' }}>
              {active?.language === 'dart' ? 'Dart' : 'TypeScript'} · {lines.length} lines
            </span>
          </div>

          {/* Code with line numbers */}
          <div className="flex-1 overflow-auto" style={{ background: '#1e1e1e' }}>
            <table className="min-w-full border-collapse font-mono text-xs leading-5">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="group">
                    <td className="w-10 select-none py-px pr-4 text-right align-top group-hover:bg-white/5" style={{ color: '#4e4e4e' }}>
                      {i + 1}
                    </td>
                    <td className="whitespace-pre py-px pr-4 align-top group-hover:bg-white/5" style={{ color: '#d4d4d4' }}>
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
