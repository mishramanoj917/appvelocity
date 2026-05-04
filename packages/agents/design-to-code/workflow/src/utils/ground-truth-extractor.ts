/**
 * GroundTruthExtractor
 *
 * Reads DesignIR and writes workspace/{sessionId}/ground_truth.json.
 * This file is the reference for VisualQAAgent comparisons — it records
 * what the generated code MUST look like (tokens, component tree, assets).
 *
 * The ground truth is extracted BEFORE code generation begins so that
 * the comparison is against the original Figma intent, not the generated output.
 */

import fs   from 'node:fs';
import path from 'node:path';
import type { DesignIR, IRElement, IRAsset } from '@appvelocity/agent-design-to-code-core';
import type { SnapshotManager } from '@appvelocity/agent-design-to-code-core';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScreenGroundTruth {
  /** Screen name as it appears in the IR (e.g. "Home") */
  name: string;
  /** Figma node ID */
  nodeId: string;
  /** Figma frame PNG export URL (from snapshot.assetUrls, empty if not yet exported) */
  frameExportUrl: string;
  /** IR element tree — the canonical component hierarchy */
  componentTree: IRElement[];
  /** Design tokens used on this screen */
  tokens: {
    colors: string[];
    fontFamilies: string[];
    fontSizes: number[];
    fontWeights: (number | string)[];
    spacingValues: number[];
  };
  /** Asset references for this screen */
  assets: Array<{ nodeId: string; slug: string; type: 'image' | 'icon' }>;
}

export interface GroundTruth {
  sessionId: string;
  fileKey: string;
  fileName: string;
  extractedAt: string;
  screens: ScreenGroundTruth[];
  /** Node IDs that were excluded from the IR (status bar, battery, WiFi, signal) */
  statusBarNodeIds: string[];
  /** All global design tokens (for token diff layer) */
  globalTokens: {
    colors: string[];
    fontFamilies: string[];
    fontSizes: number[];
    spacingValues: number[];
  };
}

// ─── Extractor ────────────────────────────────────────────────────────────────

export function extractGroundTruth(
  ir: DesignIR,
  sessionId: string,
  snapshotManager: SnapshotManager,
  assetUrls: Record<string, string> = {}
): GroundTruth {
  const screens: ScreenGroundTruth[] = ir.screens.map((screen) => {
    // Collect tokens from the element tree of this screen
    const colors       = new Set<string>();
    const fontFamilies = new Set<string>();
    const fontSizes    = new Set<number>();
    const fontWeights  = new Set<number | string>();
    const spacings     = new Set<number>();

    walkElement(screen.root, colors, fontFamilies, fontSizes, fontWeights, spacings);

    // Collect asset refs in this screen's element tree
    const screenAssets: ScreenGroundTruth['assets'] = [];
    collectAssets(screen.root, ir.assets, screenAssets);

    return {
      name:            screen.name,
      nodeId:          screen.id,
      frameExportUrl:  assetUrls[screen.id] ?? '',
      componentTree:   screen.root.children,
      tokens: {
        colors:        [...colors],
        fontFamilies:  [...fontFamilies],
        fontSizes:     [...fontSizes],
        fontWeights:   [...fontWeights],
        spacingValues: [...spacings],
      },
      assets: screenAssets,
    };
  });

  // Global tokens from the IR token set
  const globalColors       = Object.values(ir.tokens.colors).map((c) => c.hex);
  const globalFontFamilies = [...new Set(
    Object.values(ir.tokens.typography).map((t) => t.fontFamily)
  )];
  const globalFontSizes = [...new Set(
    Object.values(ir.tokens.typography).map((t) => t.fontSize)
  )];
  const globalSpacings = Object.values(ir.tokens.spacing);

  const truth: GroundTruth = {
    sessionId,
    fileKey:          ir.fileKey,
    fileName:         ir.fileName,
    extractedAt:      new Date().toISOString(),
    screens,
    statusBarNodeIds: ir.statusBarNodeIds ?? [],
    globalTokens: {
      colors:        globalColors,
      fontFamilies:  globalFontFamilies,
      fontSizes:     globalFontSizes,
      spacingValues: globalSpacings,
    },
  };

  // Persist to workspace
  const outPath = snapshotManager.groundTruthPath(sessionId);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(truth, null, 2), 'utf-8');

  return truth;
}

/** Load ground truth from disk. Returns null if not found. */
export function loadGroundTruth(
  sessionId: string,
  snapshotManager: SnapshotManager
): GroundTruth | null {
  const p = snapshotManager.groundTruthPath(sessionId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as GroundTruth;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walkElement(
  el: IRElement,
  colors: Set<string>,
  fontFamilies: Set<string>,
  fontSizes: Set<number>,
  fontWeights: Set<number | string>,
  spacings: Set<number>
): void {
  if (el.style.backgroundColor) colors.add(el.style.backgroundColor);
  if (el.style.borderColor)      colors.add(el.style.borderColor);

  if (el.text) {
    const s = el.text.style;
    if (s.fontFamily) fontFamilies.add(s.fontFamily);
    if (s.fontSize)   fontSizes.add(s.fontSize);
    if (s.fontWeight) fontWeights.add(s.fontWeight);
    if (s.color)      colors.add(s.color);
  }

  const flex = el.layout.flex;
  if (flex.gap > 0)                spacings.add(flex.gap);
  if (flex.padding.top > 0)        spacings.add(flex.padding.top);
  if (flex.padding.bottom > 0)     spacings.add(flex.padding.bottom);
  if (flex.padding.left > 0)       spacings.add(flex.padding.left);
  if (flex.padding.right > 0)      spacings.add(flex.padding.right);

  for (const child of el.children) {
    walkElement(child, colors, fontFamilies, fontSizes, fontWeights, spacings);
  }
}

function collectAssets(
  el: IRElement,
  irAssets: IRAsset[],
  out: ScreenGroundTruth['assets']
): void {
  if (el.image?.nodeId) {
    const asset = irAssets.find((a) => a.nodeId === el.image!.nodeId);
    if (asset) {
      out.push({
        nodeId: asset.nodeId,
        slug:   asset.slug,
        type:   (el.type === 'icon' ? 'icon' : 'image') as 'image' | 'icon',
      });
    }
  }
  for (const child of el.children) {
    collectAssets(child, irAssets, out);
  }
}
