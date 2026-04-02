/**
 * IR Builder
 *
 * Transforms parsed Figma data → DesignIR.
 * This is Phase 2's central class, but the scaffold is built here in Phase 1
 * so the index and tests have something real to import.
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
} from './types.js';

const log = createLogger('IRBuilder');

// ─── Builder ──────────────────────────────────────────────────────────────────

export class IRBuilder {

  build(
    file: FigmaFile,
    fileKey: string,
    variablesResponse?: FigmaVariablesResponse
  ): DesignIR {
    const start = Date.now();
    log.info('Building IR', { fileKey, fileName: file.name });

    // 1. Tokens
    const rawTokens = variablesResponse ? parseVariables(variablesResponse) : [];
    const tokens = this.buildTokenSet(rawTokens);

    // 2. Screens
    const screenNodes = extractScreens(file);
    const screens = screenNodes.map((n) => this.buildScreen(n));

    // 3. Components
    const parsedComponents = parseComponents(file);
    const components = parsedComponents
      .filter((c) => c.atomicLevel !== 'screen')
      .map((c) => this.buildComponent(c.node, c));

    // 4. Assets (collected during element walking)
    const assets: IRAsset[] = [];

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

    log.info(`IR built in ${Date.now() - start}ms`, meta.stats);

    return {
      fileKey,
      fileName: file.name,
      lastModified: file.lastModified,
      tokens,
      screens,
      components,
      assets,
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
          // Shadows arrive as raw values for now; Phase 3 will parse further
          break;
        case 'typography':
          // Typography tokens resolved in Phase 3 style extraction
          break;
      }
    }

    return { colors, typography, spacing, radii, shadows, raw: rawTokens };
  }

  // ─── Screen ────────────────────────────────────────────────────────────────

  private buildScreen(node: FigmaNode): IRScreen {
    const elementIndex: Record<string, IRElement> = {};
    const root = this.buildElement(node, elementIndex);
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
    parsed: { atomicLevel: string; variants: Record<string, string>; description: string }
  ): IRComponent {
    const elementIndex: Record<string, IRElement> = {};
    const defaultVariant = this.buildElement(node, elementIndex);

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
    index: Record<string, IRElement>
  ): IRElement {
    const classification = classifyNode(node);
    const layout = this.buildLayout(node);
    const style = this.buildStyle(node);
    const type = nodeTypeToIRType(node, classification);

    const element: IRElement = {
      id: node.id,
      type,
      name: node.name,
      classification,
      layout,
      style,
      children: (node.children ?? [])
        .filter((child) => child.visible !== false)
        .map((child) => this.buildElement(child, index)),
    };

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

    // Image / icon reference
    if (
      classification === 'image' ||
      (classification === 'icon' && node.type !== 'TEXT')
    ) {
      element.image = {
        nodeId: node.id,
        alt: node.name,
        format: classification === 'icon' ? 'svg' : 'png',
      };
    }

    index[node.id] = element;
    return element;
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  private buildLayout(node: FigmaNode): IRLayout {
    const flex = parseAutoLayout(node);
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

    // Background
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
      style.borderWidth = 1; // Figma strokeWeight not in base type; default 1
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

function nodeTypeToIRType(node: FigmaNode, cls: string): IRElementType {
  if (node.type === 'TEXT') return 'text';
  if (cls === 'image') return 'image';
  if (cls === 'icon') return 'icon';
  if (node.type === 'INSTANCE') return 'component-instance';
  return 'view';
}

function mapTextAlign(
  figmaAlign?: string
): IRElement['text'] extends undefined ? never : NonNullable<IRElement['text']>['style']['textAlign'] {
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
