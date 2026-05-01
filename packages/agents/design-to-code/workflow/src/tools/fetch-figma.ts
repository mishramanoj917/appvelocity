import { figmaFetcherAgent } from '../nodes/figma-fetcher.js';
import { memoryToState }    from './registry.js';
import type { AgentMemory } from '../agent-memory.js';
import type { ToolResult }  from '../types.js';
import type { FigmaSnapshot } from '@appvelocity/agent-design-to-code-core';

export async function fetchFigmaTool(
  args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  // ── Guard: already loaded this session (snapshot in memory) ─────────────────
  if (memory.snapshotLoaded && memory.figmaFile) {
    const screens = memory.designIR?.screens?.length ?? '?';
    const comps   = memory.designIR?.components?.length ?? '?';
    return {
      success: true,
      summary: `Figma already loaded from snapshot — "${memory.figmaFile.name}" (${screens} screens, ${comps} components). Skipping API call.`,
    };
  }

  const mgr = memory.snapshotManager;
  const sid = memory.sessionId;

  // ── Check workspace snapshot (persisted from a prior run) ────────────────────
  if (mgr.exists(sid)) {
    const snap: FigmaSnapshot = mgr.load(sid);
    memory.figmaFile         = snap.figmaFile;
    memory.variablesResponse = snap.variablesResponse ?? undefined;
    memory.snapshotLoaded    = true;

    const pageCount  = snap.figmaFile.document.children?.length ?? 0;
    const tokenCount = snap.variablesResponse
      ? Object.keys(snap.variablesResponse.meta.variables).length
      : 0;

    return {
      success: true,
      summary: `Loaded "${snap.fileName}" from workspace snapshot (no API call) — ${pageCount} page(s), ${tokenCount} tokens, snapshot age: ${_age(snap.fetchedAt)}.`,
    };
  }

  // ── Fallback: scan workspace for same fileKey from another session ─────────
  const url = (args['url'] as string | undefined) ?? memory.input.figmaUrl;
  const existingSid = mgr.findExistingSnapshot(_fileKeyFromUrl(url));
  if (existingSid) {
    const snap: FigmaSnapshot = mgr.load(existingSid);
    memory.figmaFile         = snap.figmaFile;
    memory.variablesResponse = snap.variablesResponse ?? undefined;
    memory.snapshotLoaded    = true;

    return {
      success: true,
      summary: `Reused snapshot from session ${existingSid.slice(0, 8)} — "${snap.fileName}" (${snap.figmaFile.document.children?.length ?? 0} pages). No API call.`,
    };
  }

  // ── First fetch: call Figma API once, then persist ────────────────────────
  const state = { ...memoryToState(memory), figmaUrl: url };
  const result = await figmaFetcherAgent(state);

  if (!result.figmaFile) {
    const err = result.errors?.[0]?.message ?? 'Unknown error';
    return { success: false, summary: `Failed to fetch Figma file: ${err}`, error: err };
  }

  memory.figmaFile         = result.figmaFile;
  memory.variablesResponse = result.variablesResponse;
  memory.snapshotLoaded    = true;

  // Persist snapshot to disk so all future iterations skip the API
  const snapshot: FigmaSnapshot = {
    fileKey:           _fileKeyFromUrl(url),
    fileName:          result.figmaFile.name,
    fetchedAt:         new Date().toISOString(),
    figmaFile:         result.figmaFile,
    variablesResponse: result.variablesResponse ?? null,
    assetUrls:         {},
    version:           result.figmaFile.version,
  };
  mgr.save(sid, snapshot);

  const pageCount  = result.figmaFile.document.children?.length ?? 0;
  const tokenCount = result.variablesResponse
    ? Object.keys(result.variablesResponse.meta.variables).length
    : 0;

  return {
    success: true,
    summary: `Fetched "${result.figmaFile.name}" — ${pageCount} page(s), ${tokenCount} design tokens. Snapshot saved (session ${sid.slice(0, 8)}).`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _fileKeyFromUrl(url: string): string {
  const m = /figma\.com\/(?:file|design)\/([a-zA-Z0-9_-]+)/.exec(url);
  return m?.[1] ?? url;
}

function _age(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}
