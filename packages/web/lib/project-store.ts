/**
 * Filesystem-backed project store.
 *
 * Layout: storage/projects/{jobId}/
 *   meta.json   — lightweight metadata (no file content)
 *   bundle.json — full projectBundle (files + content) for the code viewer
 *   {name}.zip  — the generated ZIP archive
 *
 * `process.cwd()` resolves to packages/web when running `next dev` or `next build`.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectFilePath {
  path: string;
  language: string;
}

export interface ProjectMeta {
  jobId: string;
  projectName: string;
  framework: string;
  fileCount: number;
  filePaths: ProjectFilePath[];
  createdAt: number;
  figmaUrl?: string;
}

export interface ProjectBundle {
  projectName?: string;
  framework: string;
  files: Array<{ path: string; content: string; language: string }>;
  dependencies?: Record<string, string>;
}

interface AgentOutputData {
  projectBundle?: ProjectBundle;
  zipBuffer?: { type: 'Buffer'; data: number[] } | Buffer;
  [key: string]: unknown;
}

interface AgentOutput {
  success?: boolean;
  data?: AgentOutputData;
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'projects');

function jobDir(jobId: string) {
  return path.join(STORAGE_ROOT, jobId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBuffer(raw: AgentOutputData['zipBuffer']): Buffer | null {
  if (!raw) return null;
  if (Buffer.isBuffer(raw)) return raw;
  // JSON-serialised Buffer arrives as { type: 'Buffer', data: [...] }
  if (typeof raw === 'object' && 'data' in raw) return Buffer.from(raw.data);
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function saveProject(
  jobId: string,
  result: AgentOutput,
  figmaUrl?: string
): Promise<void> {
  const bundle = result.data?.projectBundle;
  if (!bundle?.files?.length) return; // nothing to save

  const dir = jobDir(jobId);
  await fs.mkdir(dir, { recursive: true });

  const projectName = bundle.projectName ?? 'project';
  const filePaths: ProjectFilePath[] = bundle.files.map((f) => ({
    path: f.path,
    language: f.language,
  }));

  const meta: ProjectMeta = {
    jobId,
    projectName,
    framework: bundle.framework,
    fileCount: bundle.files.length,
    filePaths,
    createdAt: Date.now(),
    figmaUrl,
  };

  await Promise.all([
    fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2)),
    fs.writeFile(path.join(dir, 'bundle.json'), JSON.stringify(bundle, null, 2)),
  ]);

  const zipBuf = toBuffer(result.data?.zipBuffer);
  if (zipBuf) {
    const safe = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    await fs.writeFile(path.join(dir, `${safe}.zip`), zipBuf);
  }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    const entries = await fs.readdir(STORAGE_ROOT, { withFileTypes: true });
    const metas = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          try {
            const raw = await fs.readFile(path.join(STORAGE_ROOT, e.name, 'meta.json'), 'utf8');
            return JSON.parse(raw) as ProjectMeta;
          } catch {
            return null;
          }
        })
    );
    return (metas.filter(Boolean) as ProjectMeta[]).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteProject(jobId: string): Promise<void> {
  await fs.rm(jobDir(jobId), { recursive: true, force: true });
}

export async function getProjectZipPath(jobId: string): Promise<string | null> {
  try {
    const dir = jobDir(jobId);
    const entries = await fs.readdir(dir);
    const zip = entries.find((f) => f.endsWith('.zip'));
    return zip ? path.join(dir, zip) : null;
  } catch {
    return null;
  }
}

export async function loadBundle(jobId: string): Promise<ProjectBundle | null> {
  try {
    const raw = await fs.readFile(path.join(jobDir(jobId), 'bundle.json'), 'utf8');
    return JSON.parse(raw) as ProjectBundle;
  } catch {
    return null;
  }
}
