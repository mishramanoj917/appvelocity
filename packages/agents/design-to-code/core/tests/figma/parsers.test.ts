import { describe, it, expect } from 'vitest';
import {
  parseVariables,
  parseComponents,
  parseAutoLayout,
  classifyNode,
  extractScreens,
  resolveAlias,
} from '../../src/figma/parsers.js';
import {
  MOCK_FIGMA_FILE,
  MOCK_VARIABLES_RESPONSE,
} from '../fixtures/figma-mocks.js';
import type { FigmaNode } from '../../src/figma/types.js';

// ─── parseVariables ───────────────────────────────────────────────────────────

describe('parseVariables', () => {
  it('returns one token per variable per mode', () => {
    const tokens = parseVariables(MOCK_VARIABLES_RESPONSE);
    // 2 colors × 2 modes + 2 spacing × 1 mode = 6
    expect(tokens.length).toBe(6);
  });

  it('marks alias tokens correctly', () => {
    const tokens = parseVariables(MOCK_VARIABLES_RESPONSE);
    expect(tokens.every((t) => typeof t.isAlias === 'boolean')).toBe(true);
  });

  it('resolves color tokens to hex', () => {
    const tokens = parseVariables(MOCK_VARIABLES_RESPONSE);
    const primaryLight = tokens.find(
      (t) => t.name === 'Colors/Primary/500' && t.modeName === 'Light'
    );
    expect(primaryLight).toBeDefined();
    expect(primaryLight?.resolvedValue).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('assigns correct type to spacing tokens', () => {
    const tokens = parseVariables(MOCK_VARIABLES_RESPONSE);
    const spacing = tokens.filter((t) => t.type === 'spacing');
    expect(spacing.length).toBe(2);
    expect(spacing[0]?.value).toBe(8);
    expect(spacing[1]?.value).toBe(16);
  });

  it('normalises token path to dot notation', () => {
    const tokens = parseVariables(MOCK_VARIABLES_RESPONSE);
    const primary = tokens.find((t) => t.name === 'Colors/Primary/500');
    expect(primary?.path).toBe('colors.primary.500');
  });

  it('returns empty array for empty response', () => {
    const empty = { meta: { variables: {}, variableCollections: {} } };
    expect(parseVariables(empty)).toEqual([]);
  });
});

// ─── parseComponents ──────────────────────────────────────────────────────────

describe('parseComponents', () => {
  it('finds all COMPONENT nodes in the tree', () => {
    const components = parseComponents(MOCK_FIGMA_FILE);
    expect(components.length).toBeGreaterThanOrEqual(1);
    expect(components.some((c) => c.name === 'Button/Primary/Large')).toBe(true);
  });

  it('extracts variant properties from slash notation', () => {
    const components = parseComponents(MOCK_FIGMA_FILE);
    const btn = components.find((c) => c.name === 'Button/Primary/Large');
    expect(btn).toBeDefined();
    expect(btn?.componentSetName).toBe('Button');
  });

  it('assigns an atomic level to each component', () => {
    const components = parseComponents(MOCK_FIGMA_FILE);
    for (const comp of components) {
      expect(['atom', 'molecule', 'organism', 'template', 'screen']).toContain(
        comp.atomicLevel
      );
    }
  });
});

// ─── parseAutoLayout ─────────────────────────────────────────────────────────

describe('parseAutoLayout', () => {
  it('returns direction:none for non-auto-layout node', () => {
    const node: FigmaNode = { id: '1', name: 'box', type: 'FRAME' };
    const result = parseAutoLayout(node);
    expect(result.direction).toBe('none');
    expect(result.gap).toBe(0);
  });

  it('maps HORIZONTAL layoutMode to row', () => {
    const node: FigmaNode = {
      id: '2',
      name: 'row',
      type: 'FRAME',
      layoutMode: 'HORIZONTAL',
      itemSpacing: 12,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 16,
      paddingRight: 16,
    };
    const result = parseAutoLayout(node);
    expect(result.direction).toBe('row');
    expect(result.gap).toBe(12);
    expect(result.padding).toEqual({ top: 8, right: 16, bottom: 8, left: 16 });
  });

  it('maps VERTICAL layoutMode to column', () => {
    const node: FigmaNode = {
      id: '3',
      name: 'col',
      type: 'FRAME',
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
    };
    expect(parseAutoLayout(node).direction).toBe('column');
  });

  it('defaults padding to 0 when not set', () => {
    const node: FigmaNode = {
      id: '4',
      name: 'no-pad',
      type: 'FRAME',
      layoutMode: 'HORIZONTAL',
    };
    const { padding } = parseAutoLayout(node);
    expect(padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

// ─── classifyNode ─────────────────────────────────────────────────────────────

describe('classifyNode', () => {
  it('classifies TEXT node as text', () => {
    const node: FigmaNode = { id: '1', name: 'Label', type: 'TEXT' };
    expect(classifyNode(node)).toBe('text');
  });

  it('classifies VECTOR node containing "icon" as icon', () => {
    const node: FigmaNode = { id: '2', name: 'ic_arrow_right', type: 'VECTOR' };
    expect(classifyNode(node)).toBe('icon');
  });

  it('classifies wide/tall FRAME as screen', () => {
    const node: FigmaNode = {
      id: '3',
      name: 'Home',
      type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 812 },
    };
    expect(classifyNode(node)).toBe('screen');
  });

  it('classifies small FRAME as atom', () => {
    const node: FigmaNode = {
      id: '4',
      name: 'dot',
      type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
    };
    expect(classifyNode(node)).toBe('atom');
  });

  it('name hint "screen" overrides size heuristic', () => {
    const node: FigmaNode = {
      id: '5',
      name: 'Login Screen',
      type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    };
    expect(classifyNode(node)).toBe('screen');
  });
});

// ─── extractScreens ───────────────────────────────────────────────────────────

describe('extractScreens', () => {
  it('returns only top-level FRAME nodes on CANVAS pages', () => {
    const screens = extractScreens(MOCK_FIGMA_FILE);
    expect(screens.length).toBe(1);
    expect(screens[0]?.id).toBe('screen:home');
    expect(screens[0]?.name).toBe('Home Screen');
  });
});

// ─── resolveAlias ─────────────────────────────────────────────────────────────

describe('resolveAlias', () => {
  it('returns the aliased variable value', () => {
    const variableMap = new Map(
      Object.entries(MOCK_VARIABLES_RESPONSE.meta.variables)
    );
    // var-primary has a direct COLOR value, not an alias
    const resolved = resolveAlias('var-primary', variableMap);
    expect(resolved).toHaveProperty('r');
  });

  it('returns aliasId as fallback when target not found', () => {
    const result = resolveAlias('non-existent-id', new Map());
    expect(result).toBe('non-existent-id');
  });
});
