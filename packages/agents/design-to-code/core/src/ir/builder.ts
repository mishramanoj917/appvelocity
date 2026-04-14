/**
 * IR Builder
 *
 * Transforms parsed Figma data → DesignIR.
 *
 * Robust against real-world "messy" Figma files:
 *   1. Token inference  — scans inline styles when no design variables are present
 *   2. Asset extraction — detects IMAGE fills and collects node IDs for CDN export
 *   3. Layout reconstruction — converts absolute-positioned siblings into flex containers
 *   4. IR warnings     — non-fatal messages attached to the IR instead of throwing
 */

import { figmaColorToHex, figmaColorToRgba } from '../utils/color.js';
import { createLogger } from '../utils/logger.js';
import {
  parseVariables,
  parseComponents,
  parseAutoLayout,
  classifyNode,
  extractScreens,
  type DesignToken,
} from '../figma/parsers.js';
import type { FigmaFile, FigmaNode, FigmaVariablesResponse } from '../figma/types.js';
import type {
  DesignIR,
  IRTokenSet,
  IRColorToken,
  IRTypographyToken,
  IRShadowToken,
  IRScreen,
  IRComponent,
  IRElement,
  IRElementType,
  IRLayout,
  IRStyle,
  IRAsset,
  IRMeta,
  IRWarning,
} from './types.js';
import type { ParsedAutoLayout } from '../figma/parsers.js';

const log = createLogger('IRBuilder');

/** Minimum occurrences of an inline style value before it becomes an inferred token. */
const TOKEN_INFERENCE_THRESHOLD = 3;

// ─── Builder ──────────────────────────────────────────────────────────────────

export class IRBuilder {

  build(
    file: FigmaFile,
    fileKey: string,
    variablesResponse?: FigmaVariablesResponse
  ): DesignIR {
    const start = Date.now();
    log.info('Building IR', { fileKey, fileName: file.name });

    const warnings: IRWarning[] = [];

    // 1. Tokens — use design variables when available, otherwise infer from inline styles
    const rawTokens = variablesResponse ? parseVariables(variablesResponse) : [];
    let tokens = this.buildTokenSet(rawTokens);

    if (rawTokens.length === 0) {
      const { inferred, warning } = this.inferTokens(file);
      tokens = mergeTokenSets(tokens, inferred);
      if (warning) warnings.push(warning);
    }

    // 2. Screens (asset collector + warnings passed by reference)
    const collectedAssets: IRAsset[] = [];
    const screenNodes = extractScreens(file);
    const screens = screenNodes.map((n) => this.buildScreen(n, collectedAssets, warnings));

    // 3. Components
    const parsedComponents = parseComponents(file);
    const components = parsedComponents
      .filter((c) => c.atomicLevel !== 'screen')
      .map((c) => this.buildComponent(c.node, c, collectedAssets, warnings));

    // 4. Assets detected during element traversal
    const assets = collectedAssets;
    if (assets.length > 0 && !warnings.some((w) => w.code === 'ASSETS_DETECTED')) {
      warnings.push({
        code: 'ASSETS_DETECTED',
        message: `${assets.length} image node(s) detected — asset extraction required (GET /v1/images).`,
        nodeCount: assets.length,
      });
    }

    // 5. Meta
    const meta: IRMeta = {
      generatedAt: new Date().toISOString(),
      figmaVersion: String(file.schemaVersion),
      schemaVersion: '1.0',
      stats: {
        screenCount: screens.length,
        componentCount: components.length,
        tokenCount: rawTokens.length,
        assetCount: assets.length,
      },
    };

    log.info(`IR built in ${Date.now() - start}ms`, { ...meta.stats, warnings: warnings.length });

    return {
      fileKey,
      fileName: file.name,
      lastModified: file.lastModified,
      tokens,
      screens,
      components,
      assets,
      warnings,
      meta,
    };
  }

  // ─── Token set ─────────────────────────────────────────────────────────────

