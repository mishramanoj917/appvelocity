/**
 * FigmaSnapshot — workspace-level persistence layer.
 *
 * The Figma API is called exactly ONCE per session. The full response is
 * serialised to workspace/{sessionId}/figma_snapshot.json. Every subsequent
 * agent iteration (and every other agent) reads from this file — never from
 * the network.
 *
 * Session ID strategy:
 *   - Callers supply a session ID (usually generated at agent-start time).
 *   - findExistingSnapshot() lets callers reuse a prior session snapshot for
 *     the same fileKey, avoiding a second API call across sessions.
 */

import fs   from 'node:fs';
import path from 'node:path';
import type { FigmaFile, FigmaVariablesResponse } from './types.js';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface FigmaSnapshot {
  /** Figma file key (extracted from URL) */
  fileKey: string;
  /** Human-readable file name */
  fileName: string;
  /** ISO timestamp of when this snapshot was taken */
  fetchedAt: string;
  /** Full /v1/files response */
  figmaFile: FigmaFile;
  /** Design variables (null if file has none or fetch failed) */
  variablesResponse: FigmaVariablesResponse | null;
  /** nodeId → Figma CDN export URL (populated by NodeCollector) */
  assetUrls: Record<string, string>;
  /** Figma file version string (from figmaFile.version) */
  version: string;
}

// ─── Manager ──────────────────────────────────────────────────────────────────

export class SnapshotManager {
  readonly workspaceDir: string;

  constructor(workspaceDir?: string) {
    this.workspaceDir =
      workspaceDir ??
      process.env['WORKSPACE_DIR'] ??
      path.join(process.cwd(), 'workspace');
  }

  // ─── Paths ─────────────────────────────────────────────────────────────────

  sessionDir(sessionId: string): string {
    return path.join(this.workspaceDir, sessionId);
  }

  snapshotPath(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), 'figma_snapshot.json');
  }

  assetsDir(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), 'assets');
  }

  assetPath(sessionId: string, nodeId: string): string {
    const safe = nodeId.replace(/[:/]/g, '_');
    return path.join(this.assetsDir(sessionId), safe);
  }

  generatedDir(sessionId: string, framework: string): string {
    return path.join(this.sessionDir(sessionId), 'generated', framework);
  }

  validationReportPath(sessionId: string, fileHash: string): string {
    const dir = path.join(this.sessionDir(sessionId), 'validation_reports');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${fileHash}.json`);
  }

  visualQaReportPath(sessionId: string, screenName: string): string {
    const dir = path.join(this.sessionDir(sessionId), 'visual_qa_reports');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${screenName}.json`);
  }

  screenshotPath(sessionId: string, screenName: string): string {
    const dir = path.join(this.sessionDir(sessionId), 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${screenName}.png`);
  }

  groundTruthPath(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), 'ground_truth.json');
  }

  irPath(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), 'ir.json');
  }

  sessionConfigPath(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), 'session.json');
  }

  outputDir(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), 'output');
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /** Returns true if a snapshot JSON file exists for this session. */
  exists(sessionId: string): boolean {
    try {
      return fs.existsSync(this.snapshotPath(sessionId));
    } catch {
      return false;
    }
  }

  /** Loads and parses the snapshot. Throws if not found. */
  load(sessionId: string): FigmaSnapshot {
    const p = this.snapshotPath(sessionId);
    if (!fs.existsSync(p)) {
      throw new Error(`Snapshot not found at ${p}`);
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as FigmaSnapshot;
  }

  /** Writes snapshot to disk, creating all required subdirectories. */
  save(sessionId: string, snapshot: FigmaSnapshot): void {
    const dir = this.sessionDir(sessionId);
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
    fs.writeFileSync(
      this.snapshotPath(sessionId),
      JSON.stringify(snapshot, null, 2),
      'utf-8'
    );
  }

  /**
   * Scans the workspace for an existing snapshot matching fileKey.
   * Returns the most recently fetched session ID, or null if none found.
   *
   * Use this to reuse a snapshot across sessions for the same Figma file.
   */
  findExistingSnapshot(fileKey: string): string | null {
    if (!fs.existsSync(this.workspaceDir)) return null;

    let bestSessionId: string | null = null;
    let bestFetchedAt = '';

    for (const entry of fs.readdirSync(this.workspaceDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sessionId = entry.name;
      const snapshotFile = this.snapshotPath(sessionId);
      if (!fs.existsSync(snapshotFile)) continue;

      try {
        const snap = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8')) as FigmaSnapshot;
        if (snap.fileKey === fileKey && snap.fetchedAt > bestFetchedAt) {
          bestFetchedAt = snap.fetchedAt;
          bestSessionId = sessionId;
        }
      } catch {
        // Corrupt snapshot — skip
      }
    }

    return bestSessionId;
  }
}
