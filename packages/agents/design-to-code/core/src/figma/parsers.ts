/**
 * Figma Parsers
 *
 * Transforms raw Figma API responses into normalised, typed structures
 * ready for the IR builder (Phase 2).
 *
 * Each parser is a pure function — no side effects, no API calls.
 */

import { figmaColorToHex } from '../utils/color.js';
import { createLogger } from '../utils/logger.js';
import type {
  FigmaFile,
  FigmaNode,
  FigmaVariable,
  FigmaVariablesResponse,
  FigmaColor,
  FigmaVariableValue,
} from './types.js';

const log = createLogger('FigmaParsers');

// ─── Output types ─────────────────────────────────────────────────────────────

export type TokenType = 'color' | 'typography' | 'spacing' | 'radius' | 'shadow' | 'opacity';

export interface DesignToken {
  id: string;
  name: string;
  /** Dot-notation path, e.g. "colors.primary.500" */
  path: string;
  type: TokenType;
  value: string | number;
  /** Resolved hex/rgba for colors */
  resolvedValue?: string;
  /** True if this is an alias pointing at another token */
  isAlias: boolean;
  aliasId?: string;
  collectionName?: string;
  modeName?: string;
  description?: string;
}

export interface ParsedComponent {
  id: string;
  name: string;
  description: string;
  /** e.g. "Button" from a set like "Button/Primary/Large" */
  componentSetName?: string;
  variants: Record<string, string>;
  /** Atomic design level */
  atomicLevel: 'atom' | 'molecule' | 'organism' | 'template' | 'screen';
  node: FigmaNode;
}

export interface ParsedAutoLayout {
  direction: 'row' | 'column' | 'none';
  mainAxisAlignment: 'start' | 'center' | 'end' | 'space-between';
  crossAxisAlignment: 'start' | 'center' | 'end' | 'stretch';
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  wrap: boolean;
}

export type NodeClassification =
  | 'screen'
  | 'organism'
  | 'molecule'
  | 'atom'
  | 'icon'
  | 'image'
  | 'text'
  | 'shape'
  | 'unknown';

// ─── 1. Variables / Design Tokens ─────────────────────────────────────────────

/**
 * Extracts all design tokens from a Figma Variables response.
 * Resolves alias chains so consumers always get a concrete value.
 */
export function parseVariables(response: FigmaVariablesResponse): DesignToken[] {
  const { variables, variableCollections } = response.meta;
  const tokens: DesignToken[] = [];
  const variableMap = new Map(Object.entries(variables));

  for (const [, variable] of variableMap) {
    const collection = variableCollections[variable.variableCollectionId];
    if (!collection) continue;

    const defaultMode = collection.modes.find(
      (m) => m.modeId === collection.defaultModeId
    );

    for (const [modeId, rawValue] of Object.entries(variable.valuesByMode)) {
      const mode = collection.modes.find((m) => m.modeId === modeId);

      const isAlias =
        typeof rawValue === 'object' &&
        rawValue !== null &&
        'type' in rawValue &&
        (rawValue as { type: string }).type === 'VARIABLE_ALIAS';

      const aliasId = isAlias
        ? (rawValue as { type: 'VARIABLE_ALIAS'; id: string }).id
        : undefined;

      const resolvedRaw = isAlias
        ? resolveAlias(aliasId!, variableMap)
        : rawValue;

      const token: DesignToken = {
        id: variable.id,
        name: variable.name,
        path: toTokenPath(variable.name),
        type: inferTokenType(variable),
        value: formatValue(resolvedRaw, variable.resolvedType),
        resolvedValue:
          variable.resolvedType === 'COLOR' && isColor(resolvedRaw)
            ? figmaColorToHex(resolvedRaw)
            : undefined,
        isAlias,
        aliasId,
        collectionName: collection.name,
        modeName: mode?.name ?? defaultMode?.name,
        description: variable.description,
      };

      tokens.push(token);
    }
  }

  log.debug(`Parsed ${tokens.length} design tokens`);
  return tokens;
}

// ─── 2. Components ────────────────────────────────────────────────────────────

/**
 * Walks the node tree and extracts all COMPONENT and COMPONENT_SET nodes.
 */
