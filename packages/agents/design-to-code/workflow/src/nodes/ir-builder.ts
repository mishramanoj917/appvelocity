/**
 * Node 4 — IRBuilderAgent
 * Transforms the fetched FigmaFile into a DesignIR using the core IRBuilder.
 *
 * Post-build steps:
 *   1. Mobile screen filter — excludes desktop/design-system frames.
 *   2. Asset URL resolution — calls GET /v1/images to obtain CDN export URLs
 *      for any image nodes detected during IR construction.
 *   3. IR warnings — non-fatal messages are surfaced as 'info' log entries.
 */

import { FigmaClient, IRBuilder, parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState } from '../types.js';
import type { IRScreen, IRElement } from '@appvelocity/agent-design-to-code-core';

/** Mobile screens are ≤ this width (px). Wider frames are desktop/design-system. */
const MAX_MOBILE_WIDTH = 600;
/** Minimum meaningful screen height — filters stub/banner frames. */
const MIN_SCREEN_HEIGHT = 300;

const MOBILE_FRAMEWORKS = new Set(['react-native', 'flutter']);

export async function irBuilderAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  if (!state.figmaFile) {
    throw new Error(
      'FigmaFile not available in state. ResearcherAgent must run before IRBuilderAgent.'
    );
  }

  const { fileKey } = parseFigmaUrl(state.figmaUrl);
  const builder = new IRBuilder();

  const designIR = builder.build(state.figmaFile, fileKey, state.variablesResponse);

  const logs = [];

  // ── 0. Apply visualAnalysis hints to element classification ─────────────────
  if (state.visualAnalysis) {
    const { iconNodeIds, imageNodeIds, layoutHints, iconUrls = {}, imageUrls = {} } = state.visualAnalysis;
    // Build fast lookup sets
    const iconSet = new Set(iconNodeIds);
    const imageSet = new Set(imageNodeIds);
    const hintMap = new Map(layoutHints.map((h) => [h.nodeId, h]));

    // Walk all screens and update element types / layout based on vision hints
    for (const screen of designIR.screens) {
      applyVisualHints(screen.root, iconSet, imageSet, hintMap);
    }

    // Register icon and image nodes as IR assets (so they get CDN URLs and land in the ZIP)
    const existingIds = new Set(designIR.assets.map((a) => a.nodeId));
    for (const [nodeId, url] of Object.entries(iconUrls)) {
      if (!existingIds.has(nodeId)) {
        designIR.assets.push({ nodeId, slug: nodeId.replace(':', '_'), format: 'svg', url } as typeof designIR.assets[0]);
        existingIds.add(nodeId);
      }
    }
    for (const [nodeId, url] of Object.entries(imageUrls)) {
      if (!existingIds.has(nodeId)) {
        designIR.assets.push({ nodeId, slug: nodeId.replace(':', '_'), format: 'png', url } as typeof designIR.assets[0]);
        existingIds.add(nodeId);
      }
    }

    logs.push(makeLogEntry('info',
      `Applied visual analysis hints: ${iconSet.size} icon overrides, ${imageSet.size} image overrides, ${hintMap.size} layout hints, ` +
      `${Object.keys(iconUrls).length} icon URLs + ${Object.keys(imageUrls).length} image URLs registered`
    ));
  }

  // ── 1. Mobile screen filter ─────────────────────────────────────────────────
  if (MOBILE_FRAMEWORKS.has(state.targetFramework)) {
    const all = designIR.screens.length;
    designIR.screens = (designIR.screens as IRScreen[]).filter(
      (s) => s.width <= MAX_MOBILE_WIDTH && s.height >= MIN_SCREEN_HEIGHT
    );
    const excluded = all - designIR.screens.length;
    if (excluded > 0) {
      logs.push(
        makeLogEntry(
          'info',
          `Filtered ${excluded} non-mobile frame(s) (width > ${MAX_MOBILE_WIDTH}px or height < ${MIN_SCREEN_HEIGHT}px) — kept ${designIR.screens.length} mobile screens`
        )
      );
    }
  }

  // ── 2. Asset URL resolution ─────────────────────────────────────────────────
  const figmaToken = state.figmaAccessToken || process.env.FIGMA_ACCESS_TOKEN;
  if (designIR.assets.length > 0 && figmaToken) {
    const client = new FigmaClient({
      accessToken: figmaToken,
      rateLimitPerMinute: 60,
    });

    try {
      const nodeIds = designIR.assets.map((a) => a.nodeId);
      const imagesResponse = await client.getImageExports(fileKey, nodeIds, {
        format: 'png',
        scale: 2,
      });
      const exportUrls = imagesResponse.images;

      let resolved = 0;
      for (const asset of designIR.assets) {
        const url = exportUrls[asset.nodeId];
        if (url) {
          asset.url = url;
          resolved++;
        }
      }

      // Propagate resolved src into element image references
      if (resolved > 0) {
        const urlMap: Record<string, string> = Object.fromEntries(
          Object.entries(exportUrls).filter((e): e is [string, string] => e[1] !== null)
        );
        updateImageSrcs(designIR.screens.map((s) => s.root), urlMap);
        logs.push(
          makeLogEntry(
            'info',
            `Resolved CDN export URLs for ${resolved}/${designIR.assets.length} image asset(s)`
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logs.push(
        makeLogEntry('warning', `Asset URL resolution failed — continuing without image URLs: ${msg}`)
      );
    }
  }

  // ── 3. Surface IR warnings as log entries ───────────────────────────────────
  for (const warning of (designIR.warnings ?? [])) {
    logs.push(makeLogEntry('info', `[IR] ${warning.message}`));
  }

  logs.push(
    makeLogEntry(
      'success',
      `IR built: ${designIR.screens.length} screens, ${designIR.components.length} components, ` +
      `${designIR.assets.length} assets, ${designIR.meta.stats.tokenCount} tokens`
    )
  );

  return {
    designIR,
    currentStep: 'IRBuilderAgent',
    logs,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

import type { LayoutHint } from '../types.js';

/** Apply vision LLM hints to correct element types and layout directions. */
function applyVisualHints(
  el: IRElement,
  iconSet: Set<string>,
  imageSet: Set<string>,
  hintMap: Map<string, LayoutHint>
): void {
  if (iconSet.has(el.id) && el.type !== 'icon') {
    (el as { type: string }).type = 'icon';
  }
  if (imageSet.has(el.id) && el.type !== 'image') {
    (el as { type: string }).type = 'image';
  }
  const hint = hintMap.get(el.id);
  if (hint && el.layout?.flex) {
    el.layout.flex.direction = hint.direction;
  }
  for (const child of el.children) {
    applyVisualHints(child, iconSet, imageSet, hintMap);
  }
}

/**
 * Recursively walks an element tree and sets image.src from the resolved URL map.
 */
function updateImageSrcs(
  roots: IRElement[],
  urlMap: Record<string, string>
): void {
  const walk = (el: IRElement): void => {
    if (el.image?.nodeId) {
      const url = urlMap[el.image.nodeId];
      if (url) el.image.src = url;
    }
    for (const child of el.children) walk(child);
  };
  for (const root of roots) walk(root);
}
