/**
 * NodeCollector — batch Figma image export strategy.
 *
 * Problem: the Figma /v1/images API accepts up to ~200 node IDs per request.
 * Calling it once per node would consume most of the rate limit budget.
 *
 * Solution:
 *   1. Accumulate all node IDs that need export during IR building.
 *   2. Deduplicate.
 *   3. Split into batches of MAX_BATCH_SIZE.
 *   4. Call /v1/images once per batch — all through the existing p-queue throttler.
 *
 * The resulting Map<nodeId, url> is merged into the FigmaSnapshot.assetUrls field
 * so every subsequent agent reads CDN URLs from disk, never from the network.
 */

import type { FigmaClient } from './client.js';

const MAX_BATCH_SIZE = 200;

// ─── Collector ────────────────────────────────────────────────────────────────

export class NodeCollector {
  private readonly nodeIds = new Set<string>();
  private readonly format: 'svg' | 'png';

  constructor(format: 'svg' | 'png' = 'png') {
    this.format = format;
  }

  /** Register a node ID for export. Safe to call multiple times with the same ID. */
  collect(nodeId: string): void {
    if (nodeId) this.nodeIds.add(nodeId);
  }

  /** Register many node IDs at once. */
  collectMany(nodeIds: string[]): void {
    for (const id of nodeIds) this.collect(id);
  }

  get size(): number {
    return this.nodeIds.size;
  }

  /**
   * Flush all collected node IDs to the Figma /images API in batches.
   * Returns a Map of nodeId → CDN export URL.
   * Nodes that returned null (Figma couldn't export them) are omitted.
   */
  async flush(
    client: FigmaClient,
    fileKey: string
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (this.nodeIds.size === 0) return result;

    const ids    = [...this.nodeIds];
    const batches = _chunk(ids, MAX_BATCH_SIZE);

    await Promise.all(
      batches.map(async (batch) => {
        try {
          const response = await client.getImageExports(fileKey, batch, {
            format: this.format,
            scale:  this.format === 'png' ? 2 : 1,
          });
          for (const [nodeId, url] of Object.entries(response.images)) {
            if (url) result.set(nodeId, url);
          }
        } catch (err) {
          // Non-fatal: log and continue — some nodes may not be exportable
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[NodeCollector] Batch export failed for ${batch.length} nodes: ${msg}`);
        }
      })
    );

    return result;
  }

  /** Clear collected IDs (useful for re-use across sessions). */
  reset(): void {
    this.nodeIds.clear();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