export function parseComponents(file: FigmaFile): ParsedComponent[] {
  const components: ParsedComponent[] = [];

  function walk(node: FigmaNode): void {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      const nameParts = node.name.split('/').map((p) => p.trim());
      const setName = nameParts.length > 1 ? nameParts[0] : undefined;
      const variants = parseVariantProperties(node.name);

      components.push({
        id: node.id,
        name: node.name,
        description: file.components[node.id]?.description ?? '',
        componentSetName: setName,
        variants,
        atomicLevel: classifyAtomicLevel(node),
        node,
      });
    }

    node.children?.forEach(walk);
  }

  walk(file.document);
  log.debug(`Parsed ${components.length} components`);
  return components;
}

// ─── 3. Auto-layout ───────────────────────────────────────────────────────────

/**
 * Converts a Figma auto-layout node into a normalised flex model.
 * Always returns a value — non-auto-layout nodes return direction: 'none'.
 */
export function parseAutoLayout(node: FigmaNode): ParsedAutoLayout {
  if (!node.layoutMode || node.layoutMode === 'NONE') {
    return {
      direction: 'none',
      mainAxisAlignment: 'start',
      crossAxisAlignment: 'start',
      gap: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      wrap: false,
    };
  }

  return {
    direction: node.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
    mainAxisAlignment: mapPrimaryAxisAlignment(
      (node as NodeWithLayout).primaryAxisAlignItems
    ),
    crossAxisAlignment: mapCounterAxisAlignment(
      (node as NodeWithLayout).counterAxisAlignItems
    ),
    gap: node.itemSpacing ?? 0,
    padding: {
      top: node.paddingTop ?? 0,
      right: node.paddingRight ?? 0,
      bottom: node.paddingBottom ?? 0,
      left: node.paddingLeft ?? 0,
    },
    wrap: (node as NodeWithLayout).layoutWrap === 'WRAP',
  };
}

// ─── 4. Node classification ───────────────────────────────────────────────────

/**
 * Classifies any Figma node into a semantic category.
 * Used by the IR builder to decide what code to generate.
 */
export function classifyNode(node: FigmaNode): NodeClassification {
  const name = node.name.toLowerCase();

  // Explicit type overrides
  if (node.type === 'TEXT') return 'text';
  if (node.type === 'VECTOR' || node.type === 'LINE' || node.type === 'ELLIPSE') {
    return (name.includes('icon') || /^ic[_\-]/.test(name)) ? 'icon' : 'shape';
  }

  // Name-based heuristics (ordered most-specific first)
  if (name.includes('screen') || name.includes('page') || name.includes('view')) {
    return 'screen';
  }
  if (name.includes('icon') || name.includes('svg')) return 'icon';
  if (name.includes('image') || name.includes('photo') || name.includes('banner')) {
    return 'image';
  }

  // Size heuristics for frames / groups
  const bounds = node.absoluteBoundingBox;
  if (bounds) {
    const area = bounds.width * bounds.height;

    if (bounds.width >= 320 && bounds.height >= 480) return 'screen';

    if (area < 64 * 64) return 'atom';           // small → atom (icon, badge)
    if (area < 200 * 200) return 'molecule';       // medium → molecule (card, button)
    if (area < 500 * 500) return 'organism';       // large → organism (list, form)
    return 'screen';
  }

  // Depth heuristic — shallow nodes tend to be organisms/screens
  const depth = countDescendants(node);
  if (depth === 0) return 'atom';
  if (depth < 5) return 'molecule';
  if (depth < 20) return 'organism';
  return 'screen';
}

/**
 * Extracts all screen-level nodes (top-level frames on canvases).
 */
export function extractScreens(file: FigmaFile): FigmaNode[] {
  const screens: FigmaNode[] = [];

  for (const canvas of file.document.children ?? []) {
    if (canvas.type !== 'CANVAS') continue;
    for (const child of canvas.children ?? []) {
      if (child.type === 'FRAME') {
        screens.push(child);
      }
    }
  }

  log.debug(`Found ${screens.length} screen frames`);
  return screens;
}