  private buildTokenSet(rawTokens: DesignToken[]): IRTokenSet {
    const colors: Record<string, IRColorToken> = {};
    const typography: Record<string, IRTypographyToken> = {};
    const spacing: Record<string, number> = {};
    const radii: Record<string, number> = {};
    const shadows: Record<string, IRShadowToken> = {};

    for (const token of rawTokens) {
      const key = token.path;

      switch (token.type) {
        case 'color': {
          const hex = token.resolvedValue ?? String(token.value);
          colors[key] = {
            hex,
            rgba: hexToRgba(hex),
            path: token.path,
            isAlias: token.isAlias,
            aliasPath: token.aliasId,
          };
          break;
        }
        case 'spacing':
          if (typeof token.value === 'number') spacing[key] = token.value;
          break;
        case 'radius':
          if (typeof token.value === 'number') radii[key] = token.value;
          break;
        case 'shadow':
          // Shadows arrive as raw values for now
          break;
        case 'typography':
          // Typography tokens resolved in style extraction
          break;
      }
    }

    return { colors, typography, spacing, radii, shadows, raw: rawTokens };
  }

  // ─── Token inference ───────────────────────────────────────────────────────

  /**
   * Scans all node inline styles and extracts tokens for values that appear
   * at least TOKEN_INFERENCE_THRESHOLD times.
   */
  private inferTokens(
    file: FigmaFile
  ): { inferred: Partial<IRTokenSet>; warning: IRWarning } {
    const colorFreq = new Map<string, number>();
    const fontSizeFreq = new Map<number, number>();
    const spacingFreq = new Map<number, number>();
    const radiusFreq = new Map<number, number>();

    const inc = <K>(map: Map<K, number>, key: K) =>
      map.set(key, (map.get(key) ?? 0) + 1);

    const walkNode = (node: FigmaNode): void => {
      // Fill colors
      for (const fill of node.fills ?? []) {
        if (fill.type === 'SOLID' && fill.visible !== false && fill.color) {
          const hex = figmaColorToHex(fill.color);
          if (hex !== '#00000000') inc(colorFreq, hex);
        }
      }
      // Stroke colors
      for (const stroke of node.strokes ?? []) {
        if (stroke.type === 'SOLID' && stroke.visible !== false && stroke.color) {
          inc(colorFreq, figmaColorToHex(stroke.color));
        }
      }
      // Text styles
      if (node.type === 'TEXT') {
        if (node.style?.fontSize) inc(fontSizeFreq, node.style.fontSize);
      }
      // Spacing (gap + padding)
      if (node.itemSpacing && node.itemSpacing > 0) inc(spacingFreq, node.itemSpacing);
      for (const pad of [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]) {
        if (pad && pad > 0) inc(spacingFreq, pad);
      }
      // Corner radii
      if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
        inc(radiusFreq, node.cornerRadius);
      }
      for (const child of node.children ?? []) walkNode(child);
    };

    walkNode(file.document);

    const above = <K>(map: Map<K, number>): [K, number][] =>
      [...map.entries()]
        .filter(([, count]) => count >= TOKEN_INFERENCE_THRESHOLD)
        .sort((a, b) => b[1] - a[1]);

    // Colors
    const colors: Record<string, IRColorToken> = {};
    const colorNames = ['primary', 'secondary', 'tertiary', 'accent', 'neutral'];
    above(colorFreq).forEach(([hex], i) => {
      const name = `inferred.colors.${colorNames[i] ?? `color${i + 1}`}`;
      colors[name] = { hex, rgba: hexToRgba(hex), path: name, isAlias: false };
    });

    // Typography (font sizes, sorted largest → smallest)
    const typography: Record<string, IRTypographyToken> = {};
    const sizeNames = ['xl', 'lg', 'md', 'sm', 'xs'];
    [...fontSizeFreq.entries()]
      .filter(([, count]) => count >= TOKEN_INFERENCE_THRESHOLD)
      .sort((a, b) => b[0] - a[0])
      .forEach(([size], i) => {
        const name = `inferred.typography.size${sizeNames[i] ?? `size${i + 1}`}`;
        typography[name] = { fontFamily: 'System', fontSize: size, fontWeight: 400, path: name };
      });

    // Spacing (sorted smallest → largest)
    const spacing: Record<string, number> = {};
    const spacingNames = ['xs', 'sm', 'md', 'lg', 'xl'];
    [...spacingFreq.entries()]
      .filter(([, count]) => count >= TOKEN_INFERENCE_THRESHOLD)
      .sort((a, b) => a[0] - b[0])
      .forEach(([value], i) => {
        spacing[`inferred.spacing.${spacingNames[i] ?? `sp${i + 1}`}`] = value;
      });

