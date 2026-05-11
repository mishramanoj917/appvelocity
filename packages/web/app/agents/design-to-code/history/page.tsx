'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileTreeView } from '@/components/code-viewer/file-tree';
import type { ProjectMeta, ProjectFilePath } from '@/lib/project-store';

function toCodeFiles(filePaths: ProjectFilePath[]) {
  return filePaths.map((f) => ({ path: f.path, content: '', language: f.language }));
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ProjectCard({
  project,
  onDelete,
}: {
  project: ProjectMeta;
  onDelete: (jobId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${project.projectName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/agents/design-to-code/history/${project.jobId}`, { method: 'DELETE' });
      onDelete(project.jobId);
    } finally {
      setDeleting(false);
    }
  }

  const fwColor =
    project.framework === 'flutter'
      ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
      : 'border-brand-200 bg-brand-50 text-brand-600';

  return (
    <div className="av-card">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[#0f1724]">{project.projectName}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${fwColor}`}>
              {project.framework}
            </span>
            <span className="text-[10px] text-gray-400">
              {project.fileCount} file{project.fileCount !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {timeAgo(project.createdAt)}
            {project.figmaUrl && (
              <> · <span className="truncate">{project.figmaUrl.replace('https://', '').slice(0, 50)}{project.figmaUrl.length > 55 ? '…' : ''}</span></>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/agents/design-to-code/jobs/${project.jobId}`}
            className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:border-brand-500 hover:text-brand-700"
          >
            View Code ↗
          </Link>
          <a
            href={`/api/agents/design-to-code/history/${project.jobId}/download`}
            download={`${project.projectName}.zip`}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:text-[#0f1724]"
          >
            ⬇ Download
          </a>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:border-red-400 hover:text-red-600 disabled:opacity-50"
          >
            {deleting ? '…' : '🗑 Delete'}
          </button>
        </div>
      </div>

      {/* File tree toggle */}
      {project.filePaths.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 transition-colors hover:text-gray-600"
          >
            <span>{expanded ? '▼' : '▶'}</span>
            <span>{expanded ? 'Hide' : 'Show'} file structure</span>
          </button>
          {expanded && (
            <div className="mt-2">
              <FileTreeView
                files={toCodeFiles(project.filePaths)}
                activeFile=""
                onSelectFile={() => undefined}
                theme="light"
                className="max-h-56 overflow-y-auto rounded-lg bg-gray-50 border border-[#e4e7ec] py-1"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);

  useEffect(() => {
    fetch('/api/agents/design-to-code/history')
      .then((r) => r.json())
      .then((data) => setProjects(data as ProjectMeta[]))
      .catch(() => setProjects([]));
  }, []);

  function handleDelete(jobId: string) {
    setProjects((prev) => prev?.filter((p) => p.jobId !== jobId) ?? []);
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-[#e4e7ec] bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/agents/design-to-code"
              className="text-sm text-gray-500 transition-colors hover:text-[#0f1724]"
            >
              ← New job
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-[#0f1724]">Project History</span>
          </div>
          {projects && projects.length > 0 && (
            <span className="text-xs text-gray-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {projects === null && (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        )}

        {projects !== null && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-500">No projects generated yet.</p>
            <Link
              href="/agents/design-to-code"
              className="mt-3 text-sm text-brand-500 transition-colors hover:text-brand-600"
            >
              Start a new job →
            </Link>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="space-y-4">
            {projects.map((p) => (
              <ProjectCard key={p.jobId} project={p} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