// ─── 5. Alias resolution ──────────────────────────────────────────────────────

/**
 * Follows an alias chain to its terminal value.
 * Prevents infinite loops with a depth guard.
 */
export function resolveAlias(
  aliasId: string,
  variableMap: Map<string, FigmaVariable>,
  depth = 0
): FigmaVariableValue {
  if (depth > 10) {
    log.warn('Variable alias chain exceeds depth 10, returning raw id', { aliasId });
    return aliasId;
  }

  const target = variableMap.get(aliasId);
  if (!target) return aliasId;

  const [, firstValue] = Object.entries(target.valuesByMode)[0] ?? [];
  if (!firstValue) return aliasId;

  const isAliasValue =
    typeof firstValue === 'object' &&
    firstValue !== null &&
    'type' in firstValue &&
    (firstValue as { type: string }).type === 'VARIABLE_ALIAS';

  if (isAliasValue) {
    return resolveAlias(
      (firstValue as { type: 'VARIABLE_ALIAS'; id: string }).id,
      variableMap,
      depth + 1
    );
  }

  return firstValue;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toTokenPath(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\/\s*/g, '.')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '');
}

function inferTokenType(variable: FigmaVariable): TokenType {
  const name = variable.name.toLowerCase();
  if (variable.resolvedType === 'COLOR') return 'color';
  if (name.includes('spacing') || name.includes('gap') || name.includes('padding')) return 'spacing';
  if (name.includes('radius') || name.includes('corner')) return 'radius';
  if (name.includes('font') || name.includes('text') || name.includes('type')) return 'typography';
  if (name.includes('shadow') || name.includes('elevation')) return 'shadow';
  if (name.includes('opacity') || name.includes('alpha')) return 'opacity';
  return 'spacing'; // default for FLOAT
}

function formatValue(value: FigmaVariableValue, type: FigmaVariable['resolvedType']): string | number {
  if (type === 'COLOR' && isColor(value)) return figmaColorToHex(value);
  if (type === 'FLOAT' && typeof value === 'number') return value;
  if (type === 'STRING' && typeof value === 'string') return value;
  if (type === 'BOOLEAN') return String(value);
  return String(value);
}

function isColor(value: FigmaVariableValue): value is FigmaColor {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value
  );
}

function parseVariantProperties(name: string): Record<string, string> {
  const parts = name.split('/').map((p) => p.trim());
  if (parts.length <= 1) return {};

  const variants: Record<string, string> = {};
  parts.slice(1).forEach((part, i) => {
    if (part.includes('=')) {
      const [key, val] = part.split('=').map((s) => s.trim());
      if (key) variants[key] = val ?? '';
    } else {
      variants[`variant${i}`] = part;
    }
  });
  return variants;
}

function classifyAtomicLevel(
  node: FigmaNode
): ParsedComponent['atomicLevel'] {
  const name = node.name.toLowerCase();
  if (name.includes('screen') || name.includes('page')) return 'screen';
  if (name.includes('template') || name.includes('layout')) return 'template';

  const depth = countDescendants(node);
  if (depth === 0) return 'atom';
  if (depth < 4) return 'molecule';
  if (depth < 15) return 'organism';
  return 'template';
}

function countDescendants(node: FigmaNode): number {
  if (!node.children?.length) return 0;
  return node.children.reduce(
    (sum, child) => sum + 1 + countDescendants(child),
    0
  );
}

function mapPrimaryAxisAlignment(
  value?: string
): ParsedAutoLayout['mainAxisAlignment'] {
  switch (value) {
    case 'CENTER': return 'center';
    case 'MAX': return 'end';
    case 'SPACE_BETWEEN': return 'space-between';
    default: return 'start';
  }
}

function mapCounterAxisAlignment(
  value?: string
): ParsedAutoLayout['crossAxisAlignment'] {
  switch (value) {
    case 'CENTER': return 'center';
    case 'MAX': return 'end';
    case 'STRETCH': return 'stretch';
    default: return 'start';
  }
}

// Internal type extension for layout properties not in the base FigmaNode
interface NodeWithLayout extends FigmaNode {
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  layoutWrap?: 'NO_WRAP' | 'WRAP';
}
