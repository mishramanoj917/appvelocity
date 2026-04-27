/**
 * Node 13 — ProjectZipperAgent
 *
 * Creates an in-memory ZIP archive of the complete project bundle and stores
 * the raw bytes in state.zipBuffer. The web API download endpoint reads this
 * buffer and sends it as a ZIP file response.
 *
 * Assets: CDN URLs are fetched and embedded as real binary files. If a fetch
 * fails, a <name>.url placeholder is written instead so developers can
 * download manually.
 *
 * Input state:  projectBundle
 * Output state: zipBuffer, currentStep, logs
 */

import archiver from 'archiver';
import { Writable } from 'node:stream';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState } from '../types.js';

const ASSET_FETCH_TIMEOUT_MS = 15_000;
const MAX_ASSETS_TO_DOWNLOAD = 30;

// ─── Asset download ───────────────────────────────────────────────────────────

interface DownloadedAsset {
  path: string;
  content: Buffer | null;
  url: string;
}

async function downloadAssets(
  assets: Array<{ path: string; url?: string }>
): Promise<DownloadedAsset[]> {
  const capped = assets.filter((a) => !!a.url).slice(0, MAX_ASSETS_TO_DOWNLOAD);

  const results = await Promise.allSettled(
    capped.map(async (asset): Promise<DownloadedAsset> => {
      try {
        const res = await fetch(asset.url!, {
          signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return { path: asset.path, content: null, url: asset.url! };
        const buf = Buffer.from(await res.arrayBuffer());
        return { path: asset.path, content: buf, url: asset.url! };
      } catch {
        return { path: asset.path, content: null, url: asset.url! };
      }
    })
  );

  return results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { path: '', content: null, url: '' }
  ).filter((r) => r.path);
}

// ─── ZIP builder ──────────────────────────────────────────────────────────────

async function buildZip(state: WorkflowState): Promise<{ zip: Buffer; downloadedCount: number }> {
  const bundle = state.projectBundle;
  const files = bundle?.files ?? state.generatedCode?.files ?? [];
  const rawAssets = bundle?.assets ?? state.generatedCode?.assets ?? [];

  // Pre-download all asset binaries in parallel
  const downloadedAssets = await downloadAssets(rawAssets);
  const assetMap = new Map<string, Buffer>(
    downloadedAssets.filter((a) => a.content !== null).map((a) => [a.path, a.content!])
  );
  const downloadedCount = assetMap.size;

  const zip = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    const sink = new Writable({
      write(chunk: Buffer, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        cb();
      },
    });

    sink.on('finish', () => resolve(Buffer.concat(chunks)));
    sink.on('error', reject);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', reject);
    archive.pipe(sink);

    // Source files
    for (const file of files) {
      archive.append(file.content, { name: file.path });
    }

    // Assets — binary if downloaded, URL placeholder otherwise
    for (const asset of rawAssets) {
      if (!asset.url) continue;
      const content = assetMap.get(asset.path);
      if (content) {
        archive.append(content, { name: asset.path });
      } else {
        archive.append(
          `# Could not download asset automatically.\n# Download from:\n${asset.url}\n`,
          { name: asset.path + '.url' }
        );
      }
    }

    archive.finalize();
  });

  return { zip, downloadedCount };
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function projectZipperAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const { zip: zipBuffer, downloadedCount } = await buildZip(state);
  const projectName = state.projectBundle?.projectName ?? state.executionPlan?.projectName ?? 'project';
  const totalAssets = (state.projectBundle?.assets ?? state.generatedCode?.assets ?? []).length;
  const fileSizeKb = Math.round(zipBuffer.byteLength / 1024);

  const assetMsg = totalAssets > 0
    ? `, ${downloadedCount}/${totalAssets} assets embedded`
    : '';

  return {
    zipBuffer,
    currentStep: 'ProjectZipperAgent',
    logs: [
      makeLogEntry('success', `[ProjectZipper] Created ZIP: "${projectName}.zip" (${fileSizeKb} KB${assetMsg})`),
    ],
  };
}