    // Radii (sorted smallest → largest)
    const radii: Record<string, number> = {};
    above(radiusFreq).sort((a, b) => a[0] - b[0]).forEach(([value], i) => {
      radii[`inferred.radii.r${i + 1}`] = value;
    });

    const totalInferred =
      Object.keys(colors).length +
      Object.keys(typography).length +
      Object.keys(spacing).length +
      Object.keys(radii).length;

    const warning: IRWarning =
      totalInferred > 0
        ? {
            code: 'TOKENS_INFERRED',
            message:
              `No design tokens found — inferred ${totalInferred} tokens automatically ` +
              `(${Object.keys(colors).length} colors, ${Object.keys(typography).length} font sizes, ` +
              `${Object.keys(spacing).length} spacing, ${Object.keys(radii).length} radii).`,
            nodeCount: totalInferred,
          }
        : {
            code: 'NO_TOKENS',
            message: 'No design tokens found and none could be inferred from inline styles.',
            nodeCount: 0,
          };

    return { inferred: { colors, typography, spacing, radii }, warning };
  }

  // ─── Screen ────────────────────────────────────────────────────────────────

  private buildScreen(
    node: FigmaNode,
    assets: IRAsset[],
    warnings: IRWarning[]
  ): IRScreen {
    const elementIndex: Record<string, IRElement> = {};
    const root = this.buildElement(node, elementIndex, assets, warnings);
    const bounds = node.absoluteBoundingBox;

    return {
      id: node.id,
      name: node.name,
      componentName: toComponentName(node.name),
      width: bounds?.width ?? 375,
      height: bounds?.height ?? 812,
      root,
      elementIndex,
    };
  }

  // ─── Component ─────────────────────────────────────────────────────────────

  private buildComponent(
    node: FigmaNode,
    parsed: { atomicLevel: string; variants: Record<string, string>; description: string },
    assets: IRAsset[],
    warnings: IRWarning[]
  ): IRComponent {
    const elementIndex: Record<string, IRElement> = {};
    const defaultVariant = this.buildElement(node, elementIndex, assets, warnings);

    return {
      id: node.id,
      name: node.name,
      componentName: toComponentName(node.name.split('/').pop() ?? node.name),
      atomicLevel: (parsed.atomicLevel as IRComponent['atomicLevel']) ?? 'atom',
      variants: [],
      defaultVariant,
    };
  }

  // ─── Element ────────────────────────────────────────────────────────────────

  private buildElement(
    node: FigmaNode,
    index: Record<string, IRElement>,
    assets: IRAsset[],
    warnings: IRWarning[]
  ): IRElement {
    const classification = classifyNode(node);
    const style = this.buildStyle(node);

    // Detect IMAGE fills before type resolution so we can override the type
    const isImageFill = (node.fills ?? []).some(
      (f) => f.type === 'IMAGE' && f.visible !== false
    );
    const visibleChildCount = (node.children ?? []).filter(
      (c) => c.visible !== false
    ).length;

    let type = nodeTypeToIRType(node, classification);
    if (isImageFill) {
      // Standalone image node (no children) → Image widget
      // Image with overlaid content (children present) → ImageBackground wrapper
      type = visibleChildCount === 0 ? 'image' : 'imagebackground';
    }

    // Determine flex layout — reconstruct from absolute positions if needed
    const { flex, reconstructed } = this.resolveFlexLayout(node, warnings);
    const layout = this.buildLayoutWithFlex(node, flex);

    const element: IRElement = {
      id: node.id,
      type,
      name: node.name,
      classification,
      layout,
      style,
      children: (node.children ?? [])
        .filter((child) => child.visible !== false)
        .map((child) => this.buildElement(child, index, assets, warnings)),
    };

    // Absolute-position child elements when reconstruction was NOT possible
    if (!reconstructed && layout.flex.direction === 'none' && element.children.length > 0) {
      const parentBounds = node.absoluteBoundingBox;
      if (parentBounds) {
        element.children.forEach((child, i) => {
          const childNode = (node.children ?? [])[i];
          const cb = childNode?.absoluteBoundingBox;
          if (cb) {
            child.layout = {
              ...child.layout,
              position: 'absolute',
              top: cb.y - parentBounds.y,
              left: cb.x - parentBounds.x,
            };
          }
        });
      }
    }

    // Text content
    if (node.type === 'TEXT' && node.characters !== undefined) {
      element.text = {
        value: node.characters,
        style: {
          fontFamily: node.style?.fontFamily ?? 'System',
          fontSize: node.style?.fontSize ?? 14,
          fontWeight: node.style?.fontWeight ?? 400,
          lineHeight: node.style?.lineHeightPx,
          letterSpacing: node.style?.letterSpacing,
          path: '',
          color: node.fills?.[0]?.color
            ? figmaColorToHex(node.fills[0].color)
            : '#000000',
          textAlign: mapTextAlign(node.style?.textAlignHorizontal),
        },
      };
    }

    // Image / icon reference (isImageFill already declared above)
    if (
      classification === 'image' ||
      isImageFill ||
      (classification === 'icon' && node.type !== 'TEXT')
    ) {
      const format: 'svg' | 'png' =
        classification === 'icon' && !isImageFill ? 'svg' : 'png';
      element.image = {
        nodeId: node.id,
        alt: node.name,
        format,
      };

      // Collect asset for CDN export
      const slug = toSlug(node.name);
      if (!assets.some((a) => a.nodeId === node.id)) {
        assets.push({
          id: node.id,
          nodeId: node.id,
          name: node.name,
          slug,
          format,
        });
      }
    }

    index[node.id] = element;
    return element;
  }

  // ─── Flex layout resolution ────────────────────────────────────────────────

  /**
   * Returns the best flex layout for a node.
   * If the node uses Figma Auto Layout, returns it directly.
   * Otherwise, attempts to reconstruct a flex direction from child positions.
   */
  private resolveFlexLayout(
    node: FigmaNode,
    warnings: IRWarning[]
  ): { flex: ParsedAutoLayout; reconstructed: boolean } {
    const flex = parseAutoLayout(node);

    if (flex.direction !== 'none') {
      // Already has explicit Auto Layout — nothing to reconstruct
      return { flex, reconstructed: false };
    }

    const visibleChildren = (node.children ?? []).filter(
      (c) => c.visible !== false && c.absoluteBoundingBox
    );
    if (visibleChildren.length < 2) {
      return { flex, reconstructed: false };
    }

    const reconstructed = this.reconstructFlexLayout(visibleChildren);
    if (!reconstructed) {
      return { flex, reconstructed: false };
    }

    // Emit warning once per IR build
    if (!warnings.some((w) => w.code === 'LAYOUT_RECONSTRUCTED')) {
      warnings.push({
        code: 'LAYOUT_RECONSTRUCTED',
        message:
          'Absolute layout detected — reconstructed flex layout from child positions.',
      });
    }

    return { flex: reconstructed, reconstructed: true };
  }

  /**
   * Infers a flex direction (row / column) from the absolute positions of
   * sibling nodes.  Returns null when elements overlap (absolute positioning
   * must be preserved).
   */
  private reconstructFlexLayout(
    children: FigmaNode[]
  ): ParsedAutoLayout | null {
    // Reject if any two siblings overlap
    if (this.hasOverlappingNodes(children)) return null;

    // Compute centre points
    const centres = children.map((n) => ({
      cx: n.absoluteBoundingBox!.x + n.absoluteBoundingBox!.width / 2,
      cy: n.absoluteBoundingBox!.y + n.absoluteBoundingBox!.height / 2,
    }));

    const ys = centres.map((c) => c.cy);
    const ySpread = Math.max(...ys) - Math.min(...ys);

    // If all centers share roughly the same Y → row, otherwise column
    const direction: 'row' | 'column' = ySpread <= 20 ? 'row' : 'column';

    // Calculate median gap between consecutive elements along the main axis
    let gap = 0;
    if (direction === 'column') {
      const sorted = [...children].sort(
        (a, b) => a.absoluteBoundingBox!.y - b.absoluteBoundingBox!.y
      );
      const gaps = sorted
        .slice(1)
        .map((n, i) => {
          const prev = sorted[i]!;
          return (
            n.absoluteBoundingBox!.y -
            (prev.absoluteBoundingBox!.y + prev.absoluteBoundingBox!.height)
          );
        })
        .filter((g) => g > 0);
      if (gaps.length) gap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    } else {
      const sorted = [...children].sort(
        (a, b) => a.absoluteBoundingBox!.x - b.absoluteBoundingBox!.x
      );
      const gaps = sorted
        .slice(1)
        .map((n, i) => {
          const prev = sorted[i]!;
          return (
            n.absoluteBoundingBox!.x -
            (prev.absoluteBoundingBox!.x + prev.absoluteBoundingBox!.width)
          );
        })
        .filter((g) => g > 0);
      if (gaps.length) gap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }

    return {
      direction,
      mainAxisAlignment: 'start',
      crossAxisAlignment: 'start',
      gap,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      wrap: false,
    };
  }

  /** True when any two nodes in the list have overlapping bounding boxes. */
  private hasOverlappingNodes(nodes: FigmaNode[]): boolean {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!.absoluteBoundingBox!;
        const b = nodes[j]!.absoluteBoundingBox!;
        if (
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
        ) {
          return true;
        }
      }
    }
    return false;
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  private buildLayoutWithFlex(node: FigmaNode, flex: ParsedAutoLayout): IRLayout {
    const bounds = node.absoluteBoundingBox;
    return {
      flex,
      width: bounds?.width,
      height: bounds?.height,
    };
  }

  // ─── Style ─────────────────────────────────────────────────────────────────

  private buildStyle(node: FigmaNode): IRStyle {
    const style: IRStyle = {};

    // Background (skip IMAGE fills here — handled as element.image)
    const solidFill = node.fills?.find((f) => f.type === 'SOLID' && f.visible !== false);
    if (solidFill?.color) {
      const hex = figmaColorToHex(solidFill.color);
      if (hex !== '#00000000') {
        style.backgroundColor = hex;
        if (solidFill.opacity !== undefined && solidFill.opacity < 1) {
          style.opacity = solidFill.opacity;
        }
      }
    }

    // Border
    const solidStroke = node.strokes?.find((s) => s.type === 'SOLID' && s.visible !== false);
    if (solidStroke?.color) {
      style.borderColor = figmaColorToHex(solidStroke.color);
      style.borderWidth = 1;
    }

    // Corner radius
    if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
      style.borderRadius = node.cornerRadius;
    } else if (
      node.topLeftRadius || node.topRightRadius ||
      node.bottomRightRadius || node.bottomLeftRadius
    ) {
      style.borderRadius = {
        topLeft: node.topLeftRadius ?? 0,
        topRight: node.topRightRadius ?? 0,
        bottomRight: node.bottomRightRadius ?? 0,
        bottomLeft: node.bottomLeftRadius ?? 0,
      };
    }

    // Shadow (first drop shadow only)
    const dropShadow = node.effects?.find(
      (e) => e.type === 'DROP_SHADOW' && e.visible !== false
    );
    if (dropShadow) {
      style.shadow = {
        x: dropShadow.offset?.x ?? 0,
        y: dropShadow.offset?.y ?? 2,
        blur: dropShadow.radius ?? 4,
        color: dropShadow.color ? figmaColorToRgba(dropShadow.color) : 'rgba(0,0,0,0.2)',
      };
    }

    // Overflow (clips children for FRAME with clips)
    if (node.type === 'FRAME') {
      style.overflow = 'hidden';
    }

    return style;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "My Screen Name" → "MyScreenName" */
function toComponentName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/** "Hero Image / Banner" → "hero_image_banner" */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\/\s*/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function nodeTypeToIRType(node: FigmaNode, cls: string): IRElementType {
  if (node.type === 'TEXT') return 'text';
  if (cls === 'image') return 'image';
  if (cls === 'icon') return 'icon';
  if (node.type === 'INSTANCE') return 'component-instance';
  return 'view';
}

function mapTextAlign(
  figmaAlign?: string
): NonNullable<IRElement['text']>['style']['textAlign'] {
  switch (figmaAlign) {
    case 'CENTER': return 'center';
    case 'RIGHT': return 'right';
    case 'JUSTIFIED': return 'justify';
    default: return 'left';
  }
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
  };
}

function mergeTokenSets(base: IRTokenSet, inferred: Partial<IRTokenSet>): IRTokenSet {
  return {
    colors:     { ...base.colors,     ...(inferred.colors     ?? {}) },
    typography: { ...base.typography, ...(inferred.typography ?? {}) },
    spacing:    { ...base.spacing,    ...(inferred.spacing    ?? {}) },
    radii:      { ...base.radii,      ...(inferred.radii      ?? {}) },
    shadows:    { ...base.shadows },
    raw:        base.raw,
  };
}
